#!/usr/bin/env bash
set -euo pipefail

if git ls-files -z | xargs -0 grep -InE --exclude='security-check.sh' \
  -- '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{20,}|(sk|rk)-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}'
then
  echo "Potential secret material detected in tracked files." >&2
  exit 1
fi

echo "No high-confidence provider or private-key patterns found in tracked files."
