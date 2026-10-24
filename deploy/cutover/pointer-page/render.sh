#!/usr/bin/env bash
# Render the .cloud pointer page (MIG-08 switch option A). Runbook: docs/ops/production-migration-slot.md (section 5).
#
#   deploy/cutover/pointer-page/render.sh --url https://<v2 host>/ --support-email <role mailbox> \
#       --support-whatsapp <digits, country code first> --out <file outside the repo>
#
# Fills the three placeholders of index.template.html, checks each value, refuses a value that could break out of
# the HTML (only plain URL, mailbox and digit characters are accepted), refuses to leave a placeholder, writes the
# page and prints its sha256. Hand the file and the sha256 to the `.cloud` operator (half AM), who places it on .cloud. Nothing here touches
# .cloud, prestasiplus.my or any server.
set -euo pipefail
umask 022
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
url=""; email=""; wa=""; out=""
die() { printf 'pointer-page: error: %s\n' "$1" >&2; exit "${2:-1}"; }
while [ $# -gt 0 ]; do
  case "$1" in
    --url) url="${2:?}"; shift 2 ;;
    --support-email) email="${2:?}"; shift 2 ;;
    --support-whatsapp) wa="${2:?}"; shift 2 ;;
    --out) out="${2:?}"; shift 2 ;;
    -h|--help) sed -n '2,11p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) die "unknown argument: $1" 2 ;;
  esac
done
[[ "$url" =~ ^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]{2,5})?(/[A-Za-z0-9._~/-]*)?$ ]] \
  || die "--url must be a plain https URL in lowercase (https://host/ or https://host/path)" 2
case "$url" in *example*|*.invalid*|*localhost*) die "--url still looks like a placeholder" 2 ;; esac
[[ "$email" =~ ^[A-Za-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$ ]] || die "--support-email must be a plain mailbox (a role address, not a person)" 2
[[ "$wa" =~ ^[0-9]{9,15}$ ]] || die "--support-whatsapp must be 9-15 digits, country code first" 2
[ "$wa" != 60000000000 ] || die "--support-whatsapp is the dev default" 2
[ -n "$out" ] || die "--out FILE is required" 2
case "$(readlink -m "$out")/" in "$repo"/*) die "--out must be outside the repository" 2 ;; esac

page="$(sed -e "s#{{V2_URL}}#$url#g" -e "s#{{SUPPORT_EMAIL}}#$email#g" -e "s#{{SUPPORT_WHATSAPP}}#$wa#g" "$here/index.template.html")"
! grep -q '{{' <<<"$page" || die "a placeholder is left in the page"
printf '%s\n' "$page" >"$out"
printf 'pointer page written: %s\nsha256: %s\n' "$out" "$(sha256sum "$out" | cut -d' ' -f1)"
