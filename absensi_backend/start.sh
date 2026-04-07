#!/usr/bin/env sh
set -e

if [ -z "${APP_KEY:-}" ]; then
  echo "APP_KEY belum diisi. Tambahkan APP_KEY di environment variables Render."
  exit 1
fi

PORT_TO_USE="${PORT:-10000}"

mkdir -p storage/framework/cache/data
mkdir -p storage/framework/sessions
mkdir -p storage/framework/testing
mkdir -p storage/framework/views
mkdir -p storage/logs
mkdir -p bootstrap/cache

chmod -R ug+rw storage bootstrap/cache || true

php artisan config:clear
php artisan cache:clear || true
php artisan route:clear || true
php artisan view:clear || true
php artisan package:discover --ansi || true
php artisan storage:link || true
php artisan migrate --force

php artisan serve --host=0.0.0.0 --port="${PORT_TO_USE}"
