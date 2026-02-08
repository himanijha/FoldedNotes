import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI?.trim();

let clientPromise: Promise<MongoClient>;

if (!uri) {
    clientPromise = Promise.reject(new Error("MONGODB_URI is not set. Add it to .env.local to save notes."));
} else if (process.env.NODE_ENV === "development") {
    // In dev, reuse the client across hot reloads
    const globalWithMongo = global as typeof globalThis & { _mongoClientPromise?: Promise<MongoClient> };
    if (!globalWithMongo._mongoClientPromise) {
        const client = new MongoClient(uri);
        globalWithMongo._mongoClientPromise = client.connect();
    }
    clientPromise = globalWithMongo._mongoClientPromise;
} else {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
}

export default clientPromise;
