import csv
import os
from django.core.management.base import BaseCommand, CommandError
from tasks.models import Task
from tasks.cpm import compute_schedule


PAINT_CODES = {"P1", "P2", "P3", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12"}


def parse_csv(path):
    """
    Parse CSV, handle the wrapped P9 row (continuation when col D is empty).
    Returns list of dicts: code, name, category, subcategory, coverage, uom, days, deps_raw
    """
    records = {}
    order = []
    last_code = None

    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader)  # skip header

        for row in reader:
            # Pad short rows
            while len(row) < 10:
                row.append("")

            category    = row[0].strip()
            subcategory = row[1].strip()
            name        = row[2].strip().replace("\n", " ")
            code        = row[3].strip()
            deps_raw    = row[4].strip()
            coverage    = row[5].strip()
            uom         = row[6].strip()
            # col H = row[7], col I = row[8], col J = row[9]
            predispatch_raw = row[8].strip()

            if not code:
                # Continuation row — append deps to previous task
                if last_code and deps_raw:
                    records[last_code]["deps_raw"] += "," + deps_raw
                continue

            # Parse pre-dispatch days
            try:
                days = int(float(predispatch_raw))
            except (ValueError, TypeError):
                days = 0

            # Skip if no valid pre-dispatch days
            if days <= 0:
                last_code = code
                continue

            # Avoid duplicate codes (keep first occurrence with valid days)
            if code in records:
                last_code = code
                continue

            records[code] = {
                "code": code,
                "name": name,
                "category": category,
                "subcategory": subcategory,
                "coverage": coverage,
                "uom": uom,
                "days": days,
                "deps_raw": deps_raw,
            }
            order.append(code)
            last_code = code

    return [records[c] for c in order]


def parse_deps(deps_raw):
    """Split raw dep string into list of codes, stripping noise."""
    noise = {"NA", "Null", "NULL", "null", "-", "", "Last activity in the entire cycle"}
    codes = []
    for part in deps_raw.split(","):
        c = part.strip()
        if c and c not in noise:
            codes.append(c)
    return codes


def apply_cycle_breaking(parsed, valid_codes):
    """
    Apply all cycle-breaking rules. Mutates parsed records in place.
    valid_codes: set of codes that passed the pre-dispatch filter.
    """
    for rec in parsed:
        code = rec["code"]
        raw_deps = parse_deps(rec["deps_raw"])

        # 1. Remove self-references
        deps = [d for d in raw_deps if d != code]

        # 2. Remove unknown references (not in the full CSV set, not just pre-dispatch)
        # We'll handle unknown-in-predispatch below; here remove completely unknown codes
        # (unknown = not in valid_codes for this app)
        deps = [d for d in deps if d in valid_codes]

        # 3. Already filtered to pre-dispatch set by above

        # 4. M1 — clear all deps
        if code == "M1":
            deps = []

        # 5. Civil/tile C1, C2, C13, CTS4 — remove deps on PL2-PL6 (keep PL1)
        if code in {"C1", "C2", "C13", "CTS4"}:
            remove = {"PL2", "PL3", "PL4", "PL5", "PL6"}
            deps = [d for d in deps if d not in remove]

        # 6. Electrical chasing E1-E8 — remove deps on FC3, C13, C14
        if code in {"E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"}:
            remove = {"FC3", "C13", "C14"}
            deps = [d for d in deps if d not in remove]

        # 7. FC3 — remove deps on PL3, PL4, PL5, P2, P3, P6
        if code == "FC3":
            remove = {"PL3", "PL4", "PL5", "P2", "P3", "P6"}
            deps = [d for d in deps if d not in remove]

        # 8. Painting tasks
        if code in PAINT_CODES:
            if code == "P6":
                # Wall Putty: remove all deps that are painting tasks
                deps = [d for d in deps if d not in PAINT_CODES]
            else:
                # All other paint: remove deps on other paint tasks except P6
                deps = [d for d in deps if d not in PAINT_CODES or d == "P6"]

        # 9. C15 — remove dep on P10
        if code == "C15":
            deps = [d for d in deps if d != "P10"]

        # 10. PL3, PL4, PL5, PL6 — remove dep on PL2
        if code in {"PL3", "PL4", "PL5", "PL6"}:
            deps = [d for d in deps if d != "PL2"]

        rec["deps"] = deps


class Command(BaseCommand):
    help = "Seed pre-dispatch tasks from CSV into the database"

    def add_arguments(self, parser):
        parser.add_argument("--csv", required=True, dest="csv_path", help="Path to Data Dump CSV")

    def handle(self, *args, **options):
        csv_path = os.path.expanduser(options["csv_path"])
        if not os.path.exists(csv_path):
            raise CommandError(f"CSV not found: {csv_path}")

        self.stdout.write(f"Parsing {csv_path} …")
        parsed = parse_csv(csv_path)
        valid_codes = {r["code"] for r in parsed}
        self.stdout.write(f"  Parsed {len(parsed)} pre-dispatch tasks (days > 0)")

        apply_cycle_breaking(parsed, valid_codes)

        # Verify acyclic before touching DB
        # Build temporary task-like objects for CPM check
        class _FakeTask:
            def __init__(self, rec):
                self.code = rec["code"]
                self.name = rec["name"]
                self.category = rec["category"]
                self.subcategory = rec["subcategory"]
                self.coverage = rec["coverage"]
                self.uom = rec["uom"]
                self.days = rec["days"]
                self.sort_order = 0
                self._dep_codes = rec["deps"]

        fake_tasks = [_FakeTask(r) for r in parsed]
        try:
            initial_schedule = compute_schedule(fake_tasks)
        except ValueError as exc:
            raise CommandError(f"Cycle check failed after breaking: {exc}")

        self.stdout.write("  Graph is acyclic ✓")

        # Assign sort_order = topological index from initial schedule
        topo_index = {t["code"]: i for i, t in enumerate(initial_schedule)}

        # Write to DB
        Task.objects.all().delete()

        task_objs = []
        for rec in parsed:
            t = Task(
                code=rec["code"],
                name=rec["name"],
                category=rec["category"],
                subcategory=rec["subcategory"],
                coverage=rec["coverage"],
                uom=rec["uom"],
                days=rec["days"],
                sort_order=topo_index.get(rec["code"], 999),
            )
            task_objs.append(t)

        Task.objects.bulk_create(task_objs)

        # Set M2M deps after all tasks exist
        code_to_rec = {r["code"]: r for r in parsed}
        for t in Task.objects.all():
            dep_codes = code_to_rec[t.code]["deps"]
            dep_tasks = list(Task.objects.filter(code__in=dep_codes))
            t.deps.set(dep_tasks)

        # Final verification via real DB objects
        all_tasks = list(Task.objects.prefetch_related("deps").all())
        final_schedule = compute_schedule(all_tasks)
        project_days = max(t["ef"] for t in final_schedule)
        critical_count = sum(1 for t in final_schedule if t["critical"])

        self.stdout.write(self.style.SUCCESS(
            f"\nSeeded {len(task_objs)} pre-dispatch tasks. "
            f"Project duration: {project_days} days. "
            f"{critical_count} critical tasks."
        ))
