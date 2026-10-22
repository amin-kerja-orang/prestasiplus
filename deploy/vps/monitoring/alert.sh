#!/usr/bin/env bash
# Send one alert text (journal/stderr + PP_ALERT_WEBHOOK_URL). Used by the systemd failure hook:
#   deploy/vps/monitoring/alert.sh "message"
set -uo pipefail
export PP_SCRIPT=alert
# shellcheck source-path=SCRIPTDIR
# shellcheck source=../lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"
pp_alert "${*:-alert without text}"
