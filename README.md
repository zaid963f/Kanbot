<p align="center">
  <img src="design/logo/kanbot-logo.png" alt="Kanbot" width="360">
</p>

<p align="center">
  <strong>Your sprint board with an AI teammate.</strong><br>
  A personal agile todo app (backlog → sprint → board) with an AI assistant that writes todos, plans sprints and summarises them.
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white">
  <img alt="Express 5" src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white">
  <img alt="Node 20+" src="https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=node.js&logoColor=white">
</p>

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [AI assistant setup](#ai-assistant-setup)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [API overview](#api-overview)
- [Environment variables](#environment-variables)
- [Documentation & design](#documentation--design)
- [Known limitations](#known-limitations)

---

## Features

### Agile workflow
- **Projects:** create, edit and delete projects, each with a short unique key (e.g. `WEB`). Switch between them from the sidebar.
- **Backlog:** quick-add todos (type + <kbd>Enter</kbd>), search and filter, reorder by drag and drop or ↑ ↓ buttons, and move todos into a sprint.
- **Todo details:** edit title, description, type, status, priority and story points (1, 2, 3, 5, 8, 13), with a "Discard changes?" guard.
- **Sprints:** plan, start and complete sprints. When a sprint is completed, unfinished todos go back to the backlog or into a planned sprint.
- **Kanban board:** drag cards across columns, with a live progress bar.
- **Sprint history:** completed sprints keep their stats (points done and todos completed).
- **Custom workflow:** each project can rename, recolour and reorder its board statuses and priorities, and add its own next to the built-in ones.

### AI assistant
- **Ask AI panel:** available on every project page. It has a chat with Markdown answers and quick actions.
- **Generate todos:** describe a feature and get 1–10 draft todos. You review and edit them, and nothing is saved until you confirm.
- **Plan sprint:** give a capacity and an optional focus. The AI suggests a sprint goal and picks backlog todos within that capacity, and explains why.
- **Sprint summary:** one click on the board, or automatically when a sprint is completed. It is saved and can be regenerated.
- **Free mock mode:** with no API key, a built-in rule-based assistant answers instantly and offline. Add a key to use any OpenAI-compatible LLM.
- **Safe by design:** the server validates everything the model returns, and the client never renders raw HTML from AI answers.

### Experience
- 🌗 **Light & dark themes:** follows the system setting, can be toggled, and doesn't flash on load.
- 🌍 **English & العربية:** full translation with right-to-left layout.
- 📱 **Responsive:** on narrow screens the sidebar moves to the top and the board scrolls sideways.
- ♿ **Accessible cues:** priority is shown with a symbol and a word, so colour is never the only signal.
- Every page has loading, empty and error states, and every change shows a toast.

---

## Tech stack

| Layer | Technologies |
|---|---|
| **Client** | React 19, TypeScript, Vite, React Router, TanStack Query, react-markdown + remark-gfm, plain CSS (no UI library) |
| **Server** | Node.js ≥ 20, Express 5, TypeScript, Zod validation, JWT auth, Helmet, express-rate-limit |
| **Storage** | JSON-file database (`server/data/db.json`), created on first run |
| **AI** | Any OpenAI-compatible Chat Completions API (OpenRouter, Groq, Gemini, Ollama…) or the built-in mock |

---

## Quick start

**Prerequisites:** [Node.js](https://nodejs.org/) 20 or newer and npm.

```bash
git clone https://github.com/zaid963f/Kanbot.git
cd Kanbot
```

**1. Start the API** (terminal 1)

```bash
cd server
npm install
cp .env.example .env    # works as-is; the AI runs in free mock mode
npm run seed            # demo data + demo user
npm run dev             # → http://localhost:4000/api/health
```

**2. Start the web app** (terminal 2)

```bash
cd client
npm install
cp .env.example .env    # VITE_API_URL=http://localhost:4000/api
npm run dev             # → http://localhost:5173
```

**3. Log in** at <http://localhost:5173> with the demo account:

| Email | Password |
|---|---|
| `demo@kanbot.dev` | `password123` |

The seed creates 2 projects, 3 sprints and 24 todos. Run `npm run seed` again at any time to reset the data.

> **Windows (PowerShell):** use `Copy-Item .env.example .env` instead of `cp`.

---

## AI assistant setup

Kanbot works without any AI key. To use a real model, edit `server/.env`:

| Configuration | Behaviour |
|---|---|
| `AI_API_KEY` empty, **or** `AI_MOCK=true` | **Mock mode:** rule-based, instant, free and offline. The UI shows a *Mock AI* badge. |
| `AI_API_KEY` + `AI_BASE_URL` + `AI_MODEL` set | **Real LLM** via `POST {AI_BASE_URL}/chat/completions` |

Example provider settings (keys are free on most of these tiers):

```ini
# Groq: https://console.groq.com/keys
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.3-70b-versatile
AI_API_KEY=your-key

# Local Ollama (no key needed, but the value must not be empty)
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=llama3.2
AI_API_KEY=ollama
```

See [`server/.env.example`](server/.env.example) for OpenRouter and Google Gemini.

**Guardrails:** the server coerces enum values, snaps story points to the allowed scale, and only accepts sprint plans made of real backlog ids within capacity. If the model returns unusable output, the mock result is used instead. AI routes are limited to **20 requests per minute per user**.

---

## Project structure

```
Kanbot/
├── client/                 # React + Vite web app
│   └── src/
│       ├── api/            # typed fetch wrappers for each resource
│       ├── components/     # Layout, modals, TodoRow, AI panel…
│       ├── context/        # Auth, Theme, I18n, Toast, AI providers
│       ├── hooks/          # data loading, drag-and-drop moves, workflow
│       ├── i18n/           # English + Arabic translations
│       ├── pages/          # Projects, Backlog, Board, Sprints, Login…
│       └── types/api.ts    # API contract (mirrors the server)
├── server/                 # Express 5 REST API
│   └── src/
│       ├── ai/             # LLM client + assistant (real and mock)
│       ├── config/         # validated environment
│       ├── db/             # JSON-file store
│       ├── middleware/     # auth, validation, errors, logging
│       ├── routes/         # auth, projects, todos, sprints, ai + zod schemas
│       ├── services/       # board logic, sprint stats, custom workflows
│       ├── scripts/        # seed + end-to-end smoke test
│       └── types/api.ts    # API contract, the source of truth
├── docs/                   # requirements & implementation plan (EN / AR)
└── design/                 # wireframes, logo, Figma source
```

---

## Scripts

### Server (`server/`)

| Command | Description |
|---|---|
| `npm run dev` | Start the API with auto-reload on port 4000 |
| `npm run seed` | Reset the database with demo data |
| `npm run smoke` | End-to-end test of every endpoint against a temporary database |
| `npm run typecheck` | Type-check without building |
| `npm run build` / `npm start` | Compile to `dist/` and run the production build |

### Client (`client/`)

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server on port 5173 |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

---

## API overview

Base URL: `http://localhost:4000/api`. Every route except `/auth/register`, `/auth/login` and `/health` needs an `Authorization: Bearer <token>` header.

| Area | Endpoints |
|---|---|
| **Auth** | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` |
| **Projects** | `GET/POST /projects` · `GET/PATCH/DELETE /projects/:projectId` |
| **Todos** | `GET/POST /projects/:projectId/todos` · `POST /projects/:projectId/todos/bulk` · `GET/PATCH/DELETE /todos/:todoId` · `POST /todos/:todoId/move` |
| **Sprints** | `GET/POST /projects/:projectId/sprints` · `GET/PATCH/DELETE /sprints/:sprintId` · `GET /sprints/:sprintId/todos` · `POST /sprints/:sprintId/start` · `POST /sprints/:sprintId/complete` |
| **AI** | `GET /ai/status` · `POST /projects/:projectId/ai/generate-todos` · `POST /projects/:projectId/ai/plan-sprint` · `POST /projects/:projectId/ai/chat` · `POST /sprints/:sprintId/ai/summary` |
| **Health** | `GET /health` |

All request and response types are in [`server/src/types/api.ts`](server/src/types/api.ts). The full API design is in the [implementation plan §4](docs/IMPLEMENTATION-PLAN.en.md#4-backend-api-design).

---

## Environment variables

### `server/.env`

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | API port |
| `NODE_ENV` | `development` | Runtime environment |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin(s), comma-separated |
| `JWT_SECRET` | — | **Change this.** Long random string used to sign tokens (`openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | `7d` | Session lifetime |
| `DATA_FILE` | `./data/db.json` | Path of the JSON database |
| `AI_MOCK` | `false` | Force the mock assistant even when a key is set |
| `AI_API_KEY` | *(empty)* | LLM provider key. Leave empty for mock mode |
| `AI_BASE_URL` | `https://openrouter.ai/api/v1` | OpenAI-compatible endpoint |
| `AI_MODEL` | *(empty)* | Model id |
| `AI_TIMEOUT_MS` | `60000` | LLM request timeout |

### `client/.env`

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000/api` | Base URL of the API |

> `.env` files are git-ignored. Never commit real keys or secrets.

---

## Documentation & design

| Document | English | العربية |
|---|---|---|
| Requirements | [REQUIREMENTS.en.md](docs/REQUIREMENTS.en.md) | [REQUIREMENTS.ar.md](docs/REQUIREMENTS.ar.md) |
| Implementation plan & API design | [IMPLEMENTATION-PLAN.en.md](docs/IMPLEMENTATION-PLAN.en.md) | [IMPLEMENTATION-PLAN.ar.md](docs/IMPLEMENTATION-PLAN.ar.md) |

- [`design/wireframes/`](design/wireframes/): 12 low-fidelity wireframes (the user flow plus 11 screens).
- [`design/logo/`](design/logo/): icon and logo in SVG and PNG, light and dark.
- `design/kanbot.figcraft` (source) and `design/kanbot.fig` (Figma export).
- More detail is in [`client/README.md`](client/README.md) and [`server/README.md`](server/README.md).

---

## Known limitations

- **Storage:** the JSON-file database suits a personal app or a demo, not concurrent multi-user production traffic.
- **Touch screens:** drag and drop doesn't work on them. Use the ↑ ↓ buttons, *Move to…*, or the status field in todo details instead.
- **AI output:** AI suggestions can be wrong. Every AI action asks you to review before anything is saved.
