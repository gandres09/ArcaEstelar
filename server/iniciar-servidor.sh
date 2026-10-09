#!/bin/sh
# Servidor de Arca Estelar (Mac / Linux). Dejá esta ventana abierta.
cd "$(dirname "$0")/.."
while true; do
  node server/arca-server.mjs "$@"
  echo "El servidor se cerró. Lo vuelvo a abrir en 5 segundos..."
  sleep 5
done
