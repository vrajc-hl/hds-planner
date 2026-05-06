#!/usr/bin/env bash
set -e

pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

# Seed only if the DB is empty (first deploy or fresh disk)
TASK_COUNT=$(python manage.py shell -c "from tasks.models import Task; print(Task.objects.count())")
if [ "$TASK_COUNT" = "0" ]; then
  echo "Seeding database..."
  python manage.py seed_predispatch --csv /data/HDS\ Plan\ Dependency\ Dashboard\ -\ Data\ Dump.csv
else
  echo "Database already has $TASK_COUNT tasks — skipping seed."
fi
