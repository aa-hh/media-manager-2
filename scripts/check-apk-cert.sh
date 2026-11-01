#!/bin/sh
# Reads `apksigner verify --print-certs` output on stdin and exits 0 only when every certificate line names the one
# TV release certificate: SHA-256 below, owner CN=media-manager-2 TV. apksigner writes "Signer #1 certificate ..."
# or, per signing scheme, "V2 Signer: certificate ..."; both count. The release workflow publishes only after this.
set -u
want=976a2a1b32d3745305e7cf41bb86657ee1c4203605cbce52cfdce84836ce7c7e
certs=$(cat)
got=$(printf '%s\n' "$certs" | sed -n 's/^.*Signer.*certificate SHA-256 digest: //p' | tr -d ':' | tr 'A-F' 'a-f' | sort -u)
dn=$(printf '%s\n' "$certs" | sed -n 's/^.*Signer.*certificate DN: //p' | sort -u)
count=$(printf '%s\n' "$got" | grep -c . || true)
if [ "$count" != 1 ] || [ "$got" != "$want" ] || [ "$dn" != "CN=media-manager-2 TV" ]; then
    echo "check-apk-cert: the APK is not signed by the media-manager-2 TV release key alone (certificates=$count, SHA-256=$got, DN=$dn)" >&2
    exit 1
fi
