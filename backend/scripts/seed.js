/**
 * Reset incidents and reload the simulated city.
 *   npm run seed
 * Operators are kept.
 */
import { mongoDBService, SeedService, bootstrap } from "#services";

const run = async () => {
  await mongoDBService.connect();
  await SeedService.reseed();
  await bootstrap();
  await mongoDBService.disconnect();
  console.log("✅ Seed complete");
};

run().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
