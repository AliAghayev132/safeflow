/**
 * SOS triage priority — pure.
 *
 * score = severity[type] × w.severity
 *       + min(headcount, cap) × w.headcount
 *       + (#vulnerable flags) × w.vulnerable
 *       + (injuries reported ? 1 : 0) × w.injuries
 *       + (#needs) × w.needs
 *
 * Severity order (config): medical > fire > collapse > flood.
 */
export const VULNERABLE_FLAGS = ["elderly", "child", "disabled"];

export const priorityScore = (sos, cfg) => {
  const w = cfg.weights;
  const severity = cfg.severity[sos.type] ?? 1;
  const headcount = Math.max(1, Math.min(cfg.headcountCap, Number(sos.headcount) || 1));
  const vulnerableCount = VULNERABLE_FLAGS.filter((f) => sos.vulnerable?.[f]).length;
  const injuries = sos.injuries && String(sos.injuries).trim() ? 1 : 0;
  const needs = Array.isArray(sos.needs) ? sos.needs.length : 0;

  const breakdown = {
    severity: severity * w.severity,
    headcount: headcount * w.headcount,
    vulnerable: vulnerableCount * w.vulnerable,
    injuries: injuries * w.injuries,
    needs: needs * w.needs,
  };
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { score: Math.round(score * 10) / 10, breakdown };
};

/** Queue order: highest score first, then oldest first. */
export const compareTriage = (a, b) =>
  (b.priority ?? 0) - (a.priority ?? 0) ||
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
