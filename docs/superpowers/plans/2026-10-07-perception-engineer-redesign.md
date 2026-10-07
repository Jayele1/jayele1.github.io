# Perception Engineer Repositioning + Perceiving Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the homepage/About copy toward an in-progress perception-engineering pivot, and add a new flagship project — "Perceiving" — a full-screen live webcam page that detects and names objects entirely client-side, in the site's existing visual language.

**Architecture:** Static vanilla HTML/CSS/JS site (no build step, no bundler, no package.json), hosted on GitHub Pages. The new page loads MediaPipe Tasks Vision directly from a CDN as an ES module and runs object detection on the live camera feed inside a `requestAnimationFrame` loop, drawing results onto a `<canvas>` overlay styled with the site's existing CSS custom properties. The homepage's existing 4-card asymmetric desktop grid is reworked to a 5-card `grid-template-areas` layout with the new card in the largest/first slot. No test runner exists in this repo — "tests" in this plan mean manual/scripted verification via a local static server and a browser (console/network checks plus visual screenshots), since there's no automated harness to write unit tests against.

**Tech Stack:** HTML, CSS (custom properties already defined in `css/style.css`), vanilla JS (ES modules), `@mediapipe/tasks-vision` v1.1.0 loaded from jsDelivr CDN, EfficientDet-Lite0 model loaded from Google's model storage CDN. No npm, no build tooling.

**Spec:** [docs/superpowers/specs/2026-10-07-perception-engineer-redesign-design.md](../specs/2026-10-07-perception-engineer-redesign-design.md)

## Global Constraints

- No backend/server component — GitHub Pages static hosting only.
- No build step — plain `<script>`/`<link>` tags only, matching the existing site. No npm/package.json introduced.
- No new fonts. All colors must reuse the existing CSS custom properties defined in `:root` in `css/style.css` (e.g. `--warm-brown`, `--soft-cream`, `--accent-color`, `--primary-text`) — add at most one new custom property only if genuinely needed for contrast against live video.
- The four existing projects (currently titled Testing, Data Stories, Visuals, Reflections — renamed from Testing/Visualizing/Painting/Dreaming by an upstream commit after the spec was written) keep their existing copy, links, and markup unchanged — only their position in the DOM/grid shifts.
- The new page is named **"Perceiving"** — a gerund in the site's established voice; it no longer needs to match all four sibling titles exactly (only "Testing" is still a gerund after the rename above), but stands on its own as a clear, evocative name for a live-perception feature.
- The intro screen must explicitly state that video is processed entirely on-device and is never recorded or transmitted — this must be literally true of the implementation.
- The header tagline must not state "Perception Engineer" as a current job title — it signals direction, not a current role (dual-signal copy, per spec).
- MediaPipe/model URLs are pinned to specific versions (not `@latest`) for stability: `@mediapipe/tasks-vision@1.1.0`, model at `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite` (both verified reachable as of 2026-10-07).

---

## Local verification setup (used by every task below)

Because `getUserMedia` requires a secure context, pages must be served over `http://localhost`, not opened as `file://`. Before any browser-based verification step, start a static server from the repo root if one isn't already running:

```bash
cd /Users/josephayele/jayele1.github.io && python3 -m http.server 8787 >/tmp/portfolio-server.log 2>&1 &
```

Then open pages at `http://localhost:8787/index.html` or `http://localhost:8787/pages/<page>.html` in the Browser pane.

---

### Task 1: Homepage tagline and meta copy

**Files:**
- Modify: `index.html:4` (title tag), `index.html:9` (meta description), `index.html:18` (header tagline)

**Interfaces:** None — static copy only, no new functions/behavior.

- [ ] **Step 1: Update the `<title>` tag**

In `index.html`, change:

```html
<title>Joseph Ayele - Portfolio</title>
```

to:

```html
<title>Joseph Ayele - Software Engineer, Building Toward Perception</title>
```

- [ ] **Step 2: Update the meta description**

Change:

```html
<meta name="description" content="Joseph Ayele's personal portfolio showcasing creative projects, data stories, visual art, and reflections">
```

to:

```html
<meta name="description" content="Joseph Ayele's personal portfolio showcasing creative projects, data stories, visual art, reflections, and live perception experiments">
```

- [ ] **Step 3: Update the header tagline**

Change:

```html
<p class="title">Senior Software Engineer</p>
```

to:

```html
<p class="title">Software Engineer, building toward perception</p>
```

- [ ] **Step 4: Verify in browser**

Start the local server (see setup above), open `http://localhost:8787/index.html`, and confirm:
- The browser tab title reads "Joseph Ayele - Software Engineer, Building Toward Perception"
- The header under the name reads "Software Engineer, building toward perception"
- No layout shift/overflow in the header box (the `.title` rule already uses `clamp()` for responsive sizing, so this should hold, but confirm visually at both a mobile-width and desktop-width viewport)

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Update homepage tagline and meta copy toward perception positioning"
```

---

### Task 2: About page addition

**Files:**
- Modify: `pages/aboutMe.html:24-26`

**Interfaces:** None — static copy only. Introduces a link to `perceiving.html`, which does not exist until Task 4; this is acceptable since Task 2 is independently reviewable as a copy change, and the link target lands before the branch is considered done (final regression in Task 8 confirms the link resolves).

- [ ] **Step 1: Add the pivot paragraph**

In `pages/aboutMe.html`, after:

```html
        <h4>
            I get excited about building things, telling stories, helping people, learning, and taking naps.
        </h4>
```

add a new paragraph:

```html
        <h4>
            Lately that curiosity has been pulling me toward perception — how machines see, classify, and make sense of the world. <a href="perceiving.html">Perceiving</a> is where I'm putting that into practice: a live camera feed that names what it sees, running entirely in your browser.
        </h4>
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:8787/pages/aboutMe.html` and confirm the new paragraph renders between the existing bio line and the "playlist form" line, with the "Perceiving" link styled like other inline links (accent color, underline on hover — inherited from the global `a` rule in `css/style.css`).

- [ ] **Step 3: Commit**

```bash
git add pages/aboutMe.html
git commit -m "Add perception pivot paragraph to About page"
```

---

### Task 3: Homepage grid rework and new Perceiving card

**Files:**
- Modify: `index.html:23-71` (portfolio grid section)
- Modify: `css/style.css` (new corner-bracket/scan styles; replace the 1024px+ and 1200px+ media query blocks)

**Interfaces:**
- Produces: CSS classes `.corner-bracket`, `.corner-bracket--tl/--tr/--bl/--br`, `.project-image--perceiving`, `.perceiving-scan` — reused by the Perceiving page itself in Task 4/7 (flip button uses `.corner-bracket`).
- Produces: the new first `<section class="project-card">` in `.portfolio-grid`, linking to `pages/perceiving.html` (created in Task 4).

- [ ] **Step 1: Add the new project card markup**

In `index.html`, inside `<main class="portfolio-grid">`, insert a new card as the **first** child, before the existing "testing" card:

```html
        <section class="project-card" data-category="perception">
            <a href="pages/perceiving.html" class="project-link">
                <div class="project-image project-image--perceiving">
                    <span class="corner-bracket corner-bracket--tl" aria-hidden="true"></span>
                    <span class="corner-bracket corner-bracket--tr" aria-hidden="true"></span>
                    <span class="corner-bracket corner-bracket--bl" aria-hidden="true"></span>
                    <span class="corner-bracket corner-bracket--br" aria-hidden="true"></span>
                    <span class="perceiving-scan" aria-hidden="true"></span>
                </div>
                <div class="project-info">
                    <h3 class="project-title">Perceiving</h3>
                    <p class="project-description">A live camera feed that sees and names what's in front of it</p>
                </div>
            </a>
        </section>

```

Do not modify the four existing `<section class="project-card">` blocks that follow — leave their markup exactly as-is. They are now the 2nd through 5th children.

- [ ] **Step 2: Add corner-bracket and scan styles to `css/style.css`**

After the existing block:

```css
.project-card:hover .project-image img {
  transform: scale(1.02);
}
```

add:

```css

/* Perception accent: corner brackets + scanning visual (no photo needed) */
.corner-bracket {
  position: absolute;
  width: 20px;
  height: 20px;
  border: 2px solid var(--soft-cream);
  z-index: 2;
  pointer-events: none;
}

.corner-bracket--tl { top: 10px; left: 10px; border-right: none; border-bottom: none; }
.corner-bracket--tr { top: 10px; right: 10px; border-left: none; border-bottom: none; }
.corner-bracket--bl { bottom: 10px; left: 10px; border-right: none; border-top: none; }
.corner-bracket--br { bottom: 10px; right: 10px; border-left: none; border-top: none; }

.project-image--perceiving {
  background: linear-gradient(135deg, var(--warm-brown) 0%, var(--primary-text) 100%);
}

.perceiving-scan {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--soft-cream);
  opacity: 0.55;
  animation: perceiving-scan-move 3.5s ease-in-out infinite;
}

@keyframes perceiving-scan-move {
  0%, 100% { top: 12%; }
  50% { top: 88%; }
}
```

- [ ] **Step 3: Replace the 1024px+ breakpoint for 5 cards**

Replace this entire block in `css/style.css`:

```css
/* 1024px+ : Desktop / Tablet Landscape */
@media (min-width: 1024px) {
  .portfolio-grid {
    grid-template-columns: 2fr 1fr;
    grid-template-rows: 1fr 2fr;
    gap: 5rem 0.5rem;
    padding: 3rem 2rem 7rem 2rem;
    justify-items: start;
  }

  .project-card {
    padding: 22px;
    border-width: 10px;
  }

  /* Reintroduce asymmetric card sizing */
  .project-card:nth-child(1) {
    padding: 28px;
    border-width: 12px;
    max-width: 450px;
  }

  .project-card:nth-child(1) .project-image {
    height: 280px;
  }

  .project-card:nth-child(2) {
    padding: 18px;
    border-width: 9px;
    max-width: 280px;
    justify-self: end;
  }

  .project-card:nth-child(2) .project-image {
    height: 200px;
  }

  .project-card:nth-child(3) {
    padding: 22px;
    border-width: 8px;
    max-width: 250px;
  }

  .project-card:nth-child(3) .project-image {
    height: 300px;
  }

  .project-card:nth-child(4) {
    padding: 32px;
    border-width: 14px;
    max-width: 380px;
    justify-self: end;
  }

  .project-card:nth-child(4) .project-image {
    height: 320px;
  }

  /* Carefully reintroduce absolute positioning with safer values */
  .project-info {
    position: absolute;
    bottom: -110px;
    right: 0;
    padding: 18px 0;
    max-width: 280px;
    z-index: 5;
  }

  .project-card:nth-child(1) .project-info {
    bottom: -110px;
    max-width: 350px;
    right: -15px;
  }

  .project-card:nth-child(2) .project-info {
    bottom: -100px;
    max-width: 240px;
    right: 0;
  }

  .project-card:nth-child(3) .project-info {
    bottom: -110px;
    max-width: 220px;
    right: -20px;
  }

  .project-card:nth-child(4) .project-info {
    bottom: -110px;
    max-width: 300px;
    right: 0;
  }

  .social-link {
    margin: 0 1rem;
  }
}
```

with:

```css
/* 1024px+ : Desktop / Tablet Landscape */
@media (min-width: 1024px) {
  .portfolio-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    grid-template-rows: repeat(2, auto);
    grid-template-areas:
      "perceiving perceiving perceiving perceiving testing visualizing"
      "perceiving perceiving perceiving perceiving painting dreaming";
    gap: 5rem 2rem;
    padding: 3rem 2rem 7rem 2rem;
    justify-items: stretch;
    align-items: start;
  }

  .project-card {
    padding: 22px;
    border-width: 10px;
    max-width: none;
    width: 100%;
  }

  /* Perceiving: the flagship card, largest and first */
  .project-card:nth-child(1) {
    grid-area: perceiving;
    padding: 28px;
    border-width: 12px;
  }

  .project-card:nth-child(1) .project-image {
    height: 320px;
  }

  .project-card:nth-child(2) {
    grid-area: testing;
    max-width: 280px;
    justify-self: end;
    padding: 18px;
    border-width: 9px;
  }

  .project-card:nth-child(2) .project-image {
    height: 200px;
  }

  .project-card:nth-child(3) {
    grid-area: visualizing;
    max-width: 250px;
    padding: 22px;
    border-width: 8px;
  }

  .project-card:nth-child(3) .project-image {
    height: 220px;
  }

  .project-card:nth-child(4) {
    grid-area: painting;
    max-width: 280px;
    justify-self: end;
    padding: 18px;
    border-width: 9px;
  }

  .project-card:nth-child(4) .project-image {
    height: 200px;
  }

  .project-card:nth-child(5) {
    grid-area: dreaming;
    max-width: 380px;
    padding: 32px;
    border-width: 14px;
  }

  .project-card:nth-child(5) .project-image {
    height: 260px;
  }

  .project-info {
    position: absolute;
    bottom: -110px;
    right: 0;
    padding: 18px 0;
    max-width: 280px;
    z-index: 5;
  }

  .project-card:nth-child(1) .project-info {
    bottom: -110px;
    max-width: 420px;
    right: -15px;
  }

  .project-card:nth-child(2) .project-info {
    bottom: -100px;
    max-width: 240px;
    right: 0;
  }

  .project-card:nth-child(3) .project-info {
    bottom: -110px;
    max-width: 220px;
    right: -20px;
  }

  .project-card:nth-child(4) .project-info {
    bottom: -100px;
    max-width: 240px;
    right: 0;
  }

  .project-card:nth-child(5) .project-info {
    bottom: -110px;
    max-width: 300px;
    right: 0;
  }

  .social-link {
    margin: 0 1rem;
  }
}
```

- [ ] **Step 4: Replace the 1200px+ breakpoint**

Replace:

```css
/* 1200px+ : Large Desktop */
@media (min-width: 1200px) {
  .portfolio-grid {
    gap: 6rem 0.5rem;
    padding: 3rem 2rem 8rem 2rem;
  }

  /* Original full design with larger variations */
  .project-info {
    bottom: -120px;
  }

  .project-card:nth-child(1) .project-info {
    bottom: -120px;
    right: -20px;
  }

  .project-card:nth-child(3) .project-info {
    bottom: -130px;
    right: -30px;
  }

  .project-card:nth-child(4) .project-info {
    bottom: -125px;
  }
}
```

with:

```css
/* 1200px+ : Large Desktop */
@media (min-width: 1200px) {
  .portfolio-grid {
    gap: 6rem 2rem;
    padding: 3rem 2rem 8rem 2rem;
  }

  .project-card:nth-child(1) .project-info {
    right: -20px;
  }

  .project-card:nth-child(3) .project-info {
    right: -30px;
  }

  .project-card:nth-child(5) .project-info {
    right: -10px;
  }
}
```

- [ ] **Step 5: Verify in browser across breakpoints**

Open `http://localhost:8787/index.html` and check, resizing the Browser pane (or using viewport emulation) at roughly 375px (mobile), 800px (tablet), 1100px (desktop), and 1300px (large desktop):
- Mobile/tablet (<1024px): five cards stack/wrap without any CSS change needed at those breakpoints — confirm no overlap and that the new Perceiving card (with its gradient + corner brackets + moving scan line) renders first, above Testing.
- 1024px+: Perceiving is visibly the largest card, occupying the left ~4/6 of the grid across both rows; Testing and Data Stories sit top-right, Visuals and Reflections sit bottom-right; no cards overlap; no horizontal scrollbar appears.
- 1200px+: layout holds, project-info caption offsets don't clip or overlap neighboring cards.
- Click the Perceiving card: confirm it attempts to navigate to `pages/perceiving.html` (expected to 404 until Task 4 — that's fine for this task).
- Click Testing, Data Stories, Visuals, Reflections cards: confirm all four still link and render exactly as before.

- [ ] **Step 6: Commit**

```bash
git add index.html css/style.css
git commit -m "Add Perceiving project card and rework homepage grid for 5 cards"
```

---

### Task 4: Perceiving page skeleton (intro, stage, fallback states)

**Files:**
- Create: `pages/perceiving.html`
- Create: `css/perceiving.css`
- Create: `js/perceiving.js`

**Interfaces:**
- Produces: DOM element IDs consumed by Task 5–7's JS: `perceiving-intro`, `perceiving-stage`, `perceiving-fallback`, `perceiving-fallback-message`, `perceiving-start-btn`, `perceiving-flip-btn`, `perceiving-video`, `perceiving-canvas`, `perceiving-caption`.
- Produces: CSS class `.perceiving-mirrored` (toggled by JS in Task 5/7 on `#perceiving-stage` to mirror video+canvas only when using the front camera) — defined here, used later.
- Consumes: `.corner-bracket` class from Task 3 (`css/style.css`, loaded alongside `css/perceiving.css`).

- [ ] **Step 1: Create `pages/perceiving.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Perceiving - Joseph Ayele</title>
    <link rel="shortcut icon" href="../img/favicon.ico" type="image/x-icon">
    <link rel="icon" href="../img/favicon.ico" type="image/x-icon">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="description" content="A live camera feed that detects and names what it sees, running entirely in your browser">
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/perceiving.css">
</head>
<body class="perceiving-body">
    <div id="perceiving-intro" class="perceiving-intro">
        <a href="../index.html" class="perceiving-home-link"><strong>Joseph Ayele</strong></a>
        <h1>Perceiving</h1>
        <p>This page turns on your camera and names what it sees, live, right here in your browser.</p>
        <p class="perceiving-privacy-note">Nothing is recorded or sent anywhere. Every frame is processed on your device and never leaves it.</p>
        <button type="button" id="perceiving-start-btn" class="perceiving-start-btn">Start</button>
    </div>

    <div id="perceiving-stage" class="perceiving-stage hide">
        <video id="perceiving-video" class="perceiving-video" autoplay playsinline muted></video>
        <canvas id="perceiving-canvas" class="perceiving-canvas"></canvas>
        <button type="button" id="perceiving-flip-btn" class="perceiving-flip-btn" aria-label="Switch camera">
            <span class="corner-bracket corner-bracket--tl" aria-hidden="true"></span>
            <span class="corner-bracket corner-bracket--br" aria-hidden="true"></span>
        </button>
        <a href="../index.html" class="perceiving-home-link perceiving-home-link--stage"><strong>Joseph Ayele</strong></a>
        <div id="perceiving-caption" class="perceiving-caption-bar"></div>
    </div>

    <div id="perceiving-fallback" class="perceiving-fallback hide">
        <a href="../index.html" class="perceiving-home-link"><strong>Joseph Ayele</strong></a>
        <h1>Perceiving</h1>
        <p id="perceiving-fallback-message">Camera access isn't available right now.</p>
        <a href="../index.html" class="perceiving-start-btn">Back home</a>
    </div>

    <script src="../js/perceiving.js" type="module"></script>
</body>
</html>
```

- [ ] **Step 2: Create `css/perceiving.css`**

```css
.perceiving-body {
  margin: 0;
  background: var(--primary-text);
  overflow: hidden;
  height: 100vh;
}

.perceiving-intro,
.perceiving-fallback {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  background: var(--primary-bg);
  gap: 1rem;
}

.perceiving-intro h1,
.perceiving-fallback h1 {
  font-family: Georgia, 'Times New Roman', serif;
  color: var(--primary-text);
}

.perceiving-intro p,
.perceiving-fallback p {
  max-width: 480px;
  color: var(--secondary-text);
}

.perceiving-privacy-note {
  font-size: 0.875rem;
  color: var(--accent-color);
  font-style: italic;
}

.perceiving-start-btn {
  display: inline-block;
  background: var(--warm-brown);
  color: white;
  border: none;
  padding: 0.875rem 2.5rem;
  font-size: 1.0625rem;
  font-weight: 500;
  border-radius: var(--border-radius);
  cursor: pointer;
  text-decoration: none;
  transition: var(--transition);
  font-family: inherit;
  margin-top: 1rem;
}

.perceiving-start-btn:hover {
  background: var(--accent-dark);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--shadow-warm);
  color: white;
  text-decoration: none;
}

.perceiving-home-link {
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  color: var(--primary-text);
  text-decoration: none;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 1.125rem;
  z-index: 10;
}

.perceiving-home-link--stage {
  color: var(--soft-cream);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

.perceiving-stage {
  position: fixed;
  inset: 0;
  background: #000;
}

.perceiving-video,
.perceiving-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.perceiving-video {
  object-fit: cover;
}

.perceiving-mirrored .perceiving-video,
.perceiving-mirrored .perceiving-canvas {
  transform: scaleX(-1);
}

.perceiving-caption-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1.25rem 1.5rem 1.5rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.75), transparent);
  color: var(--soft-cream);
  font-size: 1.0625rem;
  text-align: center;
  min-height: 3rem;
}

.perceiving-flip-btn {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  width: 44px;
  height: 44px;
  background: rgba(0, 0, 0, 0.4);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  z-index: 10;
}

.perceiving-flip-btn .corner-bracket {
  border-color: var(--soft-cream);
  width: 12px;
  height: 12px;
}

@media (min-width: 768px) {
  .perceiving-flip-btn {
    display: none;
  }
}

.hide {
  display: none !important;
}
```

Note: `css/style.css` already defines a `.hide { display: none; }` rule used by other pages. Repeating it here with `!important` is intentional — it guarantees the three top-level state containers (`#perceiving-intro`, `#perceiving-stage`, `#perceiving-fallback`) never show simultaneously even if a more specific selector elsewhere on the page would otherwise win.

- [ ] **Step 3: Create `js/perceiving.js` (skeleton, no camera logic yet)**

```javascript
const introEl = document.getElementById('perceiving-intro');
const stageEl = document.getElementById('perceiving-stage');
const fallbackEl = document.getElementById('perceiving-fallback');
const fallbackMessageEl = document.getElementById('perceiving-fallback-message');
const startBtn = document.getElementById('perceiving-start-btn');
const flipBtn = document.getElementById('perceiving-flip-btn');
const videoEl = document.getElementById('perceiving-video');
const canvasEl = document.getElementById('perceiving-canvas');
const captionEl = document.getElementById('perceiving-caption');

function showFallback(message) {
  introEl.classList.add('hide');
  stageEl.classList.add('hide');
  fallbackMessageEl.textContent = message;
  fallbackEl.classList.remove('hide');
}

function initPerceivingPage() {
  console.log('Perceiving page loaded');
}

document.addEventListener('DOMContentLoaded', initPerceivingPage);
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:8787/pages/perceiving.html` and confirm:
- The intro screen shows: "Perceiving" heading, explanation text, the privacy note, and a "Start" button, centered, styled in the site's existing palette/fonts.
- The "Joseph Ayele" link in the top-left navigates back to the homepage.
- No console errors (check the browser console — `javascript_tool`/console output should show only the "Perceiving page loaded" log, no reference/import errors).
- Resize to a mobile-width viewport: layout still centers correctly, no horizontal scroll.

- [ ] **Step 5: Commit**

```bash
git add pages/perceiving.html css/perceiving.css js/perceiving.js
git commit -m "Add Perceiving page skeleton with intro/stage/fallback states"
```

---

### Task 5: Camera access, MediaPipe object detection, and box drawing

**Files:**
- Modify: `js/perceiving.js`

**Interfaces:**
- Consumes: DOM refs and `showFallback(message)` from Task 4.
- Produces: `startPerceiving()` (wired to `#perceiving-start-btn` click), `requestCameraStream(facingMode)`, `describeCameraError(err)`, `beginDetectionLoop(stream)`, `resizeCanvasToVideo()`, `loadObjectDetector()`, `detectFrame(timestampMs)`, `drawDetections(detections)` — `drawDetections` and `detectFrame` are extended by Task 6 (caption) and the camera-request functions are reused by Task 7 (flip camera).

- [ ] **Step 1: Add the MediaPipe import and replace the skeleton with full camera + detection logic**

Replace the full contents of `js/perceiving.js` with:

```javascript
import { ObjectDetector, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0";

const introEl = document.getElementById('perceiving-intro');
const stageEl = document.getElementById('perceiving-stage');
const fallbackEl = document.getElementById('perceiving-fallback');
const fallbackMessageEl = document.getElementById('perceiving-fallback-message');
const startBtn = document.getElementById('perceiving-start-btn');
const flipBtn = document.getElementById('perceiving-flip-btn');
const videoEl = document.getElementById('perceiving-video');
const canvasEl = document.getElementById('perceiving-canvas');
const captionEl = document.getElementById('perceiving-caption');
const ctx = canvasEl.getContext('2d');

const MODEL_ASSET_PATH = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";
const WASM_FILESET_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";

let currentFacingMode = 'user';
let currentStream = null;
let objectDetector = null;

function showFallback(message) {
  introEl.classList.add('hide');
  stageEl.classList.add('hide');
  fallbackMessageEl.textContent = message;
  fallbackEl.classList.remove('hide');
}

function requestCameraStream(facingMode) {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode },
    audio: false
  });
}

function describeCameraError(err) {
  if (err && err.name === 'NotAllowedError') {
    return "Camera access was denied. Allow camera access and reload the page to try again.";
  }
  if (err && err.name === 'NotFoundError') {
    return "No camera was found on this device.";
  }
  return "Something went wrong starting the camera.";
}

async function startPerceiving() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showFallback("Your browser doesn't support camera access.");
    return;
  }

  try {
    const stream = await requestCameraStream(currentFacingMode);
    currentStream = stream;
    introEl.classList.add('hide');
    stageEl.classList.remove('hide');
    stageEl.classList.toggle('perceiving-mirrored', currentFacingMode === 'user');
    await beginDetectionLoop(stream);
  } catch (err) {
    showFallback(describeCameraError(err));
  }
}

async function beginDetectionLoop(stream) {
  videoEl.srcObject = stream;
  await videoEl.play();
  resizeCanvasToVideo();
  window.addEventListener('resize', resizeCanvasToVideo);

  if (!objectDetector) {
    objectDetector = await loadObjectDetector();
  }

  requestAnimationFrame(detectFrame);
}

function resizeCanvasToVideo() {
  canvasEl.width = videoEl.videoWidth || videoEl.clientWidth;
  canvasEl.height = videoEl.videoHeight || videoEl.clientHeight;
}

async function loadObjectDetector() {
  const vision = await FilesetResolver.forVisionTasks(WASM_FILESET_PATH);
  return ObjectDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_ASSET_PATH
    },
    scoreThreshold: 0.5,
    runningMode: "VIDEO"
  });
}

function detectFrame(timestampMs) {
  if (!objectDetector || videoEl.readyState < 2) {
    requestAnimationFrame(detectFrame);
    return;
  }

  const result = objectDetector.detectForVideo(videoEl, timestampMs);
  drawDetections(result.detections);
  requestAnimationFrame(detectFrame);
}

function drawDetections(detections) {
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  ctx.lineWidth = 3;
  ctx.font = '16px Georgia, serif';

  detections.forEach((detection) => {
    const box = detection.boundingBox;
    const category = detection.categories[0];
    const label = `${category.categoryName} ${Math.round(category.score * 100)}%`;

    ctx.strokeStyle = '#8b7355';
    ctx.strokeRect(box.originX, box.originY, box.width, box.height);

    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(box.originX, box.originY - 22, textWidth + 10, 22);
    ctx.fillStyle = '#ede8e1';
    ctx.fillText(label, box.originX + 5, box.originY - 6);
  });
}

function initPerceivingPage() {
  startBtn.addEventListener('click', startPerceiving);
}

document.addEventListener('DOMContentLoaded', initPerceivingPage);
```

Note: box/label colors (`#8b7355` = `--warm-brown`, `#ede8e1` = `--soft-cream`) are hardcoded hex values rather than `var(--warm-brown)` because canvas 2D drawing APIs (`fillStyle`/`strokeStyle`) don't resolve CSS custom properties — they need literal color strings. These values must stay in sync with `css/style.css`'s `:root` definitions.

- [ ] **Step 2: Verify MediaPipe assets load and the error path works**

Open `http://localhost:8787/pages/perceiving.html`, open the browser console and network panel, then click "Start":
- Confirm no import/reference errors appear in the console on page load (confirms the ES module import resolved correctly).
- Clicking "Start" triggers a `getUserMedia` call. In a sandboxed/headless browser environment without a camera device, this is expected to reject (commonly with `NotFoundError` or `NotAllowedError`) — confirm the fallback screen then appears with the matching message from `describeCameraError`. This exercises the error-handling path end-to-end even without camera hardware.
- If a real camera **is** available in your testing environment: confirm the video feed appears, and within a second or two, colored boxes with labels (e.g. "person 92%") appear around real objects in frame, styled in the warm-brown/cream palette rather than a default bright color.
- Check the network panel for requests to `cdn.jsdelivr.net` (the WASM fileset) and `storage.googleapis.com` (the model file) — both should return 200, confirming the assets are reachable regardless of whether the camera itself is available.

- [ ] **Step 3: Commit**

```bash
git add js/perceiving.js
git commit -m "Add live camera capture and MediaPipe object detection to Perceiving page"
```

---

### Task 6: Live caption bar

**Files:**
- Modify: `js/perceiving.js`

**Interfaces:**
- Consumes: `detectFrame(timestampMs)` and `drawDetections(detections)` from Task 5 — `detectFrame` is extended to also call the new caption function.
- Produces: `scheduleCaptionUpdate(detections)`, `buildCaptionText(detections)`, `formatCount(name, count)`, `pluralize(name)`.

- [ ] **Step 1: Add caption state and functions**

In `js/perceiving.js`, add a new module-level variable alongside the existing `let currentFacingMode = 'user';` line:

```javascript
let captionDebounceTimer = null;
```

Add these functions after `drawDetections`:

```javascript
function scheduleCaptionUpdate(detections) {
  clearTimeout(captionDebounceTimer);
  captionDebounceTimer = setTimeout(() => {
    captionEl.textContent = buildCaptionText(detections);
  }, 700);
}

function buildCaptionText(detections) {
  if (detections.length === 0) {
    return "Looking for something to see...";
  }

  const counts = new Map();
  detections.forEach((detection) => {
    const name = detection.categories[0].categoryName;
    counts.set(name, (counts.get(name) || 0) + 1);
  });

  const parts = Array.from(counts.entries()).map(([name, count]) => formatCount(name, count));

  if (parts.length === 1) {
    return `I see ${parts[0]}.`;
  }

  if (parts.length === 2) {
    return `I see ${parts[0]} and ${parts[1]}.`;
  }

  const last = parts.pop();
  return `I see ${parts.join(', ')}, and ${last}.`;
}

function formatCount(name, count) {
  if (count === 1) {
    return /^[aeiou]/i.test(name) ? `an ${name}` : `a ${name}`;
  }
  return `${count} ${pluralize(name)}`;
}

function pluralize(name) {
  if (name === 'person') return 'people';
  if (name.endsWith('s')) return name;
  return `${name}s`;
}
```

- [ ] **Step 2: Call the caption update from the detection loop**

In `detectFrame`, change:

```javascript
  const result = objectDetector.detectForVideo(videoEl, timestampMs);
  drawDetections(result.detections);
  requestAnimationFrame(detectFrame);
```

to:

```javascript
  const result = objectDetector.detectForVideo(videoEl, timestampMs);
  drawDetections(result.detections);
  scheduleCaptionUpdate(result.detections);
  requestAnimationFrame(detectFrame);
```

- [ ] **Step 3: Verify the pure caption-building logic with Node**

These functions are pure (no DOM/browser APIs), so they can be sanity-checked directly with Node before relying on a live camera. From the repo root:

```bash
node --input-type=module -e '
function formatCount(name, count) {
  if (count === 1) {
    return /^[aeiou]/i.test(name) ? `an ${name}` : `a ${name}`;
  }
  return `${count} ${pluralize(name)}`;
}
function pluralize(name) {
  if (name === "person") return "people";
  if (name.endsWith("s")) return name;
  return `${name}s`;
}
function buildCaptionText(detections) {
  if (detections.length === 0) return "Looking for something to see...";
  const counts = new Map();
  detections.forEach((d) => counts.set(d.categories[0].categoryName, (counts.get(d.categories[0].categoryName) || 0) + 1));
  const parts = Array.from(counts.entries()).map(([name, count]) => formatCount(name, count));
  if (parts.length === 1) return `I see ${parts[0]}.`;
  if (parts.length === 2) return `I see ${parts[0]} and ${parts[1]}.`;
  const last = parts.pop();
  return `I see ${parts.join(", ")}, and ${last}.`;
}

console.log(buildCaptionText([]));
console.log(buildCaptionText([{categories:[{categoryName:"person"}]}]));
console.log(buildCaptionText([{categories:[{categoryName:"person"}]},{categories:[{categoryName:"person"}]}]));
console.log(buildCaptionText([{categories:[{categoryName:"laptop"}]},{categories:[{categoryName:"cup"}]}]));
console.log(buildCaptionText([{categories:[{categoryName:"person"}]},{categories:[{categoryName:"laptop"}]},{categories:[{categoryName:"cup"}]}]));
'
```

Expected output (verified by running this exact snippet):
```
Looking for something to see...
I see a person.
I see 2 people.
I see a laptop and a cup.
I see a person, a laptop, and a cup.
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:8787/pages/perceiving.html`, click Start. If a real camera is available, confirm the caption bar at the bottom updates roughly every 700ms to match currently-visible objects, without flickering word-to-word on every single frame. If no camera is available in the test environment, confirm (via the fallback path from Task 5) that no console errors reference the new caption functions.

- [ ] **Step 5: Commit**

```bash
git add js/perceiving.js
git commit -m "Add debounced templated caption bar to Perceiving page"
```

---

### Task 7: Mobile flip camera

**Files:**
- Modify: `js/perceiving.js`

**Interfaces:**
- Consumes: `requestCameraStream(facingMode)`, `describeCameraError(err)`, `showFallback(message)`, `resizeCanvasToVideo()` from Task 5.
- Produces: `flipCamera()`, wired to `#perceiving-flip-btn` click.

- [ ] **Step 1: Add the flip handler**

In `js/perceiving.js`, add after `beginDetectionLoop`:

```javascript
function flipCamera() {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
  }

  requestCameraStream(currentFacingMode)
    .then((stream) => {
      currentStream = stream;
      videoEl.srcObject = stream;
      stageEl.classList.toggle('perceiving-mirrored', currentFacingMode === 'user');
      return videoEl.play();
    })
    .then(resizeCanvasToVideo)
    .catch((err) => showFallback(describeCameraError(err)));
}
```

- [ ] **Step 2: Wire the button**

In `initPerceivingPage`, change:

```javascript
function initPerceivingPage() {
  startBtn.addEventListener('click', startPerceiving);
}
```

to:

```javascript
function initPerceivingPage() {
  startBtn.addEventListener('click', startPerceiving);
  flipBtn.addEventListener('click', flipCamera);
}
```

(The flip button is already hidden at 768px+ via the `@media (min-width: 768px) { .perceiving-flip-btn { display: none; } }` rule added in Task 4's `css/perceiving.css` — no JS-based viewport detection is needed for visibility, only for the click behavior itself.)

- [ ] **Step 3: Verify on a mobile viewport**

Resize the Browser pane (or use device emulation) to a mobile width (e.g. 390px), open `http://localhost:8787/pages/perceiving.html`, click Start:
- Confirm the flip button (circular, corner-bracket icon) is visible in the top-right corner of the stage.
- If a real camera is available: confirm the feed starts front-facing and is mirrored (selfie-style); clicking flip switches to the rear camera and un-mirrors the feed; clicking again switches back.
- Resize to a desktop width (e.g. 1200px) with the stage already showing: confirm the flip button is hidden (CSS media query), consistent with desktop having a single default camera.
- If no camera is available in the test environment, confirm clicking Start still correctly falls through to the fallback screen as in Task 5, with no new console errors introduced by this task's code.

- [ ] **Step 4: Commit**

```bash
git add js/perceiving.js
git commit -m "Add mobile front/rear camera flip to Perceiving page"
```

---

### Task 8: Full regression and cross-breakpoint verification

**Files:** None modified — verification only.

**Interfaces:** None.

- [ ] **Step 1: Verify the homepage at all breakpoints**

With the local server running, open `http://localhost:8787/index.html` and check at mobile (~375px), tablet (~800px), desktop (~1100px), and large desktop (~1300px) widths:
- Five cards render with no overlap and no horizontal scrollbar at any width.
- Perceiving is visually the most prominent card at 1024px+ (largest, first).
- All five cards link correctly: Perceiving → `pages/perceiving.html`, Testing → `pages/testing.html`, Data Stories → `http://josephayele.com/PhoneUse/`, Visuals → the Instagram link, Reflections → `pages/dreaming.html`.

- [ ] **Step 2: Verify the four pre-existing inner pages are unchanged**

Open `pages/testing.html`, `pages/dreaming.html`, and `pages/aboutMe.html` (aside from the new paragraph added in Task 2) — confirm layout, copy, embeds (video, Spotify iframe), and the speech-recognition demo on the dreaming page all still work exactly as before this plan's changes.

- [ ] **Step 3: Verify the Perceiving page end-to-end**

Open `pages/perceiving.html`:
- Intro screen → Start → (camera available: live detection + caption + flip working; camera unavailable: fallback screen with an accurate message) — confirm there is no state where the page shows a blank screen or a raw unhandled JS error.
- "Joseph Ayele" link returns to the homepage from every state (intro, stage, fallback).
- From the About page, confirm the new "Perceiving" link (added in Task 2) now resolves correctly instead of 404ing.

- [ ] **Step 4: Note any manual follow-up**

If no real camera was available during this implementation (common in a sandboxed browser environment), record that live, in-camera object detection accuracy and box/caption behavior should be spot-checked once by the user on a real device with a webcam before considering this fully done — the code paths are verified, but the model's actual detection quality on real-world frames has not been visually confirmed in that environment.

- [ ] **Step 5: Final commit (if any fixes were needed)**

If Steps 1–3 surfaced any issues requiring code changes, fix them in the relevant file(s) from earlier tasks and commit:

```bash
git add -A
git commit -m "Fix issues found during full regression pass"
```

If no issues were found, no commit is needed for this task.
