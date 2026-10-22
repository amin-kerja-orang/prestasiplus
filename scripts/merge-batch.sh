#!/usr/bin/env bash
# merge-batch: merge the PRs of the newest "Merge-ready checker summary" (or a manual list), each pinned to its head
# commit, then report. The GitHub workflow .github/workflows/merge-batch.yml is a thin wrapper around `run`;
# the other subcommands are pure parts so tests can call them offline. Setup and usage: docs/ops/merge-batch-workflow.md.
#
#   merge-batch.sh select-summary   stdin: JSON array(s) of issue comments -> the newest checker summary (compact JSON)
#   merge-batch.sh parse-summary    stdin: summary body -> TSV "pr<TAB>sha<TAB>base<TAB>flag<TAB>note"
#                                   (flag: merge | signoff, per whole numbered item; note: warn | -)
#   merge-batch.sh parse-manual L   L = "172:<40hex>,171:<40hex>" -> same TSV with base "*", flag merge, note -
#   merge-batch.sh blocking-text    stdin: comment/review body; exit 0 = blocking text, exit 1 = not blocking
#   merge-batch.sh run              the full flow (environment below)
#
# Environment for `run` (inputs only via environment, never argv):
#   GH_REPO         owner/name (default amin-kerja-orang/prestasiplus)
#   READ_TOKEN      token for reads and for the report comments (optional; no auth header when empty, for local runs)
#   MERGE_TOKEN     token used ONLY for PUT /pulls/N/merge (required unless dry run)
#   MB_SOURCE       "checker" (default/empty) or "172:<40hex>,171:<40hex>"
#   MB_EXCLUDE      PR numbers to skip, comma or space separated
#   MB_SUMMARY_ID   optional: the newest checker summary must have exactly this comment id (digits)
#   DRY_RUN         "0" = real run; anything else, or unset = dry run
#   RUN_ID, RUN_URL for the titles and links
#   Tuning/testing (IGNORED when GITHUB_ACTIONS=true): GITHUB_API (default https://api.github.com), CHECKER_LOGIN
#                   (azarulhakim), CHECKER_USER_ID (47310631), CHECKER_ISSUE (67), NOTIFY_ISSUES ("113 109"),
#                   ALLOWED_BASES ("feature/v2-backend be/integration-frontend"), POLL_INTERVAL (10 s), POLL_MAX (120 s)
#
# HTTP methods used: GET everywhere; PUT only on /pulls/N/merge; POST only on /issues/<67|113|109>/comments.
# Exit codes: 0 = done, 1 = error or at least one FAILED merge (after the report was posted).
set -euo pipefail

if [[ ${GITHUB_ACTIONS-} == true ]]; then
  unset GITHUB_API CHECKER_LOGIN CHECKER_USER_ID CHECKER_ISSUE NOTIFY_ISSUES ALLOWED_BASES POLL_INTERVAL POLL_MAX
fi
GH_REPO=${GH_REPO:-amin-kerja-orang/prestasiplus}
GITHUB_API=${GITHUB_API:-https://api.github.com}
CHECKER_LOGIN=${CHECKER_LOGIN:-azarulhakim}
CHECKER_USER_ID=${CHECKER_USER_ID:-47310631}
CHECKER_ISSUE=${CHECKER_ISSUE:-67}
NOTIFY_ISSUES=${NOTIFY_ISSUES:-113 109}
ALLOWED_BASES=${ALLOWED_BASES:-feature/v2-backend be/integration-frontend}
POLL_INTERVAL=${POLL_INTERVAL:-10}
POLL_MAX=${POLL_MAX:-120}

die() { printf 'merge-batch: %s\n' "$*" >&2; exit 1; }

is_allowed_base() {
  local b
  for b in $ALLOWED_BASES; do [[ $b == "$1" ]] && return 0; done
  return 1
}

# ---------------------------------------------------------------- select-summary
cmd_select_summary() {
  local out
  [[ $CHECKER_USER_ID =~ ^[0-9]+$ ]] || die 'CHECKER_USER_ID must be digits'
  out=$(jq -sc --arg l "$CHECKER_LOGIN" --argjson uid "$CHECKER_USER_ID" '
    (add // [])
    | map(select(.user.login == $l and .user.id == $uid and .user.type == "User"
        and ((.body // "") | split("\n")[0] | rtrimstr("\r") | startswith("Merge-ready checker summary"))))
    | sort_by([.created_at, .id]) | last // empty') || die 'input is not a JSON array of comments'
  [[ -n $out ]] || die "no 'Merge-ready checker summary' comment by $CHECKER_LOGIN (type User, id $CHECKER_USER_ID) found"
  [[ $(jq -r '.updated_at == .created_at' <<<"$out") == true ]] || die 'newest checker summary was edited after posting: refusing (no fallback to an older one)'
  printf '%s\n' "$out"
}

# ---------------------------------------------------------------- parse-summary
# The section is cut into blocks: a block is one column-0 line plus the indented/blank lines that follow it (a numbered item
# with its sub-bullets). The sign-off flag and the warning note are decided over the whole block.
cmd_parse_summary() {
  local body line in_sec=0 found=0 base='-' name
  local -a out=() blk=()
  local -A seen=()
  local re_bold='^\*\*([^*]+)\*\*'
  local re_branch='^[A-Za-z0-9._-]+/[A-Za-z0-9._/-]+$'
  local re_signoff='sign(-|[[:space:]]|‑|‐)?off'

  flush_block() {
    local text='' l flag=merge note=- rest total valid pr sha repo tmp
    # shellcheck disable=SC2016
    local re_span='`gh pr merge ([0-9]+) --repo ([^[:space:]`]+) --merge --match-head-commit ([0-9a-f]{40})`'
    ((${#blk[@]} > 0)) || return 0
    for l in "${blk[@]}"; do text+="$l"$'\n'; done
    [[ ${text,,} =~ $re_signoff ]] && flag=signoff
    if [[ $text == *'⚠'* || ${text,,} == *'lead chooses'* ]]; then note=warn; fi
    for l in "${blk[@]}"; do
      tmp=${l//'gh pr merge'/}
      total=$(((${#l} - ${#tmp}) / 11))
      ((total > 0)) || continue
      valid=0
      rest=$l
      while [[ $rest =~ $re_span ]]; do
        pr=${BASH_REMATCH[1]}
        repo=${BASH_REMATCH[2]}
        sha=${BASH_REMATCH[3]}
        [[ $repo == "$GH_REPO" ]] || die "command for #$pr names repo '$repo', expected '$GH_REPO'"
        [[ -z ${seen[$pr]-} ]] || die "ambiguous summary: PR #$pr appears twice"
        seen[$pr]=1
        out+=("$pr"$'\t'"$sha"$'\t'"$base_of_blk"$'\t'"$flag"$'\t'"$note")
        valid=$((valid + 1))
        rest=${rest#*"${BASH_REMATCH[0]}"}
      done
      ((valid == total)) || die "a 'gh pr merge' occurrence is not exactly one backticked command: ${l:0:100}"
    done
    blk=()
  }

  body=$(cat)
  body=${body//$'\r'/}
  local base_of_blk='-'
  while IFS= read -r line || [[ -n $line ]]; do
    if ((in_sec == 0)); then
      if [[ $line == '### SEDIA MERGE (safe order)' ]]; then in_sec=1; found=1; fi
      continue
    fi
    if [[ $line == '### '* ]]; then break; fi
    [[ $line != *'<!--'* ]] || die 'HTML comment in SEDIA section'
    if [[ $line =~ $re_bold ]]; then
      name=${BASH_REMATCH[1]}
      name=${name%.}
      if is_allowed_base "$name" || [[ $name =~ $re_branch ]]; then
        flush_block
        base=$name
        continue
      fi
    fi
    if [[ -z $line || $line == [[:space:]]* ]]; then
      ((${#blk[@]} > 0)) && blk+=("$line")
      continue
    fi
    local re_new='^([0-9]+\.[[:space:]]|\*\*|[-*][[:space:]])'
    if ((${#blk[@]} > 0)) && [[ -n ${blk[-1]//[[:space:]]/} ]] && ! [[ $line =~ $re_new ]]; then
      blk+=("$line")
      continue
    fi
    flush_block
    base_of_blk=$base
    blk=("$line")
  done <<<"$body"
  flush_block
  ((found == 1)) || die "newest checker summary has no '### SEDIA MERGE (safe order)' section"
  ((${#out[@]} > 0)) || die "'### SEDIA MERGE (safe order)' section has no merge commands"
  printf '%s\n' "${out[@]}"
}

# ---------------------------------------------------------------- parse-manual
cmd_parse_manual() {
  local list=${1-} item pr sha
  local -A seen=()
  local -a items=() out=()
  local re_trim='^[[:space:]]*(.*[^[:space:]])[[:space:]]*$'
  local re_pair='^([0-9]+):([0-9a-f]{40})$'
  [[ -n $list ]] || die 'manual list is empty'
  [[ $list != *$'\n'* ]] || die 'manual list must be a single line'
  [[ $list != ,* && $list != *, && $list != *,,* ]] || die 'manual list has an empty item'
  IFS=, read -ra items <<<"$list"
  for item in "${items[@]}"; do
    [[ $item =~ $re_trim ]] || die 'manual list has an empty item'
    item=${BASH_REMATCH[1]}
    [[ $item =~ $re_pair ]] || die "bad manual item '${item:0:60}': expected <PR>:<40 lowercase hex>"
    pr=${BASH_REMATCH[1]}
    sha=${BASH_REMATCH[2]}
    [[ -z ${seen[$pr]-} ]] || die "PR #$pr is listed twice"
    seen[$pr]=1
    out+=("$pr"$'\t'"$sha"$'\t*\tmerge\t-')
  done
  printf '%s\n' "${out[@]}"
}

# ---------------------------------------------------------------- blocking-text
# Returns 0 when the text blocks a merge: the word void, "changes needed", or the word Blocker/Major not followed by 0.
blocking_text() (
  shopt -s nocasematch
  local text=$1 rest tail
  local re_void='(^|[^[:alnum:]_])void([^[:alnum:]_]|$)'
  local re_changes='changes[[:space:]]+needed'
  local re_sev='(^|[^[:alnum:]_])(blocker|major)([^[:alnum:]_].*|)$'
  local re_zero='^[:[:space:]]*0([^[:alnum:]_]|$)'
  [[ $text =~ $re_void ]] && return 0
  [[ $text =~ $re_changes ]] && return 0
  rest=$text
  while [[ $rest =~ $re_sev ]]; do
    tail=${BASH_REMATCH[3]}
    [[ $tail =~ $re_zero ]] || return 0
    rest=$tail
  done
  return 1
)

cmd_blocking_text() {
  local text
  text=$(cat)
  blocking_text "$text"
}

# ---------------------------------------------------------------- HTTP
HTTP_CODE=000
RESP=''

# http TOKEN PATH [curl args...]; body goes to $RESP, status to $HTTP_CODE. Tokens never appear on a command line.
http() {
  local tok=$1 path=$2
  shift 2
  local -a args=(-sS --max-time 60 -o "$RESP" -w '%{http_code}'
    -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' -H 'User-Agent: merge-batch' "$@")
  : >"$RESP"
  if [[ -n $tok ]]; then
    HTTP_CODE=$(curl "${args[@]}" -H @<(printf 'Authorization: Bearer %s\n' "$tok") "$GITHUB_API$path") || HTTP_CODE=000
  else
    HTTP_CODE=$(curl "${args[@]}" "$GITHUB_API$path") || HTTP_CODE=000
  fi
}

api_msg() { jq -r '.message // empty' "$RESP" 2>/dev/null | head -c 300 || true; }

ERR=''
# get PATH: 0 on 2xx; otherwise sets $ERR and returns 1.
get() {
  http "$READ_TOK" "$1"
  if [[ $HTTP_CODE == 2?? ]]; then return 0; fi
  ERR="GET ${1%%\?*} failed: HTTP $HTTP_CODE $(api_msg)"
  return 1
}

# get_pages OUTFILE PATH_WITH_QUERY: all pages (per_page=100 must be in the query) merged into one JSON array.
get_pages() {
  local dest=$1 base=$2 page=1 n
  local -a parts=()
  while :; do
    get "$base&page=$page" || return 1
    cp "$RESP" "$dest.p$page"
    parts+=("$dest.p$page")
    n=$(jq 'length' "$RESP") || { ERR="GET ${base%%\?*}: not a JSON array"; return 1; }
    ((n < 100)) && break
    page=$((page + 1))
    ((page <= 300)) || { ERR="GET ${base%%\?*}: more than 300 pages"; return 1; }
  done
  jq -s 'add // []' "${parts[@]}" >"$dest"
  rm -f "${parts[@]}"
}

# post_comment ISSUE BODY: the only POST. Sets $POSTED_URL.
POSTED_URL=''
post_comment() {
  local issue=$1 body=$2
  [[ $issue =~ ^[0-9]+$ ]] || die "bad issue number '$issue'"
  jq -n --arg b "$body" '{body: $b}' >"$WORK/payload.json"
  http "$READ_TOK" "/repos/$GH_REPO/issues/$issue/comments" -X POST -H 'Content-Type: application/json' --data-binary @"$WORK/payload.json"
  if [[ $HTTP_CODE == 201 ]]; then
    POSTED_URL=$(jq -r '.html_url // empty' "$RESP")
    return 0
  fi
  ERR="POST comment on #$issue failed: HTTP $HTTP_CODE $(api_msg)"
  return 1
}

# ---------------------------------------------------------------- run
WORK=''
PR_JSON=''
READ_TOK=''
MERGE_TOK=''
declare -A FAILED_BASE=() EXCLUDED=() TIP=()
P_RES='' P_REASON='' P_BASE='' P_WARN=0
HAD_ERROR=0
DRY=1
ZWSP=$(printf '\xe2\x80\x8b')

short() { printf '%s' "${1:0:8}"; }
pj() { jq -r "$1" <<<"$PR_JSON"; }

# esc TEXT: safe for a markdown table cell: no pipes, backticks, HTML, newlines or @-mentions.
esc() {
  local t=$1
  t=${t//$'\n'/ }
  t=${t//$'\r'/ }
  t=${t//\\/\\\\}
  t=${t//|/\\|}
  t=${t//\`/\'}
  t=${t//</&lt;}
  t=${t//>/&gt;}
  t=${t//@/@$ZWSP}
  printf '%s' "$t"
}

# norm_ts TS: ISO-8601 -> canonical YYYY-MM-DDTHH:MM:SSZ (empty output on failure)
norm_ts() { jq -nr --arg t "$1" '$t | fromdateiso8601 | todate' 2>/dev/null || true; }

read_error() { P_RES=SKIPPED; P_REASON="read error: ${ERR//$'\n'/ }"; HAD_ERROR=1; }

# pr_gate PR SHA SBASE: checks open/draft/base/head on $PR_JSON. Sets P_REASON and returns 1 when the PR must be skipped.
pr_gate() {
  local sha=$2 sbase=$3 pbase phead
  P_BASE=$(pj '.base.ref')
  if [[ $(pj '.state') != open ]]; then
    if [[ $(pj '.merged // false') == true ]]; then P_REASON='not open (already merged)'; else P_REASON='not open (closed)'; fi
    return 1
  fi
  if [[ $(pj '.draft // false') == true ]]; then P_REASON='draft'; return 1; fi
  pbase=$(pj '.base.ref')
  phead=$(pj '.head.sha')
  P_BASE=$pbase
  if [[ $sbase == '*' ]]; then
    if ! is_allowed_base "$pbase"; then P_REASON="base '$pbase' is not an allowed merge base"; return 1; fi
  elif [[ $pbase != "$sbase" ]]; then
    P_REASON="base changed: PR targets $pbase, summary says $sbase"
    return 1
  fi
  if [[ $phead != "$sha" ]]; then P_REASON="head moved: $(short "$phead") ≠ pinned $(short "$sha")"; return 1; fi
  if [[ -n ${FAILED_BASE[$pbase]-} ]]; then P_REASON="not attempted: an earlier merge on $pbase failed"; return 1; fi
  return 0
}

# later_blocker CUTOFF PR: 0 + sets P_REASON when a comment/review after CUTOFF by an OWNER/MEMBER/COLLABORATOR blocks;
# 1 when none; 2 on read error. Other authors cannot block (avoids public griefing).
later_blocker() {
  local cutoff=$1 pr=$2 row body url state
  # shellcheck disable=SC2016
  local assoc='((.author_association // "") | IN("OWNER", "MEMBER", "COLLABORATOR"))'
  local kind path
  for kind in issue inline; do
    if [[ $kind == issue ]]; then path="/repos/$GH_REPO/issues/$pr/comments"; else path="/repos/$GH_REPO/pulls/$pr/comments"; fi
    get_pages "$WORK/c.json" "$path?since=$cutoff&per_page=100" || return 2
    while IFS= read -r row; do
      body=$(jq -r '.b' <<<"$row")
      url=$(jq -r '.u' <<<"$row")
      if blocking_text "$body"; then
        P_REASON="later comment blocks: $url"
        return 0
      fi
    done < <(jq -c --arg c "$cutoff" "(\$c | fromdateiso8601) as \$cut | .[] | select($assoc and ((.updated_at | fromdateiso8601) > \$cut)) | {u: .html_url, b: (.body // \"\")}" "$WORK/c.json")
  done
  get_pages "$WORK/r.json" "/repos/$GH_REPO/pulls/$pr/reviews?per_page=100" || return 2
  while IFS= read -r row; do
    body=$(jq -r '.b' <<<"$row")
    url=$(jq -r '.u' <<<"$row")
    state=$(jq -r '.s' <<<"$row")
    if [[ $state == CHANGES_REQUESTED ]] || blocking_text "$body"; then
      P_REASON="later review blocks: $url"
      return 0
    fi
  done < <(jq -c --arg c "$cutoff" "(\$c | fromdateiso8601) as \$cut | .[] | select($assoc and ((.submitted_at // \"1970-01-01T00:00:00Z\" | fromdateiso8601) > \$cut)) | {u: .html_url, s: .state, b: (.body // \"\")}" "$WORK/r.json")
  return 1
}

# process_pr PR SHA SUMMARY_BASE FLAG NOTE CUTOFF: sets P_RES, P_REASON, P_BASE, P_WARN.
process_pr() {
  local pr=$1 sha=$2 sbase=$3 flag=$4 note=$5 cutoff=$6 waited=0 rc mstate mergeable payload merged msg
  P_RES=SKIPPED P_REASON='' P_BASE=$sbase P_WARN=0
  if [[ -n ${EXCLUDED[$((10#$pr))]-} ]]; then P_REASON='excluded by input'; return 0; fi
  if [[ $flag == signoff ]]; then P_REASON="marked 'After LEAD sign-off' in the summary"; return 0; fi
  if [[ $sbase == - ]]; then P_REASON='no base heading in summary'; return 0; fi
  if [[ $sbase != '*' ]] && ! is_allowed_base "$sbase"; then P_REASON="base '$sbase' is not an allowed merge base"; return 0; fi
  if [[ $sbase != '*' && -n ${FAILED_BASE[$sbase]-} ]]; then P_REASON="not attempted: an earlier merge on $sbase failed"; return 0; fi

  if ! get "/repos/$GH_REPO/pulls/$pr"; then read_error; return 0; fi
  PR_JSON=$(<"$RESP")
  pr_gate "$pr" "$sha" "$sbase" || return 0

  if [[ -z $cutoff ]]; then
    # manual mode: the PR's own created_at (set by GitHub, not forgeable)
    cutoff=$(norm_ts "$(pj '.created_at // empty')")
    [[ -n $cutoff ]] || { ERR="no usable created_at for PR #$pr"; read_error; return 0; }
  fi
  rc=0
  later_blocker "$cutoff" "$pr" || rc=$?
  if ((rc == 2)); then read_error; return 0; fi
  if ((rc == 0)); then return 0; fi

  # re-read the PR after the scan and re-check everything before the mergeability wait
  if ! get "/repos/$GH_REPO/pulls/$pr"; then read_error; return 0; fi
  PR_JSON=$(<"$RESP")
  pr_gate "$pr" "$sha" "$sbase" || return 0
  while [[ $(pj '.mergeable|tostring') == null ]] && ((waited < POLL_MAX)); do
    sleep "$POLL_INTERVAL"
    waited=$((waited + (POLL_INTERVAL > 0 ? POLL_INTERVAL : 1)))
    if ! get "/repos/$GH_REPO/pulls/$pr"; then read_error; return 0; fi
    PR_JSON=$(<"$RESP")
    pr_gate "$pr" "$sha" "$sbase" || return 0
  done
  mergeable=$(pj '.mergeable|tostring')
  mstate=$(pj '.mergeable_state // "unknown"')
  if [[ $mergeable == null || $mstate == unknown ]]; then
    if ((POLL_MAX % 60 == 0)); then P_REASON="mergeability not computed in $((POLL_MAX / 60)) min"; else P_REASON="mergeability not computed in ${POLL_MAX} s"; fi
    return 0
  fi
  # unstable (failing non-required checks) and behind are allowed: the checker judges CI, GitHub enforces required checks.
  case $mstate in
    dirty) P_REASON='merge conflict (mergeable_state dirty)'; return 0 ;;
    blocked) P_REASON='blocked by branch protection or required checks (mergeable_state blocked)'; return 0 ;;
    draft) P_REASON='draft (mergeable_state draft)'; return 0 ;;
  esac
  if [[ $mergeable == false ]]; then P_REASON="not mergeable (mergeable_state $mstate)"; return 0; fi

  [[ $note == warn ]] && P_WARN=1
  if ((DRY == 1)); then P_RES='WOULD MERGE'; return 0; fi
  payload=$(jq -cn --arg s "$sha" '{merge_method: "merge", sha: $s}')
  http "$MERGE_TOK" "/repos/$GH_REPO/pulls/$pr/merge" -X PUT -H 'Content-Type: application/json' --data-binary "$payload"
  merged=$(jq -r '.merged // false' "$RESP" 2>/dev/null || echo false)
  if [[ $HTTP_CODE == 200 && $merged == true ]]; then
    P_RES=MERGED
    P_REASON="merge commit $(short "$(jq -r '.sha // ""' "$RESP")")"
    sleep "$POLL_INTERVAL"
  else
    msg=$(api_msg)
    P_RES=FAILED
    P_REASON=${msg:-"HTTP $HTTP_CODE: result unknown, check the PR"}
    if get "/repos/$GH_REPO/pulls/$pr"; then
      if [[ $(jq -r '.merged // false' "$RESP") == true && -n $(jq -r '.merge_commit_sha // empty' "$RESP") ]]; then
        P_RES=MERGED
        P_REASON="merged (PUT response lost): merge commit $(short "$(jq -r '.merge_commit_sha' "$RESP")")"
        sleep "$POLL_INTERVAL"
      fi
    fi
    [[ $P_RES == FAILED ]] && FAILED_BASE[$P_BASE]=1
  fi
  return 0
}

cmd_run() {
  local src plan summary_url='' summary_cutoff='' sid='' sdigest='' line pr sha sbase flag note tok cutoff='' manual=0
  local -a plan_lines=() ROW_PR=() ROW_BASE=() ROW_RES=() ROW_REASON=() ROW_WARN=() BASES=() MBASES=()
  local now title table tips b i code=0 merged_list='' skipped_list='' failed_list='' warn_list='' tip_inline=''
  local expected_id=${MB_SUMMARY_ID-}

  # tokens: keep them in shell variables only, so no child process inherits them from the environment
  READ_TOK=${READ_TOKEN-}
  MERGE_TOK=${MERGE_TOKEN-}
  unset READ_TOKEN MERGE_TOKEN
  if [[ ${GITHUB_ACTIONS-} == true && $GH_REPO != amin-kerja-orang/prestasiplus ]]; then die "GH_REPO '$GH_REPO' is not the expected repository"; fi

  [[ ${DRY_RUN-} == 0 ]] && DRY=0
  if ((DRY == 0)) && [[ -z $MERGE_TOK ]]; then die 'MERGE_TOKEN is empty: refusing a real run (use dry_run)'; fi

  expected_id=${expected_id#"${expected_id%%[![:space:]]*}"}
  expected_id=${expected_id%"${expected_id##*[![:space:]]}"}
  [[ -z $expected_id || $expected_id =~ ^[0-9]+$ ]] || die 'summary_id must be digits only'

  for tok in $(printf '%s' "${MB_EXCLUDE-}" | tr ',' ' '); do
    [[ $tok =~ ^[0-9]+$ ]] || die "exclude must list PR numbers (digits) separated by commas or spaces; got '${tok:0:40}'"
    EXCLUDED[$((10#$tok))]=1
  done

  src=${MB_SOURCE-}
  src=${src#"${src%%[![:space:]]*}"}
  src=${src%"${src##*[![:space:]]}"}
  if [[ -n $src && $src != checker ]]; then
    manual=1
    [[ -z $expected_id ]] || die 'summary_id only applies to source=checker'
    plan=$(cmd_parse_manual "$src") || exit 1
  fi

  WORK=$(mktemp -d)
  trap 'rm -rf "$WORK"' EXIT
  RESP=$WORK/resp

  if ((manual == 0)); then
    get_pages "$WORK/comments.json" "/repos/$GH_REPO/issues/$CHECKER_ISSUE/comments?per_page=100" || die "$ERR"
    cmd_select_summary <"$WORK/comments.json" >"$WORK/summary.json"
    sid=$(jq -r '.id' "$WORK/summary.json")
    if [[ -n $expected_id && $sid != "$expected_id" ]]; then die "the newest checker summary is $sid, not the expected summary_id $expected_id: refusing"; fi
    summary_cutoff=$(norm_ts "$(jq -r '.created_at' "$WORK/summary.json")")
    [[ -n $summary_cutoff ]] || die 'summary has no usable created_at'
    summary_url=$(jq -r '.html_url' "$WORK/summary.json")
    jq -j '.body' "$WORK/summary.json" >"$WORK/summary.body"
    sdigest=$(sha256sum <"$WORK/summary.body" 2>/dev/null | cut -d' ' -f1)
    plan=$(cmd_parse_summary <"$WORK/summary.body") || exit 1
    cutoff=$summary_cutoff
  fi
  mapfile -t plan_lines <<<"$plan"

  for line in "${plan_lines[@]}"; do
    IFS=$'\t' read -r pr sha sbase flag note <<<"$line"
    process_pr "$pr" "$sha" "$sbase" "$flag" "$note" "$cutoff"
    ROW_PR+=("$pr")
    ROW_BASE+=("$P_BASE")
    ROW_RES+=("$P_RES")
    ROW_REASON+=("$P_REASON")
    ROW_WARN+=("$P_WARN")
    [[ $P_RES == FAILED ]] && code=1
  done
  ((HAD_ERROR == 0)) || code=1

  for i in "${!ROW_BASE[@]}"; do
    b=${ROW_BASE[$i]}
    [[ $b == - || $b == '*' ]] && continue
    is_allowed_base "$b" || continue
    [[ " ${BASES[*]-} " == *" $b "* ]] || BASES+=("$b")
    if [[ ${ROW_RES[$i]} == MERGED && " ${MBASES[*]-} " != *" $b "* ]]; then MBASES+=("$b"); fi
  done

  now=$(TZ=Asia/Kuala_Lumpur date '+%d %b %H:%M')
  if ((DRY == 1)); then
    title="merge-batch DRY RUN plan $now MYT (merge-batch run ${RUN_ID:-local})"
  else
    title="LEAD merge log $now MYT (merge-batch run ${RUN_ID:-local})"
  fi

  table='| # | PR | Base | Result | Reason |'$'\n''|---|----|------|--------|--------|'
  for i in "${!ROW_PR[@]}"; do
    pr=${ROW_PR[$i]}
    b=${ROW_REASON[$i]}
    if [[ ${ROW_WARN[$i]} == 1 ]]; then
      b+="${b:+; }summary warns (⚠/LEAD chooses): check order"
      warn_list+="${warn_list:+, }#$pr"
    fi
    table+=$'\n'"| $((i + 1)) | #$pr | \`$(esc "${ROW_BASE[$i]}")\` | ${ROW_RES[$i]} | $(esc "$b") |"
    case ${ROW_RES[$i]} in
      MERGED) merged_list+="${merged_list:+, }#$pr" ;;
      FAILED) failed_list+="${failed_list:+, }#$pr" ;;
      *) skipped_list+="${skipped_list:+, }#$pr" ;;
    esac
  done

  tips=''
  for b in "${BASES[@]-}"; do
    [[ -n $b ]] || continue
    if get "/repos/$GH_REPO/branches/$b"; then TIP[$b]=$(jq -r '.commit.sha // "unknown"' "$RESP"); else TIP[$b]=unavailable; HAD_ERROR=1; code=1; fi
    tips+="- \`$b\` @ \`${TIP[$b]}\`"$'\n'
  done
  [[ -n $tips ]] || tips='- none'$'\n'
  for b in "${MBASES[@]-}"; do
    [[ -n $b ]] || continue
    tip_inline+="${tip_inline:+, }\`$b\` @ \`$(short "${TIP[$b]-unknown}")\`"
  done

  local source_line
  if ((manual == 1)); then
    source_line='Source: manual list'
  else
    source_line="Source: checker summary $summary_url (id $sid, created $summary_cutoff, body sha256 ${sdigest:-n/a})"
  fi
  local report
  report="**$title**"$'\n\n'"$source_line"$'\n\n'"$table"$'\n\n'
  [[ -z $warn_list ]] || report+="Warnings: $warn_list (the summary warns about order or a LEAD choice; review before the real run)"$'\n\n'
  report+="Tips:"$'\n'"$tips"$'\n'"Run: ${RUN_URL:-n/a (local run)}"
  printf '%s\n' "$report"
  if [[ -n ${GITHUB_STEP_SUMMARY-} ]]; then printf '%s\n' "$report" >>"$GITHUB_STEP_SUMMARY"; fi

  if ((DRY == 1)); then
    printf '\nDry run: nothing merged, nothing posted.\n'
    if ((manual == 0)); then printf 'For the real run pass summary_id=%s (body sha256 %s).\n' "$sid" "${sdigest:-n/a}"; fi
  else
    local log_url='see the run URL' notice n
    if post_comment "$CHECKER_ISSUE" "$report"; then log_url=$POSTED_URL; else printf 'merge-batch: %s\n' "$ERR" >&2; code=1; fi
    if [[ -n $merged_list ]]; then
      notice="LEAD merge log $now MYT (merge-batch run ${RUN_ID:-local}): merged $merged_list; skipped ${skipped_list:-none}"
      [[ -z $failed_list ]] || notice+="; failed $failed_list"
      notice+=". New tips: $tip_inline. Authors of open PRs on these bases: merge the new tip into your branch (merge commit, no rebase) and post \`updated, head <sha>\`. Log: $log_url"
      for n in $NOTIFY_ISSUES; do
        post_comment "$n" "$notice" || { printf 'merge-batch: %s\n' "$ERR" >&2; code=1; }
      done
    fi
  fi
  exit "$code"
}

case ${1-} in
  select-summary) cmd_select_summary ;;
  parse-summary) cmd_parse_summary ;;
  parse-manual) shift; cmd_parse_manual "${1-}" ;;
  blocking-text) cmd_blocking_text ;;
  run) cmd_run ;;
  *) printf 'usage: %s select-summary|parse-summary|parse-manual LIST|blocking-text|run\n' "$0" >&2; exit 2 ;;
esac
