import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getCollection } from '../db/mongo.js';
import { buildChainedHash } from '../utils/hash.js';
import { ObjectId } from 'mongodb';

const router = Router();

/** Retrieve the last audit log hash (used for chaining). */
async function getLastLogHash() {
  const col = getCollection('audit_logs');
  const last = await col.find({}).sort({ timestamp: -1 }).limit(1).toArray();
  return last[0]?.current_log_hash || 'GENESIS_BLOCK';
}

// ── POST /api/auth/register ───────────────────────────────
router.post('/register', async (req, res) => {
  const { fullName, email, password, role } = req.body;

  if (!fullName || !email || !password || !role)
    return res.status(400).json({ error: 'All fields are required' });

  if (!['patient', 'doctor', 'admin'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });

  try {
    const rounds = Number(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, rounds);

    const users = getCollection('users');
    const existing = await users.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const now = new Date();
    const insert = await users.insertOne({ full_name: fullName, email, password_hash: passwordHash, role, created_at: now, is_active: true });
    const user = {
      id: insert.insertedId.toString(),
      full_name: fullName,
      email,
      role,
      created_at: now,
    };
    res.status(201).json({ user });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('[login] attempt for', email);
    const users = getCollection('users');
    const user = await users.findOne({ email, is_active: true });
    console.log('[login] user fetched:', !!user);

    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id || user._id.toString(), email: user.email, role: user.role, name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Chained audit log entry
    const prev = await getLastLogHash();
    const entry = { userId: user._id.toString(), action: 'LOGIN', recordId: null, timestamp: new Date().toISOString() };
    const currentHash = buildChainedHash(entry, prev);
    const audit = getCollection('audit_logs');
    try {
      await audit.insertOne({ user_id: new ObjectId(user._id), action: 'LOGIN', previous_log_hash: prev, current_log_hash: currentHash, ip_address: req.ip, timestamp: new Date() });
    } catch (auditErr) {
      console.error('[login] audit insert failed', auditErr);
    }

    res.json({
      token,
      user: { id: user._id.toString(), name: user.full_name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── PUT /api/auth/profile — update current user's profile (full name)
router.put('/profile', async (req, res) => {
  try {
    const tokenHeader = req.headers.authorization;
    if (!tokenHeader || !tokenHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
    const token = tokenHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { fullName } = req.body;
    if (!fullName) return res.status(400).json({ error: 'fullName is required' });

    const users = getCollection('users');

    // Try to find the user by id first (if present), otherwise fall back to email
    let queryUser = null;
    if (payload.id) {
      try {
        queryUser = await users.findOne({ _id: new ObjectId(payload.id) });
      } catch (e) {
        queryUser = null;
      }
    }
    if (!queryUser && payload.email) {
      queryUser = await users.findOne({ email: payload.email });
    }
    if (!queryUser) return res.status(404).json({ error: 'User not found' });

    const upd = await users.findOneAndUpdate(
      { _id: queryUser._id },
      { $set: { full_name: fullName } },
      { returnDocument: 'after' }
    );

    const user = upd.value;
    res.json({ user: { id: user._id.toString(), name: user.full_name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('[profile update]', err);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// ── GET /api/auth/me — return current user from token
router.get('/me', async (req, res) => {
  try {
    const tokenHeader = req.headers.authorization;
    if (!tokenHeader || !tokenHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
    const token = tokenHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const users = getCollection('users');
    // attempt lookup by id then email
    let queryUser = null;
    if (payload.id) {
      try { queryUser = await users.findOne({ _id: new ObjectId(payload.id) }); } catch (e) { queryUser = null; }
    }
    if (!queryUser && payload.email) {
      queryUser = await users.findOne({ email: payload.email });
    }
    if (!queryUser) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: queryUser._id.toString(), name: queryUser.full_name, email: queryUser.email, role: queryUser.role } });
  } catch (err) {
    console.error('[me]', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
const _getLastLogHash = getLastLogHash;
export { _getLastLogHash as getLastLogHash };
