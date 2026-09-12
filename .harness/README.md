# .harness — offline verification rig (development only)

Nothing in this folder ships with the game or is loaded by `index.html`. It is
the rig used to verify the real game in a real browser inside a **sandbox with
no internet route** to the CDNs the game loads at runtime.

## What's here

| Path | Purpose |
|---|---|
| `server.mjs` | static server that rewrites **only its own responses** (index.html's import map and `js/config.js`'s `HOWLER_URL`) to the vendored copies below, so the shipped code path is tested exactly as-is |
| `browser.mjs` | puppeteer-core helpers: launch, console/network capture, `waitFor` polling (never fixed sleeps — SwiftShader is slow) |
| `vendor/` | pinned `three@0.160.0` `three.module.js` + `BufferGeometryUtils.js` and `howler@2.2.4` — byte-for-byte the CDN files |
| `chromedeps/` | generated ABI stubs for `libnspr4`/`libnss3`/`libnssutil3` (see below) |
| `build-deps.sh` | regenerates `chromedeps/` for the bundled Chromium |
| `art/prepare-sprites.sh` | turns a source render into a contract-plane sprite |
| `tests/run.mjs` | contract suites: `boot`, `empty`, `views`, `aspect`, `gameplay` |
| `tests/soak.mjs` | live-play soak (draw calls, heap, geometry drift, errors) |

## Running

```bash
cd .harness
npm install puppeteer-core@23 three@0.160.0 howler@2.2.4 @sparticuz/chromium pngjs
npm install @breezystack/lamejs      # only for audio/make-sounds.mjs
#                                      (plain `lamejs` is broken under Node)
node -e "import('@sparticuz/chromium').then(m=>m.default.executablePath())"   # extracts /tmp/chromium
./build-deps.sh                                                               # ABI stubs
cd tests
node run.mjs                     # all suites
node run.mjs boot views          # a subset
node soak.mjs 5                  # 5-minute soak
node soak.mjs 1 --mobile         # mobile tuning
```

`LD_LIBRARY_PATH` is set by `browser.mjs`, so no shell exports are needed.

## Why the stubs exist

`@sparticuz/chromium` is a headless-only build that still links
`libnspr4/libnss3/libnssutil3`. This sandbox has no apt/CDN route to install
them, so `build-deps.sh` reads the exact undefined symbols Chromium imports from
those libraries (with their symbol versions, e.g. `NSS_3.30`) and generates
stub shared objects. Headless test rendering never exercises the NSS code paths
(no TLS client certificates, no profile database). They are test scaffolding and
must not be used for anything else.
