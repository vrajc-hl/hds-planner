from collections import defaultdict, deque


def compute_schedule(tasks_qs):
    """
    Pure CPM forward/backward pass.

    Returns list of dicts sorted by (es ASC, critical DESC, sort_order ASC, code ASC).
    Raises ValueError("Cycle detected: ...") if the graph is cyclic.
    """
    tasks = list(tasks_qs)
    task_map = {t.code: t for t in tasks}

    # Build dep sets from pre-fetched data (works whether deps is prefetch_related or a plain list)
    def get_dep_codes(t):
        if hasattr(t, '_dep_codes'):
            return t._dep_codes
        return [d.code for d in t.deps.all()]

    dep_codes = {t.code: get_dep_codes(t) for t in tasks}

    # Build edges_out: predecessor -> list of successors
    edges_out = defaultdict(list)
    in_degree = {t.code: 0 for t in tasks}
    for code, deps in dep_codes.items():
        for d in deps:
            if d in task_map:
                edges_out[d].append(code)
                in_degree[code] += 1

    # Kahn's topological sort (forward pass)
    queue = deque(c for c, deg in in_degree.items() if deg == 0)
    topo_order = []
    remaining = dict(in_degree)

    while queue:
        # pick by sort_order then code for determinism
        best = min(queue, key=lambda c: (task_map[c].sort_order, c))
        queue.remove(best)
        topo_order.append(best)
        for succ in edges_out[best]:
            remaining[succ] -= 1
            if remaining[succ] == 0:
                queue.append(succ)

    if len(topo_order) != len(tasks):
        in_cycle = [c for c in task_map if c not in topo_order]
        raise ValueError(f"Cycle detected: {sorted(in_cycle)}")

    # Forward pass: compute ES, EF
    es = {}
    ef = {}
    for code in topo_order:
        t = task_map[code]
        preds = dep_codes[code]
        es[code] = max((ef[d] for d in preds if d in ef), default=0)
        ef[code] = es[code] + t.days

    project_finish = max(ef.values(), default=0)

    # Backward pass: compute LF, LS
    lf = {}
    ls = {}
    for code in reversed(topo_order):
        t = task_map[code]
        succs = [s for s in edges_out[code] if s in task_map]
        lf[code] = min((ls[s] for s in succs if s in ls), default=project_finish)
        ls[code] = lf[code] - t.days

    result = []
    for t in tasks:
        code = t.code
        slack = lf[code] - ef[code]
        result.append({
            "code": code,
            "name": t.name,
            "category": t.category,
            "subcategory": t.subcategory,
            "coverage": t.coverage,
            "uom": t.uom,
            "days": t.days,
            "deps": dep_codes[code],
            "sort_order": t.sort_order,
            "es": es[code],
            "ef": ef[code],
            "ls": ls[code],
            "lf": lf[code],
            "slack": slack,
            "critical": slack == 0,
        })

    result.sort(key=lambda r: (r["es"], not r["critical"], r["sort_order"], r["code"]))
    return result
