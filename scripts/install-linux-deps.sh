#!/usr/bin/env bash
set -euo pipefail

if ! command -v apt-get >/dev/null; then
  echo "apt-get not found. This script supports Debian/Ubuntu-based systems." >&2
  exit 1
fi

packages=(libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0 squashfs-tools)

if [ "$(id -u)" -ne 0 ]; then
  SUDO=sudo
else
  SUDO=
fi

$SUDO apt-get update
$SUDO apt-get install -y "${packages[@]}"
