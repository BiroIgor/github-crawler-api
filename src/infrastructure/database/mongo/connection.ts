import mongoose from "mongoose";
import type { Env } from "../../../config/env.js";

export async function connectMongo(env: Env): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
