#!/bin/sh
# Construit, signe et (en option) installe MilkyWan TV sur une TV Samsung.
#   ./build.sh           -> crée dist/MilkyWanTV.wgt, signé
#   ./build.sh install   -> crée le paquet puis l'installe et le lance sur la TV
# Variables : TIZEN_PROFILE (profil de certificat Samsung, défaut MilkywanSamsung)
#             TV_IP (adresse IP de la TV, obligatoire pour install)
set -eu
cd "$(dirname "$0")"
PROFILE="${TIZEN_PROFILE:-MilkywanSamsung}"
command -v tizen >/dev/null || { echo "Commande tizen introuvable : ajoutez tizen-studio/tools/ide/bin au PATH." >&2; exit 1; }

BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT
# Only what the TV needs: no docs, screenshots, PC launcher or git data.
rsync -a --exclude .git --exclude docs --exclude dist --exclude '*.md' --exclude 'Lancer-PC.*' \
  --exclude serve-pc.py --exclude LICENSE --exclude build.sh --exclude .gitignore ./ "$BUILD/src/"
tizen package -t wgt -s "$PROFILE" -o "$BUILD" -- "$BUILD/src"
mkdir -p dist
mv "$BUILD"/*.wgt dist/MilkyWanTV.wgt
echo "Paquet signé : dist/MilkyWanTV.wgt"

[ "${1:-}" = install ] || exit 0
: "${TV_IP:?Définissez TV_IP avec l'adresse IP de la TV, par ex. TV_IP=192.168.1.20 ./build.sh install}"
command -v sdb >/dev/null || { echo "Commande sdb introuvable : ajoutez tizen-studio/tools au PATH." >&2; exit 1; }
sdb connect "$TV_IP"
DEVICE=$(sdb devices | awk -v ip="$TV_IP" 'index($1, ip) == 1 { print $3 }')
[ -n "$DEVICE" ] || { echo "TV $TV_IP non connectée (mode développeur actif ? IP de l'ordinateur correcte ?)." >&2; exit 1; }
tizen install -n MilkyWanTV.wgt -t "$DEVICE" -- dist
tizen run -p MilkywanTV.Main -t "$DEVICE"
