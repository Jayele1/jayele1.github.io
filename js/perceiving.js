const TASKS_VISION_MODULE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0";

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
let captionThrottleTimer = null;
let latestDetections = [];

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
  if (err && err.message === 'MODEL_LOAD_FAILED') {
    return "Couldn't load the detection model. Check your connection and reload the page to try again.";
  }
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
    try {
      objectDetector = await loadObjectDetector();
    } catch (err) {
      throw new Error('MODEL_LOAD_FAILED');
    }
  }

  requestAnimationFrame(detectFrame);
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
    .then(resizeCanvasToVideo)
    .catch((err) => showFallback(describeCameraError(err)));
}

function resizeCanvasToVideo() {
  canvasEl.width = videoEl.videoWidth || videoEl.clientWidth;
  canvasEl.height = videoEl.videoHeight || videoEl.clientHeight;
}

async function loadObjectDetector() {
  // Imported lazily so a CDN outage can't stop this module from executing.
  // A static top-level import would take the Start button's click listener
  // down with it, leaving a button that silently does nothing.
  const { ObjectDetector, FilesetResolver } = await import(TASKS_VISION_MODULE);
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

  let result;
  try {
    result = objectDetector.detectForVideo(videoEl, timestampMs);
  } catch (err) {
    // The detector may be in an inconsistent state (e.g. the stream was
    // swapped mid-loop), so surface the failure instead of rescheduling
    // into a loop that would keep throwing.
    showFallback("Something went wrong during detection. Reload the page to try again.");
    return;
  }

  drawDetections(result.detections);
  scheduleCaptionUpdate(result.detections);
  requestAnimationFrame(detectFrame);
}

/* Short L-shaped marks at each corner, matching the site's .corner-bracket
   accent, instead of a generic full bounding rectangle. */
function drawCornerBrackets(x, y, width, height) {
  const arm = Math.max(8, Math.min(22, width / 4, height / 4));

  ctx.beginPath();
  // top-left
  ctx.moveTo(x, y + arm);
  ctx.lineTo(x, y);
  ctx.lineTo(x + arm, y);
  // top-right
  ctx.moveTo(x + width - arm, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + arm);
  // bottom-right
  ctx.moveTo(x + width, y + height - arm);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width - arm, y + height);
  // bottom-left
  ctx.moveTo(x + arm, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + height - arm);
  ctx.stroke();
}

function drawDetections(detections) {
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  ctx.lineWidth = 3;
  ctx.lineCap = 'butt';
  ctx.font = '16px Georgia, serif';

  // The video is mirrored in CSS for the selfie-facing camera, but the canvas
  // deliberately is not - mirroring the canvas would mirror the label text
  // too. Flip the box coordinates here instead so the brackets still land on
  // the right part of the mirrored image while the text stays readable.
  const mirrored = stageEl.classList.contains('perceiving-mirrored');

  detections.forEach((detection) => {
    const box = detection.boundingBox;
    const category = detection.categories[0];
    const label = `${category.categoryName} ${Math.round(category.score * 100)}%`;
    const x = mirrored ? canvasEl.width - box.originX - box.width : box.originX;
    const y = box.originY;

    ctx.strokeStyle = '#8b7355';
    drawCornerBrackets(x, y, box.width, box.height);

    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(x, y - 22, textWidth + 10, 22);
    ctx.fillStyle = '#ede8e1';
    ctx.fillText(label, x + 5, y - 6);
  });
}

// Throttle, not a trailing debounce: detectFrame calls this on every animation
// frame, so a trailing debounce would reset its own timer ~60x/second and the
// caption would never update at all during continuous detection.
function scheduleCaptionUpdate(detections) {
  latestDetections = detections;
  if (captionThrottleTimer) return;
  captionThrottleTimer = setTimeout(() => {
    captionThrottleTimer = null;
    captionEl.textContent = buildCaptionText(latestDetections);
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

function initPerceivingPage() {
  startBtn.addEventListener('click', startPerceiving);
  flipBtn.addEventListener('click', flipCamera);
}

document.addEventListener('DOMContentLoaded', initPerceivingPage);
