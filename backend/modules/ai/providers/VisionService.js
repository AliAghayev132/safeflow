import { crypto } from "#lib";
import { resolveProvider, aiConfig, endpoints } from "./settings.js";
import { LlmService, z } from "./LlmService.js";

/**
 * Damage assessment from a photo (citizen upload or drone frame).
 * Providers:
 *   yolo      → YOLOv8 inference server (VISION_YOLO_URL) running a
 *               damage-trained model; returns { detections:[{label,
 *               confidence, box}] } — labels mapped to severity via config
 *   anthropic → Claude vision classification (structured output)
 *   mock      → deterministic pseudo-result derived from the image hash
 *               (same photo → same answer), marked mock: true
 *
 * Result: { severity: none|partial|blocked|collapsed, passable, confidence,
 *           detections, provider, mock }
 */
export const SEVERITIES = ["none", "partial", "blocked", "collapsed"];

const AssessmentSchema = z.object({
  severity: z.enum(SEVERITIES),
  passable: z.boolean(),
  confidence: z.number(),
  summary: z.string(),
  hazards: z.array(z.string()),
});

const DEFAULT_LABEL_SEVERITY = {
  collapsed_building: "collapsed",
  debris_full: "blocked",
  road_blocked: "blocked",
  fallen_tree: "partial",
  debris_partial: "partial",
  crack: "partial",
  flood_water: "partial",
  fire: "blocked",
};

const rank = (s) => SEVERITIES.indexOf(s);

const mockAssessment = (buffer) => {
  const h = crypto.createHash("sha256").update(buffer ?? Buffer.alloc(0)).digest();
  // Realistic mix for demos: 40% none, 30% partial, 20% blocked, 10% collapsed
  const bucket = h[0] % 10;
  const severity = bucket < 4 ? "none" : bucket < 7 ? "partial" : bucket < 9 ? "blocked" : "collapsed";
  const labels = {
    none: [],
    partial: ["debris_partial", "crack"],
    blocked: ["road_blocked", "debris_full"],
    collapsed: ["collapsed_building", "debris_full"],
  }[severity];
  return {
    severity,
    passable: rank(severity) <= 1,
    confidence: Math.round((0.62 + (h[1] / 255) * 0.33) * 100) / 100,
    summary: "Demo nəticəsi (mock) — real model qoşulmayıb.",
    hazards: labels,
    detections: labels.map((label, i) => ({
      label,
      confidence: Math.round((0.55 + (h[2 + i] / 255) * 0.4) * 100) / 100,
      box: [h[4 + i] % 200, h[6 + i] % 200, 200 + (h[8 + i] % 200), 200 + (h[10 + i] % 200)],
    })),
  };
};

class VisionService {
  static async assess({ buffer, mimeType = "image/jpeg", synthetic = false }) {
    const provider = resolveProvider("vision");
    const cfg = aiConfig("vision");
    const fallback = (reason) => ({ ...mockAssessment(buffer), provider: "mock", mock: true, fallbackReason: reason });
    // Synthetic survey frames (simulation) never go to a real model
    if (provider === "mock" || synthetic) return fallback(synthetic ? "synthetic_frame" : null);

    try {
      if (provider === "yolo") {
        const form = new FormData();
        form.append("image", new Blob([buffer], { type: mimeType }), "frame.jpg");
        const res = await fetch(`${endpoints.yolo()}/predict`, {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(cfg.timeoutMs ?? 20000),
        });
        if (!res.ok) throw new Error(`YOLO HTTP ${res.status}`);
        const body = await res.json();
        const map = { ...DEFAULT_LABEL_SEVERITY, ...(cfg.labelSeverity ?? {}) };
        const detections = (body.detections ?? []).filter((d) => d.confidence >= (cfg.minConfidence ?? 0.4));
        const severity = detections.reduce(
          (worst, d) => (rank(map[d.label] ?? "none") > rank(worst) ? map[d.label] : worst),
          "none",
        );
        const confidence = detections.length ? Math.max(...detections.map((d) => d.confidence)) : 0.5;
        return {
          severity,
          passable: rank(severity) <= 1,
          confidence,
          summary: `${detections.length} obyekt aşkarlandı`,
          hazards: [...new Set(detections.map((d) => d.label))],
          detections,
          provider,
          mock: false,
        };
      }

      if (provider === "anthropic") {
        const result = await LlmService.structured({
          task: "damage_assessment",
          system:
            "You assess disaster damage in photos (citizen or drone imagery) for an emergency dispatcher. " +
            "Classify how passable the road/area is: none = no damage, partial = passable with care, " +
            "blocked = road impassable, collapsed = building collapse. Be conservative: when unsure, choose the more severe class. " +
            "Return a short summary in Azerbaijani.",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: buffer.toString("base64") } },
            { type: "text", text: "Assess the damage in this image." },
          ],
          schema: AssessmentSchema,
          mock: () => mockAssessment(buffer),
        });
        return { detections: [], ...result.data, provider: result.provider, mock: result.mock, fallbackReason: result.fallbackReason };
      }
      return fallback(null);
    } catch (error) {
      console.error(`⚠️  [AI] vision via ${provider} failed — using mock:`, error.message);
      return fallback("error");
    }
  }
}

export { VisionService, mockAssessment };
