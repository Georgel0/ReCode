import { createClient } from 'redis';

// Reuse a single connection across requests instead of connect()/disconnect()
// on every call. On a warm serverless instance, module scope persists between
// invocations, so this client (and its socket) survives across many requests
// and only pays the connection/auth handshake once per cold start.

let client = null;
let connectingPromise = null;

export async function getRedisClient() {
  if (!client) {
    client = createClient({ url: process.env.KV_REDIS_URL });

    // Required: without a client-level 'error' listener, a dropped/idle
    // socket emits an unhandled 'error' event that can crash the process
    // instead of surfacing as a normal rejected promise on the next command.
    client.on('error', (err) => {
      console.error('Redis client error:', err);
    });
  }

  if (!client.isOpen) {
    // Guard against concurrent requests all trying to (re)connect the same
    // client at once (e.g. several requests landing on a cold instance).
    if (!connectingPromise) {
      connectingPromise = client.connect().finally(() => {
        connectingPromise = null;
      });
    }
    await connectingPromise;
  }

  return client;
}