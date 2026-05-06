import React from 'react'

export default function DraftBar({ dirtyTasks, localDeps, plan, allTasksRaw }) {
  if (dirtyTasks.size === 0) return null

  const taskMap = Object.fromEntries(allTasksRaw.map(t => [t.code, t]))
  const planMap = Object.fromEntries((plan?.tasks ?? []).map(t => [t.code, t]))

  const changes = [...dirtyTasks].map(code => {
    const original = new Set(planMap[code]?.deps ?? [])
    const updated  = new Set(localDeps[code] ?? [])
    const added    = [...updated].filter(c => !original.has(c))
    const removed  = [...original].filter(c => !updated.has(c))
    const task     = taskMap[code]
    return { code, name: task?.name ?? code, subcategory: task?.subcategory ?? '', added, removed }
  })

  return (
    <div className="draft-bar">
      <span className="draft-bar-label">Unsaved changes</span>
      <div className="draft-bar-items">
        {changes.map(({ code, name, subcategory, added, removed }) => (
          <div key={code} className="draft-bar-item">
            <span className="draft-bar-code">{code}</span>
            <span className="draft-bar-name">{name}{subcategory ? ` · ${subcategory}` : ''}</span>
            {added.map(c => (
              <span key={c} className="draft-tag added">+ {c}</span>
            ))}
            {removed.map(c => (
              <span key={c} className="draft-tag removed">− {c}</span>
            ))}
          </div>
        ))}
      </div>
      <span className="draft-bar-hint">Click <strong>Update</strong> to apply · <strong>Revert</strong> to discard</span>
    </div>
  )
}
