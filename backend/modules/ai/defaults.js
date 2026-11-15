/**
 * Config section `ai` (admin config editor). Secrets and endpoints are NOT
 * here — they come from env (see providers/settings.js and .env.example).
 *
 * provider: "auto" = real provider when its key / URL is configured,
 * otherwise deterministic mock data (demo / offline).
 */
export const aiDefaults = {
  llm: {
    provider: "auto", // auto | anthropic | local | mock
    model: "claude-opus-5-5",
    effort: "low",
    maxTokens: 2048,
    timeoutMs: 20000,
  },
  stt: {
    provider: "auto", // auto | whisper | local | mock
    model: "whisper-1",
    timeoutMs: 30000,
    maxAudioBytes: 8388608,
  },
  vision: {
    provider: "auto", // auto | yolo | anthropic | mock
    minConfidence: 0.4,
    timeoutMs: 20000,
    maxImageBytes: 8388608,
    // Apply the result to the road network automatically when confident enough
    autoApply: true,
    autoApplyMinConfidence: 0.6,
    // Road segments within this radius of the photo are affected
    affectRadiusMeters: 120,
  },
  voice: {
    // Parsed priority → triage hints
    autoSend: true,
  },
  forecast: {
    sampleMs: 60000, // occupancy sampling step for the time series
    historySamples: 120,
    alpha: 0.5, // Holt level smoothing
    beta: 0.3, // Holt trend smoothing
    horizonsMin: [15, 30],
    warnOccupancy: 0.9,
    bottleneckPeople: 40, // people routed over one road segment
    surgeSosPerZone: 6, // predicted SOS in a zone within the horizon
  },
  chatbot: {
    maxHistory: 8,
    radiusMeters: 6000,
    maxShelters: 3,
  },
  supply: {
    horizonMin: 30,
    // A shelter is "critical" when stock covers fewer hours than this
    criticalHours: 6,
    targetHours: 24,
  },
}
