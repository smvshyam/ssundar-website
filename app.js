// ============================================
// SSUNDAR. — app.js v7
// Fixed horizontal scroll, z-depth parallax, nav, form
// ============================================

document.addEventListener('DOMContentLoaded', function () {

  // --- Mobile Nav ---
  var hamburger = document.getElementById('navHamburger');
  var overlay = document.getElementById('mobileOverlay');
  if (hamburger && overlay) {
    hamburger.addEventListener('click', function () {
      hamburger.classList.toggle('open');
      overlay.classList.toggle('open');
      document.body.style.overflow = overlay.classList.contains('open') ? 'hidden' : '';
    });
    overlay.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        hamburger.classList.remove('open');
        overlay.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // --- Scroll Animations ---
  var animEls = document.querySelectorAll('.fade-in,.slide-up,.slide-left,.slide-right,.stagger-in,.scale-in,.line-draw');
  if (animEls.length) {
    var animObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          // Trigger counter animations
          var counters = e.target.querySelectorAll('[data-count]');
          counters.forEach(function(c) { animateCounter(c); });
        }
      });
    }, { threshold: 0.1 });
    animEls.forEach(function (el) { animObs.observe(el); });
  }

  // Counter animation for stats
  function animateCounter(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = '1';
    var target = el.getAttribute('data-count');
    var suffix = el.getAttribute('data-suffix') || '';
    var prefix = el.getAttribute('data-prefix') || '';
    var isFloat = target.indexOf('.') > -1;
    var end = parseFloat(target);
    var duration = 1200;
    var start = performance.now();
    function step(now) {
      var elapsed = now - start;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = isFloat ? (end * eased).toFixed(1) : Math.round(end * eased);
      el.textContent = prefix + current + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // --- Z-Depth Parallax ---
  var zLayers = document.querySelectorAll('[data-z-speed]');
  if (zLayers.length) {
    var ticking = false;
    function updateParallax() {
      var scrollY = window.pageYOffset;
      zLayers.forEach(function (el) {
        var speed = parseFloat(el.getAttribute('data-z-speed')) || 0;
        var rect = el.parentElement.getBoundingClientRect();
        var parentTop = rect.top + scrollY;
        var offset = (scrollY - parentTop) * speed;
        el.style.transform = 'translateY(' + offset + 'px)';
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
  }

  // --- Horizontal Scroll — FIXED ---
  document.querySelectorAll('.hscroll-track').forEach(function (track) {
    var isDown = false, startX, scrollLeft, hasMoved;

    // Drag to scroll
    track.addEventListener('mousedown', function (e) {
      isDown = true;
      hasMoved = false;
      track.classList.add('dragging');
      startX = e.pageX - track.offsetLeft;
      scrollLeft = track.scrollLeft;
    });

    // Listen on document so drag continues even if mouse leaves track
    document.addEventListener('mouseup', function () {
      if (isDown) {
        isDown = false;
        track.classList.remove('dragging');
      }
    });

    document.addEventListener('mousemove', function (e) {
      if (!isDown) return;
      e.preventDefault();
      hasMoved = true;
      var x = e.pageX - track.offsetLeft;
      var walk = (x - startX) * 1.8;
      track.scrollLeft = scrollLeft - walk;
    });

    // Mouse wheel: ONLY handle native horizontal scroll (trackpad two-finger swipe, shift+scroll)
    // Never hijack vertical scroll — that traps users on the page
    track.addEventListener('wheel', function (e) {
      // Only intercept if the gesture is primarily horizontal (trackpad swipe)
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;

      var maxScroll = track.scrollWidth - track.clientWidth;
      if (maxScroll <= 0) return;

      var atStart = track.scrollLeft <= 5;
      var atEnd = track.scrollLeft >= maxScroll - 5;

      // At boundaries, let page handle the scroll
      if (e.deltaX > 0 && atEnd) return;
      if (e.deltaX < 0 && atStart) return;

      // Native horizontal gesture — intercept and scroll track
      e.preventDefault();
      track.scrollLeft += e.deltaX;
    }, { passive: false });

    // Touch support
    var touchStartX = 0, touchScrollLeft = 0;
    track.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].pageX;
      touchScrollLeft = track.scrollLeft;
    }, { passive: true });

    track.addEventListener('touchmove', function (e) {
      var x = e.touches[0].pageX;
      var walk = (touchStartX - x) * 1.2;
      track.scrollLeft = touchScrollLeft + walk;
    }, { passive: true });
  });

  // --- Form Spam Protection ---
  var form = document.getElementById('engageForm');
  if (form) {
    // Timestamp when form is rendered — bots submit in < 2s
    var _formLoadTime = Date.now();
    // Interaction flag — bots don't focus fields
    var _humanInteracted = false;
    form.querySelectorAll('input, textarea, select').forEach(function(el) {
      el.addEventListener('focus', function() { _humanInteracted = true; }, { once: true });
    });

  // --- Form Validation ---
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;
      ['company', 'role', 'challenge', 'email'].forEach(function (id) {
        var input = document.getElementById(id);
        var error = document.getElementById('err-' + id);
        if (!input || !error) return;
        if (!input.value.trim()) {
          input.classList.add('error');
          input.setAttribute('aria-invalid', 'true');
          error.textContent = 'Required';
          error.classList.add('show');
          valid = false;
        } else if (id === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
          input.classList.add('error');
          input.setAttribute('aria-invalid', 'true');
          error.textContent = 'Valid email required';
          error.classList.add('show');
          valid = false;
        } else {
          input.classList.remove('error');
          input.setAttribute('aria-invalid', 'false');
          error.classList.remove('show');
        }
      });
      if (valid) {
        // Bot checks — silent rejection (don't tell bots why)
        var _elapsed = Date.now() - _formLoadTime;
        var _honeypot = form.querySelector('input[name="_gotcha"]');
        if (_elapsed < 3000 || !_humanInteracted || (_honeypot && _honeypot.value !== '')) {
          // Fake success to confuse bots
          form.style.display = 'none';
          document.getElementById('formSuccess').style.display = 'block';
          return;
        }
        var btn = form.querySelector('button[type=submit]');
        btn.textContent = 'SUBMITTING...';
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
        var fd = new FormData();
        fd.append('company', document.getElementById('company').value);
        fd.append('role', document.getElementById('role').value);
        fd.append('employees', document.getElementById('employees').value);
        fd.append('challenge', document.getElementById('challenge').value);
        fd.append('email', document.getElementById('email').value);
        fd.append('timeline', document.getElementById('timeline') ? document.getElementById('timeline').value : '');
        fd.append('_subject', 'SSUNDAR. Engagement Inquiry — ' + document.getElementById('company').value);
        // Attach hCaptcha token if available
        var hcToken = document.querySelector('[name="h-captcha-response"]');
        if (hcToken && hcToken.value) fd.append('h-captcha-response', hcToken.value);
        fetch('https://formspree.io/f/xykdyqyj', {
          method: 'POST', body: fd, headers: { 'Accept': 'application/json' }
        }).then(function(r) {
          if (r.ok) {
            form.style.display = 'none';
            document.getElementById('formSuccess').style.display = 'block';
          } else {
            btn.textContent = 'Submit Inquiry.';
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
            alert('Submission failed. Email shyam@ssundar.com directly.');
          }
        }).catch(function() {
          btn.textContent = 'Submit Inquiry.';
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
          alert('Network error. Email shyam@ssundar.com directly.');
        });
      }
    });
    form.querySelectorAll('.form-input').forEach(function (input) {
      input.addEventListener('input', function () {
        input.classList.remove('error');
        var err = document.getElementById('err-' + input.id);
        if (err) err.classList.remove('show');
      });
    });
  }

  // --- Active nav link ---
  var page = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
  document.querySelectorAll('.nav-link, .mobile-overlay a').forEach(function (link) {
    var href = (link.getAttribute('href') || '').replace('.html', '').replace('./', '');
    if (href === page || (page === 'index' && href === '')) link.classList.add('active');
  });

  // --- Floating CTA: hide on engage/simulate pages, hide near footer ---
  var floatingCta = document.getElementById('floatingCta');
  if (floatingCta) {
    // Hide on engage and simulate pages
    if (page === 'engage' || page === 'simulate') {
      floatingCta.style.display = 'none';
    } else {
      // Show after scrolling past hero, hide near footer
      var showAfter = 400;
      floatingCta.classList.add('hidden');
      window.addEventListener('scroll', function () {
        var scrollY = window.pageYOffset;
        var docHeight = document.documentElement.scrollHeight;
        var winHeight = window.innerHeight;
        var nearBottom = (docHeight - scrollY - winHeight) < 300;
        if (scrollY > showAfter && !nearBottom) {
          floatingCta.classList.remove('hidden');
        } else {
          floatingCta.classList.add('hidden');
        }
      }, { passive: true });
    }
  }

});

// SSUNDAR GA4 Event Tracking v1.0
// Key events: engage_click, platform_click, article_read
(function () {
  if (typeof gtag !== 'function') return;

  var pagePath = window.location.pathname.replace(/\/$/, '') || '/';
  var pageTitle = document.title || pagePath;
  var isArticle = /\/(insight-|what-200|competency-model|why-leadership|gcc-borrowed)/.test(pagePath);

  function fire(eventName, params) {
    gtag('event', eventName, Object.assign({ page_path: pagePath, page_title: pageTitle }, params || {}));
  }

  // 1. CTA CLICK TRACKING
  document.addEventListener('click', function (e) {
    var el = e.target.closest('a');
    if (!el) return;
    var href = el.getAttribute('href') || '';
    if (/\/engage/.test(href)) {
      fire('engage_click', { link_text: el.textContent.trim().slice(0, 50) });
    } else if (href.indexOf('app.ssundar.com') !== -1) {
      fire('platform_click', { link_text: el.textContent.trim().slice(0, 50) });
    } else if (/\/simulate/.test(href)) {
      fire('simulate_click', { link_text: el.textContent.trim().slice(0, 50) });
    } else if (href.indexOf('http') === 0 && href.indexOf('ssundar.com') === -1) {
      fire('outbound_click', { outbound_url: href, link_text: el.textContent.trim().slice(0, 50) });
    }
  }, true);

  // 2. SCROLL DEPTH - 25/50/75/90%. Article 90% fires article_read
  var scrollMilestones = [25, 50, 75, 90];
  var scrollFired = {};
  window.addEventListener('scroll', function () {
    var scrolled = window.pageYOffset + window.innerHeight;
    var total = document.documentElement.scrollHeight;
    var pct = total > 0 ? Math.round((scrolled / total) * 100) : 0;
    scrollMilestones.forEach(function (milestone) {
      if (!scrollFired[milestone] && pct >= milestone) {
        scrollFired[milestone] = true;
        fire('scroll_depth', { depth_percent: milestone, is_article: isArticle });
        if (milestone === 90 && isArticle) {
          fire('article_read', { article_title: pageTitle });
        }
      }
    });
  }, { passive: true });

  // 3. TIME ON PAGE - 30/60/120s. Pauses when tab hidden.
  var timeMilestones = [30, 60, 120];
  var timeFired = {};
  var activeSeconds = 0;
  var timerInterval = null;
  function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(function () {
      activeSeconds++;
      timeMilestones.forEach(function (ms) {
        if (!timeFired[ms] && activeSeconds >= ms) {
          timeFired[ms] = true;
          fire('time_on_page', { seconds: ms, is_article: isArticle });
        }
      });
    }, 1000);
  }
  function stopTimer() { clearInterval(timerInterval); timerInterval = null; }
  document.addEventListener('visibilitychange', function () {
    document.hidden ? stopTimer() : startTimer();
  });
  startTimer();

})();
