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

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    let dpr = Math.max(1, window.devicePixelRatio || 1);
    let drawing = false;
    let drawPoints = [];
    let currentProfile = null; // stashed for Task 6 to consume

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
      // TODO: Task 6 — hand currentProfile off to the 3D scene here.
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
        currentProfile = null;
        drawPoints = [];
        clearCanvasSurface();
      });
    }

    // --- Init ---

    sizeCanvas();
    clearCanvasSurface();

    window.addEventListener('resize', () => {
      sizeCanvas();
      clearCanvasSurface();
      drawPoints = [];
    });
  })();
}

// --- Node-checkable export (no-op in the browser) ---

if (typeof module !== 'undefined') module.exports = { resamplePolyline, deriveProfileFromPoints };
