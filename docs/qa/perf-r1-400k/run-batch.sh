#!/bin/bash
# usage: run-batch.sh lo hi seed
set -e
PSQL="docker exec -i pp-perf-t54 psql -U perf -d perf400k -v ON_ERROR_STOP=1 -q"
VLO=$($PSQL -At -c "select coalesce(max(id),0) from question_versions")
$PSQL -v lo=$1 -v hi=$2 -v seed=$3 < 10-batch.sql >/dev/null
VHI=$($PSQL -At -c "select max(id) from question_versions")
$PSQL -v vlo=$VLO -v vhi=$VHI < 20-parts.sql >/dev/null
echo "batch $1-$2 versions ($VLO,$VHI]"
