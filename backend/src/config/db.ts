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

  connecting = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 1, // Lambda containers are single-request; keep pool minimal.
    })
    .then((connection) => {
      cachedConnection = connection.connection;
      connecting = null;
      return cachedConnection;
    })
    .catch((error) => {
      connecting = null;
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