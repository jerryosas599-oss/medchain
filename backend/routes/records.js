import { Router } from 'express';
import { hashRecord, verifyRecord, buildChainedHash } from '../utils/hash.js';
import { encryptRecord, decryptRecord } from '../utils/crypto.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { getLastLogHash } from './auth.js';
import { getCollection, connectDB } from '../db/mongo.js';
import { ObjectId } from 'mongodb';

const router = Router();

// ── POST /api/records — Create + hash a new record ────────
router.post('/', authenticate, authorize('doctor', 'admin', 'patient'), async (req, res) => {
  let { patientId, diagnosis, medication, notes, allergies } = req.body;

  // If the requester is a patient, force patientId to their own id (prevent spoofing)
  if (req.user.role === 'patient') {
    patientId = req.user.id;
  }

  if (!patientId || !diagnosis)
    return res.status(400).json({ error: 'patientId and diagnosis are required' });

  // Validate patientId
  let patientObjId;
  try {
    patientObjId = new ObjectId(patientId);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid patientId' });
  }

  // Build the canonical record object (keys sorted for deterministic hashing)
  const data = {
    allergies:  allergies  || '',
    diagnosis,
    medication: medication || '',
    notes:      notes      || '',
    patientId,
  };

  const hash = hashRecord(data);
  // Encrypt sensitive record_data so only server (doctors/admins) can decrypt
  const encrypted = encryptRecord(data);

  try {
    const records = getCollection('health_records');
    const insert = await records.insertOne({ patient_id: patientObjId, record_data: encrypted, record_hash: hash, created_by: new ObjectId(req.user.id), created_at: new Date() });

    // Audit chain
    const prev = await getLastLogHash();
    const entry = { userId: req.user.id, action: 'CREATE_RECORD', recordId: insert.insertedId.toString(), timestamp: new Date().toISOString() };
    const audit = getCollection('audit_logs');
    try {
      await audit.insertOne({ user_id: new ObjectId(req.user.id), action: 'CREATE_RECORD', record_id: insert.insertedId, previous_log_hash: prev, current_log_hash: buildChainedHash(entry, prev), ip_address: req.ip, timestamp: new Date() });
    } catch (ae) {
      console.error('[create record] audit insert failed', ae);
    }

    // Return non-sensitive metadata; full decrypted data is available to authorized users via GET
    res.status(201).json({ record: { id: insert.insertedId.toString(), patient_id: patientObjId.toString(), record_hash: hash }, hash });
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
      { $lookup: { from: 'users', localField: 'updated_by', foreignField: '_id', as: 'updater' } },
      { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$updater', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, patient_id: 1, record_data: 1, record_hash: 1, patient_name: '$patient.full_name', created_by_name: '$creator.full_name', created_by_email: '$creator.email', updated_by_name: '$updater.full_name', updated_by_email: '$updater.email', created_at: 1, updated_at: 1, created_by: 1 } },
      { $addFields: { id: { $toString: '$_id' }, patient_id: { $toString: '$patient_id' }, created_by_id: { $toString: '$created_by' } } },
      { $project: { _id: 0, id: 1, patient_id: 1, record_data: 1, record_hash: 1, patient_name: 1, created_by_name: 1, created_by_email: 1, updated_by_name: 1, updated_by_email: 1, created_at: 1, updated_at: 1, created_by_id: 1 } },
      { $sort: { created_at: -1 } }
    );

    const result = await records.aggregate(pipeline).toArray();

    // Decrypt record_data only for doctor/admin. Patients and others receive redacted data.
    const transformed = result.map(r => {
      try {
        if (req.user.role === 'doctor' || req.user.role === 'admin') {
          const dec = decryptRecord(r.record_data);
          return { ...r, record_data: dec };
        }
      } catch (e) {
        console.error('[decrypt record]', e);
      }
      return { ...r, record_data: { diagnosis: 'REDACTED' } };
    });

    res.json({ records: transformed });
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

    // Only doctor/admin can verify/decrypt records
    if (!(req.user.role === 'doctor' || req.user.role === 'admin')) return res.status(403).json({ error: 'Insufficient permissions to verify record' });

    let recordData = rec.record_data;
    try { recordData = decryptRecord(rec.record_data); } catch (e) { /* ignore, may already be plaintext */ }

    const intact = verifyRecord(recordData, rec.record_hash);
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

// ── PUT /api/records/:id — Update a record
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { diagnosis, medication, notes, allergies } = req.body;

    const records = getCollection('health_records');
    const rec = await records.findOne({ _id: new ObjectId(id) });
    if (!rec) return res.status(404).json({ error: 'Record not found' });

    // Authorization rules:
    // - admin/doctor: can edit any field
    // - patient: can edit their own record, but only allowed fields (notes, medication, allergies)
    const isDoctorOrAdmin = req.user.role === 'admin' || req.user.role === 'doctor';
    const isPatientOwner = req.user.role === 'patient' && rec.record_data && rec.record_data.patientId === req.user.id;
    if (!isDoctorOrAdmin && !isPatientOwner) return res.status(403).json({ error: 'Not authorized to edit this record' });

    // Build updatedData depending on role
    let updatedData;
    if (isDoctorOrAdmin) {
      updatedData = {
        allergies: (allergies !== undefined ? allergies : (rec.record_data && rec.record_data.allergies) ) || '',
        diagnosis: (diagnosis !== undefined ? diagnosis : (rec.record_data && rec.record_data.diagnosis) ),
        medication: (medication !== undefined ? medication : (rec.record_data && rec.record_data.medication) ) || '',
        notes: (notes !== undefined ? notes : (rec.record_data && rec.record_data.notes) ) || '',
        patientId: rec.record_data ? rec.record_data.patientId : undefined,
      };
    } else {
      // patient owner: only allow notes/medication/allergies edits
      updatedData = {
        allergies: (allergies !== undefined ? allergies : (rec.record_data && rec.record_data.allergies) ) || '',
        diagnosis: (rec.record_data && rec.record_data.diagnosis),
        medication: (medication !== undefined ? medication : (rec.record_data && rec.record_data.medication) ) || '',
        notes: (notes !== undefined ? notes : (rec.record_data && rec.record_data.notes) ) || '',
        patientId: rec.record_data ? rec.record_data.patientId : undefined,
      };
    }

    const newHash = hashRecord(updatedData);
    const encrypted = encryptRecord(updatedData);
    const upd = await records.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { record_data: encrypted, record_hash: newHash, updated_at: new Date(), updated_by: new ObjectId(req.user.id) } },
      { returnDocument: 'after' }
    );

    // Audit
    const prev = await getLastLogHash();
    const entry = { userId: req.user.id, action: 'UPDATE_RECORD', recordId: id, timestamp: new Date().toISOString() };
    const audit = getCollection('audit_logs');
    try { await audit.insertOne({ user_id: new ObjectId(req.user.id), action: 'UPDATE_RECORD', record_id: new ObjectId(id), previous_log_hash: prev, current_log_hash: buildChainedHash(entry, prev), ip_address: req.ip, timestamp: new Date() }); } catch (e) { console.error('[update record] audit failed', e); }

    const updatedAt = (upd && upd.value && upd.value.updated_at) ? upd.value.updated_at : new Date();
    res.json({ record: { id: id, patient_id: rec.patient_id.toString(), record_hash: newHash, updated_at: updatedAt } });
  } catch (err) {
    console.error('[update record]', err);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

// ── DELETE /api/records/:id — Delete a record
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const records = getCollection('health_records');
    const rec = await records.findOne({ _id: new ObjectId(id) });
    if (!rec) return res.status(404).json({ error: 'Record not found' });

    const allowed = req.user.role === 'admin' || req.user.role === 'doctor';
    if (!allowed) return res.status(403).json({ error: 'Not authorized to delete this record' });

    await records.deleteOne({ _id: new ObjectId(id) });

    const prev = await getLastLogHash();
    const entry = { userId: req.user.id, action: 'DELETE_RECORD', recordId: id, timestamp: new Date().toISOString() };
    const audit = getCollection('audit_logs');
    try { await audit.insertOne({ user_id: new ObjectId(req.user.id), action: 'DELETE_RECORD', record_id: new ObjectId(id), previous_log_hash: prev, current_log_hash: buildChainedHash(entry, prev), ip_address: req.ip, timestamp: new Date() }); } catch (e) { console.error('[delete record] audit failed', e); }

    res.json({ success: true });
  } catch (err) {
    console.error('[delete record]', err);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default router;
