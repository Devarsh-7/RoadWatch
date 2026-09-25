# RoadWatch Production Deployment Guide

This guide details how to securely deploy both the **FastAPI Backend** and the **React Vite Frontend** to public cloud hosting platforms.

---

## 1. Prerequisites & Environment Variables

### Backend Environment Variables

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection URL (e.g. Supabase connection pooling string) | `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres` |
| `JWT_SECRET` | Strong random key used for administrative JWT authentication tokens | `openssl rand -hex 32` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed frontend domain URLs | `https://your-app.vercel.app,http://localhost:5173` |
| `GOOGLE_API_KEY` | Google Gemini API key for AI Chatbot | Free key from [Google AI Studio](https://aistudio.google.com/apikey) |
| `ENVIRONMENT` | Environment identifier (`production` or `development`) | `production` |
| `ADMIN_INIT_USERNAME` | (Optional) Initial Super Admin username for automated boot | `ops_admin` |
| `ADMIN_INIT_PASSWORD` | (Optional) Strong initial password for automated Super Admin | Complex password (8+ chars) |

> [!NOTE]
> **Production Administrator Provisioning**:
> When `ENVIRONMENT=production`, default mock accounts (`pune_collector`, `nhai_officer`, etc.) with weak passwords are **never** seeded.
> You can provision your first Super Admin in one of two ways:
> 1. **Interactive CLI (Recommended)**: In your deployment terminal, run:
>    ```bash
>    python cli_admin.py create-superuser
>    ```
> 2. **Environment Variables**: Define `ADMIN_INIT_USERNAME` and `ADMIN_INIT_PASSWORD` in your cloud provider's secret manager before first startup.

> [!TIP]
> **Supabase Connection Pooling**: In production, always use Supabase's **Transaction Pooler** (port 6543) or **Session Pooler** (port 5432) connection string to prevent exhausting serverless connection limits.

---

### Frontend Environment Variables

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `VITE_API_URL` | Full URL of your deployed backend service (no trailing slash) | `https://roadwatch-api.onrender.com` |
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://xyzproject.supabase.co` |
| `VITE_SUPABASE_ANON_KEY`| Supabase Public Anonymous API Key | `eyJhbGciOi...` |

---

## 2. Deploying Backend

### Option A: Render (Recommended Free/Easy Tier)
1. Fork or push this repository to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com/) -> **New** -> **Web Service**.
3. Connect your repository.
4. Set the following build and start configurations:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. In **Environment Variables**, add:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `ALLOWED_ORIGINS` (your frontend domain once deployed)
   - `GOOGLE_API_KEY`
   - `ADMIN_PASSWORD`
   - `ENV=production`
6. Click **Create Web Service**. Note your backend URL (e.g. `https://roadwatch-api.onrender.com`).

---

### Option B: Docker / Container (Fly.io, Railway, AWS ECS)
Use the included `backend/Dockerfile`:
```bash
cd backend
docker build -t roadwatch-backend .
docker run -p 8000:8000 \
  -e DATABASE_URL="your_db_url" \
  -e JWT_SECRET="your_secret" \
  -e ALLOWED_ORIGINS="https://your-frontend.vercel.app" \
  -e GOOGLE_API_KEY="your_gemini_key" \
  roadwatch-backend
```

---

## 3. Deploying Frontend

### Option A: Vercel (Recommended)
1. Go to [Vercel Dashboard](https://vercel.com/) -> **Add New** -> **Project**.
2. Import the Git repository.
3. In **Project Settings**:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variables**:
   - `VITE_API_URL` = `https://your-backend.onrender.com`
   - `VITE_SUPABASE_URL` = `https://[your-project].supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `[your-anon-key]`
5. Click **Deploy**.
6. The included `frontend/vercel.json` ensures that client-side routes (`/roads/1`, `/admin`, `/repairs`, `/complaint`) route to `index.html` without 404s.

---

### Option B: Netlify
1. Go to [Netlify Dashboard](https://app.netlify.com/) -> **Add new site** -> **Import an existing project**.
2. Set:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
3. Add environment variables: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Deploy! The included `frontend/public/_redirects` automatically handles SPA routing.

---

## 4. Post-Deployment Verification Checklist

- [ ] **Backend Health Check**: Open `https://your-backend.onrender.com/api/health`. Should return `{"status":"healthy","app":"RoadWatch"}`.
- [ ] **Interactive API Docs**: Check `https://your-backend.onrender.com/docs` to verify endpoints.
- [ ] **CORS Verification**: Open your frontend domain in the browser and inspect the network tab to verify API calls return HTTP 200 without CORS errors.
- [ ] **Citizen Complaint Verification**: Test verifying a complaint on any road to ensure PostgreSQL distinct counts execute smoothly.
- [ ] **Admin Authentication**: Navigate to `/admin-login`, sign in with `admin` and your configured `ADMIN_PASSWORD`.
- [ ] **Direct URL Refresh**: Reload the page on `/repairs` or `/roads/1` to verify no 404 errors occur.
