#!/bin/bash
while true; do
  bun run dev 2>&1
  echo "SERVER DIED at $(date) - restarting..." >> restart.log
  sleep 2
done
