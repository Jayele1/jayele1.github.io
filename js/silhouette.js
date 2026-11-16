'use strict';

// --- Constants ---

const DRAW_LOGICAL_SIZE = 600;
const PROFILE_POINT_COUNT = 40;
const MIN_STROKE_LENGTH_PX = 20;
const MIN_RADIUS_PX = 2;
const WORLD_SCALE = 1 / 300;

// --- Pure math (no DOM access; required from Node by the verification step) ---

function resamplePolyline(points, targetCount) {
  // Arc-length resample: walk cumulative segment lengths and interpolate
  // targetCount evenly-spaced points along the path. This is an open profile
  // curve, so (unlike a polygon resample) we never wrap back to points[0].
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    lengths.push(lengths[i - 1] + Math.hypot(dx, dy));
  }
  const total = lengths[lengths.length - 1] || 1;
  const result = [];
  for (let k = 0; k < targetCount; k++) {
    const target = (total * k) / targetCount;
    let i = 0;
    while (i < lengths.length - 1 && lengths[i + 1] < target) i++;
    const segLen = lengths[i + 1] - lengths[i] || 1;
    const t = (target - lengths[i]) / segLen;
    const p0 = points[i];
    const p1 = points[Math.min(i + 1, points.length - 1)];
    result.push({
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t
    });
  }
  return result;
}

function deriveProfileFromPoints(rawPoints, canvasLogicalSize) {
  if (!rawPoints || rawPoints.length < 2) return null;

  let totalLength = 0;
  for (let i = 1; i < rawPoints.length; i++) {
    const dx = rawPoints[i].x - rawPoints[i - 1].x;
    const dy = rawPoints[i].y - rawPoints[i - 1].y;
    totalLength += Math.hypot(dx, dy);
  }
  if (totalLength < MIN_STROKE_LENGTH_PX) return null;

  const axisX = Math.min(...rawPoints.map((p) => p.x));
  const resampled = resamplePolyline(rawPoints, PROFILE_POINT_COUNT);

  // Preserve stroke order (no sorting by height) — a profile that moves up
  // and down is a valid, intentional lathe shape, not an error.
  const points = resampled.map((p) => ({
    radius: Math.max(p.x - axisX, MIN_RADIUS_PX) * WORLD_SCALE,
    // Canvas y grows downward; Three.js world y grows upward, so flip here.
    height: (canvasLogicalSize - p.y) * WORLD_SCALE
  }));

  return { points, axisX };
}

// --- DOM wiring (freehand draw capture) ---

if (typeof document !== 'undefined') {
  (() => {
    const canvas = document.getElementById('silhouette-draw-canvas');
    const clearBtn = document.getElementById('silhouette-clear-btn');
    const sceneContainer = document.getElementById('silhouette-scene-container');
    const swatchesWrap = document.getElementById('silhouette-color-swatches');
    const saveBtn = document.getElementById('silhouette-save-btn');

    if (!canvas) return;

    // --- Task 8: Save image enabled state ---
    //
    // Save is only meaningful once a 3D object exists. Enabled as soon as a
    // reveal starts (showProfile() builds the mesh synchronously, so
    // hasObject() is already true right after it returns); disabled again on
    // Clear.
    function updateSaveButton() {
      if (saveBtn) saveBtn.disabled = !SilhouetteScene.hasObject();
    }

    function saveImage() {
      const link = document.createElement('a');
      link.download = `silhouette-${Date.now()}.png`;
      link.href = SilhouetteScene.exportImage();
      link.click();
    }

    // --- Task 7: surface color swatches ---
    //
    // A fixed small palette, not fractals.js's editable add/remove
    // `<input type="color">` list (js/fractals.js:264-299) — there's one
    // target color here, not an editable set, so plain clickable buttons
    // with an inline background-color are enough. Drawn from the site's
    // own warm-brown/cream palette plus its accent color; the first entry
    // matches Task 3's hardcoded default mesh color (0x8b7355) so the
    // initially-active swatch is accurate without an extra setColor() call
    // before any object exists.
    const COLOR_SWATCHES = ['#8b7355', '#5c4330', '#c9a66b', '#e4d6a4', '#2d2822', '#0032f9'];
    let activeSwatchColor = COLOR_SWATCHES[0];

    function buildColorSwatches() {
      if (!swatchesWrap) return;
      swatchesWrap.innerHTML = '';
      COLOR_SWATCHES.forEach((hex) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'color-swatch' + (hex === activeSwatchColor ? ' is-active' : '');
        btn.style.backgroundColor = hex;
        btn.setAttribute('aria-label', `Set surface color to ${hex}`);
        btn.addEventListener('click', () => {
          activeSwatchColor = hex;
          // Safe before any line is drawn / mesh exists — setColor() just
          // stashes it as the pending color for the next reveal.
          SilhouetteScene.setColor(hex);
          buildColorSwatches();
        });
        swatchesWrap.appendChild(btn);
      });
    }

    buildColorSwatches();

    const ctx = canvas.getContext('2d');

    let dpr = Math.max(1, window.devicePixelRatio || 1);
    let drawing = false;
    let drawPoints = [];
    let currentProfile = null; // stashed for Task 6 to consume
    let sceneInitialized = false; // SilhouetteScene.init() runs at most once

    function sizeCanvas() {
      dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = DRAW_LOGICAL_SIZE * dpr;
      canvas.height = DRAW_LOGICAL_SIZE * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function clearCanvasSurface() {
      ctx.clearRect(0, 0, DRAW_LOGICAL_SIZE, DRAW_LOGICAL_SIZE);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, DRAW_LOGICAL_SIZE, DRAW_LOGICAL_SIZE);
    }

    function logicalPointFromEvent(evt) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = DRAW_LOGICAL_SIZE / rect.width;
      const scaleY = DRAW_LOGICAL_SIZE / rect.height;
      return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
      };
    }

    function drawLivePath() {
      clearCanvasSurface();
      if (drawPoints.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(drawPoints[0].x, drawPoints[0].y);
      for (let i = 1; i < drawPoints.length; i++) ctx.lineTo(drawPoints[i].x, drawPoints[i].y);
      ctx.strokeStyle = '#8b7355';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    function finishDrawing() {
      if (!drawing) return;
      drawing = false;
      const profile = deriveProfileFromPoints(drawPoints, DRAW_LOGICAL_SIZE);
      if (!profile) {
        // Ignore the click/too-short stroke: clear the live stroke back to blank.
        drawPoints = [];
        clearCanvasSurface();
        return;
      }
      currentProfile = profile;

      const { points, axisX } = profile;
      if (!sceneInitialized) {
        SilhouetteScene.init(sceneContainer, canvas);
        sceneInitialized = true;
      }
      SilhouetteScene.showProfile(points, axisX, DRAW_LOGICAL_SIZE);
      updateSaveButton();
    }

    canvas.addEventListener('pointerdown', (evt) => {
      drawing = true;
      drawPoints = [logicalPointFromEvent(evt)];
      canvas.setPointerCapture(evt.pointerId);
    });

    canvas.addEventListener('pointermove', (evt) => {
      if (!drawing) return;
      drawPoints.push(logicalPointFromEvent(evt));
      drawLivePath();
    });

    canvas.addEventListener('pointerup', finishDrawing);
    canvas.addEventListener('pointerleave', () => {
      if (drawing) finishDrawing();
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        SilhouetteScene.reset();
        currentProfile = null;
        drawPoints = [];
        clearCanvasSurface();
        canvas.classList.remove('hide');
        if (sceneContainer) sceneContainer.classList.add('hide');
        updateSaveButton();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        if (!SilhouetteScene.hasObject()) return;
        saveImage();
      });
    }

    // --- Init ---

    sizeCanvas();
    clearCanvasSurface();
    updateSaveButton();

    window.addEventListener('resize', () => {
      sizeCanvas();
      clearCanvasSurface();
      drawPoints = [];
    });
  })();
}

// --- Node-checkable export (no-op in the browser) ---

if (typeof module !== 'undefined') module.exports = { resamplePolyline, deriveProfileFromPoints };
