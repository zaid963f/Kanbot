# Kanbot – Frontend

A personal todo app built around sprints: **backlog → sprint → board**.
The backend is in `../server`. I extended it with per-project custom statuses and priorities (`src/services/workflow.service.ts`).

## How to run

```bash
# backend
cd server
npm install
cp .env.example .env
npm run seed      # demo user: demo@kanbot.dev / password123
npm run dev       # http://localhost:4000/api

# frontend (in another terminal)
cd client
npm install
cp .env.example .env
npm run dev       # http://localhost:5173
```

`npm run lint` and `npm run build` both run without errors.

## What I used

- **React + TypeScript + Vite**
- **React Router** for the pages
- **TanStack Query** to load data from the API and refresh it after changes
- **Plain CSS** (`src/index.css`, plus `src/ai.css` for the AI parts). No UI library, so I could choose my own look.
- **react-markdown + remark-gfm** to show the AI's Markdown answers. It never renders raw HTML, so the AI can't inject markup.

I kept the libraries to a minimum. Forms use `useState`, and drag and drop uses the browser's built-in HTML drag events.

## Design

- A warm light background with one orange colour (`#e8552b`) for the main buttons. I recoloured the Kanbot logo to match.
- Font: **Nunito** (Google Fonts). It is round and friendly and easy to read.
- Board columns have their own soft colour (To Do, In Progress, In Review, Done).
- Priority shows a symbol and a word (↓ Low, = Medium, ↑ High, ⇈ Urgent), so colour is not the only signal.
- On screens smaller than 900px the sidebar moves to the top and the board scrolls sideways.

## Folders

```
src/
  api/          functions that call the backend (client.ts has the shared fetch code)
  components/   reusable parts: Layout, Modal, TodoRow, forms and modals
  context/      AuthContext (login state), ToastContext (messages), AiContext (assistant drawer, chat, AI dialogs)
  hooks/        data loading (useProjectData, useAiStatus) and drag-and-drop moves (useMoveTodo)
  pages/        one file per page
  types/api.ts  types copied from the server
  utils/        date formatting and labels
```

## What works

- **Login / Register** with validation and server errors. You stay logged in after a reload. Log out works. Private pages need login (`?redirect=` takes you back after login). If the session expires you go to login with a message.
- **Projects:** list, create, edit and delete (with confirmation). An empty state. A "key already used" error shows under the key field. Switch projects in the sidebar.
- **Backlog:** list with totals, quick add (type + Enter), todo details (edit every field, "Discard changes?", delete), search and filters, reorder with drag and drop or ↑ ↓ buttons, move todos to a sprint with drag or "Move to…".
- **Sprints:** create, edit, delete and start a planned sprint. The board has 4 columns, drag and drop, and a progress bar. Complete a sprint (unfinished todos go to the backlog or a planned sprint). Sprint history with stats.
- Loading, empty and error states on every page, plus a message after every change.
- **AI assistant (AI-1 to AI-5):**
  - **Ask AI** button in the top bar of every project page opens a side panel: quick actions (Create todos, Plan sprint, Summarize sprint), a chat with Markdown answers, "Thinking…" while waiting, Enter sends / Shift+Enter new line. The chat stays while the panel is closed and resets on project switch or "New chat".
  - **Generate todos:** describe a feature, pick how many (1–10), then edit the drafts (title, type, priority, points), untick the ones you don't want and add them to the backlog in one go. Nothing is saved before that.
  - **Plan sprint:** give a capacity and an optional focus. The AI suggests a goal (editable), backlog todos (you can tick/untick any backlog todo) with a running total vs capacity, and its reasoning. "Create sprint with N todos" creates a planned sprint.
  - **Sprint summary:** on the board and on active/completed sprint pages. The saved summary shows with its time and a Regenerate button. "Generate AI summary" checkbox when completing a sprint.
  - Every AI action has a spinner/skeleton, an error with "Try again", and "AI can make mistakes. Review before saving." A **Mock AI** badge shows when the server has no AI key (or `AI_MOCK=true`).

## Known issues

- Drag and drop does not work on touch screens. The ↑ ↓ buttons, "Move to…" and the status field in the todo details still work.
