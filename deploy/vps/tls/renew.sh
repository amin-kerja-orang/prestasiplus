#!/usr/bin/env bash
# Renew the Let's Encrypt certificate and reload the edge (AZ-09). Run twice a day by pp-cert-renew.timer or cron
# (certbot only renews when fewer than 30 days remain, so most runs do nothing).
#   deploy/vps/tls/renew.sh
# Renewal uses the webroot challenge on port 80 through the running edge; no downtime.
set -Eeuo pipefail
umask 077
export PP_SCRIPT=cert-renew
# shellcheck source-path=SCRIPTDIR
# shellcheck source=../lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

export PP_IMAGE_TAG="${PP_IMAGE_TAG:-prod}"
trap 'pp_alert "CERTIFICATE RENEWAL FAILED (exit $?). Check: docker compose --profile tls run --rm certbot renew --dry-run"' ERR
pp_compose --profile tls run --rm certbot renew --webroot -w /var/www/certbot --quiet
pp_compose exec -T edge nginx -s reload
pp_log "renew check done; edge reloaded"
