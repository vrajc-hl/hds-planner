// In production (Render static site) VITE_API_BASE points to the backend service URL.
// In local dev it's empty and the Vite proxy handles /api → localhost:8000.
const BASE = import.meta.env.VITE_API_BASE || ''

export async function fetchPlan() {
  const res = await fetch(`${BASE}/api/plan/`)
  if (!res.ok) throw new Error('Failed to fetch plan')
  return res.json()
}

export async function fetchTasks() {
  const res = await fetch(`${BASE}/api/tasks/`)
  if (!res.ok) throw new Error('Failed to fetch tasks')
  return res.json()
}

export async function reorderTasks(order) {
  const res = await fetch(`${BASE}/api/plan/reorder/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  })
  if (!res.ok) throw new Error('Failed to reorder')
}

export async function updateTask(code, payload) {
  const res = await fetch(`${BASE}/api/tasks/${code}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error || 'Update failed')
    err.status = res.status
    err.scc = data.scc
    throw err
  }
  return data
}

export async function recompute() {
  const res = await fetch(`${BASE}/api/plan/recompute/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error('Recompute failed')
  return res.json()
}
