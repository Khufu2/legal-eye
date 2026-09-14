#!/bin/sh
set -eu

mkdir -p /run/clamav
chown clamav:clamav /run/clamav
rm -f /run/clamav/clamd.ctl

clamd

tries=0
while [ ! -S /run/clamav/clamd.ctl ] && [ "$tries" -lt 30 ]; do
  tries=$((tries + 1))
  sleep 1
done

if [ ! -S /run/clamav/clamd.ctl ]; then
  echo "clamd socket did not become ready" >&2
  exit 1
fi

exec gosu scanner uvicorn app:app --host 0.0.0.0 --port "${PORT}" --workers 1 --proxy-headers --no-server-header
