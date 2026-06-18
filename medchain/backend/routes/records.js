import { Router } from 'express';
import { hashRecord, verifyRecord, buildChainedHash } from '../utils/hash.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { getLastLogHash } from './auth.js';
import { getCollection, connectDB } from '../db/mongo.js';
import { ObjectId } from 'mongodb';

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
    const records = getCollection('health_records');
    const insert = await records.insertOne({ patient_id: new ObjectId(patientId), record_data: data, record_hash: hash, created_by: new ObjectId(req.user.id), created_at: new Date() });

    // Audit chain
    const prev = await getLastLogHash();
    const entry = { userId: req.user.id, action: 'CREATE_RECORD', recordId: insert.insertedId.toString(), timestamp: new Date().toISOString() };
    const audit = getCollection('audit_logs');
    await audit.insertOne({ user_id: new ObjectId(req.user.id), action: 'CREATE_RECORD', record_id: insert.insertedId, previous_log_hash: prev, current_log_hash: buildChainedHash(entry, prev), ip_address: req.ip, timestamp: new Date() });

    res.status(201).json({ record: { id: insert.insertedId.toString(), patient_id: patientId, record_data: data, record_hash: hash }, hash });
  } catch (err) {
    console.error('[create record]', err);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

// ── GET /api/records — List records (filtered by role) ───
router.get('/', authenticate, async (req, res) => {
  try {
    const records = getCollection('health_records');
    const pipeline = [];
    if (req.user.role === 'patient') {
      pipeline.push({ $match: { patient_id: new ObjectId(req.user.id) } });
    }
    pipeline.push(
      { $lookup: { from: 'users', localField: 'patient_id', foreignField: '_id', as: 'patient' } },
      { $lookup: { from: 'users', localField: 'created_by', foreignField: '_id', as: 'creator' } },
      { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
      { $project: { record_data: 1, record_hash: 1, patient_name: '$patient.full_name', created_by_name: '$creator.full_name', created_at: 1 } },
      { $sort: { created_at: -1 } }
    );

    const result = await records.aggregate(pipeline).toArray();
    res.json({ records: result });
  } catch (err) {
    console.error('[list records]', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// ── GET /api/records/:id/verify — Verify SHA-256 integrity ──
router.get('/:id/verify', authenticate, async (req, res) => {
  try {
    const records = getCollection('health_records');
    const rec = await records.findOne({ _id: new ObjectId(req.params.id) });
    if (!rec) return res.status(404).json({ error: 'Record not found' });

    const intact = verifyRecord(rec.record_data, rec.record_hash);
    const prev = await getLastLogHash();
    const entry = { userId: req.user.id, action: 'VERIFY_RECORD', recordId: rec._id.toString(), timestamp: new Date().toISOString() };
    const audit = getCollection('audit_logs');
    await audit.insertOne({ user_id: new ObjectId(req.user.id), action: 'VERIFY_RECORD', record_id: rec._id, previous_log_hash: prev, current_log_hash: buildChainedHash(entry, prev), ip_address: req.ip, timestamp: new Date() });

    res.json({ recordId: rec._id.toString(), intact, storedHash: rec.record_hash });
  } catch (err) {
    console.error('[verify]', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
