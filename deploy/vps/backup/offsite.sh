#!/usr/bin/env bash
# Copy backup files off the server (AZ-09). Called by backup.sh; can be run by hand with file paths.
#
#   deploy/vps/backup/offsite.sh FILE...
#
# PP_OFFSITE_KIND (prod.env):
#   s3      any S3-compatible store through the aws CLI:  aws s3 cp --endpoint-url PP_OFFSITE_S3_ENDPOINT
#           credentials come from the aws CLI configuration of the user running this (profile PP_OFFSITE_S3_PROFILE,
#           ~/.aws/credentials or AWS_* variables in the unit environment). Retention off-site = a lifecycle rule
#           on the bucket (and object lock if the provider supports it), see the runbook.
#   rsync   rsync over ssh to PP_OFFSITE_RSYNC_TARGET with a key-based, passwordless login of the backup user
#   none    nothing is copied; a loud warning is logged (accepted only until the LEAD names a target)
# PP_BACKUP_GPG_RECIPIENT: when set, each file is encrypted with that public key before it leaves the server
# (the .sha256 sidecar stays plain and describes the unencrypted file). Dumps hold personal data of minors.
set -euo pipefail
umask 077
export PP_SCRIPT=offsite
# shellcheck source-path=SCRIPTDIR
# shellcheck source=../lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/lib.sh"

[ $# -gt 0 ] || pp_die "no files given" 2
kind="$(pp_cfg PP_OFFSITE_KIND none)"
gpg_rcpt="$(pp_cfg PP_BACKUP_GPG_RECIPIENT '')"

if [ "$kind" = none ]; then
  pp_warn "PP_OFFSITE_KIND=none: NO OFF-SITE COPY was made. A disk loss on this VPS loses every backup."
  exit 0
fi

tmpdir=""
cleanup() { [ -z "$tmpdir" ] || rm -rf "$tmpdir"; }
trap cleanup EXIT

send=()
for f in "$@"; do
  [ -f "$f" ] || pp_die "missing file: $f"
  case "$f" in
    *.sha256) send+=("$f") ;;
    *)
      if [ -n "$gpg_rcpt" ]; then
        command -v gpg >/dev/null || pp_die "PP_BACKUP_GPG_RECIPIENT is set but gpg is not installed"
        [ -n "$tmpdir" ] || tmpdir="$(mktemp -d)"
        gpg --batch --yes --trust-model always --encrypt --recipient "$gpg_rcpt" \
          --output "$tmpdir/$(basename "$f").gpg" "$f"
        send+=("$tmpdir/$(basename "$f").gpg")
      else
        send+=("$f")
      fi
      ;;
  esac
done

case "$kind" in
  s3)
    command -v aws >/dev/null || pp_die "aws CLI not installed (needed for PP_OFFSITE_KIND=s3)"
    uri="$(pp_cfg PP_OFFSITE_S3_URI '')"
    [ -n "$uri" ] || pp_die "PP_OFFSITE_S3_URI is empty"
    endpoint="$(pp_cfg PP_OFFSITE_S3_ENDPOINT '')"
    profile="$(pp_cfg PP_OFFSITE_S3_PROFILE '')"
    aws_args=()
    [ -z "$endpoint" ] || aws_args+=(--endpoint-url "$endpoint")
    [ -z "$profile" ] || aws_args+=(--profile "$profile")
    for f in "${send[@]}"; do
      aws "${aws_args[@]}" s3 cp --only-show-errors "$f" "${uri%/}/$(basename "$f")"
      pp_log "off-site (s3) ok: $(basename "$f")"
    done
    ;;
  rsync)
    command -v rsync >/dev/null || pp_die "rsync not installed (needed for PP_OFFSITE_KIND=rsync)"
    target="$(pp_cfg PP_OFFSITE_RSYNC_TARGET '')"
    [ -n "$target" ] || pp_die "PP_OFFSITE_RSYNC_TARGET is empty"
    port="$(pp_cfg PP_OFFSITE_RSYNC_SSH_PORT 22)"
    rsync -a --partial -e "ssh -p $port -o BatchMode=yes -o StrictHostKeyChecking=yes" "${send[@]}" "$target"
    pp_log "off-site (rsync) ok: ${#send[@]} file(s)"
    ;;
  *) pp_die "PP_OFFSITE_KIND must be s3, rsync or none (got: $kind)" 2 ;;
esac
