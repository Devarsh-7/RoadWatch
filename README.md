<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38B2AC?style=for-the-badge&logo=tailwindcss" />
  <img src="https://img.shields.io/badge/Gemini_AI-RAG-4285F4?style=for-the-badge&logo=google" />
  <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa" />
</p>

# 🛣️ RoadWatch — AI-Powered Road Transparency Platform

> **IIT Madras Road Safety Hackathon 2026** | Centre of Excellence for Road Safety (CoERS) & RBG Labs

RoadWatch empowers Indian citizens to **monitor road conditions**, **track public infrastructure spending**, and **report road issues** to the correct authorities — bringing transparency and accountability to India's ₹4.76 lakh crore road network.

## 🎯 Problem Statement

India has the **2nd largest road network** in the world (5.9M+ km), yet citizens have no easy way to:
- Know who built their road and how much was spent
- Check if road maintenance budgets are being utilized properly
- Report potholes/damage to the **correct authority** (NHAI vs PWD vs District Collector)

**RoadWatch solves this** by creating a single platform that combines open government data with AI-powered insights.

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔍 **Smart Search** | Search any road by name, NH number, or GPS location |
| 📊 **Budget Transparency** | View sanctioned vs spent amounts with utilization scores |
| 🏗️ **Contractor Details** | See who built the road, contact info, and repair history |
| 📝 **Smart Complaint Routing** | NH → NHAI, SH → State PWD, MDR → District Collector |
| 🤖 **AI Chatbot (RAG)** | Ask questions about any road — powered by Gemini AI |
| 📈 **Dashboard** | Real-time analytics with charts, maps, and condition reports |
| 🗺️ **Interactive Map** | Leaflet-based visualization of road networks |
| 📱 **PWA + Offline** | Works offline, queues complaints for sync when online |
| ⭐ **Transparency Score** | 0-100 health score based on repairs, budget, and complaints |

## 🏗️ Tech Stack

### Frontend
- **React 19** + **Vite 8** — Lightning-fast SPA
- **Tailwind CSS v4** — Utility-first styling with glassmorphism design
- **Framer Motion** — Spring-based animations & page transitions
- **Recharts** — Interactive data visualization (bar, pie, area charts)
- **Leaflet** — Interactive maps with custom road overlays
- **PWA** — Service worker for offline support

### Backend
- **FastAPI** — High-performance Python REST API
- **SQLAlchemy** — ORM with SQLite (dev) / PostgreSQL (prod)
- **Google Gemini AI** — RAG-based chatbot with road data context
- **Pydantic** — Request/response validation

## 🏛️ System Architecture

For an in-depth technical breakdown including C4 diagrams, sequence flows, database entity relationships, and algorithmic scoring formulas, read the [**Full System Architecture Specification (ARCHITECTURE.md)**](ARCHITECTURE.md).

## 📁 Project Structure

```
RoadWatch/
├── ARCHITECTURE.md         # Complete system architecture specification & diagrams
├── frontend/
│   ├── src/
│   │   ├── components/     # Navbar, Footer, BeforeAfterSlider, CitizenVerification
│   │   ├── pages/          # Landing, Search, Dashboard, Complaint, Chatbot, RoadDetail, Admin
│   │   ├── api.js          # API client with offline queue
│   │   └── index.css       # Design system (glassmorphism theme)
│   ├── index.html
│   └── vite.config.js
│
├── backend/
│   ├── main.py             # FastAPI routes (roads, complaints, authorities, repairs, admin)
│   ├── models.py           # SQLAlchemy models (Road, Complaint, Authority, Repair, AuditLog)
│   ├── schemas.py          # Pydantic validation schemas
│   ├── chatbot.py          # Gemini AI RAG chatbot with FAISS vector store
│   ├── security.py         # PBKDF2 cryptography, PyJWT, IDOR & jurisdictional control
│   ├── abuse_protection.py # Sliding-window rate limiters & bot honeypots
│   ├── data_ingestion.py   # OpenStreetMap Overpass & CSV bulk import pipelines
│   ├── seed_data.py        # 20 realistic roads across 5 Indian states
│   ├── database.py         # DB connection & connection pooling (SQLite / Supabase Postgres)
│   └── requirements.txt
│
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ & npm
- **Python** 3.10+
- **Google Gemini API Key** ([Get one free](https://aistudio.google.com/apikey))

### 1. Clone the repo
```bash
git clone https://github.com/sshekhar563/RoadW.git
cd RoadW
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install -r requirements.txt

# Create .env file
echo GOOGLE_API_KEY=your_gemini_api_key_here > .env

# Seed database & start server
python seed_data.py
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** 🎉

## 📊 Data Sources

| Source | Data Used |
|--------|-----------|
| [data.gov.in](https://data.gov.in) | State-wise road lengths, road expenditure statistics |
| [nhai.gov.in](https://nhai.gov.in) | NH project details, contractor info, budget data |
| [OpenStreetMap](https://www.openstreetmap.org) | Road geo-coordinates (lat/lng) |
| [MoRTH Reports](https://morth.nic.in) | Annual road statistics, condition reports |

## 🧮 Transparency Score Algorithm

Each road gets a **0-100 transparency score** based on:

| Factor | Weight | Logic |
|--------|--------|-------|
| Repair Recency | 40 pts | <6mo = 40, <1yr = 30, <2yr = 15, else 5 |
| Budget Utilization | 40 pts | 70-100% = 40, 50-70% = 25, >100% = 10 (over-budget flag) |
| Complaint Volume | 20 pts | 0 complaints = 20, ≤3 = 15, ≤10 = 5, >10 = 0 |

## 📸 Screenshots

> *Add screenshots of your app here before submission*


## 📄 License

This project is built for the **IIT Madras Road Safety Hackathon 2026** organized by CoERS & RBG Labs.

---

<p align="center">
  <b>Built with ❤️ for safer Indian roads</b>
</p>
