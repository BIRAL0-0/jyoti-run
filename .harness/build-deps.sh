#!/usr/bin/env bash
# build-deps.sh — regenerate the headless-Chromium shims for this sandbox.
#
# @sparticuz/chromium needs libnspr4/libnss3/libnssutil3. There is no apt/CDN
# route from this sandbox, so this script generates ABI stubs for exactly the
# symbols Chromium imports from them (with the right symbol versions). Only the
# test harness needs this; the browser is never shipped with the game.
set -euo pipefail
cd "$(dirname "$0")"
CHROME="${CHROME_PATH:-/tmp/chromium}"
mkdir -p chromedeps
cat > /tmp/gen-abi-stubs.mjs <<'EOF'
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const chrome = process.env.CHROME_PATH || '/tmp/chromium';
const out = execSync(`objdump -T ${chrome} | grep '\\*UND\\*'`, { maxBuffer: 1 << 28 }).toString();
const map = new Map(); const plain = [];
for (const line of out.split('\n')) {
  const m = line.match(/\*UND\*\s+\S+\s+(?:(\S+)\s+)?(\S+)$/);
  if (!m) continue;
  const [, ver, symRaw] = m; const sym = symRaw.replace(/@.*$/, '');
  if (!/^(CERT_|NSS_|PK11_|SECITEM_|SECMOD_|PR_)/.test(sym)) continue;
  if (ver && ver.startsWith('(')) { const v = ver.replace(/[()]/g, ''); if (!map.has(v)) map.set(v, new Set()); map.get(v).add(sym); }
  else plain.push(sym);
}
fs.writeFileSync('/tmp/stub-nss.c',
  [...map.values()].flatMap(s => [...s]).map(s => `void *${s}(void) { return 0; }`).join('\n') + '\n');
fs.writeFileSync('/tmp/nss.map', [...map.entries()].map(([v, s], i) =>
  `${v} { global: ${[...s].join('; ')};${i === 0 ? ' local: *;' : ''} };`).join('\n'));
fs.writeFileSync('/tmp/stub-nspr.c', plain.map(s => `void *${s}(void) { return 0; }`).join('\n') + '\n');
EOF
CHROME_PATH="$CHROME" node /tmp/gen-abi-stubs.mjs
gcc -shared -fPIC -Wl,-soname,libnss3.so -Wl,--version-script=/tmp/nss.map -o chromedeps/libnss3.so /tmp/stub-nss.c
gcc -shared -fPIC -Wl,-soname,libnspr4.so -o chromedeps/libnspr4.so /tmp/stub-nspr.c
printf 'void *NSS_SetAlgorithmPolicy(void){return 0;}\n' > /tmp/stub-util.c
echo 'NSSUTIL_3.12.3 { global: NSS_SetAlgorithmPolicy; local: *; };' > /tmp/util.map
gcc -shared -fPIC -Wl,-soname,libnssutil3.so -Wl,--version-script=/tmp/util.map -o chromedeps/libnssutil3.so /tmp/stub-util.c
echo "chromedeps rebuilt ($(ls chromedeps | wc -l) libs)"
