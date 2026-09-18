# 🛣️ RoadWatch — Backend API

**AI-powered road transparency & complaint management for Indian citizens.**

Built for the IIT Madras Road Safety Hackathon 2026.

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Framework | Python FastAPI                      |
| Database  | SQLite + SQLAlchemy ORM             |
| AI Chat   | LangChain + Google Gemini + FAISS   |
| Data      | Pandas (processing)                 |

---

## Quick Start

### 1. Create virtual environment

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
# Add your GOOGLE_API_KEY for AI chatbot (optional — fallback mode available)
```

### 4. Run the server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The database is **auto-created and seeded** with 20 Indian roads on first launch.

---

## API Endpoints

| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| GET    | `/api/roads`                | List all roads           |
| GET    | `/api/roads/search?q=`      | Search roads by name     |
| GET    | `/api/roads/{id}`           | Full road details        |
| GET    | `/api/roads/nearby?lat=&lng=` | Find nearby roads      |
| POST   | `/api/complaints`           | File a complaint         |
| GET    | `/api/complaints/{road_id}` | Complaints for a road    |
| POST   | `/api/chat`                 | AI chatbot message       |
| GET    | `/api/stats`                | Dashboard statistics     |
| GET    | `/api/authorities`          | List authorities         |
| GET    | `/api/health`               | Health check             |

---

## Database

SQLite database (`roadwatch.db`) with 3 tables:
- **roads** — 20 pre-seeded Indian roads across 5 states
- **complaints** — Citizen complaints with smart routing
- **authorities** — Government officers mapped to roads

---

## AI Chatbot

- Uses **LangChain RAG** with **FAISS** vector store
- Powered by **Google Gemini 1.5 Flash** (free tier)
- Falls back to keyword search if no API key is set
- Answers questions about roads, budgets, and authorities

---

## Deployment (Render)

1. Push to GitHub
2. Create a new Web Service on [Render](https://render.com)
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add `GOOGLE_API_KEY` environment variable
