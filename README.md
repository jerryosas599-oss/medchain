# MedChain — Secure Healthcare Record System
### SHA-256 Integrity · JWT Authentication · Chained Audit Trail

---

## Quick Start

### 1. Database
```bash
psql -U postgres -c "CREATE DATABASE healthcare_db;"
psql -U postgres -d healthcare_db -f backend/db/schema.sql
```

### 2. Backend
```bash
cd backend
cp .env.example .env        # Fill in your real values
npm install
npm run dev                 # API starts at http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
npm start                   # App starts at http://localhost:3000
```

---

## Architecture

```
frontend/               React app (SHA-256 via Web Crypto API)
├── src/utils/
│   ├── hash.js         Browser-side SHA-256 + truncateHash
│   └── api.js          Axios-style fetch wrapper + JWT injection

backend/                Node.js + Express API
├── server.js           Entry point, CORS, security headers
├── routes/
│   ├── auth.js         Register, Login, JWT issuance
│   ├── records.js      CRUD + SHA-256 hash + verify endpoint
│   └── audit.js        Chained audit log retrieval
├── middleware/
│   └── auth.js         JWT authentication + RBAC authorization
├── utils/
│   └── hash.js         hashRecord, verifyRecord, buildChainedHash
└── db/
    ├── pool.js         PostgreSQL connection pool
    └── schema.sql      Tables: users, health_records, audit_logs
```

---

## API Reference

| Method | Endpoint                    | Auth           | Description                  |
|--------|-----------------------------|----------------|------------------------------|
| POST   | /api/auth/register          | —              | Create user account          |
| POST   | /api/auth/login             | —              | Login → JWT token            |
| GET    | /api/records                | JWT            | List records (role-filtered) |
| POST   | /api/records                | Doctor / Admin | Create + SHA-256 hash record |
| GET    | /api/records/:id/verify     | JWT            | Re-hash and verify integrity |
| GET    | /api/audit                  | Doctor / Admin | Chained audit log            |
| GET    | /api/health                 | —              | Health check                 |

---

## Security Features

| Feature                | Implementation                            |
|------------------------|-------------------------------------------|
| Password hashing       | bcrypt (12 rounds)                        |
| Record integrity       | SHA-256 on sorted JSON keys               |
| Tamper detection       | Re-hash on every read, compare with stored|
| Timing attacks         | crypto.timingSafeEqual                    |
| Authentication         | JWT (8h expiry, HS256)                   |
| Authorization          | RBAC middleware (patient/doctor/admin)    |
| Audit trail            | Chained SHA-256 — each entry hashes prev |
| Transport security     | HTTPS (enforced on hosting platform)     |
| Security headers       | X-Frame-Options, X-XSS-Protection, etc.  |

---

## SHA-256 Record Flow

```
1. Doctor submits record data
        ↓
2. Keys sorted alphabetically (deterministic)
        ↓
3. JSON.stringify → SHA-256 → 64-char hex hash
        ↓
4. Record + hash stored in PostgreSQL
        ↓
5. On any read: re-hash and compare
        ↓
6. Mismatch → TAMPER ALERT + audit log entry
```

## Chained Audit Log

```
Entry N Hash = SHA-256(userId + action + recordId + timestamp + Entry N-1 Hash)
```
Changing any past entry changes its hash, breaking the chain from that point forward.

---

## Deployment

**Frontend → Vercel**
```bash
cd frontend && npm run build
npx vercel deploy
```

**Backend → Render.com**
- Push to GitHub → connect repo on render.com
- Set environment variables from .env.example
- Deploy as Web Service

**Database → Neon.tech** (free PostgreSQL)
- Create project → copy connection string → paste into DATABASE_URL
