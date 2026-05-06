import React from 'react'
import GanttBar from './GanttBar.jsx'

function fmt(dateStr, workIdx) {
  if (workIdx === null || workIdx === undefined) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  let count = 0
  while (count < workIdx) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0) count++
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default function TaskRow({ task, serial, calDays, startDate, isDirty, onEditDeps, editingBlocked }) {
  const rowClass = ['task-row', task.critical ? 'critical' : ''].filter(Boolean).join(' ')

  let firstColIdx = -1
  for (let i = 0; i < calDays.length; i++) {
    if (calDays[i].workIdx === task.es) { firstColIdx = i; break }
  }

  const startLabel = fmt(startDate, task.es)
  const endLabel = task.days > 0 ? fmt(startDate, task.ef - 1) : '—'
  const cov = task.coverage && task.coverage !== '-' && task.coverage !== ''
    ? `Coverage: ${task.coverage} ${task.uom || ''}/day`
    : 'Coverage: —'

  return (
    <tr className={rowClass}>
      <td className="col-sn">{serial}</td>

      <td className="col-code" style={isDirty ? { borderLeft: '3px solid var(--orange)' } : {}}>
        {task.code}
      </td>

      <td className="col-name">
        <div
          className="task-name"
          onClick={() => onEditDeps(task)}
          title={editingBlocked ? 'Update or Revert the current draft before editing another task' : 'Click to edit prerequisites'}
          style={editingBlocked ? { cursor: 'not-allowed', opacity: 0.5 } : {}}
        >
          <span className="phase-tag">{task.category.split(' ')[0]}</span>
          {task.name}
        </div>
        <div className="task-subcat">{task.subcategory || '—'}</div>
        <div className="task-coverage">{cov}</div>
      </td>

      <td className="col-days">{task.days}d</td>
      <td className="col-start">{startLabel}</td>
      <td className="col-end">{endLabel}</td>

      {calDays.map((d, i) => {
        const cls = ['day', d.isSunday ? 'sun' : '', d.date.getDay() === 1 ? 'weekstart' : ''].filter(Boolean).join(' ')
        return (
          <td key={i} className={cls}>
            {i === firstColIdx && task.days > 0 && (
              <GanttBar task={task} calDays={calDays} startDate={startDate} />
            )}
          </td>
        )
      })}
    </tr>
  )
}
