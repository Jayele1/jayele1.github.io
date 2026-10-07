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
