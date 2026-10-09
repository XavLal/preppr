#!/bin/sh
set -eu

if [ "$(id -u)" = 0 ]; then
  data_dir="${DATA_DIR:-/data}"
  mkdir -p "$data_dir"
  chown -R preppr:preppr "$data_dir"
  chmod 700 "$data_dir"
  exec setpriv --reuid=preppr --regid=preppr --init-groups --inh-caps=-all "$@"
fi

exec "$@"
