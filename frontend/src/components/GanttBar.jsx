import React from 'react'

export default function GanttBar({ task, calDays, startDate }) {
  const { es, ef, days, code, name, critical, coverage, uom, deps } = task

  // Find first and last calendar column indices for this bar
  let firstIdx = -1, lastIdx = -1
  for (let i = 0; i < calDays.length; i++) {
    if (calDays[i].workIdx === es) firstIdx = i
    if (calDays[i].workIdx !== null && calDays[i].workIdx === ef - 1) lastIdx = i
  }
  if (firstIdx < 0) return null

  const spanCols = lastIdx >= firstIdx ? lastIdx - firstIdx + 1 : 1
  const width = spanCols * 28 - 4

  function fmt(d) {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = d.getFullYear()
    return `${dd}/${mm}/${yy}`
  }

  function workingDayToDate(start, idx) {
    const d = new Date(start + 'T00:00:00')
    if (d.getDay() === 0) d.setDate(d.getDate() + 1)
    let count = 0
    while (count < idx) {
      d.setDate(d.getDate() + 1)
      if (d.getDay() !== 0) count++
    }
    return d
  }

  const startDt = workingDayToDate(startDate, es)
  const endDt = workingDayToDate(startDate, ef - 1)
  const tooltip = [
    `${code} — ${name}`,
    `Duration: ${days} days  ·  Coverage: ${coverage || '—'} ${uom || ''}/day`,
    `Start: ${fmt(startDt)}  ·  End: ${fmt(endDt)}`,
    `Critical: ${critical ? 'YES' : 'no'}`,
    `Deps: ${deps.length ? deps.join(', ') : '(none)'}`,
  ].join('\n')

  return (
    <div
      className={`bar ${critical ? 'critical' : 'normal'}`}
      style={{ width: width + 'px', left: '2px' }}
      title={tooltip}
    >
      {width > 40 ? `${code} · ${days}d` : ''}
    </div>
  )
}
