import { Operator, Brigade } from "#models";
import { config } from "#config";
import { SeedService } from "./SeedService.js";

/**
 * First-boot setup: simulated city data + default staff accounts
 * (admin, dispatcher, brigade lead linked to its brigade).
 */
const bootstrap = async () => {
  if (!(await SeedService.isSeeded())) {
    await SeedService.seed();
  }

  for (const account of config.defaultOperators) {
    const { brigadeCode, ...data } = account;
    const brigade = brigadeCode ? await Brigade.findOne({ code: brigadeCode }) : null;
    const existing = await Operator.findOne({ username: data.username });
    if (!existing) {
      await Operator.create({ ...data, brigade: brigade?._id ?? null });
      if (!config.isTest) console.log(`👤 Default account created: ${data.username} (${data.role})`);
    } else {
      // Keep default accounts aligned with their configured role / brigade
      // (brigade ids change on reseed)
      let changed = false;
      if (existing.role !== data.role) {
        existing.role = data.role;
        changed = true;
      }
      if (brigade && String(existing.brigade) !== String(brigade._id)) {
        existing.brigade = brigade._id;
        changed = true;
      }
      if (changed) await existing.save();
    }
  }
};

export { bootstrap };
