'use strict';

// --- Three.js scene bootstrap + hollow lathe mesh builder ---
//
// This file owns the Three.js engine (scene/camera/lights/mesh/material) for
// the Silhouette page. Drawing/pointer-capture logic lives in js/silhouette.js.

(() => {
  const LATHE_SEGMENTS = 48;
  // Duplicated from js/silhouette.js's constants of the same name: this file
  // is loaded as its own classic <script>, so a top-level const in that file
  // isn't visible here. Keep these in sync with js/silhouette.js.
  const DRAW_LOGICAL_SIZE = 600;
  const WORLD_SCALE = 1 / 300;
  const REVEAL_DURATION_MS = 1200;
  const AMBIENT_INTENSITY = 0.5;
  const KEY_LIGHT_INTENSITY = 0.9;
  // Fill light is deliberately strong and placed from the opposite side/lower
  // angle so the hollow interior of an open-rim profile (e.g. a vase mouth)
  // reads as a lit surface instead of a black hole. Combined with
  // THREE.DoubleSide on the material (which makes the interior wall render
  // at all), this is what makes looking down into an open top rim show a
  // visible, lit wall rather than a flat black disc.
  const FILL_LIGHT_INTENSITY = 0.85;
  const MESH_COLOR = 0x8b7355;

  // Task 7: surface color. pendingColor is what the *next* buildMesh() call
  // (whether from a fresh showProfile() reveal or a mid-sweep frame) uses as
  // its material color. setColor() below always updates this, and also
  // live-updates the current mesh's material when one exists. Starting it
  // at MESH_COLOR means the very first object still reveals in the original
  // Task 3 default until a swatch is clicked. Deliberately NOT reset by
  // reset() (Task 6's Clear) — a color picked before Clear should still be
  // what the next drawn object reveals in.
  let pendingColor = MESH_COLOR;

  // Drag-to-orbit + idle auto-spin (Task 5) tuning constants.
  // Radians of azimuth/elevation per pixel of pointer drag delta.
  const DRAG_AZIMUTH_SPEED = 0.008;
  const DRAG_ELEVATION_SPEED = 0.008;
  // Keep the camera away from the poles so it can never flip upside down.
  const ELEVATION_MIN = 0.1;
  const ELEVATION_MAX = Math.PI - 0.1;
  // How long after the last drag input before auto-spin resumes, and how
  // fast (radians/sec) it spins once it does.
  const IDLE_SPIN_DELAY_MS = 2000;
  const IDLE_SPIN_SPEED = 0.15;

  let scene = null;
  let camera = null;
  let renderer = null;
  let container = null;
  let drawCanvasEl = null;
  let currentMesh = null;
  let hasMesh = false;

  // Reveal-sweep + camera-handoff state (Task 4). currentPhiLength tracks
  // the lathe's current reveal angle so a repeated showProfile() call, or a
  // later idle-spin/orbit step (Task 5), can see where the sweep left off.
  let currentPhiLength = Math.PI * 2;
  let revealRafId = null;

  // Orbit state handed off to Task 5: spherical coordinates around the
  // object's own bounding-sphere center, with a fixed radius chosen by the
  // auto-fit at the end of the reveal.
  // Initial defaults, also restored by reset() (Task 6) so each new reveal
  // starts from the same predictable camera angle rather than wherever a
  // previous object's orbit/idle-spin left off.
  const ORBIT_AZIMUTH_DEFAULT = Math.PI / 6;
  const ORBIT_ELEVATION_DEFAULT = Math.PI / 2 - 0.35;

  let orbitRadius = 1;
  let orbitAzimuth = ORBIT_AZIMUTH_DEFAULT;
  let orbitElevation = ORBIT_ELEVATION_DEFAULT;
  let originY = 0;

  // Drag-to-orbit + idle auto-spin (Task 5) runtime state. orbitActive
  // gates the per-frame orbit/spin update so it only runs once the reveal
  // handoff in showProfile() has produced a perspective camera to drive —
  // it's false for the whole reveal sweep (and before the first reveal),
  // and flips true on the final frame of showProfile().
  let orbitActive = false;
  let isPointerDown = false;
  let activePointerId = null;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastDragTime = 0;
  let lastFrameTime = null;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function orbitCameraPosition() {
    const sinE = Math.sin(orbitElevation);
    return new THREE.Vector3(
      orbitRadius * sinE * Math.sin(orbitAzimuth),
      originY + orbitRadius * Math.cos(orbitElevation),
      orbitRadius * sinE * Math.cos(orbitAzimuth)
    );
  }

  function render() {
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
  }

  // Recomputes the perspective camera's position/lookAt from the current
  // orbitAzimuth/orbitElevation each frame — the single place that reads
  // those values and writes to the camera, whether they changed this frame
  // because of a drag (pointermove below) or idle auto-spin (here).
  function updateOrbit(deltaSeconds) {
    if (!orbitActive || !camera) return;

    if (!isPointerDown && Date.now() - lastDragTime > IDLE_SPIN_DELAY_MS) {
      orbitAzimuth += IDLE_SPIN_SPEED * deltaSeconds;
    }

    camera.position.copy(orbitCameraPosition());
    camera.lookAt(0, originY, 0);
  }

  function animate(timestamp) {
    const now = typeof timestamp === 'number' ? timestamp : performance.now();
    const deltaSeconds = lastFrameTime !== null ? Math.max(0, (now - lastFrameTime) / 1000) : 0;
    lastFrameTime = now;

    updateOrbit(deltaSeconds);
    render();
    requestAnimationFrame(animate);
  }

  // --- Drag-to-orbit pointer handlers (Task 5) ---
  //
  // Hand-rolled instead of Three.js's OrbitControls addon: that addon ships
  // as an ES module, and every script on this site (Three.js included,
  // loaded here as a classic global script with no import maps) is a
  // classic script — pulling in one ES-module addon would be the only
  // module-based script on the whole site. These handlers only ever write
  // to orbitAzimuth/orbitElevation/isPointerDown/lastDragTime; the actual
  // camera.position/lookAt recompute happens once per frame in
  // updateOrbit() above, not here.
  function onPointerDown(event) {
    isPointerDown = true;
    activePointerId = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    lastDragTime = Date.now();
    if (container && container.setPointerCapture) {
      try {
        container.setPointerCapture(event.pointerId);
      } catch (e) {
        // Ignore — pointer capture is a nice-to-have, not required for
        // the drag math below to work.
      }
    }
  }

  function onPointerMove(event) {
    if (!isPointerDown || event.pointerId !== activePointerId) return;

    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    orbitAzimuth += dx * DRAG_AZIMUTH_SPEED;
    orbitElevation = Math.min(
      ELEVATION_MAX,
      Math.max(ELEVATION_MIN, orbitElevation + dy * DRAG_ELEVATION_SPEED)
    );
    lastDragTime = Date.now();
  }

  function onPointerUp(event) {
    if (event.pointerId !== activePointerId) return;
    isPointerDown = false;
    activePointerId = null;
    lastDragTime = Date.now();
    if (container && container.releasePointerCapture) {
      try {
        container.releasePointerCapture(event.pointerId);
      } catch (e) {
        // Already released/invalid — nothing to do.
      }
    }
  }

  // Attached once a reveal settles into an orbit-able perspective view
  // (end of showProfile's reveal sweep), and detached by reset() — so a
  // Clear click during/after one object's orbit never leaves that object's
  // listeners stacked underneath the next one's.
  function attachOrbitListeners() {
    if (!container) return;
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
  }

  function detachOrbitListeners() {
    if (!container) return;
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointercancel', onPointerUp);
  }

  function handleResize() {
    if (!renderer || !camera || !container) return;
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function init(containerEl, drawCanvas) {
    container = containerEl;
    drawCanvasEl = drawCanvas;

    scene = new THREE.Scene();

    const rect = container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);

    // Static perspective camera, arbitrary front-ish angle, elevated enough
    // to look down into an open top rim. Auto-fit comes in Task 4.
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2.6, 3.1, 4.0);
    camera.lookAt(0, 1, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY);
    scene.add(ambientLight);

    // Key light: front-upper-side.
    const keyLight = new THREE.DirectionalLight(0xffffff, KEY_LIGHT_INTENSITY);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    // Fill light: opposite side, lower angle, softer — see note on
    // FILL_LIGHT_INTENSITY above.
    const fillLight = new THREE.DirectionalLight(0xffffff, FILL_LIGHT_INTENSITY);
    fillLight.position.set(-3, 1.2, -3.5);
    scene.add(fillLight);

    window.addEventListener('resize', handleResize);

    // touch-action: none keeps touch drags from also scrolling/zooming the
    // page while orbiting. The pointer listeners themselves are attached
    // per-reveal (attachOrbitListeners, called once showProfile's sweep
    // settles into an orbit-able view) and detached by reset(), not here —
    // init() itself only ever runs once.
    container.style.touchAction = 'none';
    container.style.cursor = 'grab';

    requestAnimationFrame(animate);
  }

  function buildMesh(profile, phiLength) {
    const points = profile.map((p) => new THREE.Vector2(p.radius, p.height));
    // phiStart fixed at 0; phiLength defaults to a full revolution so
    // existing callers (and the Task 3 debug path) are unaffected. The
    // reveal sweep (showProfile) passes a growing phiLength each frame.
    const geometry = new THREE.LatheGeometry(
      points,
      LATHE_SEGMENTS,
      0,
      typeof phiLength === 'number' ? phiLength : Math.PI * 2
    );
    const material = new THREE.MeshStandardMaterial({
      color: pendingColor,
      side: THREE.DoubleSide,
      roughness: 0.6
    });

    if (currentMesh) {
      scene.remove(currentMesh);
      currentMesh.geometry.dispose();
      currentMesh.material.dispose();
      currentMesh = null;
    }

    currentMesh = new THREE.Mesh(geometry, material);
    scene.add(currentMesh);
    hasMesh = true;
    return currentMesh;
  }

  function showProfile(profile, axisX, canvasLogicalSize) {
    if (!scene || !renderer || !container) return;

    if (revealRafId !== null) {
      cancelAnimationFrame(revealRafId);
      revealRafId = null;
    }

    // --- Step 1: orthographic reveal camera, pixel-matched to the draw canvas ---
    //
    // js/silhouette.js derives each profile point from the raw stroke as:
    //   radius = (canvasX - axisX) * WORLD_SCALE
    //   height = (canvasLogicalSize - canvasY) * WORLD_SCALE
    // i.e. a plain shift-by-axisX-then-scale of the canvas's pixel columns
    // (and a flip+scale of its rows, with no per-stroke shift). A LatheGeometry
    // at phiLength≈0 just places its points at those (radius, height)
    // world coordinates, unrevolved — a flat ribbon sitting exactly where
    // the stroke's own pixels were, up to that shift+scale.
    //
    // For the camera to show that ribbon at the real on-screen position the
    // stroke was drawn (not shifted/zoomed), its frustum has to invert the
    // *same* shift+scale across the *entire* canvas width, not just the
    // slice to the right of axisX. Canvas column 0 must map to
    // world x = -axisX * WORLD_SCALE, and canvas column canvasLogicalSize
    // must map to world x = (canvasLogicalSize - axisX) * WORLD_SCALE — so
    // camera.left is -axisX * WORLD_SCALE, not 0. (0 would narrow the
    // frustum to only the [axisX, canvasLogicalSize] slice of the canvas
    // and stretch that slice across the whole viewport, visibly shifting
    // the ribbon away from its drawn position whenever axisX isn't ~0 —
    // i.e. almost always, since axisX is the stroke's own leftmost x, not
    // the canvas's left edge.) Vertically there's no analogous per-stroke
    // shift — height already spans the full canvas row range
    // [0, canvasLogicalSize] — so bottom=0 / top=canvasLogicalSize*WORLD_SCALE
    // is correct as literally given.
    const orthoLeft = -axisX * WORLD_SCALE;
    const orthoRight = (canvasLogicalSize - axisX) * WORLD_SCALE;
    const orthoBottom = 0;
    const orthoTop = canvasLogicalSize * WORLD_SCALE;

    const orthoCamera = new THREE.OrthographicCamera(
      orthoLeft,
      orthoRight,
      orthoTop,
      orthoBottom,
      0.1,
      100
    );
    orthoCamera.position.set(0, 0, 10); // +Z axis, looking down -Z (default orientation)
    camera = orthoCamera;

    // Extending the frustum left of the mesh's own x=0 (whenever axisX > 0)
    // leaves a margin, to the left of the ribbon, that nothing draws into.
    // Render that margin as opaque white — matching the draw canvas's own
    // fill color — instead of letting the (alpha:true) renderer show the
    // page's cream background through it, which would otherwise appear as
    // a colored seam right at the handoff moment. Restored to transparent
    // once we hand off to the perspective camera below.
    renderer.setClearColor(0xffffff, 1);

    // Hide the 2D draw canvas and show the 3D container right now, so the
    // ribbon appears in the same frame the stroke's own pixels disappear
    // from — this is what Step 2 means by "no jump/flash at the start".
    if (drawCanvasEl) drawCanvasEl.classList.add('hide');
    container.classList.remove('hide');
    // init() may have measured the container while it was still
    // display:none (0x0), e.g. when init() runs before the first reveal.
    // Now that it's visible, re-measure so the renderer/camera actually
    // match its real on-screen size.
    handleResize();

    // --- Step 2: sweep phiLength 0 -> 2π while handing the camera off ---
    currentPhiLength = 0;
    buildMesh(profile, currentPhiLength);

    const startTime = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - startTime) / REVEAL_DURATION_MS);
      currentPhiLength = easeOutCubic(t) * Math.PI * 2;
      const mesh = buildMesh(profile, currentPhiLength);

      if (t < 1) {
        revealRafId = requestAnimationFrame(frame);
        return;
      }

      // Final frame: auto-fit a perspective camera to the finished mesh's
      // bounding sphere, with margin, and clamp the fit distance so a
      // stroke that stays close to the axis (near-zero bounding sphere
      // radius) never leaves the camera at distance ~0.
      mesh.geometry.computeBoundingSphere();
      const sphere = mesh.geometry.boundingSphere;
      const sphereRadius = sphere ? sphere.radius : 0;
      const center = sphere ? sphere.center : new THREE.Vector3(0, 0, 0);

      const fov = 45;
      const fitDistance = (sphereRadius / Math.sin((fov * Math.PI / 180) / 2)) * 1.5;
      orbitRadius = Math.max(fitDistance, 1);
      originY = center.y;

      const rect = container.getBoundingClientRect();
      const aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      const perspectiveCamera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 100);
      perspectiveCamera.position.copy(orbitCameraPosition());
      perspectiveCamera.lookAt(0, originY, 0);

      camera = perspectiveCamera;
      renderer.setClearColor(0x000000, 0); // back to transparent for the settled view

      // Hand off to Task 5's drag-to-orbit/idle-spin: start the idle-spin
      // clock now (not from whenever init() happened to run) so the ~2s
      // idle delay is measured from the moment the object actually settles
      // into view.
      orbitActive = true;
      lastDragTime = Date.now();
      attachOrbitListeners();

      revealRafId = null;
    }

    revealRafId = requestAnimationFrame(frame);
  }

  // Tears down everything specific to the current object so the next
  // showProfile() call starts clean: cancels any in-flight reveal-sweep
  // frame (so a stale closure over the old profile can't resurrect it),
  // removes+disposes the mesh, detaches the drag-orbit listeners, and
  // resets orbit/drag runtime state — including restoring orbitAzimuth/
  // orbitElevation to their initial defaults, so every new reveal starts
  // from the same predictable camera angle rather than wherever the
  // previous object's orbit/idle-spin left off. The renderer/scene/camera/
  // lights themselves are left alive and reused.
  function reset() {
    if (revealRafId !== null) {
      cancelAnimationFrame(revealRafId);
      revealRafId = null;
    }

    if (currentMesh) {
      if (scene) scene.remove(currentMesh);
      currentMesh.geometry.dispose();
      currentMesh.material.dispose();
      currentMesh = null;
    }
    hasMesh = false;

    detachOrbitListeners();
    orbitActive = false;
    isPointerDown = false;
    activePointerId = null;
    lastDragTime = 0;
    orbitAzimuth = ORBIT_AZIMUTH_DEFAULT;
    orbitElevation = ORBIT_ELEVATION_DEFAULT;
  }

  function hasObject() {
    return hasMesh;
  }

  // Task 7: called by a swatch click in js/silhouette.js. Always records
  // the choice as pendingColor so it survives into whatever buildMesh()
  // call comes next (mid-sweep frame, or a brand-new showProfile() after a
  // Clear); additionally pokes the live material when a mesh already
  // exists, so the current object's surface recolors immediately without
  // waiting for another reveal.
  function setColor(hex) {
    pendingColor = hex;
    if (currentMesh) {
      currentMesh.material.color.set(hex);
    }
  }

  window.SilhouetteScene = { init, buildMesh, showProfile, reset, hasObject, setColor };
})();
