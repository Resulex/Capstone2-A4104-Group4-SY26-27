import mongoose from 'mongoose';

/**
 * Global cached connection.
 *
 * In a serverless environment, the Lambda container may be reused across
 * invocations (warm starts). Caching the Mongoose connection avoids opening
 * a new connection (and TCP/TLS handshake) on every warm invocation.
 *
 * IMPORTANT: Keep the connection outside the handler so it persists for the
 * lifetime of the execution environment.
 */
let cachedConnection: mongoose.Connection | null = null;
let connecting: Promise<mongoose.Connection> | null = null;

const CONNECT_OPTIONS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 8000,
  maxPoolSize: 1, // Lambda containers are single-request; keep pool minimal.
  // Do NOT let operations silently buffer for 10s when the connection drops —
  // fail fast with the real server-selection error instead (see
  // MongooseError "buffering timed out").
  bufferCommands: false,
};

/** Attach one-time logging so the server terminal shows DB state changes. */
function wireConnectionLogging(conn: mongoose.Connection): void {
  if ((conn as unknown as { __kbcWired?: boolean }).__kbcWired) return;
  (conn as unknown as { __kbcWired: boolean }).__kbcWired = true;

  conn.on('connected', () => {
    // eslint-disable-next-line no-console
    console.log('[db] mongoose connected');
  });
  conn.on('reconnected', () => {
    // eslint-disable-next-line no-console
    console.log('[db] mongoose reconnected');
  });
  conn.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.warn('[db] mongoose disconnected — next call will reconnect fresh.');
    cachedConnection = null;
  });
  conn.on('error', (err: Error) => {
    // eslint-disable-next-line no-console
    console.error('[db] mongoose error:', err?.message ?? err);
  });
}

/**
 * Returns a single shared Mongoose connection, reusing the cached one when
 * available. Call this at the top of every handler that touches the database.
 *
 * @example
 * await connectToDatabase();
 */
export async function connectToDatabase(): Promise<mongoose.Connection> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI environment variable is not set. ' +
        'Add it to your .env file or Lambda environment configuration.'
    );
  }

  // Reuse an already-connected connection.
  if (cachedConnection && cachedConnection.readyState === 1) {
    return cachedConnection;
  }

  // Reuse an in-flight connection attempt to avoid race conditions on
  // concurrent warm invocations.
  if (connecting) {
    return connecting;
  }

  const startedAt = Date.now();
  // eslint-disable-next-line no-console
  console.log('[db] connecting to MongoDB...');
  connecting = mongoose
    .connect(uri, CONNECT_OPTIONS)
    .then((mongooseInstance) => {
      const conn = mongooseInstance.connection;
      cachedConnection = conn;
      connecting = null;
      wireConnectionLogging(conn);
      // eslint-disable-next-line no-console
      console.log(`[db] connected in ${Date.now() - startedAt} ms`);
      return conn;
    })
    .catch((error: Error) => {
      connecting = null;
      // eslint-disable-next-line no-console
      console.error('[db] connect error:', error?.message ?? error);
      throw error;
    });

  return connecting;
}

/** Disconnects the shared connection (primarily for tests / local teardown). */
export async function disconnectDatabase(): Promise<void> {
  if (cachedConnection) {
    await cachedConnection.close();
    cachedConnection = null;
  }
}
