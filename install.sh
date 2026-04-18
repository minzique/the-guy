#!/usr/bin/env bash
set -euo pipefail

DEFAULT_GITHUB_REPO="minzique/the-guy"
DEFAULT_GITHUB_API_BASE="https://api.github.com"
TMP_DIR=""
BUNDLE_INPUT=""
GITHUB_REPO="${THE_GUY_GITHUB_REPO:-$DEFAULT_GITHUB_REPO}"
GITHUB_API_BASE="${THE_GUY_RELEASE_API_BASE:-$DEFAULT_GITHUB_API_BASE}"
RELEASE_TAG="${THE_GUY_RELEASE_TAG:-}"
SKIP_LOCAL_BUNDLE_LOOKUP="${THE_GUY_SKIP_LOCAL_BUNDLE_LOOKUP:-0}"
RUN_GUY_INSTALL=1

usage() {
  cat <<'EOF'
Install The Guy from the latest GitHub release or an explicit release bundle.

Usage:
  ./install.sh [--repo <owner/name>] [--tag <tag>] [--bundle <path-or-url>] [--no-run]

Flags:
  --repo <owner/name>    GitHub repo that owns releases. Default: minzique/the-guy
  --tag <tag>            Install a specific release tag instead of the latest release
  --bundle <path-or-url> Install from a local tarball or direct asset URL
  --no-run               Install the guy launcher but do not run `guy install`
  -h, --help             Show this help

Environment:
  THE_GUY_GITHUB_REPO    Override the release repo
  THE_GUY_RELEASE_API_BASE Override the GitHub API base URL (useful for tests)
  THE_GUY_RELEASE_TAG    Override the release tag
  THE_GUY_BUNDLE_URL     Override the release bundle URL

Examples:
  ./install.sh
  ./install.sh --tag v0.1.0
  ./install.sh --bundle ./.artifacts/the-guy-0.1.0.tar.gz
  curl -fsSL https://raw.githubusercontent.com/minzique/the-guy/main/install.sh | bash
EOF
}

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

log() {
  printf '==> %s\n' "$1"
}

resolve_script_dir() {
  local source_path
  source_path="${BASH_SOURCE[0]:-}"
  if [[ -z "$source_path" || "$source_path" == "bash" ]]; then
    return 1
  fi

  cd "$(dirname "$source_path")" && pwd
}

parse_args() {
  BUNDLE_INPUT="${THE_GUY_BUNDLE_URL:-}"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo)
        [[ $# -ge 2 ]] || fail "--repo requires a value"
        GITHUB_REPO="$2"
        shift 2
        ;;
      --tag)
        [[ $# -ge 2 ]] || fail "--tag requires a value"
        RELEASE_TAG="$2"
        shift 2
        ;;
      --bundle)
        [[ $# -ge 2 ]] || fail "--bundle requires a value"
        BUNDLE_INPUT="$2"
        shift 2
        ;;
      --no-run)
        RUN_GUY_INSTALL=0
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "unknown argument: $1"
        ;;
    esac
  done
}

find_local_bundle() {
  local script_dir
  if ! script_dir="$(resolve_script_dir)"; then
    return 1
  fi

  find "$script_dir/.artifacts" -maxdepth 1 -type f -name 'the-guy-*.tar.gz' | sort | tail -n 1
}

fetch_release_json() {
  local repo="$1"
  local tag="$2"
  local api_url="${GITHUB_API_BASE}/repos/${repo}/releases/latest"

  if [[ -n "$tag" ]]; then
    api_url="${GITHUB_API_BASE}/repos/${repo}/releases/tags/${tag}"
  fi

  curl -fsSL \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$api_url"
}

resolve_bundle_from_release() {
  local release_json="$1"

  RELEASE_BUNDLE_NAME="$(RELEASE_JSON="$release_json" node -e '
const release = JSON.parse(process.env.RELEASE_JSON || "{}");
const asset = (release.assets || []).find((entry) => /^the-guy-.*\.tar\.gz$/.test(entry.name));
if (!asset) process.exit(2);
process.stdout.write(asset.name);
')" || fail "release does not contain a the-guy tarball asset"

  RELEASE_JSON="$release_json" node -e '
const release = JSON.parse(process.env.RELEASE_JSON || "{}");
const asset = (release.assets || []).find((entry) => /^the-guy-.*\.tar\.gz$/.test(entry.name));
if (!asset) process.exit(2);
process.stdout.write(asset.browser_download_url);
'
}

resolve_bundle_input() {
  if [[ -n "$BUNDLE_INPUT" ]]; then
    printf '%s\n' "$BUNDLE_INPUT"
    return 0
  fi

  if [[ "$SKIP_LOCAL_BUNDLE_LOOKUP" != "1" ]]; then
    local local_bundle
    local_bundle="$(find_local_bundle || true)"
    if [[ -n "$local_bundle" ]]; then
      printf '%s\n' "$local_bundle"
      return 0
    fi
  fi

  printf '==> %s\n' "Resolving release asset from ${GITHUB_REPO}${RELEASE_TAG:+ @ ${RELEASE_TAG}}" >&2
  local release_json
  release_json="$(fetch_release_json "$GITHUB_REPO" "$RELEASE_TAG")" || fail "failed to fetch release metadata from GitHub"
  resolve_bundle_from_release "$release_json"
}

download_or_copy_bundle() {
  local input="$1"
  local destination="$2"

  case "$input" in
    http://*|https://*)
      command -v curl >/dev/null 2>&1 || fail "curl is required to download bundles"
      log "Downloading bundle"
      curl -fsSL "$input" -o "$destination"
      ;;
    *)
      [[ -f "$input" ]] || fail "bundle not found: $input"
      log "Using local bundle $input"
      cp "$input" "$destination"
      ;;
  esac
}

install_launcher() {
  mkdir -p "$HOME/.local/bin"
  cat > "$HOME/.local/bin/guy" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exec "$HOME/.guy/current/bin/guy" "$@"
EOF
  chmod +x "$HOME/.local/bin/guy"
}

main() {
  parse_args "$@"

  command -v node >/dev/null 2>&1 || fail "node is required before installing The Guy"
  command -v tar >/dev/null 2>&1 || fail "tar is required before installing The Guy"
  command -v curl >/dev/null 2>&1 || fail "curl is required before installing The Guy"

  local bundle_input
  bundle_input="$(resolve_bundle_input)" || fail "could not resolve a release bundle"

  TMP_DIR="$(mktemp -d)"
  trap 'if [[ -n "${TMP_DIR:-}" ]]; then rm -rf -- "$TMP_DIR"; fi' EXIT

  local bundle_archive
  bundle_archive="$TMP_DIR/the-guy.tar.gz"
  download_or_copy_bundle "$bundle_input" "$bundle_archive"

  local unpack_dir
  unpack_dir="$TMP_DIR/unpack"
  mkdir -p "$unpack_dir"
  tar -xzf "$bundle_archive" -C "$unpack_dir"

  local extracted_dir
  extracted_dir="$(find "$unpack_dir" -mindepth 1 -maxdepth 1 -type d | head -n 1 || true)"
  [[ -n "$extracted_dir" ]] || fail "bundle did not extract a top-level directory"

  local release_name
  release_name="$(basename "$extracted_dir")"
  local releases_dir
  releases_dir="$HOME/.guy/releases"
  local install_dir
  install_dir="$releases_dir/$release_name"

  log "Installing $release_name"
  mkdir -p "$releases_dir" "$HOME/.guy"
  rm -rf "$install_dir"
  mv "$extracted_dir" "$install_dir"
  ln -sfn "$install_dir" "$HOME/.guy/current"
  install_launcher

  log "Installed launcher at $HOME/.local/bin/guy"

  if [[ "$RUN_GUY_INSTALL" -eq 1 ]]; then
    log "Running guy install"
    "$HOME/.local/bin/guy" install
  else
    log "Skipping guy install (--no-run)"
  fi

  printf '\nDone. Run `%s` if ~/.local/bin is not already on PATH.\n' 'export PATH="$HOME/.local/bin:$PATH"'
}

main "$@"
