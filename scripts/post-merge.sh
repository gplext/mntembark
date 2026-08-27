#!/bin/bash
set -euo pipefail

pnpm install --frozen-lockfile
pnpm --filter db migrate
