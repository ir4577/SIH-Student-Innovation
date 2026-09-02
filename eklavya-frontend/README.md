# Eklavya — AI Badminton Technique Analysis (Frontend)

**Train smarter. Play sharper.**

Eklavya is an AI-powered badminton technique analysis platform. This repository contains the **frontend only** — a static, dependency-free web app built in plain HTML5, CSS3, and vanilla JavaScript (ES6+). It is designed to work today against realistic dummy data, and to connect to the existing Python (OpenCV + MediaPipe) analysis backend once that backend is exposed as a REST API.

Backend reference: https://github.com/ir4577/SIH-Student-Innovation

---

## Running it

No build step, no package manager. Either:

- Open `index.html` directly in a browser, or
- Serve the folder with any static server, e.g.:

  ```bash
  python3 -m http.server 5500
  ```

  then visit `http://localhost:5500`.

---

## Project structure

```
eklavya-frontend/
├── index.html          Home page
├── analyze.html        Sport → shot → upload → review workflow
├── processing.html     Immersive AI-processing screen
├── results.html        Full results dashboard
├── about.html          Product + pipeline explanation
│
├── css/
│   ├── style.css        Design tokens, layout primitives, shared components
│   ├── home.css
│   ├── analyze.css
│   ├── processing.css
│   └── results.css
│
├── js/
│   ├── app.js           Nav, demo/backend status pill, toasts, shared helpers,
│   │                    IndexedDB-backed video persistence across pages
│   ├── api.js           The ONLY file that talks to the backend
│   ├── mock-data.js     Demo Mode sample analysis data
│   ├── upload.js        Drag-and-drop uploader (validation, preview)
│   ├── analyze.js       Workflow state machine for analyze.html
│   ├── processing.js    Progress simulation + redirect to results
│   └── results.js       Renders the full results dashboard
│
└── assets/
    ├── images/
    ├── icons/
    └── demo/
```

## Demo Mode

The Python backend is currently a set of local processing scripts, not a hosted API. This frontend is fully usable without it:

- The header status pill shows **● DEMO MODE** whenever no live backend responds to a health check, and **● BACKEND CONNECTED** once one does.
- In Demo Mode, your real uploaded video is accepted, previewed, and played back — but the analysis shown is sample data from `js/mock-data.js`, clearly labeled **Demo Analysis** on the results page.
- The interface never claims a real AI analysis happened when it didn't.

## Connecting the real backend

All network calls live in `js/api.js`, built against the API shape the backend is expected to grow into:

```
POST /api/analyze
GET  /api/analysis/:id
GET  /api/analysis/:id/video
GET  /api/analysis/:id/annotated-video
```

Update `API_BASE_URL` in `js/api.js` once the backend is deployed. No other file should need to change — `analyze.js`, `processing.js`, and `results.js` are already written against this contract and fall back to Demo Mode automatically if a health check to the backend fails.

## State between pages

Because this is a plain multi-page app (no SPA router), state is passed between pages via:

- `sessionStorage` (key: `eklavyaAnalysis`) for selections and the analysis result object.
- `IndexedDB` for the actual uploaded video file. A `blob:` object URL only resolves inside the document that created it, so it can't survive a full page navigation — IndexedDB is used instead to persist the real video bytes, and each page mints its own fresh object URL from them.

## Browser support

Built against evergreen browsers (Chrome, Edge, Firefox, Safari — latest two versions). Uses `IntersectionObserver`, `IndexedDB`, and `URL.createObjectURL`, all broadly supported.
