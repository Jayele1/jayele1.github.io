(function () {
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fxEnabled = canHover && !reducedMotion;

  document.addEventListener('DOMContentLoaded', function () {
    initCircleWords();
    if (fxEnabled) {
      initCursorTrail();
      initFrameDodge();
    }
  });

  // ---- Circled hover-words -------------------------------------------------
  // Wraps each word of matching elements' text in a <span class="cw"> so it
  // can be individually hovered: the word steps away from its neighbors and
  // a hand-drawn circle fades in around it.
  function initCircleWords() {
    var selector = [
      '#description-row h4',
      '.testContent h4'
    ].join(', ');

    document.querySelectorAll(selector).forEach(function (el) {
      wrapWords(el);
    });

    // Header: only two always-on circles, nothing else hoverable there.
    var location = document.querySelector('.simple-header .location');
    if (location) wrapWholeAsOne(location, ['cw-always', 'cw-phrase']);

    var title = document.querySelector('.simple-header .title');
    if (title) wrapSubstring(title, /perception/i, ['cw-always']);
  }

  // Wraps an element's entire text content in a single <span class="cw">,
  // so the whole phrase gets one circle instead of one per word.
  function wrapWholeAsOne(el, extraClasses) {
    var text = el.textContent;
    el.textContent = '';
    var span = document.createElement('span');
    span.className = ['cw'].concat(extraClasses || []).join(' ');
    span.textContent = text;
    el.appendChild(span);
  }

  // Wraps only the first substring of an element's text matching `regex`
  // in a <span class="cw">, leaving the rest of the text untouched (plain,
  // non-hoverable).
  function wrapSubstring(el, regex, extraClasses) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var text = node.nodeValue;
      var match = regex.exec(text);
      if (!match) continue;

      var frag = document.createDocumentFragment();
      var before = text.slice(0, match.index);
      var after = text.slice(match.index + match[0].length);

      if (before) frag.appendChild(document.createTextNode(before));

      var span = document.createElement('span');
      span.className = ['cw'].concat(extraClasses || []).join(' ');
      span.textContent = match[0];
      frag.appendChild(span);

      if (after) frag.appendChild(document.createTextNode(after));

      node.parentNode.replaceChild(frag, node);
      return span;
    }
    return null;
  }

  function wrapWords(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.trim().length) textNodes.push(node);
    }

    textNodes.forEach(function (textNode) {
      var parts = textNode.nodeValue.split(/(\s+)/); // keep whitespace tokens
      var frag = document.createDocumentFragment();

      parts.forEach(function (part) {
        if (part === '') return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else {
          var span = document.createElement('span');
          span.className = 'cw';
          span.textContent = part;
          frag.appendChild(span);
        }
      });

      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  // ---- Cursor trail ----------------------------------------------------------
  function initCursorTrail() {
    var canvas = document.createElement('canvas');
    canvas.id = 'js-cursor-trail';
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    var points = [];
    var MAX_AGE = 450; // ms

    window.addEventListener('mousemove', function (e) {
      points.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    });

    function tick() {
      var now = performance.now();
      points = points.filter(function (p) { return now - p.t < MAX_AGE; });

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (var i = 1; i < points.length; i++) {
        var p0 = points[i - 1];
        var p1 = points[i];
        var age = (now - p1.t) / MAX_AGE; // 0 = fresh, 1 = old
        var alpha = Math.max(0, 1 - age);
        var width = Math.max(0.5, 7 * (1 - age));

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = 'rgba(0, 50, 249, ' + (alpha * 0.55) + ')';
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ---- Frame dodge -------------------------------------------------------
  // Picture-frame project cards lean away from the cursor as it approaches,
  // and spring back once it moves on.
  function initFrameDodge() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.project-card'));
    if (!cards.length) return;

    cards.forEach(function (card) {
      card.classList.add('dodge-active');
    });

    var state = cards.map(function () {
      return { x: 0, y: 0, r: 0, tx: 0, ty: 0, tr: 0 };
    });

    var mouseX = -9999;
    var mouseY = -9999;
    var hasMoved = false;

    window.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      hasMoved = true;
    });

    window.addEventListener('mouseleave', function () {
      hasMoved = false;
    });

    var RADIUS = 170;
    var MAX_PUSH = 24;
    var MAX_ROT = 6;

    function frame() {
      cards.forEach(function (card, i) {
        if (!card.classList.contains('is-visible')) return;

        var s = state[i];

        if (hasMoved) {
          var rect = card.getBoundingClientRect();
          var cx = rect.left + rect.width / 2;
          var cy = rect.top + rect.height / 2;
          var dx = cx - mouseX;
          var dy = cy - mouseY;
          var dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < RADIUS) {
            var force = 1 - dist / RADIUS;
            var angle = Math.atan2(dy, dx);
            s.tx = Math.cos(angle) * force * MAX_PUSH;
            s.ty = Math.sin(angle) * force * MAX_PUSH;
            s.tr = (dx > 0 ? 1 : -1) * force * MAX_ROT;
          } else {
            s.tx = 0;
            s.ty = 0;
            s.tr = 0;
          }
        } else {
          s.tx = 0;
          s.ty = 0;
          s.tr = 0;
        }

        s.x += (s.tx - s.x) * 0.14;
        s.y += (s.ty - s.y) * 0.14;
        s.r += (s.tr - s.r) * 0.14;

        card.style.transform =
          'translate(' + s.x.toFixed(2) + 'px, ' + s.y.toFixed(2) + 'px) rotate(' + s.r.toFixed(2) + 'deg)';
      });

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
})();
