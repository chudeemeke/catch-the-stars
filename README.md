# Catch the Stars — Stealth Learning (PWA)

Touch-first browser game for kids that stealth-teaches numbers, letters, colors, shapes, and basic math while they pop stars.

## Run locally
Just open `index.html` in a browser. For full PWA + service worker behavior, serve with any static server (e.g., VS Code Live Server, `python -m http.server`, or GitHub Pages).

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Deploy to GitHub Pages (two options)

### Option A — Pages from `main` (simplest)
1. Create a new GitHub repo (public) named `catch-the-stars`.
2. Push these files to the repo root.
3. In **Settings → Pages**, set:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` and `/ (root)`
4. Wait for Pages to build, then open the provided URL.

### Option B — GitHub Actions workflow (auto-deploy)
- Keep this repo public.
- The included workflow deploys on every push to `main`.

## iPhone install
- Open the Pages URL in Safari.
- **Share → Add to Home Screen** to install like an app.
