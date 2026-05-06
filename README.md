# HomeLane HDS — Pre-Dispatch Planner

A local-prototype web application for the HomeLane HDS team. Lets a planner edit task dependencies and drag-reorder rows, then click **Update** to persist changes, re-run CPM, and refresh the Gantt.

---

## Prerequisites

- **Python 3.10+** (`python3.10 --version`)
- **Node 18+** (`node --version`)
- **npm 9+** (`npm --version`)
- The CSV file: `HDS Plan Dependency Dashboard - Data Dump.csv`

---

## Backend setup (one shot)

```bash
cd hds-planner/backend

# Create venv (use python3.10 or higher — Django 5.2 requires ≥3.10)
python3.10 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -r requirements.txt

python manage.py migrate

# (Optional) Create a superuser to inspect the admin
python manage.py createsuperuser

# Seed the 53 pre-dispatch tasks from CSV
python manage.py seed_predispatch --csv "../HDS Plan Dependency Dashboard - Data Dump.csv"
# Expected output:
#   Seeded 53 pre-dispatch tasks. Project duration: 24 days. 10 critical tasks.

# Start the API server
python manage.py runserver 8000
```

---

## Frontend setup (one shot)

In a second terminal:

```bash
cd hds-planner/frontend
npm install
npm run dev          # starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Django admin

Visit **http://localhost:8000/admin/** and log in with the superuser credentials you created above. From there you can inspect all 53 Task rows, view their dependency M2M relationships, and modify them directly.

---

## How drag-and-drop interacts with CPM

**Drag is purely a display hint.** When you drag a row up or down in the Gantt table, you are changing `sort_order` — a UI tiebreaker field that determines how tasks are displayed when they share the same Early Start. The `sort_order` is persisted to SQLite when you click **Update**, but it never overrides the schedule computed from the `deps` graph.

**Dependencies drive the schedule.** The Critical Path Method (CPM) uses only the `deps` (M2M prerequisite edges) and `days` values to compute `es` (Early Start), `ef` (Early Finish), `ls` (Late Start), `lf` (Late Finish), and `slack` for every task. A task is on the critical path when `slack == 0`. Moving M1 to row 5 via drag does not change its ES (it will always be 0, having no predecessors), confirming that drag is cosmetic and dependencies are authoritative.

---

## Sample API calls

```bash
# Get the full plan (CPM schedule)
curl http://localhost:8000/api/plan/

# Get flat task list (for deps editor)
curl http://localhost:8000/api/tasks/

# Update task C2 deps
curl -X PUT http://localhost:8000/api/tasks/C2/ \
  -H "Content-Type: application/json" \
  -d '{"deps": ["D1", "PL1"]}'

# Reorder tasks (sets sort_order)
curl -X POST http://localhost:8000/api/plan/reorder/ \
  -H "Content-Type: application/json" \
  -d '{"order": ["M1", "D1", "D4", "D7", "D2"]}'

# Recompute schedule (returns same shape as GET /api/plan/)
curl -X POST http://localhost:8000/api/plan/recompute/ \
  -H "Content-Type: application/json"

# Cycle detection — returns HTTP 400
curl -X PUT http://localhost:8000/api/tasks/D1/ \
  -H "Content-Type: application/json" \
  -d '{"deps": ["M1", "C2"]}'
# Response: {"error": "Cycle detected", "scc": "['C2', 'D1']"}
```

---

## Architecture notes

| Layer | Tech | Version |
|---|---|---|
| Frontend | React (Vite) | ^18.2.0 |
| Backend | Django + DRF | Django 5.2, DRF 3.15 |
| Database | SQLite | bundled with Python |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable | latest |
| HTTP client | fetch (browser native) | — |
| Styling | Plain CSS + HomeLane brand tokens | — |

### CPM algorithm

1. **Kahn's topological sort** — forward pass. Any failed sort (leftover nodes) → `ValueError("Cycle detected: …")`.
2. **Forward pass** — `es[c] = max(ef[predecessor])`, `ef[c] = es[c] + days`.
3. **Backward pass** — `lf[c] = min(ls[successor])` (or `project_finish` for sinks), `ls[c] = lf[c] - days`.
4. **Slack** = `lf − ef`. **Critical** = `slack == 0`.
