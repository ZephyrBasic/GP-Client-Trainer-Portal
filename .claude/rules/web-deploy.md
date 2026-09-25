---
paths: ["scripts/fix-web-assets.js", "app.json", "public/**"]
---
# Web deploy (Cloudflare Pages)

- Pages builds `main` with `npm run build:web`. Plain `expo export` loses fonts and icons: Pages
  skips `node_modules/` paths and serves `index.html` (200) instead of 404.
- If fonts or icons break live, `curl` a font URL: a `text/html` response means this bug.
- Add no `_redirects` or `404.html`. Pages already serves the SPA shell for unmatched paths.
- DNS and dashboard env vars are Zephyr's.
