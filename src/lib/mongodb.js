import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
    throw new Error("Please add MONGODB_URI to .env.local");
}

let client;
let clientPromise;

if (process.env.NODE_ENV === "development") {
    // In dev, reuse the client across hot reloads
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else {
    // In prod, create a new client
    client = new MongoClient(uri);
    clientPromise = client.connect();
}

export default clientPromise;