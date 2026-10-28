#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
exec node --experimental-sqlite server/index.js "$@"
