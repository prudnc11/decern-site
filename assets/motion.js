/**
 * motion.js — Calm, precise motion layer for Decern.
 * Vanilla JS, no dependencies. Loaded with defer.
 */
(function () {
  'use strict';

  /* ── Progressive enhancement gate ── */
  document.documentElement.classList.add('motion');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = matchMedia('(pointer: fine)').matches;

  /* ── Refs ── */
  var header = document.querySelector('header[data-header]');
  var navlinks = document.querySelectorAll('.navlink[href^="#"]');
  var sections = [];
  navlinks.forEach(function (a) {
    var id = a.getAttribute('href').slice(1);
    var el = document.getElementById(id);
    if (el) sections.push({ id: id, el: el, link: a });
  });

  /* ══════════════════════════════════════
     1. SCROLL PROGRESS BAR
     ══════════════════════════════════════ */
  var progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress';
  progressBar.setAttribute('aria-hidden', 'true');
  document.body.prepend(progressBar);

  /* ══════════════════════════════════════
     2. STICKY HEADER — hide on down, show on up
     ══════════════════════════════════════ */
  var lastScrollY = 0;
  var headerH = header ? header.offsetHeight : 68;
  var scrollTicking = false;

  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      var sy = window.scrollY;
      var docH = document.documentElement.scrollHeight - window.innerHeight;

      /* Progress bar */
      if (docH > 0) progressBar.style.transform = 'scaleX(' + (sy / docH) + ')';

      /* Header */
      if (header) {
        if (sy > 24) header.classList.add('scrolled');
        else header.classList.remove('scrolled');

        if (sy > lastScrollY && sy > headerH + 50) header.classList.add('hidden');
        else header.classList.remove('hidden');
      }

      /* Active nav */
      var active = '';
      for (var i = sections.length - 1; i >= 0; i--) {
        if (sections[i].el.getBoundingClientRect().top <= headerH + 40) {
          active = sections[i].id;
          break;
        }
      }
      navlinks.forEach(function (a) {
        if (a.getAttribute('href') === '#' + active) a.classList.add('active');
        else a.classList.remove('active');
      });

      lastScrollY = sy;
      scrollTicking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ══════════════════════════════════════
     3. REVEAL OBSERVER
     ══════════════════════════════════════ */
  var revealEls = document.querySelectorAll(
    '[data-reveal],[data-stagger],[data-countup]'
  );

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.getAttribute('data-delay') || '0', 10);

        setTimeout(function () {
          el.classList.add('revealed');

          /* Stagger children */
          if (el.hasAttribute('data-stagger')) {
            var children = el.children;
            var stagger = parseInt(getComputedStyle(el).getPropertyValue('--stagger') || '70', 10);
            var maxTotal = 600;
            var perChild = Math.min(stagger, Math.floor(maxTotal / Math.max(children.length - 1, 1)));
            for (var i = 0; i < children.length; i++) {
              children[i].style.transitionDelay = (i * perChild) + 'ms';
            }
          }

          /* Count-up */
          if (el.hasAttribute('data-countup')) {
            animateCountUp(el);
          }
        }, delay);

        observer.unobserve(el);
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
  );

  revealEls.forEach(function (el) { observer.observe(el); });

  /* ══════════════════════════════════════
     4. MASK REVEAL — split heading into lines
     ══════════════════════════════════════ */
  var maskEls = document.querySelectorAll('[data-reveal="mask"]');

  maskEls.forEach(function (heading) {
    /* Collect child nodes, wrap text runs + inline elements into line spans */
    var nodes = Array.from(heading.childNodes);
    var serifSpan = heading.querySelector('.serif');
    heading.innerHTML = '';

    /* Rebuild as mask lines */
    var currentLine = null;
    nodes.forEach(function (node) {
      if (node.nodeType === 3) {
        /* Text node — split on <br> isn't needed here; just wrap */
        var text = node.textContent;
        if (!text.trim()) return;
        /* Split by explicit \n or <br> */
        if (!currentLine) {
          currentLine = makeMaskLine();
          heading.appendChild(currentLine);
        }
        var inner = currentLine.querySelector('.mask-inner');
        inner.appendChild(document.createTextNode(text));
      } else if (node.nodeName === 'BR') {
        currentLine = null; /* next content goes to a new line */
      } else if (node.nodeName === 'SPAN' || node.nodeName === 'A') {
        if (!currentLine) {
          currentLine = makeMaskLine();
          heading.appendChild(currentLine);
        }
        var inner = currentLine.querySelector('.mask-inner');
        /* If this is the serif span, add serif-reveal class */
        if (node.classList && node.classList.contains('serif')) {
          node.classList.add('serif-reveal');
        }
        inner.appendChild(node);
      } else {
        if (!currentLine) {
          currentLine = makeMaskLine();
          heading.appendChild(currentLine);
        }
        var inner = currentLine.querySelector('.mask-inner');
        inner.appendChild(node);
      }
    });

    /* Observe the heading for reveal */
    var baseDelay = parseInt(heading.getAttribute('data-delay') || '0', 10);
    var maskObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var lines = heading.querySelectorAll('.mask-inner');
          var serifEl = heading.querySelector('.serif-reveal');
          lines.forEach(function (line, i) {
            setTimeout(function () {
              line.classList.add('revealed');
            }, baseDelay + i * 90);
          });
          /* Serif accent arrives last */
          if (serifEl) {
            var serifDelay = baseDelay + lines.length * 90 + 120;
            setTimeout(function () {
              serifEl.classList.add('revealed');
            }, serifDelay);
          }
          maskObserver.unobserve(heading);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );
    maskObserver.observe(heading);
  });

  function makeMaskLine() {
    var outer = document.createElement('span');
    outer.className = 'mask-line';
    var inner = document.createElement('span');
    inner.className = 'mask-inner';
    outer.appendChild(inner);
    return outer;
  }

  /* ══════════════════════════════════════
     5. PAGE LOAD — hero sequence
     ══════════════════════════════════════ */
  var heroEls = document.querySelectorAll('[data-hero]');

  function runHeroSequence() {
    heroEls.forEach(function (el) {
      var delay = parseInt(el.getAttribute('data-hero-delay') || '0', 10);
      setTimeout(function () { el.classList.add('revealed'); }, delay);
    });

    /* Hero h1 mask reveal */
    var heroH1 = document.querySelector('#top h1[data-reveal="mask"]');
    if (heroH1) {
      var lines = heroH1.querySelectorAll('.mask-inner');
      var serifEl = heroH1.querySelector('.serif-reveal');
      lines.forEach(function (line, i) {
        setTimeout(function () { line.classList.add('revealed'); }, 280 + i * 90);
      });
      if (serifEl) {
        setTimeout(function () { serifEl.classList.add('revealed'); }, 280 + lines.length * 90 + 120);
      }
    }
  }

  /* Wait for fonts, max 600ms */
  var fontTimer = setTimeout(runHeroSequence, 600);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      clearTimeout(fontTimer);
      runHeroSequence();
    });
  }

  /* ══════════════════════════════════════
     6. COUNT-UP ANIMATION
     ══════════════════════════════════════ */
  function animateCountUp(el) {
    if (reduced) return; /* show final value immediately */
    var text = el.textContent.trim();
    /* Parse: extract leading symbol, number, trailing text */
    var match = text.match(/^([^\d]*)([\d,.]+)(.*)$/);
    if (!match) return;
    var prefix = match[1];
    var numStr = match[2];
    var suffix = match[3];
    var hasComma = numStr.indexOf(',') !== -1;
    var hasDot = numStr.indexOf('.') !== -1 && !hasComma;
    var target = parseFloat(numStr.replace(/,/g, ''));
    if (isNaN(target)) return;
    var decimals = hasDot ? (numStr.split('.')[1] || '').length : 0;

    var start = performance.now();
    var dur = 1200;

    function tick(now) {
      var t = Math.min(1, (now - start) / dur);
      /* ease-out cubic */
      var inv = 1 - t;
      var eased = 1 - inv * inv * inv;
      var val = target * eased;
      var formatted = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toString();
      if (hasComma) formatted = Number(formatted).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      el.textContent = prefix + formatted + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ══════════════════════════════════════
     7. LAZY IMAGE DECODE FADE
     ══════════════════════════════════════ */
  document.querySelectorAll('img[loading="lazy"]').forEach(function (img) {
    if (img.complete) { img.classList.add('decoded'); return; }
    img.addEventListener('load', function () {
      if (img.decode) {
        img.decode().then(function () { img.classList.add('decoded'); })
          .catch(function () { img.classList.add('decoded'); });
      } else {
        img.classList.add('decoded');
      }
    });
  });

  /* ══════════════════════════════════════
     8. POINTER EFFECTS (fine pointer only)
     ══════════════════════════════════════ */
  if (finePointer && !reduced) {

    /* ── Hero cowrie pointer parallax + radial light ── */
    var heroSection = document.getElementById('top');
    var heroImg = heroSection ? heroSection.querySelector('img') : null;
    var heroOverlay = null;
    var hpx = 0, hpy = 0, hcx = 0, hcy = 0;

    if (heroSection && heroImg) {
      heroOverlay = document.createElement('div');
      heroOverlay.setAttribute('aria-hidden', 'true');
      heroOverlay.style.cssText =
        'position:absolute;inset:0;pointer-events:none;opacity:0;' +
        'transition:opacity 400ms ease;';
      heroSection.style.position = 'relative';
      heroSection.appendChild(heroOverlay);

      heroSection.addEventListener('mouseenter', function () {
        heroOverlay.style.opacity = '1';
      });
      heroSection.addEventListener('mouseleave', function () {
        heroOverlay.style.opacity = '0';
        hpx = hpy = 0;
      });
      heroSection.addEventListener('mousemove', function (e) {
        var rect = heroSection.getBoundingClientRect();
        hpx = e.clientX - rect.left;
        hpy = e.clientY - rect.top;
      });
    }

    /* ── Card cursor-following radial highlight ── */
    var glowCards = document.querySelectorAll('.card, .snippet');
    glowCards.forEach(function (card) {
      var glow = document.createElement('div');
      glow.setAttribute('aria-hidden', 'true');
      glow.style.cssText =
        'position:absolute;inset:0;pointer-events:none;opacity:0;' +
        'border-radius:inherit;transition:opacity 300ms ease;';
      card.style.position = 'relative';
      card.style.overflow = 'hidden';
      card.appendChild(glow);

      card.addEventListener('mouseenter', function () { glow.style.opacity = '1'; });
      card.addEventListener('mouseleave', function () { glow.style.opacity = '0'; });
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = e.clientX - r.left;
        var y = e.clientY - r.top;
        glow.style.background =
          'radial-gradient(320px circle at ' + x + 'px ' + y + 'px,' +
          'rgba(164,211,241,0.08),transparent)';
      });
    });

    /* ── Magnetic primary buttons ── */
    document.querySelectorAll('.btn-primary').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        var dx = (e.clientX - cx) / (r.width / 2) * 4;
        var dy = (e.clientY - cy) / (r.height / 2) * 4;
        btn.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
      });
      btn.addEventListener('mouseleave', function () {
        btn.style.transform = '';
      });
    });

    /* ── rAF loop for hero pointer lerp ── */
    var heroRAF = 0;
    function heroPointerLoop() {
      if (heroOverlay) {
        hcx += (hpx - hcx) * 0.08;
        hcy += (hpy - hcy) * 0.08;
        heroOverlay.style.background =
          'radial-gradient(280px circle at ' + hcx.toFixed(0) + 'px ' + hcy.toFixed(0) + 'px,' +
          'rgba(164,211,241,0.06),transparent)';
        /* Parallax the cowrie image */
        if (heroImg) {
          var px = (hcx / (heroSection.offsetWidth || 1) - 0.5) * -8;
          var py = (hcy / (heroSection.offsetHeight || 1) - 0.5) * -8;
          heroImg.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)';
        }
      }
      heroRAF = requestAnimationFrame(heroPointerLoop);
    }
    heroRAF = requestAnimationFrame(heroPointerLoop);
  }

  /* ══════════════════════════════════════
     9. FOOTER WORDMARK LIGHT-UP
     ══════════════════════════════════════ */
  var wordmark = document.querySelector('.dotword');
  if (wordmark) {
    var wmObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        wordmark.style.transition = 'none';
        wordmark.style.backgroundSize = '9px 9px';
        /* Column-by-column via a mask sweep */
        wordmark.style.webkitMaskImage =
          'linear-gradient(to right, #000 0%, #000 0%, transparent 0%, transparent 100%)';
        wordmark.style.maskImage =
          'linear-gradient(to right, #000 0%, #000 0%, transparent 0%, transparent 100%)';

        var start = performance.now();
        var dur = 900;
        function sweep(now) {
          var t = Math.min(1, (now - start) / dur);
          /* ease-inout */
          var eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          var pct = (eased * 110).toFixed(1); /* overshoot to 110% to fully reveal */
          var mask = 'linear-gradient(to right, #000 0%, #000 ' + pct + '%, transparent ' + (parseFloat(pct) + 5) + '%, transparent 100%)';
          wordmark.style.webkitMaskImage = mask;
          wordmark.style.maskImage = mask;
          if (t < 1) requestAnimationFrame(sweep);
          else {
            wordmark.style.webkitMaskImage = 'none';
            wordmark.style.maskImage = 'none';
          }
        }
        if (!reduced) requestAnimationFrame(sweep);
        wmObserver.unobserve(wordmark);
      });
    }, { threshold: 0.2 });
    wmObserver.observe(wordmark);

    /* Fine pointer dot brightness */
    if (finePointer && !reduced) {
      wordmark.addEventListener('mousemove', function (e) {
        var r = wordmark.getBoundingClientRect();
        var x = e.clientX - r.left;
        var y = e.clientY - r.top;
        wordmark.style.webkitMaskImage =
          'radial-gradient(120px circle at ' + x + 'px ' + y + 'px, #000 0%, rgba(0,0,0,0.65) 100%)';
        wordmark.style.maskImage =
          'radial-gradient(120px circle at ' + x + 'px ' + y + 'px, #000 0%, rgba(0,0,0,0.65) 100%)';
      });
      wordmark.addEventListener('mouseleave', function () {
        wordmark.style.webkitMaskImage = 'none';
        wordmark.style.maskImage = 'none';
      });
    }
  }

  /* ══════════════════════════════════════
     10. #fair PIXEL FIELD TWINKLE
     ══════════════════════════════════════ */
  var fairSection = document.getElementById('fair');
  if (fairSection && !reduced) {
    var fieldImg = fairSection.querySelector('img[src*="pixel-field"]');
    if (fieldImg) {
      var twinkleCanvas = document.createElement('canvas');
      twinkleCanvas.setAttribute('aria-hidden', 'true');
      twinkleCanvas.style.cssText =
        'position:absolute;left:0;bottom:0;width:100%;height:auto;pointer-events:none;' +
        'aspect-ratio:' + (fieldImg.naturalWidth || 1920) + '/' + (fieldImg.naturalHeight || 400) + ';';
      fairSection.insertBefore(twinkleCanvas, fieldImg.nextSibling);

      var twinkleCtx = twinkleCanvas.getContext('2d');
      var twinkleDots = [];
      var twinkleVisible = false;
      var twinkleFrame = 0;

      /* Seed dots on first visibility */
      var twinkleObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          twinkleVisible = entry.isIntersecting;
          if (twinkleVisible && twinkleDots.length === 0) {
            /* Size canvas */
            var w = twinkleCanvas.clientWidth;
            var h = twinkleCanvas.clientHeight || 200;
            var dpr = Math.min(devicePixelRatio || 1, 2);
            twinkleCanvas.width = w * dpr;
            twinkleCanvas.height = h * dpr;
            twinkleCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            /* Create ~40 random twinkle dots */
            for (var i = 0; i < 40; i++) {
              twinkleDots.push({
                x: Math.random() * w,
                y: Math.random() * h,
                phase: Math.random() * Math.PI * 2,
                speed: 0.8 + Math.random() * 0.8,
                r: 1.5 + Math.random() * 1.5
              });
            }
            twinkleLoop();
          }
        });
      }, { threshold: 0.1 });
      twinkleObs.observe(fairSection);

      function twinkleLoop() {
        if (!twinkleVisible || document.hidden) {
          twinkleFrame = requestAnimationFrame(twinkleLoop);
          return;
        }
        var w = twinkleCanvas.width / (Math.min(devicePixelRatio || 1, 2));
        var h = twinkleCanvas.height / (Math.min(devicePixelRatio || 1, 2));
        twinkleCtx.clearRect(0, 0, w, h);
        var now = performance.now() / 1000;
        for (var i = 0; i < twinkleDots.length; i++) {
          var d = twinkleDots[i];
          var alpha = Math.max(0, 0.6 * Math.sin(now * d.speed + d.phase));
          if (alpha > 0.01) {
            twinkleCtx.globalAlpha = alpha;
            twinkleCtx.fillStyle = '#A4D3F1';
            twinkleCtx.beginPath();
            twinkleCtx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            twinkleCtx.fill();
          }
        }
        twinkleCtx.globalAlpha = 1;
        /* ~30fps */
        setTimeout(function () {
          twinkleFrame = requestAnimationFrame(twinkleLoop);
        }, 33);
      }

      document.addEventListener('visibilitychange', function () {
        if (!document.hidden && twinkleVisible) twinkleLoop();
      });
    }
  }

  /* ══════════════════════════════════════
     11. #demo COWRIE TRIO FLOAT
     ══════════════════════════════════════ */
  var trioImg = document.querySelector('#demo img[src*="cowrie-trio"]');
  if (trioImg && !reduced) {
    trioImg.classList.add('cowrie-float');
  }

  /* ══════════════════════════════════════
     12. SCROLL-MARGIN for smooth anchor links
     ══════════════════════════════════════ */
  if (header) {
    var hh = header.offsetHeight + 'px';
    document.querySelectorAll('section[id]').forEach(function (s) {
      s.style.scrollMarginTop = hh;
    });
  }

})();
