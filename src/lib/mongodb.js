import { MongoClient } from 'mongodb'

constant uri = process.env.MONGODB_URI

let client
let clientPromise

if (!process.env.MONGODB_URI) {
  throw new Error('Please add MONGODB_URI to .env.local')
}
else {
  client = new MongoClient(uri)
  clientPromise = client.connect()
}

export default clientPromise


