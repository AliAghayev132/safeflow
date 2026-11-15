import { mongoose } from "#lib";
import { config } from "#config";

/**
 * MongoDBService (singleton) — owns the single mongoose connection.
 */
class MongoDBService {
  static instance = null;

  constructor() {
    this.isConnected = false;
  }

  static getInstance() {
    if (!MongoDBService.instance) {
      MongoDBService.instance = new MongoDBService();
    }
    return MongoDBService.instance;
  }

  async connect() {
    if (this.isConnected) return mongoose.connection;

    // Warm pool: a burst of SOS must not wait for new TCP/handshakes
    // (minPoolSize kept open; maxPoolSize caps concurrent operations)
    await mongoose.connect(config.mongoUri, {
      minPoolSize: Number(process.env.MONGO_MIN_POOL ?? 20),
      maxPoolSize: Number(process.env.MONGO_MAX_POOL ?? 100),
      // default 2 → a burst queues behind connection setup
      maxConnecting: 10,
    });
    this.isConnected = true;
    // Open the minimum pool now (parallel pings) instead of on the first burst
    const warm = Number(process.env.MONGO_MIN_POOL ?? 20);
    await Promise.all(Array.from({ length: warm }, () => mongoose.connection.db.admin().ping())).catch(() => null);
    console.log("✅ MongoDB connected");

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });
    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected");
      this.isConnected = false;
    });
    mongoose.connection.on("reconnected", () => {
      console.log("🔄 MongoDB reconnected");
      this.isConnected = true;
    });

    return mongoose.connection;
  }

  async disconnect() {
    if (!this.isConnected) return;
    await mongoose.disconnect();
    this.isConnected = false;
    console.log("🔌 MongoDB disconnected");
  }
}

const mongoDBService = MongoDBService.getInstance();

export { MongoDBService, mongoDBService };
