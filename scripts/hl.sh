#!/usr/bin/env bash
# Usage: scripts/hl.sh "<command>" — pushes the local tree to ubuntu-homelab (rsync, not
# syncthing: many agents edit at once), then runs <command> there in the repo root.
set -euo pipefail
rsync -a --exclude node_modules --exclude .nuxt --exclude .output --exclude .git \
  ~/hfl-projects/chat-template-nuxt/ ubuntu-homelab:hfl-projects/chat-template-nuxt/
exec ssh ubuntu-homelab "cd ~/hfl-projects/chat-template-nuxt && $1"
