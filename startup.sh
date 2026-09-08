#!/bin/sh
set -eu
cd /workspace
if [ -f /workspace/.local/supabase-secret ]; then
  SUPABASE_SECRET_KEY=$(tr -d '\n\r' < /workspace/.local/supabase-secret)
  export SUPABASE_SECRET_KEY
fi
if [ -f /workspace/.local/slack-webhook ]; then
  SLACK_WEBHOOK_URL=$(tr -d '\n\r' < /workspace/.local/slack-webhook)
  export SLACK_WEBHOOK_URL
fi
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
