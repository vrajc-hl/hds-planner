import io
import csv
from django.core.management.base import BaseCommand, CommandError
from tasks.models import Task
from tasks.cpm import compute_schedule

# Full CSV embedded — no file upload needed on Render
CSV_DATA = """\
Category,Subcategory,"NEW GROUP\n(Type of Service)",Group Code,Dependency Cycle ,Work Coverage PER DAY,UOM,Total No. of Days (8Hrs),Total Pre-Dispatch Days,Total Post-Dispatch Days
Ceiling & Wall Panels,Accessories,Product Supply - PVC panels,WP1,NA,-,Nos,-,,
Ceiling & Wall Panels,Ceiling & Wall Panels,Product Supply - PVC panels,WP1,NA,-,Nos,-,,
Ceiling & Wall Panels,Ceiling Panels,Product Supply - PVC panels,WP1,NA,-,Nos,-,,
Ceiling & Wall Panels,Panel Installation,Installation - PVC panels,WP2,NA,70,Sq.Ft.,1,0,1
Civil,Bathroom Packages,Bathroom Tile Installation - Floor & Wall,C1,"D1, C2,PL1,PL2,PL3,PL4,PL6",100,Sq.Ft.,4,4,0
Civil,Bathroom Packages,Bathroom Waterproofing,C2,"D1,PL1,PL3,PL4,PL6",100,Sq.Ft.,7,7,0
Civil,Wall Construction,Block Wall,C3,D4,90,Sq.Ft.,3,3,0
Civil,Wall Construction,Brick Wall,C4,D4,70,Sq.Ft.,3,3,0
Civil,Other Civil Services,Brickbat Waterproofing,C5,D1,100,Sq.Ft.,5,5,0
Civil,Other Civil Services,Core Cutting,C6,Null,4,Nos,1,1,0
Civil,Wall & Dado Services,Dado Installation,C7,"D4,C3,C4",84,Sq.Ft.,2,0,2
Civil,Other Civil Services,Door / Window Jambs,C8,"D4,C3,C4",60,Rft,3,3,0
Civil,Epoxy Grouting,Grouting,C9,"C1, C15,C16,CTS1,CTS4,CTS7",100,Sq.Ft.,1,0,1
Civil,Flooring - Civil,Marble Flooring,C10,D5,120,Sq.Ft.,3,3,0
Civil,Flooring - Civil,Marble Polishing,C11,C10,160,Sq.Ft.,5,3,2
Civil,Flooring - Civil,PCC Platform,C12,"D1,D2,D5,D6",80,Sq.Ft.,3,3,0
Civil,Other Civil Services,Plastering,C13,"PL1,PL4,PL5,PL6,C3,C4",100,Sq.Ft.,3,3,0
Civil,Other Civil Services,Punning,C14,C13,150,Sq.Ft.,2,2,0
Civil,Flooring - Civil,Tile Flooring,C15,"D6,P10",200,Sq.Ft.,3,2,0
Civil,Wall Tile Installation,Wall Tiling,C16,C13,200,Sq.Ft.,3,0,3
Cleaning,All Cleaning,Cleaning,CL1,Last activity in the entire cycle,1000,Sq.Ft.,1,0,1
Counter Top Services,Countertop Installation,Countertop Installation,CTS1,"CTS6,CTM2",50,Sq.Ft.,2,0,2
Counter Top Services,Countertop Removal,Countertop Removal,CTS2,M1,150,Sq.Ft.,2,2,0
Counter Top Services,L angles,L-Angles Supply & Installation,CTS3,D7,10,Nos,1,0,1
Counter Top Services,Dado Tiles Installation,Wall Tiling,CTS4,"PL1,PL2,PL3,PL4,PL5,PL6,C13",100,Sq.Ft.,2,0,2
Counter Top Services,Other Countertop Service,Puncture Hole,CTS5,CTS1,12,Nos,1,0,1
Counter Top Services,Other Countertop Service,CT Base Sheet - Supply,CTS6,"D1, D2, D4, D5, D6, D7",0,-,-,0,0
Counter Top Services,Other Countertop Service,Sink Cutting/Installation,CTS7,CTS1,2,Nos,1,0,1
Counter Top Services,Other Countertop Service,Hob Cutting,CTS8,CTS1,2,Nos,1,0,1
Counter Top Services,Other Countertop Service,Fixture & Service Removals,CTS9,NA,-,Nos,-,0,0
Counter Top Services,Other Countertop Service,Paani Patti,CTS10,CTS1,20,Rft.,1,0,1
Demolition,Bathroom Demolition,Bathroom Demolition,D1,M1,40,Sq.Ft.,2,2,0
Demolition,Debris Removal,Debris Removal,D2,"D1,D3,D4,D5,D6,D7",1,Nos,1,1,0
Demolition,Fixture & Service Removals,Fixture & Service Removals,D3,M1,6,Nos,1,1,0
Demolition,Full Home Interior Demolition,Interior Wall / WW Demolition ,D4,M1,300,Sq.Ft.,2,2,0
Demolition,Floor Demolition,Marble Floor Demolition,D5,M1,300,Sq.Ft.,1,1,0
Demolition,Floor Demolition,Tile Floor Demolition,D6,M1,300,Sq.Ft.,1,1,0
Demolition,Kitchen Demolition,Kitchen Demolition,D7,M1,150,Sq.Ft.,2,2,0
Electrical,Addition of Point,Creating / Shifting / Closing / Adding,E1,"FC3,C13,C14",12,Nos,5,4,1
Electrical,Closing of Board,Creating / Shifting / Closing / Adding,E2,"FC3,C13,C14",10,Nos,1,1,0
Electrical,Creating of New Board from DB,Creating / Shifting / Closing / Adding,E3,"FC3,C13,C14",12,Nos,5,4,1
Electrical,Creating or Shifting of Board,Creating / Shifting / Closing / Adding,E4,"FC3,C13,C14",8,Nos,5,4,1
Electrical,Fan Point,Creating / Shifting / Closing / Adding,E5,"FC3,C13,C14",3,Nos,2,1,1
Electrical,New Light Point,Creating / Shifting / Closing / Adding,E6,"FC3,C13,C14",3,Nos,2,1,1
Electrical,Other Electrical services,Creating / Shifting / Closing / Adding,E7,"FC3,C13,C14",-,Nos,-,,
Electrical,Removing and Refixing of Board,Creating / Shifting / Closing / Adding,E8,"FC3,C13,C14",10,Nos,3,,3
Electrical,Light Installation,Light Instalation,E9,"E1,E2,E3,E4,E5,E6,E7,E8",15,Nos,1,,1
Electrical,Packaged Offering,Packaged Offering,E10,NA,,,,,
Electrical,Electrical Package:False Ceiling,Packaged Offering,E11,NA,,,,,
Electrical,Wire Manager,Wire Manager,E12,"E1,E2,E3,E4,E5,E6,E7,E8",10,Nos,1,,1
Electrical,Other Electrical services,Wiring / Cable Installation,E13,"E1,E2,E3,E4,E5,E6,E7,E8",10,Nos,2,1,1
False Ceiling,False Ceiling for Washrooms,Calcium Silicate FC - Regular Design,FC1,"E1,E2,E3,E4,E6,E8,E9,CM1,CS1,CS3,CS5,D1,D2,D3,C2,C9,PL1,PL3,PL4,PL5,P2,P3,P6",80,Sq.Ft.,1,1,
False Ceiling,False Ceiling for Washrooms,Grid Ceiling,FC2,"E1,E2,E3,E4,E6,E8,E9,CM1,CS1,CS3,CS5,D1,D2,D3,C2,C9,PL1,PL3,PL4,PL5,P2,P3,P6",80,Sq.Ft.,1,1,
False Ceiling,False Ceiling With Paint,Gyp FC with Paint,FC3,"E1,E2,E3,E4,E6,E8,E9,CM1,CS1,CS3,CS5,D1,D2,D3,C2,C9,PL1,PL3,PL4,PL5,P2,P3,P6",80,Sq.Ft.,6,4,2
False Ceiling,POP Moulding,POP Moulding,FC4,"E1,E2,E3,E4,E6,E8,E9,CM1,CS1,CS3,CS5,D1,D2,D3,C2,C9",80,Rft.,1,1,
False Ceiling,Gypsum Panelling or Partition,Gyp Partition/Paneling w/o Paint,FC5,"E1,E2,E3,E4,E6,E8,E9,CM1,CS1,CS3,CS5,D1,D2,D3,C2,C9,PL1,PL3,PL4,PL5,P2,P3,P6",80,Sq.Ft.,1,1,
False Ceiling,False Ceiling Rafters,Gyp/POP Rafter w/o Paint,FC6,"E1,E2,E3,E4,E6,E8,E9,CM1,CS1,CS3,CS5,D1,D2,D3,C2,C9",80,Sq.Ft.,2,2,
False Ceiling,False Ceiling Without Paint,Gypsum FC w/o Paint - Custom Design,FC7,"E1,E2,E3,E4,E6,E8,E9,CM1,CS1,CS3,CS5,D1,D2,D3,C2,C9",80,Sq.Ft.,2,2,
False Ceiling,False Ceiling Without Paint,Gypsum FC w/o Paint - Regular Design,FC8,"E1,E2,E3,E4,E6,E8,E9,CM1,CS1,CS3,CS5,D1,D2,D3,C2,C9",80,Sq.Ft.,1,1,
False Ceiling,False Ceiling Without Paint,POP FC w/o Paint,FC9,"E1,E2,E3,E4,E6,E8,E9,CM1,CS1,CS3,CS5,D1,D2,D3,C2,C9",40,Sq.Ft.,2,2,
False Ceiling,False Ceiling With Paint,POP FC with Paint,FC10,"E1,E2,E3,E4,E6,E8,E9,CM1,CS1,CS3,CS5,D1,D2,D3,C2,C9,PL1,PL3,PL4,PL5,P1,P2,P3,P4,P5,P6",40,Sq.Ft.,7,5,2
False Ceiling,Other False Ceiling Services,Pendant support,FC11,"E1,E2,E3,E4,E6,E8,E9,CM1,CS1,CS3,CS5,D1,D2,D3,C2,C9,PL1,PL3,PL4,PL5,P1,P2,P3,P4,P5,P6",4,Nos,1,1,
False Ceiling,Other False Ceiling Services,Groove in FC,FC12,"E1,E2,E3,E4,E5,E6,E7,E9,E10,F1,F2,F3,F4",60,Rft.,1,1,
False Ceiling,Other False Ceiling Services,AC Boxing,FC13,"E1,E2,E3,E4,E6,E8,E9,PL3,P2,P3,P4,P5,P6",2,Nos,1,1,
Flooring,Excel,Material Supply & Installation - Wooden Flooring,FL1,"C12,C13,PL1,PL4,PL5,PL6",100,Sq.Ft.,4,4,
Flooring,Egger,Material Supply & Installation - Wooden Flooring,FL2,"C12,C13,PL1,PL4,PL5,PL6",100,Sq.Ft.,2,,
Granite,Granite,Material Supply - CT,CTM1,"C10,C11,C12,C13",50,Sq.Ft.,1,,1
Miscellaneous,Floor Protection,Floor Covering,M1,CL1,1800,Sq.Ft.,1,1,
Painting,Exterior Fresh Painting,Painting - Exterior - Fresh,P1,"E1,E2,E3,E4,E6,E8,E9,PL3,P1,P4,P5,P6",300,Sq.Ft.,3,,4
Painting,Exterior Fresh Painting,Painting - Exterior - Repainting,P2,"E1,E2,E3,E4,E6,E8,E9,PL3,P1,P4,P5,P6",300,Sq.Ft.,4,,4
Painting,Interior Fresh Painting,Painting - Interior - Fresh,P3,"E1,E2,E3,E4,E6,E8,E9,PL3,P2,P3,P4,P5,P6",100,Sq.Ft.,4,3,1
Painting,Interior Re-Painting,Painting - Interior - Repainting,P5,"E1,E2,E3,E4,E6,E8,E9,PL3,P2,P3,P4,P5,P6",200,Sq.Ft.,4,3,1
Painting,Surface Preparation,Wall Putty,P6,"E1,E2,E3,E4,E6,E8,E9,PL3,P2,P3,P4,P5,P6",250,Sq.Ft.,2,2,
Painting,Surface Preparation,Oil Primer,P7,"E1,E2,E3,E4,E6,E8,E9,PL3,P2,P3,P4,P5,P6",300,Sq.Ft.,1,,1
Painting,Texture Painting,Texture Painting ,P8,"E1,E2,E3,E4,E6,E8,E9,PL3,P2,P3,P4,P5,P6",80,Sq.Ft.,2,,2
Painting,Waterproofing,Painting - Waterproofing,P9,"E1,E2,E3,E4,E6,E8,E9,PL3,P2,P3,P4,P5,P6,C9,PL1,PL2,PL3,PL4,P6",200,Sq.Ft.,5,6,1
Painting,Waterproofing,Grouting,P10,"E1,E2,E3,E4,E6,E8,E9,PL3,P2,P3,P4,P5,P6,C9,PL1,PL2,PL3,PL4,P6",200,Sq.Ft.,2,3,1
Painting,Wood & Metal Painting - Fresh Painting,Wood & Metal Painting - Fresh Painting,P11,"CS1,CS3,C3,C7,C8,C9,P8,CS1,CS6,CS7,CS8,P4",200,Sq.Ft.,3,2,1
Painting,Wood & Metal Painting - Repainting,Wood & Metal Painting - Repainting,P12,"CS1,CS3,C3,C7,C8,C9,P8,CS1,CS6,CS7,CS8,P4",200,Sq.Ft.,2,2,1
Plumbing,Shifting & Creating Points,Creating / Shifting,PL1,"D1,D2,D4,D5,D6,D7",5,Nos,2,2,
Plumbing,Bathroom Plumbing,Fixture Installation,PL2,"CM1,CM2,CM3,CS1,CS2,CS3,CS4,CS5,D1,D2,D3,D4,D5,D6,D7,C1,C2,C3,C4,C5,C6,C7,C8,C9,PL1,PL3",8,Nos,1,,1
Plumbing,Sanitary Fixtures,Material Supply - Sanitary,PL3,"CM1,CM2,CM3,CS1,CS2,CS3,CS4,CS5,D1,D2,D3,D4,D5,D6,D7,C1,C2,C3,C4,C5,C6,C7,C8,C9,PL1,PL2,PL3",-,Nos,,,1
Plumbing,Bathroom Plumbing,Plumbing Rework - Heavy,PL4,"CM1,CM2,CM3,CS1,CS2,CS3,CS4,CS5,D1,D2,D3,D4,D5,D6,D7,C1,C2,C3,C4,C5,C6,C7,C8,C9,PL1,PL2,PL3",5,Nos,1,1,
Plumbing,Kitchen Plumbing,Plumbing Rework - Heavy,PL5,"CM1,CM2,CM3,CS1,CS2,CS3,CS4,CS5,D1,D2,D3,D4,D5,D6,D7,C1,C2,C3,C4,C5,C6,C7,C8,C9,PL1,PL2,PL3",5,Nos,1,1,
Plumbing,Tap & Pipe Installation,Plumbing Rework ,PL6,"CM1,CM2,CM3,CS1,CS2,CS3,CS4,CS5,D1,D2,D3,D4,D5,D6,D7,C1,C2,C3,C4,C5,C6,C7,C8,C9,PL1,PL2,PL3",10,Nos,2,,2
Quartz,Quartz,Material Supply - CT,CTM2,NA,-,Nos,,,1
Quartz,Quartz,Material Supply & Installation - CT,CTM3,NA,,,,,
"Switches, Sockets & Plates",Fan Regulators,Material Supply - Switches/Sockets,ELM1,NA,-,Nos,,,1
"Switches, Sockets & Plates",Sockets,Material Supply - Switches/Sockets,ELM2,NA,-,Nos,,,1
"Switches, Sockets & Plates",Switch Plates,Material Supply - Switches/Sockets,ELM3,NA,-,Nos,,,1
"Switches, Sockets & Plates",Switches,Material Supply - Switches/Sockets,ELM4,NA,-,Nos,,,1
Transportation,Transportation,Material Supply & Transport - CT,T1,NA,,Nos,,,1
"""

PAINT_CODES = {"P1", "P2", "P3", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12"}


def parse_csv(source):
    records = {}
    order = []
    last_code = None

    reader = csv.reader(io.StringIO(source))
    next(reader)  # skip header

    for row in reader:
        while len(row) < 10:
            row.append("")

        category    = row[0].strip()
        subcategory = row[1].strip()
        name        = row[2].strip().replace("\n", " ")
        code        = row[3].strip()
        deps_raw    = row[4].strip()
        coverage    = row[5].strip()
        uom         = row[6].strip()
        predispatch_raw = row[8].strip()

        if not code:
            if last_code and deps_raw:
                records[last_code]["deps_raw"] += "," + deps_raw
            continue

        try:
            days = int(float(predispatch_raw))
        except (ValueError, TypeError):
            days = 0

        if days <= 0:
            last_code = code
            continue

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
    noise = {"NA", "Null", "NULL", "null", "-", "", "Last activity in the entire cycle"}
    return [c.strip() for c in deps_raw.split(",") if c.strip() and c.strip() not in noise]


def apply_cycle_breaking(parsed, valid_codes):
    for rec in parsed:
        code = rec["code"]
        deps = [d for d in parse_deps(rec["deps_raw"]) if d != code and d in valid_codes]

        if code == "M1":
            deps = []

        if code in {"C1", "C2", "C13", "CTS4"}:
            deps = [d for d in deps if d not in {"PL2", "PL3", "PL4", "PL5", "PL6"}]

        if code in {"E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"}:
            deps = [d for d in deps if d not in {"FC3", "C13", "C14"}]

        if code == "FC3":
            deps = [d for d in deps if d not in {"PL3", "PL4", "PL5", "P2", "P3", "P6"}]

        if code in PAINT_CODES:
            if code == "P6":
                deps = [d for d in deps if d not in PAINT_CODES]
            else:
                deps = [d for d in deps if d not in PAINT_CODES or d == "P6"]

        if code == "C15":
            deps = [d for d in deps if d != "P10"]

        if code in {"PL3", "PL4", "PL5", "PL6"}:
            deps = [d for d in deps if d != "PL2"]

        rec["deps"] = deps


class Command(BaseCommand):
    help = "Seed pre-dispatch tasks from embedded CSV data"

    def add_arguments(self, parser):
        parser.add_argument("--csv", dest="csv_path", default=None,
                            help="Optional path to CSV file (uses embedded data if omitted)")
        parser.add_argument("--force", action="store_true",
                            help="Re-seed even if tasks already exist")

    def handle(self, *args, **options):
        if not options["force"] and Task.objects.exists():
            self.stdout.write("Database already seeded — skipping. Use --force to re-seed.")
            return

        if options["csv_path"]:
            import os
            path = os.path.expanduser(options["csv_path"])
            if not os.path.exists(path):
                raise CommandError(f"CSV not found: {path}")
            with open(path, encoding="utf-8-sig") as f:
                source = f.read()
            self.stdout.write(f"Parsing {path} …")
        else:
            source = CSV_DATA
            self.stdout.write("Parsing embedded CSV data …")

        parsed = parse_csv(source)
        valid_codes = {r["code"] for r in parsed}
        self.stdout.write(f"  {len(parsed)} pre-dispatch tasks (days > 0)")

        apply_cycle_breaking(parsed, valid_codes)

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
            raise CommandError(f"Cycle check failed: {exc}")

        self.stdout.write("  Graph is acyclic ✓")
        topo_index = {t["code"]: i for i, t in enumerate(initial_schedule)}

        Task.objects.all().delete()
        task_objs = [
            Task(
                code=rec["code"],
                name=rec["name"],
                category=rec["category"],
                subcategory=rec["subcategory"],
                coverage=rec["coverage"],
                uom=rec["uom"],
                days=rec["days"],
                sort_order=topo_index.get(rec["code"], 999),
            )
            for rec in parsed
        ]
        Task.objects.bulk_create(task_objs)

        code_to_rec = {r["code"]: r for r in parsed}
        for t in Task.objects.all():
            dep_tasks = list(Task.objects.filter(code__in=code_to_rec[t.code]["deps"]))
            t.deps.set(dep_tasks)

        all_tasks = list(Task.objects.prefetch_related("deps").all())
        final_schedule = compute_schedule(all_tasks)
        project_days = max(t["ef"] for t in final_schedule)
        critical_count = sum(1 for t in final_schedule if t["critical"])

        self.stdout.write(self.style.SUCCESS(
            f"\nSeeded {len(task_objs)} pre-dispatch tasks. "
            f"Project duration: {project_days} days. "
            f"{critical_count} critical tasks."
        ))
