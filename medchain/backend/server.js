require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes   = require('./routes/auth');
const recordRoutes = require('./routes/records');
const auditRoutes  = require('./routes/audit');

const app = express();

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/audit',   auditRoutes);

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', service: 'MedChain API', time: new Date().toISOString() })
);

// ── Error handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[unhandled]', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`MedChain API running → http://localhost:${PORT}`)
);
