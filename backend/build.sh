#!/usr/bin/env bash
set -e

pip install -r requirements.txt

# Create /data dir if the persistent disk is mounted; otherwise use project dir
if [ -d "/data" ]; then
  export DB_PATH="/data/db.sqlite3"
  echo "Using persistent disk: $DB_PATH"
else
  export DB_PATH="$(pwd)/db.sqlite3"
  echo "No persistent disk — using local: $DB_PATH"
fi

python manage.py migrate
python manage.py collectstatic --noinput
python manage.py seed_predispatch
