import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

client.on('error', (err) => console.error('[Redis]', err));
client.on('connect', () => console.log('[Redis] connected'));

let connected = false;

async function getClient() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
  return client;
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const c = await getClient();
      const val = await c.get(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    try {
      const c = await getClient();
      await c.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch {
      // non-fatal
    }
  },

  async del(key: string): Promise<void> {
    try {
      const c = await getClient();
      await c.del(key);
    } catch {
      // non-fatal
    }
  },

  async invalidatePrefix(prefix: string): Promise<void> {
    try {
      const c = await getClient();
      const keys = await c.keys(`${prefix}*`);
      if (keys.length > 0) await c.del(keys);
    } catch {
      // non-fatal
    }
  },
};

export default client;
