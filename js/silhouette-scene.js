'use strict';

// --- Three.js scene bootstrap + hollow lathe mesh builder ---
//
// This file owns the Three.js engine (scene/camera/lights/mesh/material) for
// the Silhouette page. Drawing/pointer-capture logic lives in js/silhouette.js.

(() => {
  const LATHE_SEGMENTS = 48;
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

  let scene = null;
  let camera = null;
  let renderer = null;
  let container = null;
  let currentMesh = null;

  function render() {
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
  }

  function animate() {
    render();
    requestAnimationFrame(animate);
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

    requestAnimationFrame(animate);
  }

  function buildMesh(profile) {
    const points = profile.map((p) => new THREE.Vector2(p.radius, p.height));
    const geometry = new THREE.LatheGeometry(points, LATHE_SEGMENTS);
    const material = new THREE.MeshStandardMaterial({
      color: MESH_COLOR,
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
    return currentMesh;
  }

  window.SilhouetteScene = { init, buildMesh };

  // --- Debug harness (Tasks 3-5 only) ---
  //
  // Independently checkable without depending on js/silhouette.js at all:
  // a hardcoded literal sample profile, not computed via any shared
  // function. Task 4 extends this to call showProfile instead of buildMesh
  // directly; Task 5 reuses it unchanged; Task 6 removes it once real
  // drawing is wired to the same call.
  if (typeof window !== 'undefined' && /(?:^|[?&])debug=1(?:&|$)/.test(window.location.search)) {
    const debugContainer = document.getElementById('silhouette-scene-container');
    const debugCanvas = document.getElementById('silhouette-draw-canvas');
    if (debugContainer) {
      debugContainer.classList.remove('hide');
      init(debugContainer, debugCanvas);
      buildMesh([
        { radius: 0.15, height: 0 },
        { radius: 0.45, height: 0.5 },
        { radius: 0.3, height: 1.1 },
        { radius: 0.55, height: 2 }
      ]);
    }
  }
})();
