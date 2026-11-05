#!/bin/bash
# Build, sign and install the Salam home screen on the Samsung TV.
# Needs Tizen Studio in ~/tizen-studio, Developer Mode on the TV (with this
# computer's IP), and a certificate profile in Tizen Studio's Certificate Manager.
#
#   TV_IP=192.168.178.23 PROFILE=salam ./deploy.sh
set -euo pipefail

TV_IP="${TV_IP:-192.168.178.23}"
PROFILE="${PROFILE:-salam}"
TIZEN_HOME="${TIZEN_HOME:-$HOME/tizen-studio}"
TIZEN="$TIZEN_HOME/tools/ide/bin/tizen"
SDB="$TIZEN_HOME/tools/sdb"
APP_ID="SalamHome1.SalamHome"

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

cp -R "$here/app/." "$work/"
"$TIZEN" package -t wgt -s "$PROFILE" -- "$work"
wgt="$(ls "$work"/*.wgt)"
echo "Built $wgt"

"$SDB" connect "$TV_IP"
serial="$("$SDB" devices | awk -v ip="$TV_IP" 'index($1, ip) == 1 {print $1}')"
[ -n "$serial" ] || { echo "The TV at $TV_IP is not connected. Is Developer Mode on?"; exit 1; }

"$TIZEN" install -n "$(basename "$wgt")" -s "$serial" -- "$work"
# "tizen run" fails on Tizen 2.3 (NullPointerException); the TV's own command works.
"$SDB" -s "$serial" shell 0 was_execute "$APP_ID"
