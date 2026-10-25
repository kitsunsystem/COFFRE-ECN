#!/usr/bin/env bash
# Runs a CI command; on failure, the end of its output becomes an annotation of the run,
# readable on the run page (and through the public API) without opening the raw logs.
set -o pipefail
log=$(mktemp)
"$@" 2>&1 | tee "$log"
code=${PIPESTATUS[0]}
if [ "$code" -ne 0 ]; then
  echo "::error title=$*::$(tail -n 40 "$log" | sed 's/\x1b\[[0-9;]*m//g' | tr '\n' ' ' | cut -c1-3500)"
fi
exit "$code"
