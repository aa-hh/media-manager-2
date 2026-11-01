#!/usr/bin/env bash
# Tests for scripts/check-apk-cert.sh, the gate before a TV release is published: it accepts apksigner output naming
# only the release certificate, in either output format, and refuses any other key, a second certificate, or none.
#
# Usage: scripts/test-check-apk-cert.sh

set -uo pipefail   # deliberately NOT -e: a case failing must not stop the rest

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILURES=0
fail() { echo "FAIL: $1" >&2; FAILURES=$((FAILURES + 1)); }
ok()   { echo "  ok — $1"; }

SHA=976a2a1b32d3745305e7cf41bb86657ee1c4203605cbce52cfdce84836ce7c7e
# name, expected exit (0 publish, 1 refuse), apksigner output
case_() {
    local name=$1 want=$2 got
    printf '%b' "$3" | sh "$SCRIPT_DIR/check-apk-cert.sh" 2>/dev/null
    got=$?
    if [ "$got" = "$want" ]; then ok "$name"; else fail "$name: expected exit $want, got $got"; fi
}

# Reading only "Signer #1 certificate" lines turns this red: it is what the first release run (41258253462) printed.
case_ "per-scheme V2 lines with the release key publish" 0 \
    "V2 Signer: certificate DN: CN=media-manager-2 TV\nV2 Signer: certificate SHA-256 digest: $SHA\nV2 Signer: certificate SHA-1 digest: dbac13812211d1eb3063938a84b7dcc7d89e0bb6\n"
case_ "the older Signer #1 format with colons publishes" 0 \
    "Signer #1 certificate DN: CN=media-manager-2 TV\nSigner #1 certificate SHA-256 digest: 97:6A:2A:1B:32:D3:74:53:05:E7:CF:41:BB:86:65:7E:E1:C4:20:36:05:CB:CE:52:CF:DC:E8:48:36:CE:7C:7E\n"
case_ "the same certificate under two schemes publishes" 0 \
    "V2 Signer: certificate DN: CN=media-manager-2 TV\nV2 Signer: certificate SHA-256 digest: $SHA\nV3 Signer: certificate DN: CN=media-manager-2 TV\nV3 Signer: certificate SHA-256 digest: $SHA\n"
# Dropping the distinct-certificate count turns this red.
case_ "a second, different certificate refuses" 1 \
    "V2 Signer: certificate DN: CN=media-manager-2 TV\nV2 Signer: certificate SHA-256 digest: $SHA\nV3 Signer: certificate DN: CN=media-manager-2 TV\nV3 Signer: certificate SHA-256 digest: bbbb\n"
case_ "another key refuses" 1 "V2 Signer: certificate DN: CN=attacker\nV2 Signer: certificate SHA-256 digest: aaaa\n"
case_ "the right digest with another owner refuses" 1 "V2 Signer: certificate DN: CN=someone\nV2 Signer: certificate SHA-256 digest: $SHA\n"
case_ "no certificate lines refuse" 1 "DOES NOT VERIFY\n"

[ "$FAILURES" -eq 0 ] || { echo "$FAILURES failure(s)" >&2; exit 1; }
