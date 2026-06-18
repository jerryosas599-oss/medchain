const express = require('express');
const pool    = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/audit — Retrieve chained audit log ───────────
router.get('/', authenticate, authorize('doctor', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT al.*, u.full_name AS user_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.timestamp DESC
       LIMIT 200`
    );
    res.json({ logs: result.rows });
  } catch (err) {
    console.error('[audit]', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
