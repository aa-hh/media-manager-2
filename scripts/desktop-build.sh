#!/bin/bash
# Builds the Mac desktop app from desktop/ into desktop/out/media-manager-2.app:
# Electron, the app's own files, the mpv addon, libmpv with every Homebrew
# library it loads, and MoltenVK and the Vulkan loader that mpv's gpu-next
# renderer draws through. Then signs every piece with the owner's Developer ID
# (hardened runtime), notarises the app with notarytool and staples the ticket.
#
# Usage: bash scripts/desktop-build.sh [--unsigned]
#   --unsigned  bundle only, with ad-hoc signatures so it runs on this Mac;
#               touches no certificate, keychain or Apple service
#
# Needs Homebrew's mpv (0.41.0 tested) and the Xcode command line tools.
# Notarising reads its Apple credentials from a notarytool keychain profile,
# never from the repo. Make it once (it asks for an app-specific password):
#   xcrun notarytool store-credentials media-manager-2-notary --apple-id <your Apple ID> --team-id TGT8D69RZ4
# NOTARY_PROFILE names another profile.
set -eu
cd "$(dirname "$0")/../desktop"

IDENTITY="Developer ID Application: Alexander Henderson Hamilton (TGT8D69RZ4)"
NOTARY_PROFILE="${NOTARY_PROFILE:-media-manager-2-notary}"
BREW="$(brew --prefix)"
OUT="$PWD/out"
APP="$OUT/media-manager-2.app"
FRAMEWORKS="$APP/Contents/Frameworks"
RESOURCES="$APP/Contents/Resources"
unsigned=0
[ "${1:-}" = --unsigned ] && unsigned=1

echo "== Installing and building the addon"
[ -d node_modules ] || npm ci
# npm on this Mac skips install scripts, so Electron's own download may not have run.
[ -d node_modules/electron/dist/Electron.app ] || node node_modules/electron/install.js
node prepare.mjs
npx @electron/rebuild -v 45.0.0 -f

echo "== Bundling into $APP"
rm -rf "$OUT"
mkdir -p "$OUT"
ditto node_modules/electron/dist/Electron.app "$APP"
rm -f "$RESOURCES/default_app.asar"
plist="$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName media-manager-2" "$plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName media-manager-2" "$plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier io.github.aa-hh.media-manager-2" "$plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $(node -p "require('./package.json').version")" "$plist"

app="$RESOURCES/app"
mkdir -p "$app/build/Release" "$app/address"
cp package.json main.js preload.js "$app/"
cp -R lib "$app/lib"
cp address/index.html address/planet.js address/SchibstedGrotesk.ttf "$app/address/"
cp build/Release/mpvview.node "$app/build/Release/"

# libmpv and every Homebrew library it loads, found by walking `otool -L`, into
# Contents/Frameworks. Each reference between them becomes @loader_path, so they
# load from beside each other and never from Homebrew. MoltenVK is not linked
# (the Vulkan loader opens it through the driver file below), so it is a root too.
is_brew() { case "$1" in "$BREW"/*|/usr/local/*) return 0 ;; esac; return 1; }
deps() { otool -L "$1" | tail -n +2 | awk '{print $1}'; }
queue="$BREW/lib/libmpv.2.dylib $BREW/lib/libMoltenVK.dylib"
while [ -n "$queue" ]; do
    set -- $queue
    source=$1
    shift
    queue="$*"
    name=$(basename "$source")
    [ -e "$FRAMEWORKS/$name" ] && continue
    cp -L "$source" "$FRAMEWORKS/$name"
    chmod u+w "$FRAMEWORKS/$name"
    for dep in $(deps "$source"); do
        is_brew "$dep" && queue="$queue $dep"
    done
done
for lib in "$FRAMEWORKS"/*.dylib; do
    install_name_tool -id "@rpath/$(basename "$lib")" "$lib" 2>/dev/null
    for dep in $(deps "$lib"); do
        is_brew "$dep" && install_name_tool -change "$dep" "@loader_path/$(basename "$dep")" "$lib" 2>/dev/null
    done
done
addon="$app/build/Release/mpvview.node"
for dep in $(deps "$addon"); do
    is_brew "$dep" && install_name_tool -change "$dep" "@loader_path/../../../../Frameworks/$(basename "$dep")" "$addon" 2>/dev/null
done
install_name_tool -delete_rpath "$BREW/lib" "$addon" 2>/dev/null || true

# The Vulkan driver file main.js points the loader at; its library path is relative to the file.
mkdir -p "$RESOURCES/vulkan"
node -e '
const [from, to] = process.argv.slice(1);
const driver = JSON.parse(require("fs").readFileSync(from, "utf8"));
driver.ICD.library_path = "../../Frameworks/libMoltenVK.dylib";
require("fs").writeFileSync(to, JSON.stringify(driver, null, 2));
' "$BREW/etc/vulkan/icd.d/MoltenVK_icd.json" "$RESOURCES/vulkan/MoltenVK_icd.json"

leftover=$(for file in "$FRAMEWORKS"/*.dylib "$addon"; do deps "$file"; done | grep -E "^($BREW|/usr/local)/" || true)
if [ -n "$leftover" ]; then
    printf 'still pointing into Homebrew:\n%s\n' "$leftover" >&2
    exit 1
fi
echo "bundled $(ls "$FRAMEWORKS"/*.dylib | wc -l | tr -d ' ') libraries"

# Every Mach-O file under Contents, bundle executables included, then the bundles
# from the deepest out, then the app: codesign seals each bundle over what it holds.
sign_all() {
    find "$APP/Contents" -type f -print0 | while IFS= read -r -d '' file; do
        file -b "$file" | grep -q Mach-O || continue
        sign "$file"
    done
    find "$FRAMEWORKS" -type d \( -name '*.app' -o -name '*.framework' \) | awk '{ print gsub("/", "/"), $0 }' | sort -rn | cut -d' ' -f2- |
        while IFS= read -r bundle; do
            case "$bundle" in *.app) sign "$bundle" --entitlements "$ENTITLEMENTS" ;; *) sign "$bundle" ;; esac
        done
    sign "$APP" --entitlements "$ENTITLEMENTS"
}

# Electron's V8 needs JIT memory under the hardened runtime, in the app and its helpers.
ENTITLEMENTS="$OUT/entitlements.plist"
cat > "$ENTITLEMENTS" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
</dict>
</plist>
PLIST

# Loads the addon, and through it libmpv and its libraries, from inside the app.
# Electron runs as plain Node here, so no window opens.
check_load() {
    ELECTRON_RUN_AS_NODE=1 "$APP/Contents/MacOS/Electron" -e "require(process.argv[1]); console.log('addon and libmpv load from the bundle')" "$addon"
}

if [ "$unsigned" = 1 ]; then
    echo "== Ad-hoc signing (no certificate)"
    sign() { target=$1; shift; codesign --force --sign - "$@" "$target"; }
    sign_all
    check_load
    echo "Unsigned app: $APP"
    exit 0
fi

echo "== Signing with $IDENTITY"
sign() { target=$1; shift; codesign --force --timestamp --options runtime --sign "$IDENTITY" "$@" "$target"; }
sign_all
codesign --verify --deep --strict --verbose=2 "$APP"
check_load

echo "== Notarising (profile $NOTARY_PROFILE)"
zip="$OUT/media-manager-2.zip"
ditto -c -k --keepParent "$APP" "$zip"
xcrun notarytool submit "$zip" --keychain-profile "$NOTARY_PROFILE" --wait
xcrun stapler staple "$APP"
rm -f "$zip"
spctl -a -vv "$APP"
echo "Signed and notarised: $APP"
