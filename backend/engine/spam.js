/**
 * SOS spam heuristics — pure. Flags, never blocks: a flagged SOS still reaches
 * the dispatcher (marked), it just doesn't inflate cluster counts.
 *
 *   repeat_device: same device sent >= deviceBurstCount SOS within deviceBurstWindowMs
 *   ip_burst:      one IP produced SOS from >= ipDeviceBurstCount distinct devices
 *                  within ipBurstWindowMs (device-id rotation)
 *
 * @param {object} p
 * @param {number} p.deviceRecentCount  SOS from this device in its window (incl. this one)
 * @param {number} p.ipDistinctDevices  distinct devices from this IP in its window (incl. this one)
 */
export const assessSpam = ({ deviceRecentCount, ipDistinctDevices }, cfg) => {
  const flags = [];
  let score = 0;
  if (deviceRecentCount >= cfg.deviceBurstCount) {
    flags.push("repeat_device");
    score += 40 + (deviceRecentCount - cfg.deviceBurstCount) * 10;
  }
  if (ipDistinctDevices >= cfg.ipDeviceBurstCount) {
    flags.push("ip_burst");
    score += 50;
  }
  score = Math.min(100, score);
  return { flags, score, flagged: score >= cfg.flagScore };
};
