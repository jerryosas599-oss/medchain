process.on('warning', warning => {
  console.warn(warning.name, warning.message);
  console.warn(warning.stack);
});

import 'dotenv/config';
import express, { json } from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import recordRoutes from './routes/records.js';
import auditRoutes from './routes/audit.js';
import { connectDB } from './db/mongo.js';

const app = express();

// ── Middleware ────────────────────────────────────────────
// CORS: allow a comma-separated list in FRONTEND_URL (e.g. "https://a.vercel.app,https://b.vercel.app")
const rawFrontends = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigins = rawFrontends.split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // allow non-browser requests (e.g. curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true
}));
app.use(json({ limit: '2mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Connect DB and then mount routes
await connectDB();

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


export default app; //vercel serveless export

