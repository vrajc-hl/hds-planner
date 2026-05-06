import React from 'react'

function getNextMonday() {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 1 : (8 - day) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

export default function Header({ plan, startDate, onStartDateChange, dirty, updating, onUpdate, onRevert, onExport }) {
  const totalDays = plan?.project_days ?? '—'
  const taskCount = plan?.total_tasks ?? '—'
  const critCount = plan?.critical_count ?? '—'

  function computeEndDate() {
    if (!plan?.project_days || !startDate) return '—'
    const start = new Date(startDate + 'T00:00:00')
    let added = 0
    const cur = new Date(start)
    while (added < plan.project_days) {
      cur.setDate(cur.getDate() + 1)
      if (cur.getDay() !== 0) added++
    }
    return cur.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="header">
      <div className="header-row">
        <div className="brand">
          <span className="gem" />
          <div>
            <h1>
              HomeLane HDS — Pre-Dispatch Planner
              <span className="plan-pill">Pre-Dispatch</span>
            </h1>
          </div>
        </div>

        <div className="header-meta">
          <div className="stat">
            <span className="stat-label">Project Start</span>
            <input
              type="date"
              className="date-input"
              value={startDate}
              onChange={e => onStartDateChange(e.target.value)}
            />
          </div>
          <div className="stat">
            <span className="stat-label">Working Days</span>
            <span className="stat-value crimson">{totalDays}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Tasks</span>
            <span className="stat-value">{taskCount}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Critical Tasks</span>
            <span className="stat-value crimson">{critCount}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Pre-Dispatch End</span>
            <span className="stat-value small">{computeEndDate()}</span>
          </div>

          <button
            className="btn-export"
            onClick={onExport}
            title="Download current dependencies as CSV"
            style={{ visibility: plan ? 'visible' : 'hidden' }}
          >
            ↓ Export CSV
          </button>
          <button
            className="btn-revert"
            onClick={onRevert}
            title="Discard all unsaved changes"
            style={{ visibility: dirty && !updating ? 'visible' : 'hidden' }}
          >
            Revert
          </button>
          <button
            className="btn-update"
            disabled={!dirty || updating}
            onClick={onUpdate}
          >
            {updating && <span className="spinner" />}
            {updating ? 'Updating…' : 'Update'}
            {dirty && !updating && <span className="dirty-dot" />}
          </button>
        </div>
      </div>
    </div>
  )
}
