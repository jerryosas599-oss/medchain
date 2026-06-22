import { MongoClient } from 'mongodb';
import 'dotenv/config';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set in environment');

const client = new MongoClient(uri);
let db = null;

export async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db(process.env.DB_NAME || 'medchain');
    console.log('Connected to MongoDB');
  }
  return db;
}

export function getCollection(name) {
  if (!db) throw new Error('Database not connected. Call connectDB() first.');
  return db.collection(name);
}

export { MongoClient };
export default client;
