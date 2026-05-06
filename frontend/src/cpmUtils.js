/**
 * Shared CPM graph utilities used by DepsEditor and DragReorderDialog.
 */

/**
 * Returns true if adding toCode as a direct dependency of fromCode would
 * create a cycle in the current dependency graph.
 *
 * Detects this by checking whether fromCode is reachable from toCode
 * (i.e. following deps forward from fromCode we can reach toCode, meaning
 * toCode is already a transitive successor of fromCode — making it a dep
 * would form a loop).
 */
export function wouldCycle(allTasks, fromCode, toCode, currentDepsForFrom) {
  const deps = {}
  for (const t of allTasks) {
    deps[t.code] = t.code === fromCode
      ? [...(currentDepsForFrom || t.deps)]
      : [...t.deps]
  }
  const visited = new Set()
  const stack = [fromCode]
  while (stack.length) {
    const cur = stack.pop()
    if (cur === toCode) return true
    if (visited.has(cur)) continue
    visited.add(cur)
    for (const d of (deps[cur] || [])) stack.push(d)
  }
  return false
}

/**
 * Returns a Set of all task codes that taskCode transitively depends on
 * (i.e. all ancestors in the DAG, following deps edges forward).
 * Includes direct deps.
 */
export function computeTransitiveDeps(allTasks, taskCode) {
  const depMap = {}
  for (const t of allTasks) depMap[t.code] = t.deps || []

  const result = new Set()
  const stack = [...(depMap[taskCode] || [])]
  while (stack.length) {
    const cur = stack.pop()
    if (result.has(cur)) continue
    result.add(cur)
    for (const d of (depMap[cur] || [])) stack.push(d)
  }
  return result
}

/**
 * Returns the projected Early Start for taskCode if additionalDepCodes
 * were added as direct prerequisites.
 *
 * This is a local approximation: max(EF of all current direct deps,
 * EF of all additional deps). Does not re-run full CPM.
 */
export function computeProjectedES(allTasks, taskCode, additionalDepCodes) {
  const taskMap = {}
  for (const t of allTasks) taskMap[t.code] = t

  const task = taskMap[taskCode]
  if (!task) return 0

  const allDepEFs = [
    ...(task.deps || []).map(c => taskMap[c]?.ef ?? 0),
    ...additionalDepCodes.map(c => taskMap[c]?.ef ?? 0),
  ]

  return allDepEFs.length > 0 ? Math.max(0, ...allDepEFs) : 0
}
