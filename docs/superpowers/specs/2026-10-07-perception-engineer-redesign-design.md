# Perception Engineer Repositioning + Live Classifier Page

Date: 2026-10-07
Status: Approved, ready for implementation planning

## Summary

Reposition the portfolio from "Senior Software Engineer" toward a perception/CV-engineering
direction (an in-progress pivot, not a current job title), while keeping the existing four
projects intact. Add a new flagship project — a full-screen live webcam page that detects and
labels objects in view entirely client-side — and evolve (not replace) the site's existing
"framed window" visual identity to carry a light perception-themed accent.

Audience: both recruiters/hiring managers evaluating this as evidence of direction, and anyone
who finds the site as a personal showcase. The site should read as honest about where the
author currently is (not overclaiming current job title) while being bold about direction.

## Current state

Static site, vanilla HTML/CSS/JS, no build step, hosted on GitHub Pages (custom domain via
CNAME). Visual identity: thick dark "framed window" borders, warm earth-tone palette (defined
as CSS custom properties in `css/style.css`), Georgia serif headers, card hover-lift shadows.
Homepage (`index.html`) is a 4-card asymmetric grid (`.project-card:nth-child(1..4)` with
hardcoded sizing at the 1024px+ breakpoint) linking to `pages/testing.html`,
`pages/dreaming.html`, an external visualization project, and an external Instagram link.
`pages/aboutMe.html` carries a short bio and a Spotify embed.

## Goals

- Update the header tagline and About page to signal an in-progress pivot toward perception
  engineering, without misrepresenting current role.
- Add a new project, "Perceiving," as the flagship proof-of-work for this positioning.
- Keep all four existing projects, their links, and their copy unchanged.
- Keep the result feeling hand-made and specific to this person — not a templated ML-demo
  page bolted onto a portfolio.

## Non-goals

- No rewrite of the existing four projects' content or pages.
- No backend/server component — GitHub Pages static hosting only.
- No true ML-generated scene captioning (too heavy for in-browser use here); captions are
  templated from live detections instead.
- No broader resume/skills page beyond the About page's short addition.

## Content & information architecture

- **Header tagline** (`index.html`, carries the same framed-header pattern used elsewhere):
  changes from "Senior Software Engineer" to a dual-signal line, e.g. *"Software Engineer,
  building toward perception"* — exact wording may be tuned once in place, but it must not
  claim perception engineering as a current title.
- **New project card** on the homepage grid, named **"Perceiving"** (matches the existing
  gerund naming pattern: Testing, Visualizing, Painting, Dreaming), linking to
  `pages/perceiving.html`.
- Placement: "Perceiving" takes the **largest/first slot** in the desktop asymmetric grid
  (the slot currently held by "Testing"), since it's the flagship evidence for the new
  positioning. The other four cards keep their existing copy, links, and relative styling.
- **About page** (`pages/aboutMe.html`): add one short paragraph describing the pivot toward
  perception/CV work, naturally introducing the Perceiving project. Not a full rewrite.
- **Meta updates**: `index.html` `<title>` and meta description updated to mention
  perception/CV alongside the existing creative-work framing, for search/sharing context.

## Visual design

Evolve the existing identity; do not replace it.

- Keep: thick dark framed borders, warm earth-tone palette (`--primary-text`, `--warm-brown`,
  `--soft-cream`, `--accent-color`, etc.), Georgia serif headers, existing hover/shadow
  language, card structure.
- Add, scoped to the new card and new page only: a **corner-bracket accent** (camera
  autofocus-style brackets) as a small line-weight detail — on the "Perceiving" project image
  and reused on the live page's UI chrome. No new fonts. No new color palette — reuse existing
  CSS custom properties; only add one new accent/contrast tone if genuinely needed for
  legibility against live video.
- On the Perceiving page itself, live bounding boxes and labels are drawn in the site's
  existing accent colors (`--warm-brown` / `--accent-color`), not a default ML-library green —
  this is what keeps it from reading as "a library demo."

## The Perceiving page (`pages/perceiving.html`)

- **Full-screen** `<video>` camera passthrough with a `<canvas>` overlay on top for drawn
  detections. New page follows the existing `pages/*.html` structure (shared header/footer
  patterns, links back to `../index.html`).
- **Intro/consent screen** shown before the camera starts: brief explanation of what the page
  does, explicit statement that video is processed entirely in-browser and never recorded or
  transmitted, then a "Start" button that triggers the camera permission prompt. Avoids a
  surprise permission popup on page load.
- **Live detection overlay**: bounding boxes + labels + confidence, drawn every frame in the
  site's accent palette with the corner-bracket visual treatment.
- **Running caption bar** at the bottom of the screen, templated from the current frame's
  unique detected object classes (e.g. "I see 2 people and a laptop"), debounced so it doesn't
  flicker on frame-to-frame jitter.
- **Mobile**: defaults to front-facing camera, with a small flip-camera button (corner-bracket
  icon style) to switch to the rear camera. Desktop uses the default webcam.
- **Navigation**: name/logo links home, consistent with other inner pages.
- **Fallback**: if camera permission is denied, or `getUserMedia`/MediaPipe isn't supported in
  the browser, show a plain, calm message instead of a broken or blank screen.

## Technical implementation

- **Library**: MediaPipe Tasks Vision (`@mediapipe/tasks-vision`), loaded via CDN (jsDelivr),
  using `FilesetResolver` for the WASM runtime — no local model file committed to the repo, no
  build step, consistent with the rest of the site's plain-`<script>` approach.
- **Model**: Google's hosted **EfficientDet-Lite0** object detection model, loaded by URL at
  runtime.
- **Detection loop**: `ObjectDetector` created in `VIDEO` running mode; `detectForVideo` called
  once per animation frame against the live `<video>` element. Results are redrawn onto the
  `<canvas>` overlay each frame (canvas sized to match video dimensions).
- **Caption logic**: derived from the current frame's unique detected classes; debounced
  (~700ms) before updating the caption text; simple templated sentence construction handling
  singular/plural and counts (no ML-generated text).
- **Camera handling**: `navigator.mediaDevices.getUserMedia`; `facingMode: 'user'` by default
  on mobile, toggled to `'environment'` via the flip button; desktop uses default device
  selection.
- **Homepage grid rework**: `css/style.css`'s hardcoded 4-card asymmetric desktop layout
  (`.project-card:nth-child(1..4)` rules in the 1024px+ and 1200px+ breakpoints) is restructured
  for 5 cards, with "Perceiving" in the largest/first slot. This is the one piece of existing
  CSS that needs real rework rather than pure addition; the mobile/tablet single- and
  two-column layouts need the same extension to accommodate a 5th card.
- **New files**:
  - `pages/perceiving.html` — markup, intro/consent screen, full-screen video/canvas structure.
  - `js/perceiving.js` — detection loop, camera handling, caption logic. Kept separate from
    `js/index.js`, which stays focused on homepage behavior as it is today.
- **Privacy**: stated plainly on the intro screen (video never leaves the browser, nothing is
  recorded or uploaded, inference is on-device only) — both accurate and reassuring to a first-
  time visitor being asked for camera access.

## Testing / validation

- Manual verification in a desktop browser: camera starts after consent, boxes/labels track
  objects in view, caption updates sensibly, flip button absent/appropriate on desktop.
- Manual verification on a mobile viewport/device: front camera default, flip button switches
  to rear camera, full-screen layout holds up, touch targets are reasonably sized.
- Verify graceful fallback copy when camera permission is denied.
- Verify the 5-card homepage grid at each existing breakpoint (mobile single column, tablet
  2-column, 1024px+ and 1200px+ asymmetric layouts) — no overlap, no broken card sizing for any
  of the five cards.
- Verify existing four project pages and links are unchanged.
