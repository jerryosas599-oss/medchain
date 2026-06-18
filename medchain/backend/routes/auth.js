import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import { buildChainedHash } from '../utils/hash.js';

const router = Router();

/** Retrieve the last audit log hash (used for chaining). */
async function getLastLogHash() {
  const r = await query(
    'SELECT current_log_hash FROM audit_logs ORDER BY timestamp DESC LIMIT 1'
  );
  return r.rows[0]?.current_log_hash || 'GENESIS_BLOCK';
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

    const result = await query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1,$2,$3,$4)
       RETURNING id, full_name, email, role, created_at`,
      [fullName, email, passwordHash, role]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'Email already registered' });
    console.error('[register]', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await query(
      'SELECT * FROM users WHERE email=$1 AND is_active=true', [email]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Chained audit log entry
    const prev = await getLastLogHash();
    const entry = { userId: user.id, action: 'LOGIN', recordId: null, timestamp: new Date().toISOString() };
    const currentHash = buildChainedHash(entry, prev);

    await query(
      `INSERT INTO audit_logs (user_id, action, previous_log_hash, current_log_hash, ip_address)
       VALUES ($1,$2,$3,$4,$5)`,
      [user.id, 'LOGIN', prev, currentHash, req.ip]
    );

    res.json({
      token,
      user: { id: user.id, name: user.full_name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
const _getLastLogHash = getLastLogHash;
export { _getLastLogHash as getLastLogHash };
