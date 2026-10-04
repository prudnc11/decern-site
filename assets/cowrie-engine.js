/**
 * cowrie-engine.js
 * Interactive dot-particle cowrie shell for the #engine title band.
 * Vanilla JS, no dependencies. Loaded with defer.
 */

/* ── Tunables ─────────────────────────────────────────── */
var SAMPLE_GAP      = 10;    // px between grid samples in the 1200×1050 source
var SCAN_INTERVAL   = 5500;  // ms between scan-line sweeps
var SCAN_DURATION   = 1400;  // ms for one left-to-right sweep
var SCAN_WIDTH      = 40;    // px width of the soft highlight band
var SCAN_GROW       = 0.15;  // fractional radius boost while the scan passes
var SCAN_DECAY      = 0.0115;// exponential decay rate (per ms) for scan boost
var REPEL_RADIUS    = 90;    // px — pointer repulsion range (canvas coords)
var REPEL_FORCE     = 14;    // px — maximum push distance
var FLOAT_AMP       = 6;     // px — vertical bob amplitude
var FLOAT_PERIOD    = 6000;  // ms — one bob cycle
var SHIMMER_AMP     = 0.12;  // ± brightness fraction per particle
var ASSEMBLE_DUR    = 900;   // ms — fly-in ease duration
var ASSEMBLE_SPREAD = 300;   // px — max random offset from home at start
var ASSEMBLE_DELAY  = 250;   // ms — max random stagger per particle
var SPRING_K        = 0.08;  // spring stiffness for pointer rebound
var SPRING_DAMP     = 0.75;  // velocity damping per frame
var SRC_W           = 1200;
var SRC_H           = 1050;
var DISPLAY_W       = 640;
var DISPLAY_H       = Math.round(DISPLAY_W * SRC_H / SRC_W); // 560
var TAU             = Math.PI * 2;

(function () {
  'use strict';

  /* ── Bail on reduced motion ── */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ── DOM refs ── */
  var band = document.querySelector('#engine > div:first-child');
  if (!band) return;
  var heroImg = band.querySelector('img');
  var h2 = band.querySelector('h2.giant');
  if (!heroImg || !h2) return;

  /* ── Device ── */
  var DPR = devicePixelRatio || 1;
  var isMobile = innerWidth < 760;
  var finePointer = matchMedia('(pointer: fine)').matches;
  var gap = isMobile ? Math.round(SAMPLE_GAP * 1.5) : SAMPLE_GAP;

  /* ── Canvas ── */
  var cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText =
    'position:absolute;left:38%;top:-170px;' +
    'width:' + DISPLAY_W + 'px;height:' + DISPLAY_H + 'px;' +
    'pointer-events:none;transform:rotate(-12deg);will-change:transform;';
  cv.width = DISPLAY_W * DPR;
  cv.height = DISPLAY_H * DPR;
  band.insertBefore(cv, heroImg);
  heroImg.style.display = 'none';

  var ctx = cv.getContext('2d');
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  /* ── H2 reveal: wrap " engine" in a span ── */
  var serifSpan = h2.querySelector('.serif');
  var engineSpan = null;
  var nodes = h2.childNodes;
  for (var ni = 0; ni < nodes.length; ni++) {
    if (nodes[ni].nodeType === 3 && nodes[ni].textContent.indexOf('engine') !== -1) {
      var space = document.createTextNode(' ');
      engineSpan = document.createElement('span');
      engineSpan.textContent = 'engine';
      h2.replaceChild(engineSpan, nodes[ni]);
      h2.insertBefore(space, engineSpan);
      break;
    }
  }

  /* Initial hidden state for both text spans */
  function hideSpan(el, delay) {
    el.style.display = 'inline-block';
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = 'opacity 600ms ease, transform 600ms ease';
    if (delay) el.style.transitionDelay = delay + 'ms';
  }
  hideSpan(serifSpan, 0);
  if (engineSpan) hideSpan(engineSpan, 120);
  h2.style.zIndex = '2';

  /* ── State ── */
  var particles = [];
  var assembled = false;
  var assembleT0 = 0;
  var lastScanT = 0;
  var pointerX = -9999, pointerY = -9999;
  var bandTop = 0, bandH = 300, viewH = innerHeight;
  var isVisible = false;
  var loopId = 0;
  var prevNow = 0;

  /* ── Helpers ── */
  function easeOutCubic(t) {
    var inv = 1 - t;
    return 1 - inv * inv * inv;
  }

  var resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(cacheLayout, 200);
  }
  function cacheLayout() {
    var r = band.getBoundingClientRect();
    bandTop = r.top + scrollY;
    bandH = r.height;
    viewH = innerHeight;
  }

  /* ── Load image → build particles ── */
  var srcImg = new Image();
  srcImg.onload = function () {
    var oc = document.createElement('canvas');
    oc.width = SRC_W; oc.height = SRC_H;
    var ox = oc.getContext('2d');
    ox.drawImage(srcImg, 0, 0, SRC_W, SRC_H);
    var px = ox.getImageData(0, 0, SRC_W, SRC_H).data;
    var scale = DISPLAY_W / SRC_W;

    for (var sy = 0; sy < SRC_H; sy += gap) {
      for (var sx = 0; sx < SRC_W; sx += gap) {
        var i = (sy * SRC_W + sx) * 4;
        var r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
        if (a < 26) continue; // skip alpha < ~0.1

        var lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        var hx = sx * scale, hy = sy * scale;
        var baseR = Math.max(0.6, lum * 3 * scale);

        particles.push({
          hx: hx, hy: hy,
          x: hx, y: hy,
          vx: 0, vy: 0,
          r: r, g: g, b: b, a: a,
          br: baseR,
          sp: Math.random() * TAU,
          ss: 0.5 + Math.random() * 1.5,
          dl: Math.random() * ASSEMBLE_DELAY,
          ox: hx + (Math.random() - 0.5) * ASSEMBLE_SPREAD * 2,
          oy: hy + (Math.random() - 0.5) * ASSEMBLE_SPREAD * 2,
          sb: 0,
          done: false
        });
      }
    }

    cacheLayout();
    addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', checkRun);

    /* Intersection observer — triggers assembly once, tracks visibility */
    var obs = new IntersectionObserver(function (entries) {
      for (var e = 0; e < entries.length; e++) {
        isVisible = entries[e].isIntersecting;
        if (isVisible && !assembled) {
          assembled = true;
          assembleT0 = performance.now();
          lastScanT = assembleT0; // first scan after SCAN_INTERVAL
          requestAnimationFrame(function () {
            serifSpan.style.opacity = '1';
            serifSpan.style.transform = 'translateY(0)';
            if (engineSpan) {
              engineSpan.style.opacity = '1';
              engineSpan.style.transform = 'translateY(0)';
            }
          });
        }
      }
      checkRun();
    }, { threshold: 0.3 });
    obs.observe(band);

    /* Pointer tracking (fine pointer only) */
    if (finePointer) {
      band.addEventListener('mousemove', function (e) {
        var rect = cv.getBoundingClientRect();
        if (rect.width === 0) return;
        pointerX = (e.clientX - rect.left) * (DISPLAY_W / rect.width);
        pointerY = (e.clientY - rect.top) * (DISPLAY_H / rect.height);
      });
      band.addEventListener('mouseleave', function () {
        pointerX = pointerY = -9999;
      });
    }
  };
  srcImg.src = '/assets/cowrie-hero.webp';

  /* ── Loop control ── */
  function checkRun() {
    var should = isVisible && !document.hidden && particles.length > 0;
    if (should && !loopId) {
      prevNow = performance.now();
      loopId = requestAnimationFrame(frame);
    }
    if (!should && loopId) {
      cancelAnimationFrame(loopId);
      loopId = 0;
    }
  }

  /* ── Render frame ── */
  function frame(now) {
    loopId = 0;
    if (!isVisible || document.hidden) return;

    /* 60fps cap */
    var dt = now - prevNow;
    if (dt < 15) { loopId = requestAnimationFrame(frame); return; }
    prevNow = now;

    /* ── Scroll-linked values ── */
    var sy = scrollY;
    var scrolled = sy - bandTop + viewH;
    var progress = Math.max(0, Math.min(1, scrolled / (viewH + bandH)));
    var angle = -18 + progress * 12;               // -18deg → -6deg
    var parallaxY = (progress - 0.5) * bandH * 0.15;

    /* ── Idle float ── */
    var floatY = FLOAT_AMP * Math.sin(now / FLOAT_PERIOD * TAU);

    cv.style.transform =
      'rotate(' + angle.toFixed(2) + 'deg) translateY(' +
      (parallaxY + floatY).toFixed(1) + 'px)';

    /* ── Scan line ── */
    var scanActive = false, scanPos = -1;
    if (assembled && now - lastScanT > SCAN_INTERVAL) lastScanT = now;
    var scanElapsed = now - lastScanT;
    if (scanElapsed < SCAN_DURATION) {
      scanActive = true;
      scanPos = (scanElapsed / SCAN_DURATION) * DISPLAY_W;
    }

    /* ── Clear canvas ── */
    ctx.clearRect(0, 0, DISPLAY_W, DISPLAY_H);

    /* ── Draw particles ── */
    var halfScan = SCAN_WIDTH / 2;
    var decayFactor = Math.exp(-dt * SCAN_DECAY);
    var len = particles.length;

    for (var i = 0; i < len; i++) {
      var p = particles[i];

      /* --- Assembly phase --- */
      if (!p.done) {
        if (!assembled) continue; // not triggered yet
        var elapsed = now - assembleT0 - p.dl;
        if (elapsed < 0) continue; // still in stagger delay
        if (elapsed < ASSEMBLE_DUR) {
          var t = easeOutCubic(elapsed / ASSEMBLE_DUR);
          p.x = p.ox + (p.hx - p.ox) * t;
          p.y = p.oy + (p.hy - p.oy) * t;
          // Draw with fade-in opacity
          ctx.globalAlpha = t * (p.a / 255);
          ctx.fillStyle = 'rgb(' + p.r + ',' + p.g + ',' + p.b + ')';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.br, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }
        // Assembly complete for this particle
        p.done = true;
        p.x = p.hx; p.y = p.hy;
        p.vx = 0; p.vy = 0;
      }

      /* --- Post-assembly: spring physics --- */
      var tx = p.hx, ty = p.hy;

      // Pointer repulsion
      var dx = p.hx - pointerX, dy = p.hy - pointerY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < REPEL_RADIUS && dist > 0.1) {
        var push = (1 - dist / REPEL_RADIUS) * REPEL_FORCE;
        tx = p.hx + (dx / dist) * push;
        ty = p.hy + (dy / dist) * push;
      }

      p.vx = (p.vx + (tx - p.x) * SPRING_K) * SPRING_DAMP;
      p.vy = (p.vy + (ty - p.y) * SPRING_K) * SPRING_DAMP;
      p.x += p.vx;
      p.y += p.vy;

      /* --- Shimmer --- */
      var bright = 1 + SHIMMER_AMP * Math.sin(now / 1000 * p.ss + p.sp);

      /* --- Scan boost --- */
      if (scanActive) {
        var sd = Math.abs(p.hx - scanPos);
        if (sd < halfScan) {
          var boost = 1 - sd / halfScan;
          if (boost > p.sb) p.sb = boost;
        }
      }
      if (p.sb > 0.005) p.sb *= decayFactor; else p.sb = 0;

      /* --- Final colour and radius --- */
      var rad = p.br * (1 + p.sb * SCAN_GROW);
      var sb = p.sb;
      // Push colour toward white during scan
      var fr = Math.min(255, p.r * bright + sb * (255 - p.r) * 0.6);
      var fg = Math.min(255, p.g * bright + sb * (255 - p.g) * 0.6);
      var fb = Math.min(255, p.b * bright + sb * (255 - p.b) * 0.6);

      ctx.globalAlpha = p.a / 255;
      ctx.fillStyle = 'rgb(' + (fr | 0) + ',' + (fg | 0) + ',' + (fb | 0) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    /* ── Scan glow overlay ── */
    if (scanActive) {
      var grad = ctx.createLinearGradient(
        scanPos - halfScan, 0, scanPos + halfScan, 0);
      grad.addColorStop(0, 'rgba(164,211,241,0)');
      grad.addColorStop(0.5, 'rgba(164,211,241,0.05)');
      grad.addColorStop(1, 'rgba(164,211,241,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(scanPos - halfScan, 0, SCAN_WIDTH, DISPLAY_H);
    }

    loopId = requestAnimationFrame(frame);
  }
})();
