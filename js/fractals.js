(() => {
  'use strict';

  const LOGICAL_SIZE = 700;

  // More vertices means more child copies competing for the same ring of
  // space around the parent, so denser shapes get smaller children to keep
  // the self-similar gaps visible instead of solid-filling the canvas.
  function childScaleFor(vertexCount) {
    return Math.max(0.28, Math.min(0.5, 0.5 * (4 / vertexCount)));
  }

  const PALETTES = [
    { name: 'Kaleidoscope', colors: ['#3b1f66', '#a12db0', '#e0479b', '#f2a65a', '#f7e04b'] },
    { name: 'Sunset', colors: ['#2b1b4d', '#7b2d8e', '#d14081', '#f2765a', '#ffd36e'] },
    { name: 'Ocean', colors: ['#031f3a', '#0a4f6e', '#1b8a9a', '#4fc9c0', '#bdf2e3'] },
    { name: 'Forest', colors: ['#0f2e1d', '#1f5c3a', '#4f9b5c', '#9ccf72', '#e7f2a1'] },
    { name: 'Ink', colors: ['#111111', '#3a3a3a', '#6e6e6e', '#a6a6a6', '#e6e6e6'] }
  ];

  const SHAPES = {
    square: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
    triangle: angledPolygon(3, -90),
    rectangle: [[-1.3, -0.85], [1.3, -0.85], [1.3, 0.85], [-1.3, 0.85]]
  };

  function angledPolygon(sides, startDeg) {
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = ((startDeg + (360 / sides) * i) * Math.PI) / 180;
      pts.push([Math.cos(a), Math.sin(a)]);
    }
    return pts;
  }

  // Deterministic seeded PRNG (mulberry32).
  function makeRandom(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Smooth deterministic wobble, not true noise but continuous and cheap.
  function noise2D(x, y) {
    return (
      Math.sin(x * 1.3 + y * 0.7) +
      Math.sin(x * 0.6 - y * 1.1 + 2.1) +
      Math.sin(x * 2.1 + y * 1.9 + 5.3)
    ) / 3;
  }

  function hslToHex(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  function rotatePoint(x, y, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [x * c - y * s, x * s + y * c];
  }

  const state = {
    shapeKey: 'square',
    customShape: null,
    levels: 4,
    fuzz: 0,
    blend: 20,
    colors: [...PALETTES[0].colors],
    seed: 1,
    baseRotation: 0
  };

  const canvas = document.getElementById('fractal-canvas');
  const ctx = canvas.getContext('2d');
  const bufferCanvas = document.createElement('canvas');
  const bufferCtx = bufferCanvas.getContext('2d');
  const softCanvas = document.createElement('canvas');
  const softCtx = softCanvas.getContext('2d');

  let dpr = Math.max(1, window.devicePixelRatio || 1);

  function sizeCanvases() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    [canvas, bufferCanvas, softCanvas].forEach((c) => {
      c.width = LOGICAL_SIZE * dpr;
      c.height = LOGICAL_SIZE * dpr;
    });
    [ctx, bufferCtx, softCtx].forEach((c) => c.setTransform(dpr, 0, 0, dpr, 0, 0));
  }

  function currentShapeVertices() {
    if (state.shapeKey === 'custom') {
      return state.customShape || SHAPES.square;
    }
    return SHAPES[state.shapeKey];
  }

  function collectInstances(vertices) {
    const instances = [];
    const center = { x: LOGICAL_SIZE / 2, y: LOGICAL_SIZE / 2 };
    const baseSize = LOGICAL_SIZE * 0.62;
    const rand = makeRandom(state.seed);
    // Pre-roll so every level/vertex gets a stable-but-varied jitter value.
    const jitterTable = [];
    for (let i = 0; i < 4096; i++) jitterTable.push(rand());
    let jitterIndex = 0;
    const nextJitter = () => jitterTable[jitterIndex++ % jitterTable.length];

    const childScale = childScaleFor(vertices.length);

    function recurse(center, size, rotation, level) {
      instances.push({ vertices, center, size, rotation, level });
      if (level >= state.levels) return;
      for (let i = 0; i < vertices.length; i++) {
        const [vx, vy] = vertices[i];
        const [rx, ry] = rotatePoint(vx, vy, rotation);
        const childCenter = {
          x: center.x + rx * size * childScale,
          y: center.y + ry * size * childScale
        };
        const childSize = size * childScale;
        const wobble = (nextJitter() - 0.5) * (state.fuzz / 100) * 0.5;
        recurse(childCenter, childSize, rotation + wobble, level + 1);
      }
    }

    recurse(center, baseSize, state.baseRotation, 0);
    return instances;
  }

  function shapePath(targetCtx, vertices, center, size, rotation, fuzzAmount, seedOffset) {
    const n = vertices.length;
    const subdiv = fuzzAmount > 0 ? 6 : 1;
    targetCtx.beginPath();
    for (let i = 0; i <= n * subdiv; i++) {
      const segIndex = Math.floor(i / subdiv) % n;
      const nextIndex = (segIndex + 1) % n;
      const t = (i % subdiv) / subdiv;
      const p0 = vertices[segIndex];
      const p1 = vertices[nextIndex];
      let x = p0[0] + (p1[0] - p0[0]) * t;
      let y = p0[1] + (p1[1] - p0[1]) * t;
      if (fuzzAmount > 0) {
        const strength = (fuzzAmount / 100) * 0.22;
        x += noise2D(x * 3 + seedOffset, y * 3 + seedOffset) * strength;
        y += noise2D(y * 3 + seedOffset + 50, x * 3 + seedOffset + 50) * strength;
      }
      const [rx, ry] = rotatePoint(x, y, rotation);
      const px = center.x + rx * size * 0.5;
      const py = center.y + ry * size * 0.5;
      if (i === 0) targetCtx.moveTo(px, py);
      else targetCtx.lineTo(px, py);
    }
    targetCtx.closePath();
  }

  function paintInstances(targetCtx, instances, colors) {
    targetCtx.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    const sorted = [...instances].sort((a, b) => a.level - b.level);
    sorted.forEach((inst, idx) => {
      shapePath(targetCtx, inst.vertices, inst.center, inst.size, inst.rotation, state.fuzz, state.seed + idx * 0.37);
      targetCtx.fillStyle = colors[inst.level % colors.length];
      targetCtx.fill();
    });
  }

  function addGrain(targetCtx, amount) {
    if (amount <= 0) return;
    const rand = makeRandom(state.seed + 999);
    const dotCount = Math.round((amount / 100) * 1400);
    targetCtx.save();
    for (let i = 0; i < dotCount; i++) {
      const x = rand() * LOGICAL_SIZE;
      const y = rand() * LOGICAL_SIZE;
      const r = rand() * 1.6 + 0.3;
      targetCtx.globalAlpha = rand() * 0.18 * (amount / 100);
      targetCtx.fillStyle = rand() > 0.5 ? '#000000' : '#ffffff';
      targetCtx.beginPath();
      targetCtx.arc(x, y, r, 0, Math.PI * 2);
      targetCtx.fill();
    }
    targetCtx.restore();
  }

  function render() {
    const vertices = currentShapeVertices();
    const instances = collectInstances(vertices);
    const colors = state.colors;

    ctx.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);

    paintInstances(bufferCtx, instances, colors);

    // Backdrop: a zoomed-in, blurred echo of the same artwork behind itself,
    // instead of flat white filling the gaps between shapes.
    const zoom = 1.8;
    const zoomSize = LOGICAL_SIZE * zoom;
    const zoomOffset = -(zoomSize - LOGICAL_SIZE) / 2;
    ctx.save();
    ctx.filter = 'blur(22px)';
    ctx.globalAlpha = 0.55;
    ctx.drawImage(bufferCanvas, zoomOffset, zoomOffset, zoomSize, zoomSize);
    ctx.restore();

    const blurPx = (state.blend / 100) * 18;
    softCtx.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    softCtx.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
    softCtx.drawImage(bufferCanvas, 0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    softCtx.filter = 'none';

    ctx.drawImage(softCanvas, 0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    const sharpAlpha = 1 - (state.blend / 100) * 0.55;
    ctx.save();
    ctx.globalAlpha = sharpAlpha;
    ctx.drawImage(bufferCanvas, 0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    ctx.restore();

    addGrain(ctx, state.fuzz);
  }

  // --- UI wiring ---

  function setActiveShapeButton() {
    document.querySelectorAll('.shape-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.shape === state.shapeKey);
    });
  }

  function buildPaletteButtons() {
    const wrap = document.getElementById('palette-buttons');
    wrap.innerHTML = '';
    PALETTES.forEach((palette) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'palette-btn';
      btn.title = palette.name;
      btn.setAttribute('aria-label', `Load ${palette.name} palette`);
      const grad = `linear-gradient(135deg, ${palette.colors.join(', ')})`;
      btn.innerHTML = `<span style="background:${grad}"></span>`;
      btn.addEventListener('click', () => {
        state.colors = [...palette.colors];
        buildColorSwatches();
        render();
      });
      wrap.appendChild(btn);
    });
  }

  const MIN_COLORS = 2;
  const MAX_COLORS = 8;

  function buildColorSwatches() {
    const wrap = document.getElementById('color-swatches');
    wrap.innerHTML = '';
    state.colors.forEach((hex, idx) => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';

      const input = document.createElement('input');
      input.type = 'color';
      input.value = hex;
      input.setAttribute('aria-label', `Color ${idx + 1}`);
      input.addEventListener('input', () => {
        state.colors[idx] = input.value;
        render();
      });
      swatch.appendChild(input);

      if (state.colors.length > MIN_COLORS) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'color-swatch-remove';
        removeBtn.setAttribute('aria-label', `Remove color ${idx + 1}`);
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
          state.colors.splice(idx, 1);
          buildColorSwatches();
          render();
        });
        swatch.appendChild(removeBtn);
      }

      wrap.appendChild(swatch);
    });

    document.getElementById('add-color-btn').classList.toggle('hide', state.colors.length >= MAX_COLORS);
  }

  function resampleToPolygon(points, targetCount) {
    // Arc-length resample so a messy freehand path becomes a tidy N-gon.
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

  function normalizeDrawnShape(rawPoints) {
    if (rawPoints.length < 3) return null;
    const resampled = resampleToPolygon(rawPoints, 8);
    const cx = resampled.reduce((s, p) => s + p.x, 0) / resampled.length;
    const cy = resampled.reduce((s, p) => s + p.y, 0) / resampled.length;
    let maxDist = 0;
    resampled.forEach((p) => {
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d > maxDist) maxDist = d;
    });
    if (maxDist < 1) return null;
    return resampled.map((p) => [(p.x - cx) / maxDist, (p.y - cy) / maxDist]);
  }

  // --- Freehand drawing mode ---

  let drawing = false;
  let drawPoints = [];
  const drawHint = document.getElementById('draw-hint');
  const clearDrawBtn = document.getElementById('clear-draw-btn');

  function logicalPointFromEvent(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_SIZE / rect.width;
    const scaleY = LOGICAL_SIZE / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY
    };
  }

  function enterDrawMode() {
    canvas.classList.add('is-drawable');
    drawHint.classList.remove('hide');
    clearDrawBtn.classList.remove('hide');
  }

  function exitDrawMode() {
    canvas.classList.remove('is-drawable');
    drawHint.classList.add('hide');
    clearDrawBtn.classList.add('hide');
  }

  function drawLivePath() {
    ctx.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
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

  canvas.addEventListener('pointerdown', (evt) => {
    if (state.shapeKey !== 'custom') return;
    drawing = true;
    drawPoints = [logicalPointFromEvent(evt)];
    canvas.setPointerCapture(evt.pointerId);
  });

  canvas.addEventListener('pointermove', (evt) => {
    if (!drawing) return;
    drawPoints.push(logicalPointFromEvent(evt));
    drawLivePath();
  });

  function finishDrawing() {
    if (!drawing) return;
    drawing = false;
    const shape = normalizeDrawnShape(drawPoints);
    if (shape) state.customShape = shape;
    render();
  }

  canvas.addEventListener('pointerup', finishDrawing);
  canvas.addEventListener('pointerleave', () => {
    if (drawing) finishDrawing();
  });

  clearDrawBtn.addEventListener('click', () => {
    state.customShape = null;
    drawPoints = [];
    ctx.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
  });

  // --- Controls ---

  document.querySelectorAll('.shape-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.shapeKey = btn.dataset.shape;
      setActiveShapeButton();
      if (state.shapeKey === 'custom') {
        enterDrawMode();
        if (!state.customShape) {
          ctx.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
          return;
        }
      } else {
        exitDrawMode();
      }
      render();
    });
  });

  const levelsSlider = document.getElementById('levels-slider');
  const levelsValue = document.getElementById('levels-value');
  levelsSlider.addEventListener('input', () => {
    state.levels = Number(levelsSlider.value);
    levelsValue.textContent = String(state.levels);
    render();
  });

  const fuzzSlider = document.getElementById('fuzz-slider');
  const fuzzValue = document.getElementById('fuzz-value');
  fuzzSlider.addEventListener('input', () => {
    state.fuzz = Number(fuzzSlider.value);
    fuzzValue.textContent = String(state.fuzz);
    render();
  });

  const blendSlider = document.getElementById('blend-slider');
  const blendValue = document.getElementById('blend-value');
  blendSlider.addEventListener('input', () => {
    state.blend = Number(blendSlider.value);
    blendValue.textContent = String(state.blend);
    render();
  });

  document.getElementById('add-color-btn').addEventListener('click', () => {
    if (state.colors.length >= MAX_COLORS) return;
    state.colors.push(hslToHex(Math.random() * 360, 0.65, 0.55));
    buildColorSwatches();
    render();
  });

  document.getElementById('randomize-btn').addEventListener('click', () => {
    state.seed = Math.floor(Math.random() * 1e9);
    state.baseRotation = Math.random() * Math.PI * 2;
    // Spread hues widely around a random starting point for variety, rather
    // than cycling through the same few preset palettes.
    const count = state.colors.length;
    const hueStart = Math.random() * 360;
    state.colors = Array.from({ length: count }, (_, i) =>
      hslToHex(
        (hueStart + (i * 360) / count + (Math.random() - 0.5) * 20) % 360,
        0.55 + Math.random() * 0.35,
        0.3 + (i / Math.max(count - 1, 1)) * 0.45
      )
    );
    buildColorSwatches();
    render();
  });

  document.getElementById('export-btn').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `fractal-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  // --- Init ---

  sizeCanvases();
  buildPaletteButtons();
  buildColorSwatches();
  setActiveShapeButton();
  render();

  window.addEventListener('resize', () => {
    sizeCanvases();
    render();
  });
})();
