# Silhouette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Silhouette" page/tile where a user draws one line by click-drag and, on release, watches it lathe into a shaded, hollow 3D object they can recolor, orbit, and save as a PNG.

**Architecture:** A static 2D canvas captures the freehand stroke and derives a lathe profile from it (pure math, no dependencies). A Three.js scene (loaded from a CDN, global `THREE`) builds a `LatheGeometry` from that profile and animates its `phiLength` from 0 to 2π as a visible reveal sweep, handing off from an orthographic camera pixel-matched to the drawing canvas to a perspective camera auto-fit to the finished object, which the user can then drag-orbit. Two new JS files split the 2D/pure-logic layer from the 3D engine; everything else follows the page/css/js-per-feature convention already used by `pages/fractals.html`.

**Tech Stack:** Vanilla JS (no bundler), Three.js via a pinned CDN `<script>` tag (global build, no ES modules/import maps — keeps parity with how every other script on the site is loaded), existing site CSS tokens.

**Spec:** [docs/superpowers/specs/2026-11-15-silhouette-design.md](../specs/2026-11-15-silhouette-design.md)

## Global Constraints

- Static site, no build step: Three.js must load via a CDN `<script>` tag (classic/global build, not an ES module), same pattern as the Google Fonts `<link>` already in every page `<head>`.
- New page in `pages/`, dedicated JS in `js/`, dedicated CSS in `css/`, one new tile in `index.html`'s `.portfolio-grid` — not added to the top `social-nav`, matching Fractals/Testing/Dreaming.
- "Save" means a PNG snapshot only — no `.obj`/`.stl` export.
- One open polyline profile per object — no multi-line or closed-shape support in this pass.
- No axis guide while drawing — the revolve axis is always the drawn stroke's own leftmost point ("scribble and see").
- Open rims stay hollow (double-sided material + extra fill light) — never capped.
- Reuse `--primary-bg`, `--accent-color`, `--font-display`/`--font-body` tokens from `css/style.css` and the corner-bracket tile treatment used by the Perceiving/Fractals tiles.

## Review Focus

- A click with no drag (zero/near-zero-length stroke) must be silently ignored, not crash or produce a degenerate mesh — owned by Task 2/6.
- A stroke that stays very close to the axis for its whole length (near-zero radius throughout) must not send the camera auto-fit or geometry math to zero/NaN (zero-size bounding sphere, zero camera distance) — owned by Task 3/4.
- An open-rim profile (doesn't taper back to the axis at top or bottom) must read as a lit, visible interior, not a black hole, confirming the hollow decision actually looks right and isn't just technically double-sided — owned by Task 3.
- Drawing a new line immediately after a previous reveal/orbit (before idle-spin settles) must fully tear down the old mesh, animation frame, and drag listeners — no leaked render loops or duplicate meshes after repeated draw/clear cycles — owned by Task 6.
- Resizing the browser window (or rotating a mobile device) mid-session must resize/relayout both the 2D draw canvas and the Three.js renderer/camera without distorting the aspect ratio or breaking the orthographic pixel-match used for the reveal handoff — owned by Task 10.

---

## File Structure

- Create: `pages/silhouette.html` — page markup.
- Create: `css/silhouette.css` — page-specific styles (adapted from `css/fractals.css`'s conventions).
- Create: `js/silhouette.js` — 2D draw capture, pure profile-derivation math, UI wiring, orchestration.
- Create: `js/silhouette-scene.js` — Three.js engine: camera/lights/material, lathe mesh, reveal sweep, drag-orbit, idle spin, export.
- Create: `img/silhouette-thumb.png` — static homepage tile thumbnail (generated in Task 9).
- Modify: `index.html` — new `.project-card` tile in `.portfolio-grid`.
- Modify: `css/style.css` — new `.project-image--silhouette` rule (same pattern as `.project-image--fractals`).

### Shared interface (fixed now so every task agrees on it)

`js/silhouette-scene.js` exposes a single global namespace object:

```js
window.SilhouetteScene = {
  init(containerEl, drawCanvas) {},       // one-time setup
  showProfile(profile, axisX, canvasLogicalSize) {},
  // profile: Array<{radius:number, height:number}> (world units, from deriveProfileFromPoints(...).points)
  // axisX: number (canvas px, from deriveProfileFromPoints(...).axisX) — needed to align the reveal camera (Task 4)
  // canvasLogicalSize: number — pass DRAW_LOGICAL_SIZE
  setColor(hex) {},                       // hex: "#rrggbb"
  reset() {},                             // tears down mesh + animation + listeners, hides 3D canvas
  hasObject() {},                         // -> boolean
  exportImage() {}                        // -> "data:image/png;base64,..."
};
```

`js/silhouette.js` exposes (for drawing capture + the Node-run correctness checks) two pure functions, dual-exported for both the browser and Node:

```js
function resamplePolyline(points, targetCount) {}   // points: Array<{x,y}> -> Array<{x,y}>, length targetCount
function deriveProfileFromPoints(rawPoints, canvasLogicalSize) {}
// -> { points: Array<{radius:number, height:number}>, axisX: number } | null (null = stroke too short to lathe)
```

Constants fixed now, used across tasks:
- `DRAW_LOGICAL_SIZE = 600` (2D canvas logical px, square)
- `PROFILE_POINT_COUNT = 40`
- `MIN_STROKE_LENGTH_PX = 20` (total arc length below this → `deriveProfileFromPoints` returns `null`)
- `MIN_RADIUS_PX = 2` (pre-scale clamp so the pole never gets an exact-zero radius)
- `WORLD_SCALE = 2 / DRAW_LOGICAL_SIZE` (maps canvas px to world units, keeping objects roughly in a `[0, 2]` box)
- `LATHE_SEGMENTS = 48`
- `REVEAL_DURATION_MS = 1200`
- `IDLE_SPIN_DELAY_MS = 2000`
- `IDLE_SPIN_SPEED = 0.15` (rad/s)

---

### Task 1: Page scaffold

**Files:**
- Create: `pages/silhouette.html`
- Create: `css/silhouette.css`

**Interfaces:**
- Produces: the DOM ids every later task binds to: `#silhouette-draw-canvas`, `#silhouette-scene-container`, `#silhouette-draw-hint`, `#silhouette-color-swatches`, `#silhouette-clear-btn`, `#silhouette-save-btn`.

- [ ] **Step 1: Write `pages/silhouette.html`**

Follow `pages/fractals.html`'s structure (home link, header, `<main>`). Inside `<main class="silhouette-main">`:

```html
<div class="silhouette-canvas-wrap">
  <canvas id="silhouette-draw-canvas"></canvas>
  <div id="silhouette-scene-container" class="hide"></div>
  <p class="silhouette-draw-hint" id="silhouette-draw-hint">Click and drag to draw a line — release to see it in 3D</p>
</div>
<aside class="silhouette-controls">
  <div class="control-group">
    <h2>Surface color</h2>
    <div class="color-swatches" id="silhouette-color-swatches"></div>
  </div>
  <div class="control-group control-actions">
    <button type="button" class="action-btn" id="silhouette-clear-btn">Clear</button>
    <button type="button" class="action-btn action-btn--primary" id="silhouette-save-btn" disabled>Save image</button>
  </div>
</aside>
```

In `<head>`, link `../css/style.css`, `../css/silhouette.css`, `../css/effects.css`. Before `</body>`, in this order: the Three.js CDN script, `../js/silhouette-scene.js`, `../js/silhouette.js`, `../js/effects.js`. Use `https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js` for Three.js (global `THREE` build); if that exact pinned version 404s at build time, use the closest `0.16x.x` version cdnjs actually serves — don't fall back to an unpinned `latest` URL.

- [ ] **Step 2: Write `css/silhouette.css`**

Adapt `css/fractals.css` directly: `.silhouette-body` (same as `.fractals-body`), `.silhouette-home-link`, `.silhouette-header`/`h1`/`p`, `.silhouette-main` (same flex layout, breakpoint at 900px). `.silhouette-canvas-wrap`: same square aspect-ratio/border/shadow treatment as `.fractals-canvas-wrap`. `#silhouette-draw-canvas` and `#silhouette-scene-container` both `position: absolute; inset: 0;` so they stack in the same box; `#silhouette-scene-container.hide` and a `#silhouette-draw-canvas.hide` class (both default to the canvas visible, container hidden) let Task 6 swap which one shows. `.silhouette-draw-hint` same styling as `.fractals-draw-hint`. `.silhouette-controls` same panel styling as `.fractals-controls`. Reuse `.control-group`, `.color-swatches`, `.color-swatch`, `.action-btn`, `.action-btn--primary`, `.control-actions` rule-for-rule from `css/fractals.css` (these are page-scoped files, so redeclaring the same class names here is the established pattern, not a collision). Add `.action-btn:disabled { opacity: 0.5; cursor: default; }` and `.action-btn:disabled:hover { border-color: var(--border-color); transform: none; }` since `#silhouette-save-btn` starts disabled.

- [ ] **Step 3: Verify in browser**

Open `pages/silhouette.html` in the browser pane. Confirm: no console errors (Three.js script loads — check `window.THREE` is defined via `javascript_tool`), header/description visible, canvas-wrap shows an empty square canvas with the draw hint below it, controls panel shows "Surface color" (empty swatch row for now), a "Clear" button, and a disabled "Save image" button. Resize to mobile width (375px) and confirm the layout stacks (canvas above controls) without horizontal scroll.

- [ ] **Step 4: Commit**

```bash
git add pages/silhouette.html css/silhouette.css
git commit -m "Add Silhouette page scaffold"
```

---

### Task 2: Freehand draw capture + profile derivation

**Files:**
- Create: `js/silhouette.js`
- Test: ad-hoc Node checks run via `node -e` (no new dependency — see Step 2)

**Interfaces:**
- Consumes: `#silhouette-draw-canvas` from Task 1.
- Produces: `resamplePolyline(points, targetCount)` and `deriveProfileFromPoints(rawPoints, canvasLogicalSize)` (signatures above), plus the live-drawing pointer handlers and a `finishDrawing()` function that later tasks (6, 7, 8) call into.

- [ ] **Step 1: Implement `resamplePolyline` and `deriveProfileFromPoints` in `js/silhouette.js`**

`resamplePolyline(points, targetCount)`: identical arc-length resampling technique to `resampleToPolygon` in `js/fractals.js` (walk cumulative segment lengths, interpolate `targetCount` evenly-spaced points along the path) — but do **not** close the path back to the first point (this is an open profile curve, not a polygon).

`deriveProfileFromPoints(rawPoints, canvasLogicalSize)`:
1. If `rawPoints.length < 2`, return `null`.
2. Compute total arc length; if `< MIN_STROKE_LENGTH_PX`, return `null`.
3. `axisX = Math.min(...rawPoints.map(p => p.x))`.
4. `resampled = resamplePolyline(rawPoints, PROFILE_POINT_COUNT)`.
5. Map each resampled point, **preserving stroke order** (do not sort by height — a profile that moves up and down is a valid, intentional lathe shape, not an error):
   `radius = Math.max(p.x - axisX, MIN_RADIUS_PX) * WORLD_SCALE`
   `height = (canvasLogicalSize - p.y) * WORLD_SCALE`
   (the `canvasLogicalSize - p.y` flip makes the top of the drawn stroke the top of the 3D object, since canvas y grows downward and Three.js world y grows upward).
6. Return `{ points: <the array of {radius, height}>, axisX }` — `axisX` travels with the profile from here on so Task 4's camera setup and Task 6's orchestration don't need to recompute or re-derive it.

Structure the file so the pure functions (`resamplePolyline`, `deriveProfileFromPoints`) are defined at the top, outside of and before any DOM access, and wrap everything that touches `document`/`window` (the pointer-capture wiring, `finishDrawing`, the eventual init block) in `if (typeof document !== 'undefined') { ... }`. This isn't just style: Task 2's Step 2 `require()`s this file from Node, where `document` doesn't exist — without the guard, requiring the file for the pure-math check would crash before the exports are even read.

Wrap the pointer-capture wiring exactly like `js/fractals.js:385-417` (`pointerdown` starts capture + records points, `pointermove` appends points and redraws the live stroke in the same warm-brown stroke style, `pointerup`/`pointerleave` call `finishDrawing()`), targeting `#silhouette-draw-canvas` at `DRAW_LOGICAL_SIZE`. `finishDrawing()` calls `deriveProfileFromPoints`; if it returns `null`, just clear the live stroke (ignore the click); otherwise stash the profile in a module-level variable for Task 6 to consume — leave the actual "now show it in 3D" call as a `// TODO: Task 6` for now so this task stays testable on its own.

- [ ] **Step 2: Add a Node-checkable dual export, and verify the math**

At the bottom of `js/silhouette.js`, guard an export that's a no-op in the browser:

```js
if (typeof module !== 'undefined') module.exports = { resamplePolyline, deriveProfileFromPoints };
```

Run (no project dependency needed, just the `node` already on the machine):

```bash
node -e "
const { deriveProfileFromPoints } = require('./js/silhouette.js');
const straight = Array.from({length: 20}, (_, i) => ({x: 100, y: i * 10}));
const straightResult = deriveProfileFromPoints(straight, 600);
console.log('straight line axisX:', straightResult.axisX, 'sample radius:', straightResult.points[5].radius);
const vase = [{x:50,y:0},{x:120,y:100},{x:80,y:300},{x:150,y:580}];
const vaseResult = deriveProfileFromPoints(vase, 600);
console.log('vase axisX:', vaseResult.axisX, 'points length:', vaseResult.points.length, 'first:', vaseResult.points[0], 'last:', vaseResult.points[vaseResult.points.length-1]);
console.log('click only:', deriveProfileFromPoints([{x:10,y:10}], 600));
console.log('short wiggle:', deriveProfileFromPoints([{x:10,y:10},{x:11,y:11}], 600));
"
```

Expected: the straight-line case's `points` are all at `radius` close to `MIN_RADIUS_PX * WORLD_SCALE` (since every point is equidistant from its own axis — confirms no crash on a near-zero-radius stroke); the vase case returns `axisX` plus a 40-point `points` array whose first `height` is near `2` (top) and last `height` is near `0` (bottom); both the click-only and short-wiggle cases print `null`.

- [ ] **Step 3: Commit**

```bash
git add js/silhouette.js
git commit -m "Add Silhouette freehand draw capture and profile derivation"
```

---

### Task 3: Three.js scene bootstrap + static hollow lathe render

**Files:**
- Create: `js/silhouette-scene.js`

**Interfaces:**
- Produces: `SilhouetteScene.init(containerEl, drawCanvas)` and an internal `buildMesh(profile)` used by `showProfile` (Task 4). For this task, wire a temporary debug harness so it's independently checkable without depending on `js/silhouette.js` at all (that file isn't loaded until after `silhouette-scene.js` per Task 1's script order, and won't have real drawing wired to it until Task 6): at the bottom of the file, behind a `?debug=1` query-string check, call `init` then `buildMesh` with a hardcoded literal sample profile — e.g. `[{radius:0.15,height:0},{radius:0.45,height:0.5},{radius:0.3,height:1.1},{radius:0.55,height:2}]` (an open-rim shape: the last point has a non-trivial radius, not ~0) — and show the container. **This debug harness stays in place through Tasks 3-5** (Task 4 extends it to call `showProfile` instead of `buildMesh` directly; Task 5 reuses it unchanged) and is only removed in Task 6, once real drawing is wired to the same call.

- [ ] **Step 1: Implement `init(containerEl, drawCanvas)`**

Create a `THREE.Scene`, a `THREE.WebGLRenderer({ antialias: true, alpha: true })` sized to `containerEl`'s bounding box, append `renderer.domElement` to `containerEl`. Add an ambient light (low intensity, e.g. `THREE.AmbientLight(0xffffff, 0.5)`) plus one `THREE.DirectionalLight` from the front-upper-side, plus a second, softer `THREE.DirectionalLight` from the opposite side/lower angle as fill light specifically so a hollow interior doesn't read as a black hole (this is the Review Focus item owned by this task). For now, create a `THREE.PerspectiveCamera` positioned to look at the origin from an arbitrary front-ish angle — auto-fit comes in Task 4, not needed to prove the material/lighting works.

- [ ] **Step 2: Implement `buildMesh(profile)`**

Convert `profile` (`Array<{radius, height}>`) to `Array<THREE.Vector2>` (`new THREE.Vector2(p.radius, p.height)`), build `new THREE.LatheGeometry(points, LATHE_SEGMENTS)`. Material: `new THREE.MeshStandardMaterial({ color: 0x8b7355, side: THREE.DoubleSide, roughness: 0.6 })` — `DoubleSide` is what makes the hollow interior render at all instead of showing through as empty space. Remove any existing mesh from the scene before adding the new one (`scene.remove(currentMesh)`, dispose its geometry) so repeated calls don't accumulate meshes.

- [ ] **Step 3: Verify the hollow-rim lighting specifically**

Open `pages/silhouette.html?debug=1` in the browser — the sample profile from this task's Interfaces section already leaves the rim open at the top (its last point, at `height=2`, has `radius=0.55`, not tapering to ~0). Screenshot the result. Confirm: the object reads as a solid, lit, roughly vase-shaped object, and looking at the open top rim shows a visibly lit interior wall (not a flat black disc, not a see-through gap to the background) — if the interior is dark, add/raise the fill light's intensity until it reads correctly, since this is exactly the anti-goal the spec calls out.

- [ ] **Step 4: Commit**

```bash
git add js/silhouette-scene.js
git commit -m "Add Three.js scene bootstrap with hollow lathe rendering"
```

---

### Task 4: Reveal sweep animation + camera handoff

**Files:**
- Modify: `js/silhouette-scene.js`

**Interfaces:**
- Consumes: `buildMesh(profile)`, lights/renderer/scene from Task 3.
- Produces: `showProfile(profile, axisX, canvasLogicalSize)`, and an internal `currentPhiLength` animation driver that Task 5 extends into the idle spin. Update Task 3's `?debug=1` block to call `showProfile(sampleProfile, sampleAxisX, DRAW_LOGICAL_SIZE)` instead of calling `buildMesh` directly — pick a `sampleAxisX` (e.g. `100`) that's simply internally consistent for the debug check, not derived from a real stroke. Keep the debug block in place; don't remove it yet — Task 5 still needs it.

- [ ] **Step 1: Implement the orthographic reveal camera, pixel-matched to the draw canvas**

Before the sweep starts, create a `THREE.OrthographicCamera` whose frustum is set so that world `x=0` lines up with the draw canvas's screen column at `axisX` and world `x = (canvasLogicalSize - axisX) * WORLD_SCALE` lines up with the canvas's right edge; world `y=0` lines up with the canvas's bottom edge and world `y = canvasLogicalSize * WORLD_SCALE` lines up with its top edge. Concretely: `camera.left = -axisX * WORLD_SCALE`, `camera.right = (canvasLogicalSize - axisX) * WORLD_SCALE`, `camera.bottom = 0`, `camera.top = canvasLogicalSize * WORLD_SCALE`, positioned on the +Z axis looking down -Z. (`camera.left = 0` only happens to work when `axisX = 0`; for any other `axisX` it crops the frustum to the `[axisX, canvasLogicalSize]` slice of world space and stretches that across the full viewport, visibly shifting the ribbon away from where it was actually drawn — `camera.left` must shift by the same `-axisX * WORLD_SCALE` the profile's own radius values were shifted by, or the two don't line up.) This works because a `LatheGeometry` at `phiLength ≈ 0` is a flat ribbon lying exactly in the XY plane at the profile's own (radius, height) coordinates — which, by construction in Task 2, are the original stroke's pixels shifted by `axisX` and flipped in y. So this camera shows that flat ribbon in exactly the screen position the stroke was drawn in. This is why `showProfile` takes `axisX` and `canvasLogicalSize` as well as the profile (see the "Shared interface" section above).

- [ ] **Step 2: Implement the sweep + camera handoff animation inside `showProfile`**

Build the mesh once via `buildMesh(profile)`, but render it with the geometry's `phiLength` driven by a `requestAnimationFrame` loop from `0` to `2π` over `REVEAL_DURATION_MS`, eased with `easeOutCubic(t) = 1 - Math.pow(1 - t, 3)` (recreate the `LatheGeometry` each frame with the current `phiLength` — straightforward given `LATHE_SEGMENTS` and `PROFILE_POINT_COUNT` are small). Hide `drawCanvas` and show `containerEl` right when the sweep starts (so the flat ribbon appears exactly where the real stroke just was). Over the same duration, animate the active camera from the orthographic one (Step 1) to a `THREE.PerspectiveCamera` positioned so the finished mesh's bounding sphere (`geometry.boundingSphere`, computed after the final frame) fits in view with some margin — e.g. `distance = boundingSphere.radius / Math.sin(fov/2) * 1.5`. Guard against a near-zero bounding sphere radius (the Review Focus item for a stroke that stays close to the axis): clamp the computed `distance` to a sane minimum (e.g. `Math.max(distance, 1)`) so the camera never ends up at distance ~0.

- [ ] **Step 3: Verify the handoff looks continuous, and the near-axis edge case doesn't break the camera**

Real pointer-drawn strokes aren't wired to this yet (that's Task 6) — verify through the `?debug=1` harness instead. Open `pages/silhouette.html?debug=1` and confirm the flat profile appears first, then visibly sweeps into the solid over ~1.2s without a jump/flash at the start (it should look like the flat ribbon itself starts spinning, not a cut to an unrelated view), then the camera settles into a perspective view framing the object with margin. Then temporarily edit the debug sample profile to one with very small radius throughout (e.g. every `radius` near `MIN_RADIUS_PX * WORLD_SCALE`) to simulate the near-axis edge case, reload with `?debug=1`, and confirm it still reveals with no console errors and the final camera isn't zoomed to nothing (distance clamp from Step 2 kicks in). Revert the sample profile back afterward.

- [ ] **Step 4: Commit**

```bash
git add js/silhouette-scene.js
git commit -m "Add Silhouette reveal sweep and ortho-to-perspective camera handoff"
```

---

### Task 5: Drag-to-orbit + idle auto-spin

**Files:**
- Modify: `js/silhouette-scene.js`

**Interfaces:**
- Consumes: the perspective camera established at the end of Task 4's handoff.
- Produces: orbit/idle-spin behavior with no new public method — it activates automatically once `showProfile`'s reveal finishes, and must be fully stoppable by `reset()` (Task 6 depends on this).

- [ ] **Step 1: Implement hand-rolled drag-to-orbit on `containerEl`**

Not Three.js's `OrbitControls` addon — it ships as an ES module, and every other script on this site (including Three.js itself here) loads as a classic global script with no import maps, so pulling in one ES-module addon would be the only module-based script on the whole site. A plain pointer-drag handler is a better fit: track the camera's position in spherical coordinates around the origin (`azimuth`, `elevation`, fixed `radius` from Task 4's fit); on `pointermove` while a pointer is down on `containerEl`, adjust `azimuth`/`elevation` proportionally to the drag delta, clamp `elevation` away from the poles (e.g. within `[0.1, Math.PI - 0.1]`) so the camera can't flip upside down, recompute `camera.position` from spherical coordinates each frame, `camera.lookAt(0, originY, 0)` (center of the object's bounding sphere, not world origin, since the lathe sits above `y=0`).

- [ ] **Step 2: Implement idle auto-spin**

Track the timestamp of the last drag input. In the render loop, once `Date.now() - lastDragTime > IDLE_SPIN_DELAY_MS` and no pointer is currently down, increment `azimuth` by `IDLE_SPIN_SPEED * deltaSeconds` each frame instead of waiting for drag input.

- [ ] **Step 3: Verify in browser**

Real pointer-drawn strokes still aren't wired up yet (Task 6) — use `pages/silhouette.html?debug=1` again to get an object revealed and settled into orbit mode. Click-drag on the object and confirm it rotates smoothly following the drag and doesn't flip or jump at the poles. Release and wait ~2 seconds; confirm it resumes a slow spin on its own. Drag again; confirm the auto-spin stops immediately and hands control back.

- [ ] **Step 4: Commit**

```bash
git add js/silhouette-scene.js
git commit -m "Add drag-to-orbit and idle auto-spin to Silhouette scene"
```

---

### Task 6: Orchestration — wire drawing to the scene, Clear, and teardown

**Files:**
- Modify: `js/silhouette.js`
- Modify: `js/silhouette-scene.js` (add `reset()`)

**Interfaces:**
- Consumes: `finishDrawing()`'s stashed profile (Task 2), `SilhouetteScene.showProfile(profile, axisX, canvasLogicalSize)` (Task 4), the drag-orbit/idle-spin state (Task 5).
- Produces: `SilhouetteScene.reset()` and `SilhouetteScene.hasObject()`, and the `#silhouette-clear-btn` click handler.

- [ ] **Step 1: Replace Task 2's `// TODO: Task 6` with the real call**

In `finishDrawing()`, once `deriveProfileFromPoints` returns a non-null result, destructure `{ points, axisX }` from it, call `SilhouetteScene.init(container, drawCanvas)` on first use only, then `SilhouetteScene.showProfile(points, axisX, DRAW_LOGICAL_SIZE)`. The draw-canvas/container `.hide` toggle already happens inside `showProfile` itself (Task 4's `init(containerEl, drawCanvas)` signature exists specifically so the scene code can do this at the exact moment the sweep starts) — this task does not need to (and should not) toggle it again here. Remove the `?debug=1` block from `js/silhouette-scene.js` now — real drawing exercises the same `showProfile` call it was standing in for.

- [ ] **Step 2: Implement `SilhouetteScene.reset()` in `js/silhouette-scene.js`**

Cancel the active `requestAnimationFrame` handle (store it in a module-level variable whenever one is scheduled), remove the current mesh from the scene and dispose its geometry/material, remove the drag-orbit pointer listeners added in Task 5, clear `lastDragTime`/`azimuth` state. Leave the renderer/scene/lights/camera objects themselves alive and reusable — only the per-object state resets.

- [ ] **Step 3: Implement `SilhouetteScene.hasObject()`**

Returns whether a mesh currently exists in the scene (a simple boolean flag set in `buildMesh`/cleared in `reset`) — Task 8 uses this to enable/disable the Save button.

- [ ] **Step 4: Wire the Clear button in `js/silhouette.js`**

`#silhouette-clear-btn` click handler: call `SilhouetteScene.reset()`, clear the draw canvas back to blank, toggle `.hide` so the draw canvas shows again and the scene container hides, clear the stashed profile/drawn points so a fresh stroke can be drawn.

- [ ] **Step 5: Verify the redraw/teardown cycle doesn't leak**

In the browser, draw a line, let it reveal and start idle-spinning, click Clear, draw a different line immediately, let it reveal. Repeat this draw → reveal → Clear cycle 5+ times. Confirm via `read_console_messages` there are no errors, and visually that only one object is ever present (no ghost/duplicate meshes), and performance doesn't degrade (no visible stutter building up).

- [ ] **Step 6: Commit**

```bash
git add js/silhouette.js js/silhouette-scene.js
git commit -m "Wire Silhouette drawing to the 3D reveal with Clear/teardown"
```

---

### Task 7: Color swatches

**Files:**
- Modify: `js/silhouette.js`
- Modify: `js/silhouette-scene.js`
- Modify: `css/silhouette.css` (Task 1's `.color-swatch` rules styled an `<input type="color">` swatch, which this task's plain-button swatches replace — update those rules, and add `.color-swatch.is-active` reusing `.palette-btn.is-active`'s look, per Step 2 below)

**Interfaces:**
- Consumes: `#silhouette-color-swatches` (Task 1), `SilhouetteScene.setColor(hex)`.
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Implement `SilhouetteScene.setColor(hex)`**

Set `currentMesh.material.color.set(hex)` if a mesh exists; otherwise store the pending color so the next `buildMesh` call uses it as the initial color instead of the Task 3 hardcoded `0x8b7355`.

- [ ] **Step 2: Build the swatch row in `js/silhouette.js`**

Reuse `buildColorSwatches`'s structure from `js/fractals.js:264-299`, simplified to a fixed small palette (no add/remove) — e.g. 6 swatches drawn from the site's own palette (warm browns/creams plus `--accent-color`) rendered as `<button class="color-swatch">` elements (not `<input type="color">`, since there's one target color, not an editable list) with a `background-color` set inline and a click handler calling `SilhouetteScene.setColor(hex)`. Mark the currently-selected swatch with an `is-active` class (reuse `.palette-btn.is-active`'s look from `css/fractals.css`, applied to `.color-swatch` instead).

- [ ] **Step 3: Verify in browser**

Draw a line, let it reveal, click each swatch and confirm the object's surface color changes live and the active swatch highlight follows the click. Click Clear, draw a new line, and confirm the previously-selected color (not the default) is what the new object reveals in.

- [ ] **Step 4: Commit**

```bash
git add js/silhouette.js js/silhouette-scene.js
git commit -m "Add surface color swatches to Silhouette"
```

---

### Task 8: Save image

**Files:**
- Modify: `js/silhouette.js`
- Modify: `js/silhouette-scene.js`

**Interfaces:**
- Consumes: `SilhouetteScene.hasObject()`, `SilhouetteScene.exportImage()`.

- [ ] **Step 1: Implement `SilhouetteScene.exportImage()`**

`return renderer.domElement.toDataURL('image/png');` — same technique as `js/fractals.js`'s `export-btn` handler, just reading from the Three.js renderer's canvas instead of the 2D canvas.

- [ ] **Step 2: Wire the Save button and its enabled state in `js/silhouette.js`**

Disable `#silhouette-save-btn` whenever `SilhouetteScene.hasObject()` is false (on init, and again inside the Clear handler from Task 6); enable it right when a reveal starts (or completes — either is fine, but pick one and be consistent: enable it as soon as the sweep *starts*, since the renderer canvas is already showing something meaningful by then). Click handler mirrors `js/fractals.js:489-494`: create a temporary `<a>`, `link.download = \`silhouette-${Date.now()}.png\``, `link.href = SilhouetteScene.exportImage()`, `link.click()`.

- [ ] **Step 3: Verify in browser**

Confirm the Save button is disabled before any line is drawn. Draw a line, let it reveal, click Save, and confirm a PNG downloads (check `read_network_requests`/downloads or the page's own feedback) showing the current 3D view. Click Clear and confirm Save becomes disabled again.

- [ ] **Step 4: Commit**

```bash
git add js/silhouette.js js/silhouette-scene.js
git commit -m "Add Save image to Silhouette"
```

---

### Task 9: Homepage tile

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Create: `img/silhouette-thumb.png`

**Interfaces:**
- None consumed from other tasks; this is purely the homepage entry point into the finished page.

- [ ] **Step 1: Generate `img/silhouette-thumb.png`**

With the finished page (Tasks 1–8), draw one clean, clearly vase-like sample line, let it reveal and settle, orbit to a flattering angle, and use the page's own Save image button to get a PNG. Crop/resize it to a square (matching `img/fractal-thumb.png`'s treatment) and save it as `img/silhouette-thumb.png`.

- [ ] **Step 2: Add the tile markup to `index.html`**

Insert a new `<section class="project-card" data-category="silhouette">` into `.portfolio-grid` (placement: after the Fractals tile, before Reflections, as a reasonable match for its "live generator" sibling — builder's call if a different position reads better), following the Fractals tile's exact structure (four `.corner-bracket` spans, `.project-image.project-image--silhouette`, `.project-info` with an `<h3 class="project-title">Silhouette</h3>` and a one-line `<p class="project-description">`, e.g. "Draw a line, watch it become a 3D object"), linking to `pages/silhouette.html`.

- [ ] **Step 3: Add the CSS rule to `css/style.css`**

Next to `.project-image--fractals` (around `css/style.css:228`):

```css
.project-image--silhouette {
  background: url('../img/silhouette-thumb.png') center / cover no-repeat;
}
```

- [ ] **Step 4: Verify in browser**

Open `index.html`, confirm the new tile renders with the thumbnail, corner brackets, title, and description, and clicking it navigates to `pages/silhouette.html`.

- [ ] **Step 5: Commit**

```bash
git add index.html css/style.css img/silhouette-thumb.png
git commit -m "Add Silhouette tile to the homepage"
```

---

### Task 10: Responsive pass + final Review Focus sweep

**Files:**
- Modify: `css/silhouette.css`
- Modify: `js/silhouette-scene.js` (resize handling)
- Modify: `js/silhouette.js` (re-measure the draw canvas on resize)

**Interfaces:**
- Consumes: everything built in Tasks 1–9. No new public interface.

- [ ] **Step 1: Implement resize handling**

Add a `window.addEventListener('resize', ...)` in `js/silhouette-scene.js` (mirroring `js/fractals.js`'s `sizeCanvases`/resize pattern) that: resizes the renderer to match `containerEl`'s current bounding box, and — if the object is still mid-reveal or the orthographic camera is still active — recomputes its frustum against the draw canvas's current pixel size so the alignment from Task 4 still holds after a resize; if already in perspective/orbit mode, just updates the camera's aspect ratio. In `js/silhouette.js`, resizing should similarly re-measure `#silhouette-draw-canvas`'s `getBoundingClientRect()` the same way `js/fractals.js` does, so in-progress or future strokes map to the right canvas pixels.

- [ ] **Step 2: Run the full Review Focus list end-to-end**

In the browser, at both desktop (~1200px) and mobile (375px) widths:
- Click without dragging → nothing happens, no error (Review Focus #1).
- Draw a near-axis squiggle (stroke stays within a few px of its own leftmost point) → reveals without a stuck/zero-distance camera (Review Focus #2).
- Draw a profile whose top point has a large radius (open rim) → interior reads as lit, not black (Review Focus #3) — re-confirms Task 3's check still holds end-to-end.
- Draw → reveal → Clear → redraw, 5+ times → no leaks, no duplicate meshes, no console errors (Review Focus #4) — re-confirms Task 6's check still holds end-to-end.
- Resize the window (or use `resize_window` to switch between desktop/mobile presets) mid-reveal and again after an object has settled → no distortion, canvas and 3D view both relayout cleanly (Review Focus #5).

- [ ] **Step 3: Commit**

```bash
git add css/silhouette.css js/silhouette-scene.js
git commit -m "Add Silhouette resize handling and final polish"
```
