import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'medchain');

  const users = db.collection('users');
  const records = db.collection('health_records');
  const audit = db.collection('audit_logs');

  // Clear collections for a clean seed (use with caution in production)
  await Promise.all([
    users.deleteMany({}),
    records.deleteMany({}),
    audit.deleteMany({}),
  ]);

  // ensure unique index on email
  await users.createIndex({ email: 1 }, { unique: true });

  const rounds = Number(process.env.BCRYPT_ROUNDS) || 12;
  const passwordHash = await bcrypt.hash('123456', rounds);

  const now = new Date();
  const userDoc = {
    full_name: 'Muhammed Abiodun',
    email: 'user@gmail.com',
    password_hash: passwordHash,
    role: 'patient',
    is_active: true,
    created_at: now,
  };

  try {
    const res = await users.insertOne(userDoc);
    console.log('Seeded user id:', res.insertedId.toString());
  } catch (err) {
    console.error('Seed error', err);
  } finally {
    await client.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
