#!/usr/bin/env bash
#
# build.sh — build the store image (linux/amd64) and optionally push it.
#
#   houseofleo/build.sh           build docker.hudolini.com/houseofleo/store:v<prestashop>-<n>
#   houseofleo/build.sh --push    build and push it
#
# The version is the PrestaShop version of the Dockerfile's base image followed by the next build number
# in the registry (e.g. v9.2.0-3 after v9.2.0-2), so the deploy script
# (infrastructure/.../store/7a_deploy_store_service.sh) picks the newest one by itself.
# Reading and pushing need `docker login docker.hudolini.com` on this machine.

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
readonly ROOT="$(dirname "$SCRIPT_DIR")"
readonly DOCKERFILE="${SCRIPT_DIR}/Dockerfile"
readonly REGISTRY="docker.hudolini.com"
readonly REPOSITORY="houseofleo/store"
readonly IMAGE="${REGISTRY}/${REPOSITORY}"
readonly PLATFORM="linux/amd64"

die() { echo "error: $*" >&2; exit 1; }

PUSH=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --push)    PUSH=true ;;
    -h|--help) sed -n '3,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)         die "unknown argument: $1 (see --help)" ;;
  esac
  shift
done

command -v docker >/dev/null || die "docker not found in PATH"
command -v curl   >/dev/null || die "curl not found in PATH"
command -v jq     >/dev/null || die "jq not found in PATH (brew install jq)"

# PrestaShop version of the base image: FROM prestashop/prestashop:9.2.0-apache -> 9.2.0
PS_VERSION=$(sed -nE 's#^FROM prestashop/prestashop:([0-9]+\.[0-9]+\.[0-9]+).*#\1#p' "$DOCKERFILE" | head -n1)
[[ -n "$PS_VERSION" ]] || die "no prestashop/prestashop:<x.y.z> base image in $DOCKERFILE"

# --- registry: the highest build number of this PrestaShop version ---

# Credentials of `docker login`, from the credential helper configured in ~/.docker/config.json
CREDS_STORE=$(jq -r '.credsStore // empty' "${HOME}/.docker/config.json" 2>/dev/null || true)
[[ -n "$CREDS_STORE" ]] || die "no docker credential store configured — run: docker login $REGISTRY"
command -v "docker-credential-${CREDS_STORE}" >/dev/null || die "docker-credential-${CREDS_STORE} not found in PATH"
CREDS=$(echo "$REGISTRY" | "docker-credential-${CREDS_STORE}" get 2>/dev/null) \
  || die "no docker login for $REGISTRY — run: docker login $REGISTRY"

# The credential goes to curl through stdin (--config -), never on the command line
TAGS=$(jq -r '"user = \"" + .Username + ":" + .Secret + "\""' <<<"$CREDS" \
  | curl --silent --show-error --fail --config - "https://${REGISTRY}/v2/${REPOSITORY}/tags/list?n=10000" \
  | jq -r '.tags // [] | .[]') \
  || die "could not list the tags of $IMAGE"
unset CREDS

LAST=$(grep -E "^v${PS_VERSION//./\\.}-[0-9]+$" <<<"$TAGS" | sed "s/^v${PS_VERSION}-//" | sort -n | tail -n1 || true)
readonly VERSION="${PS_VERSION}-$(( ${LAST:-0} + 1 ))"
readonly TAG="${IMAGE}:v${VERSION}"
readonly CREATED="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

PREVIOUS="none"
[[ -n "$LAST" ]] && PREVIOUS="v${PS_VERSION}-${LAST}"
echo "building $TAG ($PLATFORM; last in the registry: $PREVIOUS)"
# --pull: the base image tag is rebuilt upstream for PHP security fixes; never build on a stale local copy
docker build \
  --pull \
  --platform "$PLATFORM" \
  --label "org.opencontainers.image.title=hol-store" \
  --label "org.opencontainers.image.description=House of Leo store: PrestaShop ${PS_VERSION} with our modules and theme" \
  --label "org.opencontainers.image.version=${VERSION}" \
  --label "org.opencontainers.image.created=${CREATED}" \
  -f "$DOCKERFILE" \
  -t "$TAG" \
  "$ROOT"

if $PUSH; then
  # Someone else may have pushed this number meanwhile; never overwrite a pushed image
  if docker manifest inspect "$TAG" >/dev/null 2>&1; then
    die "$TAG appeared in the registry during the build — run again for the next number"
  fi
  echo "pushing $TAG"
  docker push "$TAG"
  echo "done — deploy with: store/7a_deploy_store_service.sh --diff, then --apply"
else
  echo "done — push with: docker push $TAG (or rerun with --push; an unpushed build does not take the number)"
fi
