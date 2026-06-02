
<div align="center">

```
██████╗ ██████╗  ██████╗ ██████╗ ██╗     ██╗███╗   ██╗██╗  ██╗
██╔══██╗██╔══██╗██╔═══██╗██╔══██╗██║     ██║████╗  ██║██║ ██╔╝
██║  ██║██████╔╝██║   ██║██████╔╝██║     ██║██╔██╗ ██║█████╔╝ 
██║  ██║██╔══██╗██║   ██║██╔═══╝ ██║     ██║██║╚██╗██║██╔═██╗ 
██████╔╝██║  ██║╚██████╔╝██║     ███████╗██║██║ ╚████║██║  ██╗
╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝
```

**Share files instantly. No sign-up. No friction. Just a link.**

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app)

![Python](https://img.shields.io/badge/Python-3.10-3776AB?style=flat-square&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0-000000?style=flat-square&logo=flask&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-Storage-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

</div>

---

## What is DropLink?

DropLink is a **no-signup, ephemeral file sharing platform**. Upload any file up to 1 GB, get a shareable link, and it auto-deletes after your chosen expiry — 24 hours, 2 days, or 7 days. The person receiving the link doesn't need an account either.

> Built as a full-stack college project. Clean codebase, production-grade architecture, deployed on Railway + Supabase.

---

## Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [How It Works](#-how-it-works)
- [File Lifecycle](#-file-lifecycle)
- [Token System](#-token-system)
- [Tech Stack](#-tech-stack)
- [API Reference](#-api-reference)
- [Security](#-security)
- [Setup & Installation](#-setup--installation)
- [Environment Variables](#-environment-variables)
- [Deployment — Railway](#-deployment--railway)
- [Cleanup & Maintenance](#-cleanup--maintenance)
- [Enterprise API](#-enterprise-api--coming-soon)
- [Project Structure](#-project-structure)

---

## ✨ Features

| Feature | Detail |
|---|---|
| 📁 **Any file type** | PDFs, videos, ZIPs, images, docs — anything up to 1 GB |
| ⏱️ **Expiry control** | Choose 24h, 2 days, or 7 days per upload |
| 🔗 **One-click share** | Copy link, share on WhatsApp or Telegram directly |
| 📋 **My Files** | Browser-local history of all your uploads — re-share or delete |
| 🖼️ **Image preview** | Thumbnail shown on download page for image files |
| 📊 **Download tracking** | See how many times each file was downloaded (uploader only) |
| 🔐 **Token-based rate limiting** | 10 tokens/day per browser — small files cost 1, large files cost 3 |
| 🗑️ **Proactive cleanup** | Expired files deleted from cloud storage automatically on every upload cycle |
| 📱 **Fully responsive** | Works on mobile, tablet, and desktop |
| 🚫 **Zero tracking** | Rate-limit data auto-purged daily. No cookies, no accounts |

---

## 🏗 Architecture

```mermaid
graph TB
    subgraph Client ["🌐 Client (Browser)"]
        React["⚛️ React 18\nSPA — 3 pages"]
        LS["📦 localStorage\nowner_token · device_token"]
    end

    subgraph Server ["🐍 Flask Backend (Railway)"]
        API["REST API\n/api/*"]
        Cleanup["🗑️ _cleanup_expired()\nRuns on every upload"]
        RateLimit["🔢 Token Rate Limiter\nPer browser · 10/day"]
    end

    subgraph Storage ["☁️ Cloud Storage"]
        Supabase["Supabase S3\nAES-256 encrypted\nFiles stored by random token"]
        SQLite["🗄️ SQLite\nFile metadata\nToken usage"]
    end

    React -->|"POST /api/upload\nX-Device-Token header"| API
    React -->|"GET /api/file/:token"| API
    React -->|"GET /api/download/:token"| API
    React -->|"GET /api/preview/:token"| API
    React -->|"GET /api/my/:ownerToken"| API

    API --> RateLimit
    API --> Cleanup
    API -->|"upload_file / stream_file / delete_file"| Supabase
    API -->|"INSERT · SELECT · DELETE"| SQLite

    LS -.->|"owner_token sent as X-Device-Token"| React
```

---

## 🔄 How It Works

```mermaid
sequenceDiagram
    actor U as Uploader
    actor R as Recipient
    participant FE as React Frontend
    participant BE as Flask API
    participant SB as Supabase Storage
    participant DB as SQLite

    U->>FE: Drop file + choose expiry
    FE->>BE: POST /api/upload (file, expires_in, X-Device-Token)
    BE->>BE: _cleanup_expired() — purge any expired files first
    BE->>DB: Check daily token balance for device
    DB-->>BE: tokens_used today
    BE->>SB: Upload file (stored as random_token.ext)
    BE->>DB: INSERT file metadata (token, size, expires_at…)
    BE->>DB: Deduct upload tokens for device
    BE-->>FE: { token, share_url, tokens_left }
    FE-->>U: Show share link + WhatsApp / Telegram buttons

    U->>R: Sends link  →  droplink.app/d/a3f9c12e01

    R->>FE: Opens /d/a3f9c12e01
    FE->>BE: GET /api/file/a3f9c12e01
    BE->>DB: SELECT file WHERE token = a3f9c12e01
    DB-->>BE: file row
    BE-->>FE: { name, size, mimetype, expires_at }
    FE-->>R: Show file info + Download button

    R->>BE: GET /api/download/a3f9c12e01
    BE->>DB: INCREMENT downloads counter
    BE->>SB: Stream file bytes
    SB-->>BE: File stream + Content-Length
    BE-->>R: File download (Content-Disposition: attachment)
```

---

## ♻️ File Lifecycle

```mermaid
stateDiagram-v2
    direction LR

    [*] --> Uploading : User selects file

    Uploading --> Active : Stored in Supabase\nMetadata saved in DB

    Active --> Active : Downloads tracked\nLink shareable

    Active --> Expired : expires_at timestamp\npasses UTC midnight

    Expired --> Deleted : _cleanup_expired()\nruns on next upload\nor /api/cleanup call

    Deleted --> [*] : Removed from Supabase\nRemoved from DB\nLink returns 410 Gone
```

---

## 🔢 Token System

Each browser gets **10 upload tokens per day** — tracked by a unique device token stored in `localStorage`, not by IP address. This means two people on the same WiFi each get their own full 10 tokens.

```
Token cost per upload:
┌────────────────────────┬───────────┐
│ File size              │ Cost      │
├────────────────────────┼───────────┤
│ < 50 MB                │ 1 token   │
│ 50 MB – 500 MB         │ 2 tokens  │
│ 500 MB – 1 GB          │ 3 tokens  │
└────────────────────────┴───────────┘

Daily capacity examples:
  10 small files  (<50 MB each)   = 10 × 1 = 10 tokens ✓
   5 medium files (<500 MB each)  =  5 × 2 = 10 tokens ✓
   3 large files  (up to 1 GB)    =  3 × 3 =  9 tokens ✓

Token counter resets at UTC midnight every day.
Rate-limit records are auto-purged — no data kept after the day ends.
```

---

## 💻 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, React Router v6 | SPA with 3 pages: Home, Download, Manage |
| **Styling** | Pure CSS (custom design system) | Dark theme, CSS variables, responsive |
| **Backend** | Python 3.10, Flask 3.0 | REST API, file handling, rate limiting |
| **File Storage** | Supabase S3-compatible Storage | AES-256 encrypted cloud object storage |
| **Database** | SQLite (via Python sqlite3) | File metadata, daily token usage |
| **CORS** | Flask-CORS | Allows `X-Device-Token` custom header |
| **Cloud Storage SDK** | boto3 (AWS S3-compatible) | Upload, stream, delete via Supabase S3 API |
| **Deployment** | Railway | Auto-deploy from GitHub, single service |

---

## 📡 API Reference

All endpoints are prefixed with `/api`.

### Upload a file

```http
POST /api/upload
Content-Type: multipart/form-data
X-Device-Token: <browser-device-token>
```

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | ✅ | The file to upload (max 1 GB) |
| `expires_in` | string | ❌ | `24h` · `2d` · `7d` (default: `24h`) |
| `owner_token` | string | ❌ | Browser owner token for "My Files" grouping |

**Response `201 Created`**
```json
{
  "token":        "a3f9c12e01",
  "owner_token":  "abc123...",
  "name":         "presentation.pptx",
  "size":         "4.2 MB",
  "expires_in":   "24h",
  "expires_at":   "2026-06-03T10:00:00Z",
  "tokens_used":  1,
  "tokens_left":  9,
  "tokens_limit": 10
}
```

**Response `429 Too Many Requests`** — daily token limit reached
```json
{
  "error": "Daily limit reached. 0 token(s) left.",
  "tokens_left": 0,
  "tokens_limit": 10
}
```

---

### Get file info

```http
GET /api/file/:token
```

**Response `200 OK`**
```json
{
  "token":      "a3f9c12e01",
  "name":       "presentation.pptx",
  "size":       "4.2 MB",
  "size_bytes": 4404019,
  "mimetype":   "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "expires_at": "2026-06-03T10:00:00Z",
  "created_at": "2026-06-02 10:00:00"
}
```

**Response `410 Gone`** — link has expired
```json
{ "error": "This link has expired" }
```

---

### Download a file

```http
GET /api/download/:token
```

Returns the file as an attachment (`Content-Disposition: attachment`). Always forces a download — never opens in the browser. Increments the download counter.

---

### Preview an image

```http
GET /api/preview/:token
```

Returns image files inline (no forced download). Only works for `image/*` MIME types — returns `400` for other file types. Used to render thumbnails on the download page.

---

### My files

```http
GET /api/my/:ownerToken
```

**Response `200 OK`**
```json
{
  "files": [
    {
      "token":      "a3f9c12e01",
      "name":       "presentation.pptx",
      "size":       "4.2 MB",
      "mimetype":   "application/vnd.ms-powerpoint",
      "downloads":  7,
      "expires_in": "24h",
      "expires_at": "2026-06-03T10:00:00Z",
      "created_at": "2026-06-02 10:00:00",
      "expired":    false
    }
  ]
}
```

---

### Delete a file

```http
DELETE /api/my/:ownerToken/:token
```

Deletes the file from Supabase storage and the database. Requires the matching `ownerToken` — files cannot be deleted by others.

---

### Token balance

```http
GET /api/tokens
X-Device-Token: <browser-device-token>
```

**Response `200 OK`**
```json
{ "limit": 10, "used": 1, "left": 9 }
```

---

### Cleanup (admin / cron)

```http
GET  /api/cleanup?secret=<CLEANUP_SECRET>
POST /api/cleanup
     X-Cleanup-Secret: <CLEANUP_SECRET>
```

Proactively deletes all expired files from Supabase storage and the database. Also purges daily rate-limit records older than today. The `CLEANUP_SECRET` check is skipped if the env var is not set.

**Response `200 OK`**
```json
{
  "ok":      true,
  "deleted": 3,
  "message": "Purged 3 expired file(s) from storage and cleared stale rate-limit records.",
  "ran_at":  "2026-06-02T12:00:00Z"
}
```

---

## 🔐 Security

Every claim here is backed by real code — not marketing text.

### AES-256 Encrypted Storage
Files are uploaded to **Supabase S3-compatible storage**, which applies AES-256 encryption at rest to every stored object at the infrastructure level. DropLink never writes files to an unencrypted disk.

### Private Link — Never Indexed
Files are stored under a randomly generated 10-character hex token (`uuid4().hex[:10]`). The token space is **16¹⁰ = 1,099,511,627,776** combinations — computationally infeasible to brute-force. There is no search endpoint, no file listing, and no directory. The only access path is the exact URL.

### Proactive Permanent Deletion
`_cleanup_expired()` runs on **every upload request** and immediately removes all expired files from Supabase storage + the database. Files do not linger in cloud storage waiting to be lazily cleaned. The `/api/cleanup` endpoint can also be triggered on a schedule via Railway Cron.

```python
# backend/routes/files.py — runs on every upload
def _cleanup_expired():
    expired = db.execute(
        "SELECT stored_name FROM files WHERE expires_at < ?", [now_str]
    ).fetchall()
    for row in expired:
        sb_delete(row['stored_name'])          # deleted from Supabase
    db.execute("DELETE FROM files WHERE expires_at < ?", [now_str])  # deleted from DB
    db.execute("DELETE FROM daily_usage WHERE date < ?", [today])    # purge rate data
```

### Rate-Limit Data Auto-Purged Daily
The only data stored about a user is today's upload token count, keyed by a browser-generated device token (not an IP address). This record is **deleted at end of day** — no data survives past the current UTC day.

### No Tracking, No Cookies, No Accounts
- No cookies set anywhere in the application
- No analytics or telemetry
- No user accounts or email addresses collected
- `localStorage` stores only two opaque tokens: `droplink_owner_token` (file ownership) and the device token (rate limiting). Neither is linked to any personal identity.

---

## 🚀 Setup & Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- A [Supabase](https://supabase.com) project with a storage bucket

### 1. Clone the repository

```bash
git clone https://github.com/mbhuvan898/DropLink.git
cd DropLink
```

### 2. Backend setup

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:

```env
SUPABASE_ACCESS_KEY=your_supabase_access_key
SUPABASE_SECRET_KEY=your_supabase_secret_key
SUPABASE_ENDPOINT=https://<project-ref>.storage.supabase.co/storage/v1/s3
SUPABASE_PROJECT_REF=your_project_ref
SUPABASE_BUCKET=your_bucket_name
SUPABASE_REGION=us-east-1
CLEANUP_SECRET=your_optional_cleanup_secret
```

Start the backend:

```bash
python app.py
# → http://localhost:5002
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm start
# → http://localhost:3000 (proxies API to :5002)
```

### 4. Production build (served by Flask)

```bash
cd frontend
npm run build
# Flask serves frontend/build/ automatically
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_ACCESS_KEY` | ✅ | Supabase S3 access key ID |
| `SUPABASE_SECRET_KEY` | ✅ | Supabase S3 secret access key |
| `SUPABASE_ENDPOINT` | ✅ | `https://<ref>.storage.supabase.co/storage/v1/s3` |
| `SUPABASE_PROJECT_REF` | ✅ | Your Supabase project reference ID |
| `SUPABASE_BUCKET` | ✅ | Name of the storage bucket |
| `SUPABASE_REGION` | ❌ | Storage region (default: `us-east-1`) |
| `CLEANUP_SECRET` | ❌ | If set, `/api/cleanup` requires this value as `?secret=` or `X-Cleanup-Secret` header |
| `PORT` | ❌ | HTTP port (default: `5002`, Railway sets this automatically) |

---

## 🚂 Deployment — Railway

DropLink is pre-configured for one-click Railway deployment.

### Automatic deployment

1. Fork this repository
2. Create a new Railway project → **Deploy from GitHub repo**
3. Add the environment variables listed above in Railway's **Variables** tab
4. Railway auto-detects `railway.json` and starts with:
   ```
   cd backend && python app.py
   ```

### Optional: Scheduled cleanup cron

To ensure expired files are purged even during periods of no uploads:

1. Railway dashboard → your service → **Cron Jobs**
2. Add a new cron:
   - **Schedule:** `0 * * * *` (every hour)
   - **Command:** `curl https://your-app.railway.app/api/cleanup?secret=$CLEANUP_SECRET`

```
┌─────────────────────────────────────────────────────────┐
│  Railway Service                                         │
│                                                         │
│  Start:   cd backend && python app.py                   │
│  Port:    $PORT (set by Railway)                        │
│  Build:   Nixpacks (auto-detects requirements.txt)      │
│  Cron:    0 * * * * → GET /api/cleanup?secret=...       │
└─────────────────────────────────────────────────────────┘
```

---

## 🧹 Cleanup & Maintenance

### How cleanup works

```
Every upload request
        │
        ▼
 _cleanup_expired()
        │
        ├─► Find all files WHERE expires_at < NOW()
        │
        ├─► Delete each from Supabase storage (sb_delete)
        │
        ├─► DELETE FROM files WHERE expires_at < NOW()
        │
        └─► DELETE FROM daily_usage WHERE date < TODAY
                 (purges yesterday's rate-limit data)
```

### Manual cleanup

```bash
# No secret set
curl https://your-app.railway.app/api/cleanup

# With CLEANUP_SECRET
curl -H "X-Cleanup-Secret: your_secret" https://your-app.railway.app/api/cleanup

# Via query param (for cron URL)
curl https://your-app.railway.app/api/cleanup?secret=your_secret
```

---

## 🏢 Enterprise API — Coming Soon

A programmatic file-transfer API for teams and applications — currently in design phase.

### Planned architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DropLink Enterprise API                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   POST /api/enterprise/upload                                   │
│   Authorization: Bearer dk_live_••••••••••                      │
│                                                                 │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │  API Key     │    │  Bulk Upload │    │  Webhooks    │     │
│   │  Auth        │    │  Multi-file  │    │  on download │     │
│   │  Per-app     │    │  Batch jobs  │    │  on expiry   │     │
│   └──────────────┘    └──────────────┘    └──────────────┘     │
│                                                                 │
│   ┌──────────────┐    ┌──────────────┐                         │
│   │  Higher      │    │  Priority    │                         │
│   │  Limits      │    │  CDN Edge    │                         │
│   │  Custom TTL  │    │  Delivery    │                         │
│   └──────────────┘    └──────────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Planned API shape

```http
POST /api/enterprise/upload
Authorization: Bearer dk_live_a1b2c3d4e5f6

Content-Type: multipart/form-data

file=<binary>
expires_in=7d
webhook_url=https://yourapp.com/hooks/droplink
```

```json
{
  "token":      "a3f9c12e01",
  "share_url":  "https://droplink.app/d/a3f9c12e01",
  "expires_at": "2026-06-09T10:00:00Z",
  "size":       "128.4 MB",
  "webhook_registered": true
}
```

```http
POST https://yourapp.com/hooks/droplink   ← fired by DropLink
Content-Type: application/json

{
  "event":      "file.downloaded",
  "token":      "a3f9c12e01",
  "downloads":  1,
  "timestamp":  "2026-06-02T11:30:00Z"
}
```

> 📬 **Interested?** Open an issue on GitHub to join the waitlist.

---

## 📁 Project Structure

```
DropLink/
├── backend/
│   ├── app.py                  # Flask app factory, static file serving
│   ├── database.py             # SQLite init, schema, migrations
│   ├── supabase_client.py      # Supabase S3 upload / stream / delete
│   ├── s3_client.py            # (legacy local S3 helper)
│   ├── routes/
│   │   ├── __init__.py
│   │   └── files.py            # All API endpoints + cleanup logic
│   ├── uploads/                # Local fallback storage (no Supabase)
│   ├── droplink.db             # SQLite database file
│   └── .env                    # Environment variables (not committed)
│
├── frontend/
│   ├── src/
│   │   ├── App.js              # Router — 3 routes: / · /d/:token · /my/:owner
│   │   ├── index.css           # Full design system (CSS variables, dark theme)
│   │   ├── index.js
│   │   └── pages/
│   │       ├── Home.jsx        # Upload page, success card, share buttons
│   │       ├── Download.jsx    # Download page, image preview, upload CTA
│   │       └── Manage.jsx      # My Files — inline delete confirm, timestamps
│   ├── public/
│   │   └── index.html
│   ├── build/                  # Production build (served by Flask)
│   └── package.json
│
├── Procfile                    # web: cd backend && python app.py
├── railway.json                # Railway deploy config
├── requirements.txt            # Root-level pip deps (for Nixpacks detection)
├── runtime.txt                 # python-3.10
└── README.md                   # This file
```

---

## 📜 License

MIT License — free to use, modify, and distribute.

---

<div align="center">

Built with ♥ by **Nishmitha Pawan** · Deployed on [Railway](https://railway.app) · Storage by [Supabase](https://supabase.com)

</div>
