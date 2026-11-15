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

    await mongoose.connect(config.mongoUri);
    this.isConnected = true;
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
