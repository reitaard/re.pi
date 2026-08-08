#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
	printf 'b.sh: ERROR: %s\n' "$*" >&2
	exit 1
}

on_error() {
	local status=$? line=$1 command=$2
	printf 'b.sh: ERROR: command failed with exit %s at line %s: %s\n' "$status" "$line" "$command" >&2
	exit "$status"
}

trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR

log() {
	printf 'b.sh: %s\n' "$*"
}

case "$(uname -s)" in
	MINGW*|MSYS*) ;;
	*) fail "Run b.sh from Git Bash, not WSL or PowerShell. Detected: $(uname -s)" ;;
esac

for command in git node npm cygpath tar sha256sum powershell.exe where.exe; do
	command -v "$command" >/dev/null 2>&1 || fail "Required command is missing: $command"
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "Run b.sh inside the Recode repository"
cd "$ROOT"

[[ "$(git branch --show-current)" == "agent-harness" ]] || fail "Current branch must be agent-harness"
[[ -z "$(git status --porcelain)" ]] || fail "Checkout is dirty; commit or remove changes before building"

NODE_VERSION="$(node -p 'process.versions.node')"
if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 19) ? 0 : 1)'; then
	fail "Node.js >=22.19.0 is required; found $NODE_VERSION"
fi

COMMIT="$(git rev-parse HEAD)"
SHORT_COMMIT="$(git rev-parse --short HEAD)"
log "Source commit: $COMMIT"
log "Node: $NODE_VERSION"

node scripts/release-identity.mjs --mode branch

RUNNING_PROCESSES="$(powershell.exe -NoProfile -Command 'Get-Process -Name recode,recode-maestro -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Id) $($_.Path)" }' 2>/dev/null || true)"
if [[ -n "$RUNNING_PROCESSES" ]]; then
	printf 'b.sh: ERROR: Close running Recode processes before installation:\n%s\n' "$RUNNING_PROCESSES" >&2
	exit 1
fi

npm run check

TEMP_DIR="${TEMP:-${TMPDIR:-/tmp}}"
TEMP_DIR="$(cygpath -u "$TEMP_DIR" 2>/dev/null || printf '%s' "$TEMP_DIR")"
OUT_ROOT="$TEMP_DIR/recode-custom-package-$SHORT_COMMIT"
export RECODE_PACKAGE_OUT="$(cygpath -w "$OUT_ROOT")"

log "Building package into $OUT_ROOT"
npm run recode:pack-custom-local

ARTIFACT="$(find "$OUT_ROOT" -maxdepth 1 -type f -name 'reitaard-repi-coding-agent-*.tgz' -print -quit)"
[[ -f "$ARTIFACT" ]] || fail "Package artifact was not produced in $OUT_ROOT"

ARTIFACT_SOURCE="$(tar -xOf "$ARTIFACT" package/package.json | node -e 'let data = ""; process.stdin.on("data", chunk => { data += chunk; }).on("end", () => { const manifest = JSON.parse(data); process.stdout.write(manifest.repi?.sourceCommit ?? ""); });')"
[[ "$ARTIFACT_SOURCE" == "$COMMIT" ]] || fail "Artifact source commit mismatch: expected $COMMIT, found $ARTIFACT_SOURCE"

ARTIFACT_HASH="$(sha256sum "$ARTIFACT")"
ARTIFACT_HASH="${ARTIFACT_HASH%% *}"
ARTIFACT_WIN="$(cygpath -w "$ARTIFACT")"
log "Artifact: $ARTIFACT"
log "SHA-256: $ARTIFACT_HASH"

SMOKE_PREFIX="$OUT_ROOT/smoke-prefix"
SMOKE_PREFIX_WIN="$(cygpath -w "$SMOKE_PREFIX")"
log "Smoke-installing the exact artifact into $SMOKE_PREFIX"
npm install --global --prefix "$SMOKE_PREFIX_WIN" --ignore-scripts "$ARTIFACT_WIN"

SMOKE_MANIFEST="$SMOKE_PREFIX/node_modules/@reitaard/repi-coding-agent/package.json"
[[ -f "$SMOKE_MANIFEST" ]] || fail "Smoke-install manifest is missing: $SMOKE_MANIFEST"
SMOKE_SOURCE="$(node -e 'const manifest = require(process.argv[1]); process.stdout.write(manifest.repi?.sourceCommit ?? "");' "$SMOKE_MANIFEST")"
[[ "$SMOKE_SOURCE" == "$COMMIT" ]] || fail "Smoke-install source mismatch: expected $COMMIT, found $SMOKE_SOURCE"
SMOKE_LAUNCHER="$SMOKE_PREFIX/recode.cmd"
[[ -f "$SMOKE_LAUNCHER" ]] || fail "Smoke-install launcher is missing: $SMOKE_LAUNCHER"
"$SMOKE_LAUNCHER" --version >/dev/null
"$SMOKE_LAUNCHER" --help >/dev/null
"$SMOKE_LAUNCHER" --list-models >/dev/null

GLOBAL_PREFIX_WIN="$(npm prefix --global)"
GLOBAL_ROOT_WIN="$(npm root --global)"
GLOBAL_PREFIX="$(cygpath -u "$GLOBAL_PREFIX_WIN")"
GLOBAL_ROOT="$(cygpath -u "$GLOBAL_ROOT_WIN")"
[[ -d "$GLOBAL_PREFIX" ]] || fail "Windows npm global prefix does not exist: $GLOBAL_PREFIX_WIN"

log "Installing the verified artifact into the active npm prefix: $GLOBAL_PREFIX_WIN"
npm install --global --ignore-scripts "$ARTIFACT_WIN"

GLOBAL_MANIFEST="$GLOBAL_ROOT/@reitaard/repi-coding-agent/package.json"
[[ -f "$GLOBAL_MANIFEST" ]] || fail "Installed package manifest is missing: $GLOBAL_MANIFEST"
INSTALLED_SOURCE="$(node -e 'const manifest = require(process.argv[1]); process.stdout.write(manifest.repi?.sourceCommit ?? "");' "$GLOBAL_MANIFEST")"
[[ "$INSTALLED_SOURCE" == "$COMMIT" ]] || fail "Installed source mismatch: expected $COMMIT, found $INSTALLED_SOURCE"

GLOBAL_LAUNCHER="$GLOBAL_PREFIX/recode.cmd"
[[ -f "$GLOBAL_LAUNCHER" ]] || fail "Global recode launcher is missing: $GLOBAL_LAUNCHER"
"$GLOBAL_LAUNCHER" --version >/dev/null
"$GLOBAL_LAUNCHER" --help >/dev/null
"$GLOBAL_LAUNCHER" --list-models >/dev/null

# All Windows terminal applications use the same user PATH. Preserve its prior
# value beside the artifact, remove obsolete versioned Recode binary entries,
# and put the verified npm prefix first.
PATH_BACKUP="$OUT_ROOT/windows-user-path-before.txt"
export RECODE_GLOBAL_PREFIX="$GLOBAL_PREFIX_WIN"
export RECODE_PATH_BACKUP="$(cygpath -w "$PATH_BACKUP")"
powershell.exe -NoProfile -NonInteractive -Command '
$globalPrefix = [IO.Path]::GetFullPath($env:RECODE_GLOBAL_PREFIX).TrimEnd("\")
$recodeRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "Recode")).TrimEnd("\")
$current = [Environment]::GetEnvironmentVariable("Path", "User")
Set-Content -LiteralPath $env:RECODE_PATH_BACKUP -Value $current -NoNewline
$entries = foreach ($entry in ($current -split ";")) {
  if ([string]::IsNullOrWhiteSpace($entry)) { continue }
  try { $full = [IO.Path]::GetFullPath($entry).TrimEnd("\") } catch { $full = $entry.TrimEnd("\") }
  if ($full.Equals($globalPrefix, [StringComparison]::OrdinalIgnoreCase)) { continue }
  if ($full.StartsWith($recodeRoot + "\", [StringComparison]::OrdinalIgnoreCase)) { continue }
  $entry
}
[Environment]::SetEnvironmentVariable("Path", (@($globalPrefix) + @($entries) | Select-Object -Unique) -join ";", "User")
'

export PATH="$GLOBAL_PREFIX:$PATH"
hash -r 2>/dev/null || true
RESOLVED="$(command -v recode 2>/dev/null || true)"
[[ "$RESOLVED" == "$GLOBAL_PREFIX/recode" || "$RESOLVED" == "$GLOBAL_PREFIX/recode.cmd" ]] || fail "Git Bash resolves an unexpected Recode launcher: $RESOLVED"

POWERSHELL_RESOLVED="$(powershell.exe -NoProfile -NonInteractive -Command '(Get-Command recode -CommandType Application | Select-Object -First 1).Source' | tr -d '\r')"
[[ "$(cygpath -u "$POWERSHELL_RESOLVED")" == "$GLOBAL_LAUNCHER" ]] || fail "PowerShell resolves an unexpected Recode launcher: $POWERSHELL_RESOLVED"

CMD_RESOLVED="$(where.exe recode 2>/dev/null | tr -d '\r' | head -n 1)"
CMD_RESOLVED="$(cygpath -u "$CMD_RESOLVED")"
[[ "$CMD_RESOLVED" == "$GLOBAL_PREFIX/recode" || "$CMD_RESOLVED" == "$GLOBAL_LAUNCHER" ]] || fail "cmd.exe resolves an unexpected Recode launcher: $CMD_RESOLVED"

log "Installed and verified the active global Node prefix"
log "Source commit: $COMMIT"
log "Artifact SHA-256: $ARTIFACT_HASH"
log "Previous Windows user PATH: $PATH_BACKUP"
log "Open a new terminal before running bare 'recode'."
