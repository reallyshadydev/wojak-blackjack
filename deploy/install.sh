#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_NAME="wjkbj.wojakcoin.cash"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo $0"
  exit 1
fi

export NVM_DIR="/root/.nvm"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null

cd "$ROOT"
npm run setup
npm run build

cp "$ROOT/deploy/wojak-blackjack.service" /etc/systemd/system/wojak-blackjack.service
systemctl daemon-reload
systemctl enable wojak-blackjack
systemctl restart wojak-blackjack

mkdir -p /var/www/certbot
cp "$ROOT/deploy/nginx-wjkbj-wojakcoin.conf" "/etc/nginx/sites-available/${SITE_NAME}.conf"
ln -sf "/etc/nginx/sites-available/${SITE_NAME}.conf" "/etc/nginx/sites-enabled/${SITE_NAME}.conf"
nginx -t
systemctl reload nginx

echo "Installed wojak-blackjack on https://${SITE_NAME}"
echo "  service : wojak-blackjack (127.0.0.1:8787)"
echo ""
echo "Issue or renew TLS:"
echo "  certbot --nginx -d ${SITE_NAME}"
