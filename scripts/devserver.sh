#!/bin/sh
# Restart the local test server (mock AI + mock payments, fresh database) on port 3100.
# Uses the production build: run `npm run build` first after changing code.
# Extra settings pass through the environment, e.g. POOL_FRESH_SMALL=0 ./scripts/devserver.sh
cd "$(dirname "$0")/.."
pkill -f "next/dist/bin/next start -p 3100" 2>/dev/null; pkill -f "next-server" 2>/dev/null
[ -f /tmp/pc.pid ] && kill "$(cat /tmp/pc.pid)" 2>/dev/null
sleep 1
rm -rf .data
export DATABASE_URL=pglite:./.data GEMINI_MOCK=1 PAYMENTS_MOCK=1 ADMIN_EMAILS=admin@x.tn SUPPORT_EMAIL=help@prepcanada.tn MANUAL_PAY_INFO="D17: 12 345 678 (Prep Canada)"
nohup node node_modules/next/dist/bin/next start -p 3100 > /tmp/srv.log 2>&1 &
echo $! > /tmp/pc.pid
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3100/api/health && break; sleep 0.5; done
