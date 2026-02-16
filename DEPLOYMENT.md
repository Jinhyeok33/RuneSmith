# RuneSmith Deployment Guide

This guide covers deploying the RuneSmith application to production.

## Architecture Overview

```
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│   Vercel    │ ───► │  Railway    │ ───► │ PostgreSQL   │
│  (Frontend) │      │  (Backend)  │      │  (Database)  │
└─────────────┘      └─────────────┘      └──────────────┘
     Next.js          FastAPI + Python      Managed DB
```

---

## Prerequisites

- [Vercel Account](https://vercel.com) (Frontend hosting)
- [Railway Account](https://railway.app) (Backend + Database)
- [GitHub Repository](https://github.com) (Already set up)
- OpenAI API Key

---

## Part 1: Database Setup (Railway)

### 1.1 Create PostgreSQL Database

1. Go to [Railway.app](https://railway.app)
2. Click **"New Project"** → **"Provision PostgreSQL"**
3. Note the connection details (auto-populated as `DATABASE_URL`)

### 1.2 Get Database Credentials

Railway automatically provides:
- `DATABASE_URL`: Full connection string
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`: Individual fields

**Example URL:**
```
postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway
```

For our backend (asyncpg), convert to:
```
postgresql+asyncpg://postgres:password@containers-us-west-123.railway.app:5432/railway
```

---

## Part 2: Backend Deployment (Railway)

### 2.1 Deploy Backend to Railway

1. In Railway Dashboard, click **"New"** → **"GitHub Repo"**
2. Select `RuneSmith` repository
3. Railway auto-detects Python and installs dependencies
4. Set **Root Directory**: `backend` (if monorepo detection fails)

### 2.2 Configure Environment Variables

In Railway project settings → **Variables**, add:

```bash
# Required
OPENAI_API_KEY=sk-proj-your-production-key-here
SECRET_KEY=your-random-32-char-secret-key
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Auto-linked from DB service
```

**Generate SECRET_KEY:**
```bash
openssl rand -hex 32
```

### 2.3 Verify Deployment

1. Railway assigns a public URL: `https://your-app.up.railway.app`
2. Test health endpoint: `https://your-app.up.railway.app/health`
3. Expected response:
```json
{
  "status": "ok",
  "service": "runesmith-api",
  "database": "connected"
}
```

---

## Part 3: Frontend Deployment (Vercel)

### 3.1 Deploy to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import `RuneSmith` GitHub repository
4. **Framework Preset**: Next.js
5. **Root Directory**: `apps/web`
6. **Build Command**: `npm run build`

### 3.2 Configure Environment Variables

In Vercel project settings → **Environment Variables**:

```bash
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
```

### 3.3 Update Backend CORS

After deploying to Vercel, update `backend/app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-app.vercel.app",  # Add your Vercel URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Part 4: Testing Deployment

### 4.1 Backend Tests

**Health Check:**
```bash
curl https://your-backend.up.railway.app/health
```

**Test Compile Endpoint:**
```bash
curl -X POST https://your-backend.up.railway.app/api/compile \
  -H "Content-Type: application/json" \
  -d '{"user_input":"화염구","world_tier":1,"extra_vfx_budget":0}'
```

---

## Environment Variables Summary

### Backend (Railway)

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ | OpenAI API key |
| `SECRET_KEY` | ✅ | JWT secret (32 chars) |
| `DATABASE_URL` | ✅ | Auto-provided by Railway |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL |

---

## Production Checklist

- [ ] Set `SECRET_KEY` to random 32-char string
- [ ] Use production OpenAI API key
- [ ] Configure CORS with Vercel URL
- [ ] Test health endpoint
- [ ] Test skill compilation
- [ ] Verify database connection
- [ ] Test authentication flow

---

**Last Updated:** 2026-02-16
**Version:** 0.1.0
