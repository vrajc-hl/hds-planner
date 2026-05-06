import React, { useState, useMemo } from 'react'
import { wouldCycle } from '../cpmUtils.js'

export default function DepsEditor({ task, allTasks, onSave, onClose }) {
  const [localDeps, setLocalDeps] = useState([...task.deps])
  const [search, setSearch] = useState('')

  const available = useMemo(() => {
    return allTasks.filter(t => t.code !== task.code)
  }, [allTasks, task.code])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return available.filter(t =>
      t.code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      (t.subcategory || '').toLowerCase().includes(q)
    )
  }, [available, search])

  function addDep(code) {
    if (localDeps.includes(code)) return
    setLocalDeps(prev => [...prev, code])
    setSearch('')
  }

  function removeDep(code) {
    setLocalDeps(prev => prev.filter(c => c !== code))
  }

  function handleSave() {
    onSave(localDeps)
  }

  function isCyclic(candidateCode) {
    // Would adding candidateCode as a dep of task.code create a cycle?
    // i.e. is task.code already reachable from candidateCode?
    return wouldCycle(allTasks, task.code, candidateCode, localDeps)
  }

  const depNames = Object.fromEntries(allTasks.map(t => [t.code, t.name]))
  const depSubcats = Object.fromEntries(allTasks.map(t => [t.code, t.subcategory]))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Edit Prerequisites — {task.code}</div>
        <div className="modal-subtitle">{task.name}</div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--royal)', marginBottom: 8 }}>
          Current prerequisites ({localDeps.length})
        </div>

        <div className="deps-chips">
          {localDeps.length === 0 && (
            <span style={{ fontSize: 11, color: 'var(--grey)', fontStyle: 'italic' }}>No prerequisites</span>
          )}
          {localDeps.map(code => {
            const t = allTasks.find(x => x.code === code)
            return (
              <div key={code} className="dep-chip">
                <span>{code}</span>
                <span style={{ fontSize: 9, color: 'var(--grey)', marginLeft: 2 }}>
                  {t ? ` · ${t.name.slice(0, 18)}${t.subcategory ? ` (${t.subcategory.slice(0, 18)})` : ''}` : ''}
                </span>
                <button onClick={() => removeDep(code)} title={`Remove ${code}`}>×</button>
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--royal)', marginBottom: 8 }}>
          Add prerequisite
        </div>

        <input
          className="deps-search"
          type="text"
          placeholder="Search by code or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="deps-option-list">
          {filtered.map(t => {
            const alreadyAdded = localDeps.includes(t.code)
            const cyclic = !alreadyAdded && isCyclic(t.code)
            const disabled = alreadyAdded || cyclic
            return (
              <div
                key={t.code}
                className={`deps-option${disabled ? ' disabled' : ''}`}
                onClick={() => !disabled && addDep(t.code)}
                title={cyclic ? `Adding ${t.code} would create a cycle` : alreadyAdded ? 'Already added' : `Add ${t.code}`}
              >
                <span>
                  <strong>{t.code}</strong>
                  <span style={{ color: 'var(--grey)', marginLeft: 6 }}>{t.name.slice(0, 38)}</span>
                  {t.subcategory && (
                    <span style={{ color: 'var(--curious)', marginLeft: 5, fontSize: 9, fontWeight: 600 }}>
                      {t.subcategory.slice(0, 30)}
                    </span>
                  )}
                </span>
                {cyclic && <span className="cycle-warn">⚠ would cycle</span>}
                {alreadyAdded && <span style={{ fontSize: 9, color: 'var(--grey)' }}>added</span>}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="deps-option disabled">No matches</div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  )
}
