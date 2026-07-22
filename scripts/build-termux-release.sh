#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."
repo_root="$(pwd)"
output_path="${1:-$repo_root/packages/coding-agent/binaries/recode-termux-node.tar.gz}"

if [[ "$output_path" != /* ]]; then
    output_path="$repo_root/$output_path"
fi

echo "==> Building Termux Node release..."
termux_tmp=$(mktemp -d)
cleanup_termux_tmp() {
    rm -rf "$termux_tmp"
}
trap cleanup_termux_tmp EXIT

termux_root="$termux_tmp/recode"
termux_packages="$termux_root/packages"
mkdir -p "$termux_packages" "$(dirname "$output_path")"

for package_dir in ai tui agent; do
    npm pack "$repo_root/packages/$package_dir" --pack-destination "$termux_packages" --silent >/dev/null
done

# The published coding-agent package includes large development examples. Keep
# the Termux archive focused on the runtime, bundled docs, and release metadata.
coding_stage="$termux_tmp/coding-agent"
mkdir -p "$coding_stage"
cp "$repo_root/packages/coding-agent/package.json" "$coding_stage/"
cp "$repo_root/packages/coding-agent/README.md" "$coding_stage/"
cp "$repo_root/packages/coding-agent/CHANGELOG.md" "$coding_stage/"
cp -r "$repo_root/packages/coding-agent/dist" "$coding_stage/"
cp -r "$repo_root/packages/coding-agent/docs" "$coding_stage/"
find "$coding_stage/dist" -maxdepth 1 -type f -name '*.exe' -delete
rm -rf "$coding_stage/dist/docs" "$coding_stage/dist/examples"
npm pack "$coding_stage" --pack-destination "$termux_packages" --silent >/dev/null

cp "$repo_root/scripts/recode-termux" "$termux_root/recode"
cp "$repo_root/scripts/install-recode-termux" "$termux_root/install"
cp "$repo_root/scripts/README.termux.md" "$termux_root/README.md"
chmod +x "$termux_root/recode" "$termux_root/install"
tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner \
    -czf "$output_path" -C "$termux_tmp" recode

echo "Created $output_path"
