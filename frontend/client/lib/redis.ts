import "server-only";

import { createClient } from "redis";
import type { RedisClientType } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";

let client: RedisClientType | null = null;
let clientPromise: Promise<RedisClientType | null> | null = null;

async function connectClient(): Promise<RedisClientType | null> {
  try {
    const nextClient = createClient({ url: REDIS_URL });
    await nextClient.connect();
    client = nextClient;
    return nextClient;
  } catch {
    return null;
  }
}

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (client) return client;
  if (!clientPromise) {
    clientPromise = connectClient().finally(() => {
      if (!client) {
        clientPromise = null;
      }
    });
  }
  return clientPromise;
}
