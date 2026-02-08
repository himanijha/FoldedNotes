import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI?.trim();

let client;
let clientPromise;

if (!uri) {
    clientPromise = Promise.reject(new Error("MONGODB_URI is not set. Add it to .env.local to save notes."));
} else if (process.env.NODE_ENV === "development") {
    // In dev, reuse the client across hot reloads
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else {
    client = new MongoClient(uri);
    clientPromise = client.connect();
}

export default clientPromise;