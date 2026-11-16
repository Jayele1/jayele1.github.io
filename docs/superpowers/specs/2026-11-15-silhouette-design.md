# Silhouette — design

## Intent and why

A new page/tile, "Silhouette," for sketching object ideas (vases, bottles,
bowls, other turned objects) by drawing a single line and watching it
become a 3D solid of revolution — the same operation a potter's wheel or
a lathe does to a profile. The point is fast, disposable visual
exploration: draw, see the shape it implies in 3D, redraw, repeat.

## Goals

- Draw one line on a canvas by click-drag; on release, it becomes a 3D
  object by revolving around a vertical axis taken from the line's own
  leftmost point ("scribble and see" — no axis guide shown while drawing).
- The reveal is a visible sweep: the flat line visibly rotates through
  360° while the solid forms, not an instant swap from flat to solid.
- After the reveal, the user can drag to orbit the finished object and
  see it from any angle.
- A color control lets the user change the solid's surface color after
  it's 3D.
- A "Save image" button downloads a PNG snapshot of the current view,
  matching the existing pattern on the Fractals page.
- A "Clear" / redraw action resets to the flat 2D canvas to try another
  line.
- A new tile on the homepage linking to the page, matching the visual
  language of the existing tiles (corner brackets, static thumbnail).

## Non-goals

- No 3D model export (.obj/.stl) or anything meant for 3D printing —
  "save" means a picture, per the request.
- No support for multiple lines, closed shapes, or multi-segment
  compound objects in this pass — one open polyline profile per object.
- No axis guide or manual axis placement — that was explicitly declined
  in favor of "scribble and see."
- No gallery/history of past drawings — each draw replaces the last.

## Anti-goals

(what would make this a failure even though it technically runs)

- The reveal animation feels like a cheap flat-to-round crossfade rather
  than an actual lathe sweep.
- The 3D object reads as a wireframe/outline rather than a lit, shaded
  solid — it should look like an object, not a line drawing.
- Adding Three.js regresses page load/behavior elsewhere on the site
  (it must be scoped to this one page).

## Constraints

- Static site, no build step, deployed as-is to GitHub Pages — any new
  dependency must be a CDN `<script>` tag, consistent with how Google
  Fonts is already loaded.
- Match existing conventions: a page in `pages/`, a dedicated JS file in
  `js/`, a dedicated CSS file in `css/`, a tile added to
  `index.html`'s `.portfolio-grid`, linked in the social/footer nav only
  if other pages are (they aren't — only About/LinkedIn/Email are in
  `social-nav`, so Silhouette follows the same pattern as Fractals/
  Testing/Dreaming and is reached only via its homepage tile).
- Visual language: `--primary-bg`, `--accent-color`, `--font-display` /
  `--font-body` tokens from `css/style.css`; corner-bracket decoration
  like the Perceiving/Fractals tiles.

## Approaches considered

1. **Three.js via CDN, using `THREE.LatheGeometry`** — chosen. Three.js's
   lathe geometry is literally "revolve a 2D profile around the Y axis,"
   which maps directly onto this feature. It also brings real lighting/
   shading and makes drag-to-orbit nearly free (`OrbitControls`, or a
   small hand-rolled drag handler driving the camera). Cost is one
   extra script tag (no build step needed).
2. **Hand-rolled WebGL** — matches the "built from scratch" feel of
   `fractals.js`, but means writing lathe-mesh generation, normals,
   lighting, and camera-drag orbiting by hand. Rejected: a lot of code
   to re-derive something Three.js already does correctly, with more
   room for subtle shading/normal bugs.
3. **CSS 3D transforms / layered 2D rings** — rejected outright: cannot
   produce a correctly lit, arbitrary-profile solid of revolution; would
   look like a trick, not an object (an anti-goal above).

**Picked: Three.js (approach 1).**

## How it works (the parts already decided)

**Drawing.** Reuse the pointer-capture pattern already in
`js/fractals.js` (`pointerdown` → collect points → `pointermove` draws a
live path → `pointerup` finalizes): a 2D canvas, click-drag draws a
freehand polyline, release finalizes it as the profile.

**Deriving the profile.** Take the finalized polyline's bounding box;
its leftmost x becomes the revolve axis (x=0 in profile space). Each
point's distance from that axis becomes its radius; its y becomes its
height along the axis. This list of `{radius, height}` pairs (resampled
to a reasonable point count) is the input to `THREE.LatheGeometry`.

**The reveal animation.** Build the full `LatheGeometry` with
`phiLength` (Three.js's built-in "how far around the revolve has swept")
animated from ~0 to `2π` over roughly 1–1.5s, easing out. This is a
direct sweep of the actual solid, not a crossfade — the geometry
literally grows around the axis in real time. The original flat line
fades out as the swept surface overtakes it.

To avoid that handoff itself looking like a jump-cut: start the 3D
scene with an orthographic camera pixel-matched to the 2D drawing
canvas, so the flat line sits in exactly the same screen position/scale
where it was drawn when the sweep begins. Once the sweep finishes,
animate the camera from that orthographic start to a perspective view
for orbiting. This keeps the 2D→3D handoff visually continuous instead
of a swap between two unrelated camera setups.

The camera (and light rig) auto-fits to each generated mesh's actual
bounding size, rather than assuming a fixed distance/scale — strokes
will vary a lot in height/width, and a fixed camera would clip or
shrink many of them. This auto-fit only needs to apply to the
perspective/orbit stage; the orthographic reveal stage is already
pixel-matched to the fixed-size drawing canvas.

**After the reveal.** Switch to an interactive orbit: drag (pointer
events) rotates the camera around the object. A slow continuous idle
spin resumes a couple seconds after the user stops dragging, so the
object is never just sitting static — the user can always nudge it to
look from a new angle.

**Material/color.** `MeshStandardMaterial` (or `MeshPhongMaterial`) with
one ambient + one directional light, so the surface reads as a lit solid
rather than a flat-shaded or wireframe shape. A row of color swatches
(visually matching the swatch picker already built for Fractals) sets
the material's color live. Default color: the site's `--accent-color`
or a warm neutral consistent with the palette — builder's call.

Open rims (e.g. a vase mouth that doesn't taper back to the axis) stay
**hollow**, not capped — you can see down into the vessel, matching how
a real thrown/turned piece looks. The material is double-sided so the
interior wall renders instead of showing through as a black gap, and
the light rig needs enough fill (a second, softer light or raised
ambient intensity) that the interior doesn't just read as a dark hole —
builder's call on exact light placement/intensity, but it must be
checked specifically against an open-rim profile (not just a closed
vase-shaped one) before calling this done.

**Save image.** Same pattern as `fractals.js`'s `export-btn`: grab
`renderer.domElement.toDataURL('image/png')` and trigger a download via
a temporary `<a>` link.

**Clear/redraw.** A button resets to the blank 2D canvas (hide/dispose
the Three.js scene, show the drawing canvas again) so the user can try
another line. Reuses the "Clear drawing" idea from Fractals.

**Homepage tile.** A static thumbnail image (matching how the Fractals
tile uses a pre-rendered `img/fractal-thumb.png`, not a live canvas) —
one representative rendered silhouette object, saved as
`img/silhouette-thumb.png`, with the same corner-bracket treatment as
the Perceiving/Fractals tiles. Added as a new `.project-card` in
`index.html`'s grid, title "Silhouette," linking to
`pages/silhouette.html`.

## What's left to the builder

- Exact resampling/smoothing of the drawn polyline before it becomes
  lathe segments (how many points, how much smoothing so jittery hand
  strokes don't produce a lumpy surface).
- Exact default surface color and the swatch color set (should feel
  consistent with the Fractals palette presets, not identical).
- Exact easing/duration tuning of the reveal sweep and the idle-spin
  speed/delay.
- Whether drag-to-orbit is hand-rolled (a few lines on pointer events,
  consistent with how the rest of the site avoids extra dependencies
  beyond Three.js itself) or uses Three.js's `OrbitControls` addon —
  builder's call, favoring the smaller/simpler option unless it fights
  the drag-to-draw interaction on the same canvas.
- Generating the actual `silhouette-thumb.png` (render one sample object
  and screenshot it, same as presumably was done for the fractal tile).
- Minimum/maximum practical line length or height before treating a
  drawn stroke as too short to lathe (e.g. a single click with no drag).
