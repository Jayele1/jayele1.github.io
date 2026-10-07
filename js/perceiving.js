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
