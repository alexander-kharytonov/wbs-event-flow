#!/bin/sh
set -eu
umask 077
node scripts/railway-media-init.mjs
exec gosu node node scripts/start.mjs
