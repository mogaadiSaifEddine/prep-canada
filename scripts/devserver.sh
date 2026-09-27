#!/bin/sh
# Restart the local test server (mock AI + mock payments) on port 3100.
cd "$(dirname "$0")/.."
[ -f /tmp/pc.pid ] && kill "$(cat /tmp/pc.pid)" 2>/dev/null
sleep 0.5
rm -rf .data
DATABASE_URL=pglite:./.data GEMINI_MOCK=1 PAYMENTS_MOCK=1 ADMIN_EMAILS=admin@x.tn SUPPORT_EMAIL=help@prepcanada.tn MANUAL_PAY_INFO="D17: 12 345 678 (Prep Canada)" PORT=3100 nohup node server.js > /tmp/srv.log 2>&1 &
echo $! > /tmp/pc.pid
sleep 2
