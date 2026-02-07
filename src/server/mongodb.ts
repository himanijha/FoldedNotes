import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017";
const dbName = process.env.MONGODB_DB ?? "foldednotes";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

/**
 * Cached MongoDB client promise. Reusing the same client across requests
 * avoids creating a new connection per API route (important in serverless).
 */
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = new MongoClient(uri).connect();
}

/**
 * Get the MongoDB client. Use this when you need the raw client.
 */
export async function getClient(): Promise<MongoClient> {
  return clientPromise;
}

/**
 * Get the default database. Use this for most operations.
 */
export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(dbName);
}

export { clientPromise };
