const introEl = document.getElementById('perceiving-intro');
const stageEl = document.getElementById('perceiving-stage');
const fallbackEl = document.getElementById('perceiving-fallback');
const fallbackMessageEl = document.getElementById('perceiving-fallback-message');
const startBtn = document.getElementById('perceiving-start-btn');
const flipBtn = document.getElementById('perceiving-flip-btn');
const videoEl = document.getElementById('perceiving-video');
const panesContainer = document.getElementById('perceiving-panes');

const ZOOM_STEP = 2.2;
const MIN_ZOOM = 1;
const MAX_ZOOM = 24;
const MAX_PANES = 4;
const SWATCH_UPDATE_EVERY_N_FRAMES = 12;

// One shared 1x1 canvas for every pane's color sample: drawing a crop into
// it scaled down to a single pixel is a cheap, standard way to get that
// crop's average color (the browser's own downscale filtering does the
// averaging), and reusing one canvas avoids allocating N of them.
const sampleCanvas = document.createElement('canvas');
sampleCanvas.width = 1;
sampleCanvas.height = 1;
const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

let currentFacingMode = 'user';
let currentStream = null;
let panes = [];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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
    videoEl.srcObject = stream;
    await videoEl.play();
    createPane(MIN_ZOOM, { x: 0.5, y: 0.5 });
    requestAnimationFrame(renderPanes);
  } catch (err) {
    showFallback(describeCameraError(err));
  }
}

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
    .catch((err) => showFallback(describeCameraError(err)));
}

/* Each pane is an independent read of the *same* shared video element - a
   zoom factor plus a center point, both expressed in the original video's
   normalized (0-1) coordinate space. That keeps panes decoupled: zooming or
   closing one never has to walk or recompute any of the others. */
function createPane(zoom, center) {
  const index = panes.length;

  const paneEl = document.createElement('div');
  paneEl.className = 'perceiving-pane';
  paneEl.dataset.paneIndex = String(index);

  const canvas = document.createElement('canvas');
  canvas.className = 'perceiving-pane-canvas';
  paneEl.appendChild(canvas);

  const label = document.createElement('span');
  label.className = 'perceiving-pane-label';
  paneEl.appendChild(label);

  const swatch = document.createElement('div');
  swatch.className = 'perceiving-pane-swatch';
  const swatchColor = document.createElement('span');
  swatchColor.className = 'perceiving-pane-swatch-color';
  const swatchCode = document.createElement('span');
  swatchCode.className = 'perceiving-pane-swatch-code';
  swatchCode.textContent = '#------';
  swatch.appendChild(swatchColor);
  swatch.appendChild(swatchCode);
  paneEl.appendChild(swatch);

  const pane = {
    el: paneEl,
    canvas,
    ctx: canvas.getContext('2d'),
    label,
    swatchColor,
    swatchCode,
    zoom,
    center,
    index
  };

  if (index > 0) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'perceiving-pane-close';
    closeBtn.setAttribute('aria-label', 'Close this zoom level');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      truncatePanesAfter(index - 1);
    });
    paneEl.appendChild(closeBtn);
  }

  paneEl.addEventListener('click', (e) => handlePaneClick(pane, e));
  paneEl.addEventListener('wheel', (e) => handlePaneWheel(pane, e), { passive: false });

  const resizeObserver = new ResizeObserver(() => resizePaneCanvas(pane));
  resizeObserver.observe(paneEl);
  pane.resizeObserver = resizeObserver;

  panesContainer.appendChild(paneEl);
  panes.push(pane);
  panesContainer.dataset.count = String(panes.length);
  resizePaneCanvas(pane);
  updatePaneLabel(pane);

  return pane;
}

function truncatePanesAfter(index) {
  while (panes.length - 1 > index) {
    const pane = panes.pop();
    pane.resizeObserver.disconnect();
    pane.el.remove();
  }
  panesContainer.dataset.count = String(panes.length);
}

function resizePaneCanvas(pane) {
  // Match the canvas's backing-store resolution to the display's actual
  // pixel density. Without this a canvas is always drawn at 1 device pixel
  // per CSS pixel, which looks soft/blurry on any Retina-class screen next
  // to a directly-rendered <video>.
  const dpr = window.devicePixelRatio || 1;
  pane.canvas.width = Math.max(1, Math.round(pane.el.clientWidth * dpr));
  pane.canvas.height = Math.max(1, Math.round(pane.el.clientHeight * dpr));
}

function updatePaneLabel(pane) {
  pane.label.textContent = pane.index === 0 ? 'LIVE' : `×${pane.zoom.toFixed(1)}`;
}

function localPointFromEvent(pane, e) {
  const rect = pane.el.getBoundingClientRect();
  let lx = clamp((e.clientX - rect.left) / rect.width, 0, 1);
  let ly = clamp((e.clientY - rect.top) / rect.height, 0, 1);

  // The feed is mirrored for the selfie-facing camera, so translate the
  // pointer back into the source video's un-mirrored coordinate space.
  if (stageEl.classList.contains('perceiving-mirrored')) {
    lx = 1 - lx;
  }

  return { lx, ly };
}

/* The actual crop read from the video for a pane: zoom sets the base size,
   then it's trimmed to the pane's own aspect ratio (object-fit: cover
   behavior) so panes narrower or wider than the camera's aspect ratio crop
   instead of stretching the image to fit. Shared by rendering and by the
   click/wheel math so a click always lands on the pixel actually drawn
   there. Returns null until the video has real dimensions. */
function getPaneCropRect(pane) {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return null;

  let srcW = vw / pane.zoom;
  let srcH = vh / pane.zoom;

  const paneAspect = pane.canvas.width && pane.canvas.height
    ? pane.canvas.width / pane.canvas.height
    : vw / vh;
  const cropAspect = srcW / srcH;

  if (paneAspect > cropAspect) {
    srcH = srcW / paneAspect;
  } else {
    srcW = srcH * paneAspect;
  }

  const sx = clamp(pane.center.x * vw - srcW / 2, 0, vw - srcW);
  const sy = clamp(pane.center.y * vh - srcH / 2, 0, vh - srcH);

  return { sx, sy, srcW, srcH, vw, vh };
}

function paneLocalToVideoNormalized(pane, lx, ly) {
  const rect = getPaneCropRect(pane);
  if (!rect) return { x: pane.center.x, y: pane.center.y };
  return {
    x: (rect.sx + lx * rect.srcW) / rect.vw,
    y: (rect.sy + ly * rect.srcH) / rect.vh
  };
}

function handlePaneClick(pane, e) {
  const { lx, ly } = localPointFromEvent(pane, e);
  const point = paneLocalToVideoNormalized(pane, lx, ly);

  // Clicking any pane continues the grid from there, dropping whatever
  // deeper panes existed after it.
  truncatePanesAfter(pane.index);
  const nextZoom = clamp(pane.zoom * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);

  if (panes.length < MAX_PANES) {
    createPane(nextZoom, point);
  } else {
    // The grid is already full four squares - clicking its last pane zooms
    // further into it in place instead of trying to add a fifth.
    pane.zoom = nextZoom;
    pane.center = point;
    updatePaneLabel(pane);
  }
}

function handlePaneWheel(pane, e) {
  e.preventDefault();
  const { lx, ly } = localPointFromEvent(pane, e);
  const anchor = paneLocalToVideoNormalized(pane, lx, ly);

  const factor = Math.exp(-e.deltaY * 0.0015);
  pane.zoom = clamp(pane.zoom * factor, MIN_ZOOM, MAX_ZOOM);

  // Re-anchor so the point under the cursor stays put as the zoom changes.
  const rect = getPaneCropRect(pane);
  if (rect) {
    const spanX = rect.srcW / rect.vw;
    const spanY = rect.srcH / rect.vh;
    pane.center = {
      x: clamp(anchor.x - (lx - 0.5) * spanX, spanX / 2, 1 - spanX / 2),
      y: clamp(anchor.y - (ly - 0.5) * spanY, spanY / 2, 1 - spanY / 2)
    };
  }

  updatePaneLabel(pane);
}

function drawPaneFrame(pane) {
  const cw = pane.canvas.width;
  const ch = pane.canvas.height;
  if (!cw || !ch) return;

  const rect = getPaneCropRect(pane);
  if (!rect) return;

  const ctx = pane.ctx;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.save();
  if (stageEl.classList.contains('perceiving-mirrored')) {
    ctx.translate(cw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(videoEl, rect.sx, rect.sy, rect.srcW, rect.srcH, 0, 0, cw, ch);
  ctx.restore();
}

function toHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function updatePaneSwatch(pane) {
  const rect = getPaneCropRect(pane);
  if (!rect) return;

  sampleCtx.drawImage(videoEl, rect.sx, rect.sy, rect.srcW, rect.srcH, 0, 0, 1, 1);
  const [r, g, b] = sampleCtx.getImageData(0, 0, 1, 1).data;
  const hex = toHex(r, g, b);

  pane.swatchColor.style.backgroundColor = hex;
  pane.swatchCode.textContent = hex;
}

let swatchFrameCounter = 0;

function renderPanes() {
  if (videoEl.readyState >= 2 && videoEl.videoWidth) {
    panes.forEach(drawPaneFrame);

    // The average-color readout doesn't need to track every frame, and
    // getImageData forces a GPU-to-CPU readback, so it runs on its own,
    // much slower tick instead of every one of the 60fps draws above.
    swatchFrameCounter++;
    if (swatchFrameCounter >= SWATCH_UPDATE_EVERY_N_FRAMES) {
      swatchFrameCounter = 0;
      panes.forEach(updatePaneSwatch);
    }
  }
  requestAnimationFrame(renderPanes);
}

function initPerceivingPage() {
  startBtn.addEventListener('click', startPerceiving);
  flipBtn.addEventListener('click', flipCamera);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panes.length > 1) {
      truncatePanesAfter(panes.length - 2);
    }
  });
}

document.addEventListener('DOMContentLoaded', initPerceivingPage);
