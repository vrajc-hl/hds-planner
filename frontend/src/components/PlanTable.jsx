import React, { useMemo } from 'react'
import TaskRow from './TaskRow.jsx'

function buildCalendar(startDate, projectDays) {
  const calDays = []
  const start = new Date(startDate + 'T00:00:00')
  if (start.getDay() === 0) start.setDate(start.getDate() + 1)
  const cur = new Date(start)
  let workIdx = 0
  const targetWorkDays = projectDays + 1
  while (workIdx < targetWorkDays) {
    const isSun = cur.getDay() === 0
    calDays.push({ date: new Date(cur), isSunday: isSun, workIdx: isSun ? null : workIdx })
    if (!isSun) workIdx++
    cur.setDate(cur.getDate() + 1)
  }
  return calDays
}

function groupWeeks(calDays) {
  const weeks = []
  let cur = []
  for (const d of calDays) {
    cur.push(d)
    if (d.date.getDay() === 0) { weeks.push(cur); cur = [] }
  }
  if (cur.length) weeks.push(cur)
  return weeks
}

export default function PlanTable({
  tasks,
  dirtyTasks,
  startDate,
  projectDays,
  onEditDeps,
  editingBlocked,
}) {
  const calDays = useMemo(
    () => buildCalendar(startDate, projectDays),
    [startDate, projectDays]
  )
  const weeks = useMemo(() => groupWeeks(calDays), [calDays])

  const frozenHeaders = ['#', 'Code', 'Group Name & Work Coverage', 'Days', 'Start', 'End']
  const frozenClasses = ['col-sn', 'col-code', 'col-name', 'col-days', 'col-start', 'col-end']

  return (
    <div className="gantt-wrap">
      <table className="gantt">
        <thead>
          <tr className="week-row">
            {frozenHeaders.map((h, i) => (
              <th key={h + i} className={frozenClasses[i]} rowSpan={2}>{h}</th>
            ))}
            {weeks.map((wk, idx) => (
              <th key={idx} colSpan={wk.length}>Week {idx + 1}</th>
            ))}
          </tr>
          <tr className="day-row">
            {calDays.map((d, i) => (
              <th key={i} className={d.isSunday ? 'sun' : ''}>
                {d.date.toLocaleString('en-US', { weekday: 'short' })[0]}
                <span className="dnum">{String(d.date.getDate()).padStart(2, '0')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, idx) => (
            <TaskRow
              key={task.code}
              task={task}
              serial={idx + 1}
              calDays={calDays}
              startDate={startDate}
              isDirty={dirtyTasks.has(task.code)}
              onEditDeps={onEditDeps}
              editingBlocked={editingBlocked}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
