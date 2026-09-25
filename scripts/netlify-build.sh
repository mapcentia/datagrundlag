#!/usr/bin/env bash
# Build på Netlify: hent frisk katalog, kør DuckDB-analyserne og byg sitet.
#
# Fejler kataloghøstningen, fejler hele buildet, og Netlify beholder det forrige deploy.
# Fejler DuckDB eller analyserne (fx et midlertidigt netværksproblem), bygges sitet med
# de analyseresultater, der ligger i repoet.
set -euo pipefail

DUCKDB_VERSION="${DUCKDB_VERSION:-v1.5.5}"
BIN_DIR=".duckdb/${DUCKDB_VERSION}"

install_duckdb() {
  command -v duckdb >/dev/null 2>&1 && return 0
  if [ ! -x "$BIN_DIR/duckdb" ]; then
    echo "Henter DuckDB ${DUCKDB_VERSION}"
    mkdir -p "$BIN_DIR"
    curl -fsSL -o "$BIN_DIR/duckdb.zip" \
      "https://github.com/duckdb/duckdb/releases/download/${DUCKDB_VERSION}/duckdb_cli-linux-amd64.zip" || return 1
    if command -v unzip >/dev/null 2>&1; then
      unzip -o -q "$BIN_DIR/duckdb.zip" -d "$BIN_DIR" || return 1
    else
      python3 -m zipfile -e "$BIN_DIR/duckdb.zip" "$BIN_DIR" || return 1
    fi
    chmod +x "$BIN_DIR/duckdb"
    rm -f "$BIN_DIR/duckdb.zip"
  fi
  export PATH="$PWD/$BIN_DIR:$PATH"
  # Udvidelserne (spatial, httpfs) lægges ved siden af binæren
  export DUCKDB_EXTENSION_DIRECTORY="$PWD/$BIN_DIR/extensions"
}

npm run data

if install_duckdb && duckdb --version && npm run analysis; then
  echo "Analyserne er opdateret."
else
  echo "ADVARSEL: DuckDB-analyserne fejlede. Bygger med resultaterne fra repoet."
  git checkout -- src/data/examples.json src/data/kommuner.json 2>/dev/null || true
fi

npx astro build
