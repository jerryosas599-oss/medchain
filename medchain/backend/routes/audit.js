import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { getCollection } from '../db/mongo.js';

const router = Router();

// ── GET /api/audit — Retrieve chained audit log ───────────
router.get('/', authenticate, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const audit = getCollection('audit_logs');
    const pipeline = [
      { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $sort: { timestamp: -1 } },
      { $limit: 200 }
    ];
    const logs = await audit.aggregate(pipeline).toArray();
    res.json({ logs });
  } catch (err) {
    console.error('[audit]', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
