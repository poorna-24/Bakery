#!/usr/bin/env bash
# One-time setup of a fresh Oracle Cloud Ubuntu server for the bakery.
# Run on the server, from the cloned project:   ~/Bakery/deploy/oracle/setup.sh
# Safe to run again: every step checks before it changes anything.
set -euo pipefail

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

say "Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"

say "Firewall: allow web traffic (80, 443)"
# Oracle's Ubuntu images refuse everything but SSH in iptables — on top of the
# network's security list, which has to allow 80 and 443 as well. New rules go
# just above the catch-all REJECT.
open_port() {
  local proto=$1 port=$2
  if sudo iptables -C INPUT -p "$proto" --dport "$port" -j ACCEPT 2>/dev/null; then return; fi
  local reject
  reject=$(sudo iptables -L INPUT --line-numbers | awk '/REJECT/ {print $1; exit}')
  if [ -n "$reject" ]; then
    sudo iptables -I INPUT "$reject" -p "$proto" --dport "$port" -j ACCEPT
  else
    sudo iptables -A INPUT -p "$proto" --dport "$port" -j ACCEPT
  fi
}
open_port tcp 80
open_port tcp 443
open_port udp 443
if command -v netfilter-persistent >/dev/null 2>&1; then
  sudo netfilter-persistent save
fi

say "Security updates, installed automatically"
sudo apt-get update -qq
sudo apt-get install -y -qq unattended-upgrades git >/dev/null

say "Nightly database backup at 02:30"
mkdir -p "$HOME/bakery-backups"
backup="$(cd "$(dirname "$0")" && pwd)/backup.sh"
( crontab -l 2>/dev/null | grep -v '# bakery-backup' || true
  echo "30 2 * * * $backup >> $HOME/bakery-backups/backup.log 2>&1 # bakery-backup" ) | crontab -

say "Done"
cat <<'NEXT'
Next:
  1. Log out and back in (so Docker works without sudo).
  2. Create ~/Bakery/.env from deploy/oracle/env.example and fill it in.
  3. Run ~/Bakery/deploy/oracle/deploy.sh
NEXT
