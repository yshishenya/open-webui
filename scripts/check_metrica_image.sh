#!/usr/bin/env bash
# Check the compiled frontend, not runtime variables: adapter-static freezes env.js.
set -euo pipefail
image="${1:?Usage: check_metrica_image.sh IMAGE COUNTER_ID}"
counter_id="${2:?Expected Metrica counter ID is required}"
[[ "$counter_id" =~ ^[0-9]+$ ]] || { echo "Invalid Metrica counter ID" >&2; exit 2; }
docker run --rm --platform linux/amd64 --network none --entrypoint python \
  -e AIRIS_EXPECTED_METRICA_ID="$counter_id" "$image" -c '
import os, re
from pathlib import Path
source = Path("/app/build/_app/env.js").read_text()
match = re.search(r"[\"\x27]?PUBLIC_YANDEX_METRICA_ID[\"\x27]?\s*:\s*[\"\x27]([0-9]+)[\"\x27]", source)
assert match and match[1] == os.environ["AIRIS_EXPECTED_METRICA_ID"], "Compiled frontend Metrica ID missing or mismatched"
print("Compiled frontend Metrica ID verified:", match[1])
'
