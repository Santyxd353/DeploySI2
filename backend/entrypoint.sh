#!/bin/sh
set -e

echo "Waiting for database..."
python manage.py wait_for_db

if [ "$RUN_MIGRATIONS" != "false" ]; then
    echo "Applying shared schema migrations..."
    python manage.py migrate_schemas --shared --noinput

    echo "Applying tenant schema migrations..."
    python manage.py migrate_schemas --noinput

    echo "Bootstrapping default SaaS plans..."
    python manage.py bootstrap_saas || true
fi

mkdir -p /app/backups

exec "$@"
