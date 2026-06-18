import { Router } from 'express';
import { query as _query } from '../db/pool.js';
import { hashRecord, verifyRecord, buildChainedHash } from '../utils/hash.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { getLastLogHash } from './auth.js';

const router = Router();

// ── POST /api/records — Create + hash a new record ────────
router.post('/', authenticate, authorize('doctor', 'admin', 'patient'), async (req, res) => {
  const { patientId, diagnosis, medication, notes, allergies } = req.body;

  if (!patientId || !diagnosis)
    return res.status(400).json({ error: 'patientId and diagnosis are required' });

  // Build the canonical record object (keys sorted for deterministic hashing)
  const data = {
    allergies:  allergies  || '',
    diagnosis,
    medication: medication || '',
    notes:      notes      || '',
    patientId,
  };

  const hash = hashRecord(data);

  try {
    const result = await _query(
      `INSERT INTO health_records (patient_id, record_data, record_hash, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [patientId, JSON.stringify(data), hash, req.user.id]
    );

    // Audit chain
    const prev = await getLastLogHash();
    const entry = { userId: req.user.id, action: 'CREATE_RECORD', recordId: result.rows[0].id, timestamp: new Date().toISOString() };
    await _query(
      `INSERT INTO audit_logs (user_id, action, record_id, previous_log_hash, current_log_hash, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.user.id, 'CREATE_RECORD', result.rows[0].id, prev, buildChainedHash(entry, prev), req.ip]
    );

    res.status(201).json({ record: result.rows[0], hash });
  } catch (err) {
    console.error('[create record]', err);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

// ── GET /api/records — List records (filtered by role) ───
router.get('/', authenticate, async (req, res) => {
  try {
    let query = `
      SELECT hr.*, u.full_name AS patient_name, c.full_name AS created_by_name
      FROM health_records hr
      JOIN users u  ON hr.patient_id  = u.id
      JOIN users c  ON hr.created_by  = c.id
    `;
    const params = [];
    if (req.user.role === 'patient') {
      query += ' WHERE hr.patient_id=$1';
      params.push(req.user.id);
    }
    query += ' ORDER BY hr.created_at DESC';

    const result = await _query(query, params);
    res.json({ records: result.rows });
  } catch (err) {
    console.error('[list records]', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// ── GET /api/records/:id/verify — Verify SHA-256 integrity ──
router.get('/:id/verify', authenticate, async (req, res) => {
  try {
    const result = await _query('SELECT * FROM health_records WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Record not found' });

    const rec   = result.rows[0];
    const intact = verifyRecord(rec.record_data, rec.record_hash);

    // Audit
    const prev = await getLastLogHash();
    const entry = { userId: req.user.id, action: 'VERIFY_RECORD', recordId: rec.id, timestamp: new Date().toISOString() };
    await _query(
      `INSERT INTO audit_logs (user_id, action, record_id, previous_log_hash, current_log_hash, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.user.id, 'VERIFY_RECORD', rec.id, prev, buildChainedHash(entry, prev), req.ip]
    );

    res.json({ recordId: rec.id, intact, storedHash: rec.record_hash });
  } catch (err) {
    console.error('[verify]', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
