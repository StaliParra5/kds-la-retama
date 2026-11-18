#!/usr/bin/env bash
# Ejecuta todas las pruebas de humo del Sprint 2 contra el stack local levantado.
# Requisitos: docker compose -f compose.local.yml --profile full up -d --build
#             (cd frontend && pnpm dev) para las pruebas con navegador
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/lib.sh"
esperar_backend || exit 1
FALLOS=0
for s in "$DIR"/smoke_hu*.sh; do
  echo "== $(basename "$s")"; bash "$s" || FALLOS=$((FALLOS+1))
done
for s in "$DIR"/smoke_hu*.cjs; do
  echo "== $(basename "$s")"; node "$s" || FALLOS=$((FALLOS+1))
done
echo "==== Suites con fallos: $FALLOS"
[ $FALLOS -eq 0 ]
