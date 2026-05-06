import React, { useEffect, useState } from 'react'
import Header from './components/Header.jsx'
import Legend from './components/Legend.jsx'
import PlanTable from './components/PlanTable.jsx'
import DepsEditor from './components/DepsEditor.jsx'
import DraftBar from './components/DraftBar.jsx'
import { fetchPlan, fetchTasks, updateTask, recompute } from './api.js'

function getNextMonday() {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 1 : (8 - day) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function getStoredStartDate() {
  return localStorage.getItem('hds.startDate') || getNextMonday()
}

export default function App() {
  const [plan, setPlan] = useState(null)
  const [allTasksRaw, setAllTasksRaw] = useState([])
  const [localDeps, setLocalDeps] = useState({})
  const [dirtyTasks, setDirtyTasks] = useState(new Set())
  const [startDate, setStartDate] = useState(getStoredStartDate)
  const [updating, setUpdating] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [toasts, setToasts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const dirty = dirtyTasks.size > 0

  function handleExportCSV() {
    // Build CSV matching the original source format (columns A–J)
    const rows = [
      ['Category', 'Subcategory', 'NEW GROUP\n(Type of Service)', 'Group Code',
       'Dependency Cycle ', 'Work Coverage PER DAY', 'UOM',
       'Total No. of Days (8Hrs)', 'Total Pre-Dispatch Days', 'Total Post-Dispatch Days'],
    ]

    // Use allTasksRaw as the base (has all fields), merge in any localDeps overrides
    const taskMap = Object.fromEntries(allTasksRaw.map(t => [t.code, t]))
    const planMap = Object.fromEntries((plan?.tasks ?? []).map(t => [t.code, t]))

    for (const t of allTasksRaw) {
      const deps = localDeps[t.code] !== undefined ? localDeps[t.code] : t.deps
      const depsStr = deps.length ? deps.join(',') : 'NA'
      const planTask = planMap[t.code]
      rows.push([
        t.category,
        t.subcategory,
        t.name,
        t.code,
        depsStr,
        t.coverage || '-',
        t.uom || '-',
        planTask ? String(planTask.days) : String(t.days),   // col H — total days
        String(t.days),                                       // col I — pre-dispatch days
        '',                                                   // col J — post-dispatch (not tracked)
      ])
    }

    // Escape fields that contain commas or quotes
    const escape = val => {
      const s = String(val ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s
    }

    const csv = rows.map(r => r.map(escape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date().toISOString().split('T')[0]
    a.download = `HDS_PreDispatch_Dependencies_${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function addToast(msg, type = 'info') {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }

  useEffect(() => {
    Promise.all([fetchPlan(), fetchTasks()])
      .then(([planData, tasksData]) => {
        setPlan(planData)
        setAllTasksRaw(tasksData)
        setLoading(false)
      })
      .catch((err) => {
        setError(`Failed to load plan from API. ${import.meta.env.VITE_API_BASE ? `API: ${import.meta.env.VITE_API_BASE}` : 'Is the Django server running on port 8000?'}`)
        setLoading(false)
      })
  }, [])

  function handleStartDateChange(val) {
    setStartDate(val)
    localStorage.setItem('hds.startDate', val)
  }

  function handleEditDeps(task) {
    if (dirty) return   // block editing while a draft is pending
    setEditingTask(task)
  }

  function handleSaveDeps(code, newDeps) {
    setLocalDeps(prev => ({ ...prev, [code]: newDeps }))
    setDirtyTasks(prev => new Set([...prev, code]))
    setEditingTask(null)
  }

  function handleRevert() {
    setLocalDeps({})
    setDirtyTasks(new Set())
  }

  // Merge localDeps overrides into plan tasks for display
  const displayTasks = plan
    ? plan.tasks.map(t => ({
        ...t,
        deps: localDeps[t.code] !== undefined ? localDeps[t.code] : t.deps,
      }))
    : []

  // Merged allTasks for DepsEditor cycle detection (includes local overrides)
  const mergedAllTasks = allTasksRaw.map(t => ({
    ...t,
    deps: localDeps[t.code] !== undefined ? localDeps[t.code] : t.deps,
  }))

  async function handleUpdate() {
    setUpdating(true)
    try {
      const depUpdates = [...dirtyTasks].map(code =>
        updateTask(code, { deps: localDeps[code] })
      )
      const results = await Promise.allSettled(depUpdates)

      const failures = results.filter(r => r.status === 'rejected')
      if (failures.length) {
        for (const f of failures) {
          const err = f.reason
          if (err.status === 400) {
            addToast(`Cycle detected: ${err.scc || 'unknown'}`, 'error')
          } else {
            addToast(`Update error: ${err.message}`, 'error')
          }
        }
        setUpdating(false)
        return
      }

      const [newPlan, newTasksRaw] = await Promise.all([recompute(), fetchTasks()])
      setPlan(newPlan)
      setAllTasksRaw(newTasksRaw)
      setLocalDeps({})
      setDirtyTasks(new Set())
      addToast(`Schedule updated — ${newPlan.project_days} working days`, 'success')
    } catch (err) {
      addToast(`Update failed: ${err.message}`, 'error')
    } finally {
      setUpdating(false)
    }
  }

  const taskToEdit = editingTask
    ? mergedAllTasks.find(t => t.code === editingTask.code) || editingTask
    : null

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--grey)' }}>
        <div className="spinner" style={{ margin: '0 auto 12px', borderColor: 'rgba(0,0,0,.1)', borderTopColor: 'var(--royal)', width: 28, height: 28 }} />
        Loading plan…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: 'var(--crimson)', fontWeight: 700 }}>
        {error}
      </div>
    )
  }

  return (
    <>
      <Header
        plan={plan}
        startDate={startDate}
        onStartDateChange={handleStartDateChange}
        dirty={dirty}
        updating={updating}
        onUpdate={handleUpdate}
        onRevert={handleRevert}
        onExport={handleExportCSV}
      />
      <Legend />
      <DraftBar
        dirtyTasks={dirtyTasks}
        localDeps={localDeps}
        plan={plan}
        allTasksRaw={allTasksRaw}
      />

      <PlanTable
        tasks={displayTasks}
        dirtyTasks={dirtyTasks}
        startDate={startDate}
        projectDays={plan?.project_days ?? 30}
        onEditDeps={handleEditDeps}
        editingBlocked={dirty}
      />

      {taskToEdit && (
        <DepsEditor
          task={taskToEdit}
          allTasks={mergedAllTasks}
          onSave={(newDeps) => handleSaveDeps(taskToEdit.code, newDeps)}
          onClose={() => setEditingTask(null)}
        />
      )}

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </>
  )
}
