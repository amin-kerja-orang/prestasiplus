#!/usr/bin/env bash
# Local health probe, every 5 minutes (AZ-09). Runbook: docs/ops/production-vps.md (section 10)
#
#   deploy/vps/monitoring/health-probe.sh [--quiet]
#
# Checks (each failure is one line in the alert):
#   - GET https://PP_DOMAIN/api/health and /api/ready answer 200 (through the real DNS name, TLS and the edge;
#     PP_PROBE_BASE_URL overrides the base for tests)
#   - no compose service of this stack is unhealthy or exited
#   - disk use of /, the Docker data root and the backup directory is below PP_ALERT_DISK_PCT
#   - the certificate expires in more than PP_ALERT_CERT_DAYS days (read from the certificate file)
#   - the newest dump is younger than PP_ALERT_BACKUP_MAX_AGE_H hours (backup failure that went unnoticed)
#   - API error lines (pino level 50) in the last 5 minutes stay below PP_ALERT_API_ERRORS_5M (default 25): a cheap
#     error tracker until a decision on Sentry/GlitchTip (runbook, DECISION NEEDED)
# On failure: PP_ALERT_WEBHOOK_URL gets one message (repeated at most every 6 h while the SAME problem persists,
# at once when the set of problems changes) and PP_HEALTHCHECK_PROBE_URL/fail is pinged. On success the
# dead man's switch PP_HEALTHCHECK_PROBE_URL is pinged, so a dead probe or a dead server also raises an alert
# at the provider. Exit status 1 = at least one check failed.
set -uo pipefail
umask 077
export PP_SCRIPT=health-probe
# shellcheck source-path=SCRIPTDIR
# shellcheck source=../lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

quiet=0; [ "${1:-}" = "--quiet" ] && quiet=1
domain="$(pp_cfg PP_DOMAIN '')"
base="${PP_PROBE_BASE_URL:-https://$domain}"
disk_pct="$(pp_cfg PP_ALERT_DISK_PCT 85)"
cert_days="$(pp_cfg PP_ALERT_CERT_DAYS 21)"
max_age_h="$(pp_cfg PP_ALERT_BACKUP_MAX_AGE_H 30)"
max_errors="$(pp_cfg PP_ALERT_API_ERRORS_5M 25)"
backup_dir="$(pp_cfg PP_BACKUP_DIR /var/backups/pretasiplus)"
le_dir="$(pp_cfg PP_LE_DIR /srv/pretasiplus/letsencrypt)"
state_dir="$(pp_cfg PP_STATE_DIR /var/lib/pretasiplus-deploy)"
probe_url="$(pp_cfg PP_HEALTHCHECK_PROBE_URL '')"
export PP_IMAGE_TAG="${PP_IMAGE_TAG:-prod}"

problems=()
say() { [ "$quiet" = 1 ] || pp_log "$*"; }

# ---- endpoints ----
for path in /api/health /api/ready; do
  code="$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$base$path" 2>/dev/null || true)"
  if [ "$code" = 200 ]; then say "ok   $path 200"; else problems+=("$path answered ${code:-000}"); fi
done

# ---- containers ----
if command -v docker >/dev/null && ps_out="$(pp_compose ps --format '{{.Service}} {{.State}} {{.Health}}' 2>/dev/null)" && [ -n "$ps_out" ]; then
  while read -r svc state health; do
    [ -n "$svc" ] || continue
    case "$svc" in certbot|migrate) continue ;; esac
    if [ "$state" != running ] || [ "$health" = unhealthy ]; then problems+=("service $svc is $state${health:+/$health}"); fi
  done <<<"$ps_out"
  say "ok   container states read"
else
  problems+=("could not read the container states (docker compose ps failed)")
fi

# ---- disk ----
docker_root="$(docker info -f '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)"
for p in / "$docker_root" "$backup_dir"; do
  [ -e "$p" ] || continue
  use="$(df -P "$p" | awk 'NR==2 {gsub("%","",$5); print $5}')"
  if [ "${use:-0}" -ge "$disk_pct" ]; then problems+=("disk $p is ${use}% full (limit ${disk_pct}%)"); else say "ok   disk $p ${use}%"; fi
done

# ---- certificate ----
cert="$le_dir/live/$domain/fullchain.pem"
if [ -f "$cert" ]; then
  end="$(openssl x509 -enddate -noout -in "$cert" 2>/dev/null | cut -d= -f2)"
  end_s="$(date -d "$end" +%s 2>/dev/null || echo 0)"
  days=$(( (end_s - $(date +%s)) / 86400 ))
  if [ "$end_s" -eq 0 ] || [ "$days" -lt "$cert_days" ]; then problems+=("certificate for $domain expires in ${days} days (limit ${cert_days})"); else say "ok   certificate $days days left"; fi
else
  problems+=("certificate file not found: $cert")
fi

# ---- newest backup ----
newest="$(find "$backup_dir" -maxdepth 1 -type f -name 'pp-backup-*.dump' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n1 | cut -d' ' -f1)"
if [ -z "$newest" ]; then problems+=("no backup file found in $backup_dir")
else
  age_h=$(( ($(date +%s) - ${newest%.*}) / 3600 ))
  if [ "$age_h" -gt "$max_age_h" ]; then problems+=("newest backup is ${age_h} h old (limit ${max_age_h} h)"); else say "ok   newest backup ${age_h} h old"; fi
fi

# ---- API errors in the last 5 minutes ----
if errs="$(pp_compose logs --since 5m --no-log-prefix api 2>/dev/null | grep -c '"level":50')"; then :; else errs="${errs:-0}"; fi
if [ "${errs:-0}" -ge "$max_errors" ]; then problems+=("api logged $errs error lines in 5 minutes (limit $max_errors)"); else say "ok   api error lines in 5 min: ${errs:-0}"; fi

# ---- outcome ----
mkdir -p "$state_dir" 2>/dev/null || true
sig_file="$state_dir/probe.state"
if [ ${#problems[@]} -eq 0 ]; then
  rm -f "$sig_file" 2>/dev/null || true
  pp_ping "$probe_url"
  say "all checks passed"
  exit 0
fi

msg="$(printf '%s; ' "${problems[@]}")"
sig="$(printf '%s' "$msg" | sha256sum | cut -d' ' -f1)"
now="$(date +%s)"
last_sig=""; last_ts=0
if [ -r "$sig_file" ]; then read -r last_sig last_ts <"$sig_file" || true; fi
if [ "$sig" != "$last_sig" ] || [ $(( now - ${last_ts:-0} )) -ge 21600 ]; then
  pp_alert "HEALTH PROBE: $msg"
  printf '%s %s\n' "$sig" "$now" >"$sig_file" 2>/dev/null || true
else
  pp_warn "still failing (alert already sent): $msg"
fi
pp_ping "$probe_url" fail
exit 1
