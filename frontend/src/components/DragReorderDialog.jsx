import React, { useState, useMemo } from 'react'
import { wouldCycle, computeTransitiveDeps, computeProjectedES } from '../cpmUtils.js'

export default function DragReorderDialog({
  draggedTask,
  aboveTasks,
  allTasks,
  pendingOrder,
  onConfirm,
  onKeepParallel,
  onCancel,
}) {
  const [selectedDeps, setSelectedDeps] = useState(new Set())

  // Categorize above tasks into buckets
  const { alreadyDirect, alreadyTransitive, candidates, cyclicBlocked } = useMemo(() => {
    const transitiveDeps = computeTransitiveDeps(allTasks, draggedTask.code)
    const directDepsSet = new Set(draggedTask.deps)

    const alreadyDirect = []
    const alreadyTransitive = []
    const candidates = []
    const cyclicBlocked = []

    for (const t of aboveTasks) {
      if (directDepsSet.has(t.code)) {
        alreadyDirect.push(t)
      } else if (transitiveDeps.has(t.code)) {
        alreadyTransitive.push(t)
      } else if (wouldCycle(allTasks, draggedTask.code, t.code, draggedTask.deps)) {
        cyclicBlocked.push(t)
      } else {
        candidates.push(t)
      }
    }
    return { alreadyDirect, alreadyTransitive, candidates, cyclicBlocked }
  }, [draggedTask, aboveTasks, allTasks])

  // Live projected ES based on current checkbox selections
  const projectedES = useMemo(() => {
    return computeProjectedES(allTasks, draggedTask.code, [...selectedDeps])
  }, [selectedDeps, allTasks, draggedTask])

  const esShifted = projectedES > draggedTask.es

  function toggleDep(code) {
    setSelectedDeps(prev => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }

  function handleConfirm() {
    const newDeps = [...new Set([...draggedTask.deps, ...selectedDeps])]
    onConfirm(newDeps, pendingOrder)
  }

  // Per-candidate projected ES: what would happen if THIS one were added
  function candidateImpact(candidateTask) {
    const withThis = new Set([...selectedDeps, candidateTask.code])
    return computeProjectedES(allTasks, draggedTask.code, [...withThis])
  }

  const taskMap = useMemo(() => {
    const m = {}
    for (const t of allTasks) m[t.code] = t
    return m
  }, [allTasks])

  const hasInformational = alreadyDirect.length > 0 || alreadyTransitive.length > 0 || cyclicBlocked.length > 0

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal drag-reorder-modal">

        {/* Title */}
        <div className="modal-title">
          Reorder — <span style={{ color: 'var(--curious)' }}>{draggedTask.code}</span>
        </div>
        <div className="modal-subtitle">
          {draggedTask.name} &nbsp;·&nbsp; currently starts day {draggedTask.es}
        </div>

        {/* Impact summary banner */}
        <div className={`drag-impact-banner${esShifted ? ' shifted' : ''}`}>
          {selectedDeps.size === 0 ? (
            <>
              Moving <strong>{draggedTask.code}</strong> up places it below&nbsp;
              <strong>{aboveTasks.length}</strong> task{aboveTasks.length !== 1 ? 's' : ''}.
              {candidates.length > 0
                ? ` ${candidates.length} of them ${candidates.length === 1 ? 'is' : 'are'} parallel — check below to make any a prerequisite.`
                : ' All are already prerequisites or would cause a cycle.'}
            </>
          ) : (
            <>
              <strong>{draggedTask.code}</strong> would start on working day&nbsp;
              <strong>{projectedES}</strong>
              {esShifted
                ? ` (+${projectedES - draggedTask.es} day${projectedES - draggedTask.es !== 1 ? 's' : ''} later than current)`
                : ' — same as current (no delay added)'}
            </>
          )}
        </div>

        {/* Candidates — main interactive section */}
        {candidates.length > 0 && (
          <>
            <div className="drag-section-header">
              Parallel tasks that will appear above {draggedTask.code}
              <span style={{ fontWeight: 400, color: 'var(--grey)', marginLeft: 6 }}>
                — check any that <strong>{draggedTask.code}</strong> must wait for:
              </span>
            </div>
            <table className="drag-candidate-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}></th>
                  <th>Code</th>
                  <th>Task name</th>
                  <th style={{ textAlign: 'center' }}>Finishes</th>
                  <th style={{ textAlign: 'center' }}>If prerequisite</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(t => {
                  const checked = selectedDeps.has(t.code)
                  const impact = candidateImpact(t)
                  const isDelay = impact > draggedTask.es
                  return (
                    <tr
                      key={t.code}
                      onClick={() => toggleDep(t.code)}
                      style={{ cursor: 'pointer' }}
                      className={checked ? 'drag-candidate-checked' : ''}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDep(t.code)}
                          onClick={e => e.stopPropagation()}
                          style={{ accentColor: 'var(--royal)', cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <strong style={{ color: t.critical ? 'var(--crimson)' : 'var(--royal)' }}>
                          {t.code}
                        </strong>
                      </td>
                      <td style={{ color: 'var(--grey)' }}>
                        {t.name.length > 40 ? t.name.slice(0, 40) + '…' : t.name}
                        {t.critical && (
                          <span style={{ marginLeft: 5, fontSize: 9, color: 'var(--crimson)', fontWeight: 700 }}>
                            CRITICAL
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--grey)' }}>
                        day {t.ef}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 10, fontWeight: 700 }}>
                        <span style={{ color: isDelay ? 'var(--orange)' : 'var(--curious)' }}>
                          starts day {impact}
                          {isDelay ? ' ▲' : ' ✓'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        {/* No candidates — informational only */}
        {candidates.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--grey)', fontStyle: 'italic', marginBottom: 14 }}>
            No parallel tasks to configure — all tasks above are already prerequisites or would create a cycle.
          </div>
        )}

        {/* Informational chips */}
        {hasInformational && (
          <div style={{ marginBottom: 14 }}>
            {(alreadyDirect.length > 0 || alreadyTransitive.length > 0) && (
              <>
                <div className="drag-section-header" style={{ marginBottom: 6 }}>
                  Already prerequisites
                  <span style={{ fontWeight: 400, color: 'var(--grey)', marginLeft: 6 }}>
                    — {draggedTask.code} already depends on these:
                  </span>
                </div>
                <div className="drag-collapsed-list">
                  {alreadyDirect.map(t => (
                    <span key={t.code} className="drag-info-chip" title={t.name}>
                      ✓ {t.code}
                    </span>
                  ))}
                  {alreadyTransitive.map(t => (
                    <span key={t.code} className="drag-info-chip" title={`${t.name} (transitive)`}
                      style={{ opacity: .7 }}>
                      ↩ {t.code}
                    </span>
                  ))}
                </div>
              </>
            )}
            {cyclicBlocked.length > 0 && (
              <>
                <div className="drag-section-header" style={{ marginBottom: 6 }}>
                  Cannot add as prerequisites
                  <span style={{ fontWeight: 400, color: 'var(--grey)', marginLeft: 6 }}>
                    — would create a cycle:
                  </span>
                </div>
                <div className="drag-collapsed-list">
                  {cyclicBlocked.map(t => (
                    <span key={t.code} className="drag-cycle-chip" title={t.name}>
                      ⚠ {t.code}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-secondary"
            onClick={() => onKeepParallel(pendingOrder)}
            style={{ borderColor: 'var(--curious)', color: 'var(--curious)' }}
          >
            Keep parallel — just reorder
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={selectedDeps.size === 0 && candidates.length > 0}
            style={selectedDeps.size === 0 && candidates.length > 0
              ? { background: 'var(--grey)', cursor: 'not-allowed' }
              : {}}
            title={selectedDeps.size === 0 && candidates.length > 0
              ? 'Select at least one prerequisite, or use "Keep parallel"'
              : undefined}
          >
            {selectedDeps.size > 0
              ? `Confirm — add ${selectedDeps.size} prerequisite${selectedDeps.size !== 1 ? 's' : ''}`
              : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
