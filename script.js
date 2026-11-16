(() => {
  'use strict';

  const C = window.LOVE || {};
  const $ = (s, r = document) => r.querySelector(s);
  // Burmese text is tagged lang="my" so the CSS can give it Myanmar fonts and taller lines.
  const MY = /[က-႟ꩠ-ꩿ]/;
  const say = (node, text) => {
    node.textContent = text;
    if (MY.test(text)) node.lang = 'my'; else node.removeAttribute('lang');
  };
  // Split into whole characters; Burmese syllables must never be cut in the middle.
  const graphemes = (text) => (window.Intl && Intl.Segmenter
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (x) => x.segment)
    : Array.from(text));
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) say(n, text);
    return n;
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const DAY = 864e5;

  // GSAP drives the entrances when it loaded; otherwise the CSS versions run.
  const G = !reduce && window.gsap && window.ScrollTrigger ? window.gsap : null;
  if (G) {
    G.registerPlugin(window.ScrollTrigger);
    window.ScrollTrigger.config({ ignoreMobileResize: true });
    document.documentElement.classList.add('gsap');
  }

  /* ---------------- email notifications (optional) ----------------
     When config.js has a notifyKey, what she does on the page is emailed to you
     through Web3Forms. Events are grouped so one visit doesn't send a flood. */
  const notify = (() => {
    const key = (C.notifyKey || '').trim();
    let queue = [], timer;
    function flush() {
      clearTimeout(timer);
      if (!key || !queue.length) return;
      const batch = queue.splice(0);
      const subject = [...new Set(batch.map((b) => b.subject))].join(' · ');
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        keepalive: true, // still goes out if she closes the page right after
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: key,
          subject,
          from_name: 'Our Monthsary Site',
          message: batch.map((b) => `[${b.time}] ${b.text}`).join(String.fromCharCode(10)),
        }),
      }).catch(() => {});
    }
    addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    return (subject, text, now) => {
      if (!key) return;
      queue.push({ subject, text, time: new Date().toLocaleString() });
      clearTimeout(timer);
      if (now) flush(); else timer = setTimeout(flush, 6000);
    };
  })();

  let start = new Date(C.startDate);
  if (isNaN(start)) start = new Date();

  /* ---------------- dates ---------------- */
  function addMonths(date, n) {
    const r = new Date(date);
    const day = r.getDate();
    r.setDate(1);
    r.setMonth(r.getMonth() + n);
    const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(day, last));
    return r;
  }
  function monthsTogether(now) {
    let m = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
    if (addMonths(start, m) > now) m--;
    return Math.max(0, m);
  }
  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const fmt = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const sameDay = (a, b) => a.toDateString() === b.toDateString();

  /* ---------------- hearts canvas ---------------- */
  const sky = (() => {
    const cv = $('#sky'), ctx = cv.getContext('2d');
    const colors = ['#d6456b', '#c2263f', '#efb9c1', '#f29bb0', '#c49a5a'];
    let W = 0, H = 0, parts = [], running = false;

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight;
      if (w === W && h === H) return; // mobile URL-bar slides fire resize; don't wipe the canvas for those
      W = w; H = h;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function floater(anywhere) {
      return {
        x: Math.random() * W, y: anywhere ? Math.random() * H : H + 20,
        vx: 0, vy: -(0.25 + Math.random() * 0.45), s: 5 + Math.random() * 8,
        r: (Math.random() - 0.5) * 0.6, vr: 0, a: 0.14 + Math.random() * 0.2,
        c: colors[(Math.random() * 4) | 0], sway: Math.random() * 6.28, life: Infinity,
      };
    }
    function draw(p) {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(p.s, p.s);
      ctx.globalAlpha = p.a; ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.moveTo(0, 0.8);
      ctx.bezierCurveTo(-1.3, -0.1, -0.6, -1, 0, -0.35);
      ctx.bezierCurveTo(0.6, -1, 1.3, -0.1, 0, 0.8);
      ctx.fill();
      ctx.restore();
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      parts = parts.filter((p) => {
        if (p.life === Infinity) {
          p.sway += 0.012; p.x += Math.sin(p.sway) * 0.35; p.y += p.vy;
          if (p.y < -20) Object.assign(p, floater(false));
        } else {
          p.vy += 0.12; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
          p.life--; p.a = Math.min(1, p.life / 40);
          if (p.life <= 0 || p.y > H + 40) return false;
        }
        draw(p);
        return true;
      });
      if (!document.hidden && parts.length) requestAnimationFrame(frame); else running = false;
    }
    function run() { if (!running && parts.length) { running = true; requestAnimationFrame(frame); } }
    function burst(x, y, n = 40, power = 9) {
      if (reduce) return;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * 6.28, sp = power * (0.3 + Math.random() * 0.9);
        parts.push({
          x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - power * 0.45,
          s: 5 + Math.random() * 10, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.2,
          a: 1, c: colors[(Math.random() * colors.length) | 0], life: 90 + Math.random() * 70,
        });
      }
      run();
    }
    resize();
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', run);
    function ambient() {
      if (reduce) return;
      for (let i = 0; i < (W < 700 ? 12 : 22); i++) parts.push(floater(true));
      run();
    }
    return { burst, ambient };
  })();

  /* ---------------- 3D heart (Three.js) ---------------- */
  const heart3d = (() => {
    const T = window.THREE;
    if (reduce || !T) return null;
    const canvas = $('#heart3d');
    let renderer;
    try { renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch (e) { return null; }
    document.documentElement.classList.add('three');
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));

    const scene = new T.Scene();
    const CAM_Z = 10, FOV = 35;
    const camera = new T.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.z = CAM_Z;
    const visH = 2 * CAM_Z * Math.tan((FOV * Math.PI) / 360); // world units visible at z = 0
    scene.add(new T.AmbientLight(0xffe3e8, 0.42));
    const key = new T.DirectionalLight(0xffffff, 0.7); key.position.set(3, 5, 6); scene.add(key);
    const rim = new T.PointLight(0xff9db4, 0.35, 30); rim.position.set(-4, -2, 4); scene.add(rim);

    function heartGeo(detail) {
      const s = new T.Shape();
      s.moveTo(5, 5);
      s.bezierCurveTo(5, 5, 4, 0, 0, 0);
      s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
      s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
      s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
      s.bezierCurveTo(16, 7, 16, 0, 10, 0);
      s.bezierCurveTo(7, 0, 5, 5, 5, 5);
      const g = new T.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelThickness: 2.4, bevelSize: 1.6, bevelSegments: detail, curveSegments: detail * 3 });
      g.center(); g.rotateZ(Math.PI); g.scale(0.04, 0.04, 0.04); // ≈ 1 unit wide, point down
      return g;
    }

    // the big glossy heart
    const heart = new T.Mesh(heartGeo(12), new T.MeshPhysicalMaterial({ color: 0xd81b4a, roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.12 }));
    scene.add(heart);

    // a drifting field of little pastel hearts
    const N = innerWidth < 720 ? 22 : 42;
    const field = new T.InstancedMesh(heartGeo(3), new T.MeshStandardMaterial({ roughness: 0.4 }), N);
    const palette = [0xf7a8b8, 0xffc9d3, 0xe86a8a, 0xffd9c2, 0xf3c178, 0xd6456b];
    const dummy = new T.Object3D(), col = new T.Color();
    const RANGE = 14;
    const bits = Array.from({ length: N }, (_, i) => {
      field.setColorAt(i, col.setHex(palette[i % palette.length]));
      return {
        x: (Math.random() - 0.5) * 18, y: Math.random() * RANGE, z: -7 + Math.random() * 6.5,
        s: 0.18 + Math.random() * 0.32, vy: 0.12 + Math.random() * 0.25, ph: Math.random() * 6.28, vr: 0.2 + Math.random() * 0.6,
      };
    });
    field.instanceColor.needsUpdate = true;
    scene.add(field);

    // sparkles
    const sp = new Float32Array(160 * 3);
    for (let i = 0; i < sp.length; i += 3) { sp[i] = (Math.random() - 0.5) * 20; sp[i + 1] = (Math.random() - 0.5) * 12; sp[i + 2] = -8 + Math.random() * 8; }
    const sparkGeo = new T.BufferGeometry();
    sparkGeo.setAttribute('position', new T.BufferAttribute(sp, 3));
    const sparks = new T.Points(sparkGeo, new T.PointsMaterial({ color: 0xe0a85a, size: 0.05, transparent: true, opacity: 0.7 }));
    scene.add(sparks);

    const spotHero = $('#spotHero'), spotEnd = $('#spotEnd');
    const state = { spin: 0, boost: 1, beat: 1 };
    const pointer = { x: 0, y: 0 };
    let W = 1, H = 1, running = false, first = true;

    if (G) {
      G.timeline({ repeat: -1, repeatDelay: 0.55 })
        .to(state, { beat: 1.13, duration: 0.16, ease: 'power2.out' })
        .to(state, { beat: 1, duration: 0.22, ease: 'power2.in' })
        .to(state, { beat: 1.08, duration: 0.14, ease: 'power2.out' })
        .to(state, { beat: 1, duration: 0.45, ease: 'power2.inOut' });
    }

    function resize() {
      const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
      if (w === W && h === H) return;
      W = w; H = h;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    }
    const clock = new T.Clock();
    function frame() {
      if (document.hidden) { running = false; return; }
      const t = clock.getElapsedTime(), wpp = visH / H;

      // the heart sits in the hero, shrinks into a corner companion, and returns for the finale
      const a = spotHero.getBoundingClientRect(), b = spotEnd.getBoundingClientRect();
      let px, py, size;
      if (a.bottom > -20) { px = a.left + a.width / 2; py = a.top + a.height / 2; size = a.height; }
      else if (b.top < innerHeight) { px = b.left + b.width / 2; py = b.top + b.height / 2; size = b.height; }
      else { const m = W < 720; px = m ? 20 : 64; py = innerHeight - (m ? 44 : 70); size = m ? 30 : 56; }
      const tx = (px - W / 2) * wpp, ty = -(py - H / 2) * wpp, ts = size * wpp * state.boost;
      const k = first ? 1 : 0.09; first = false;
      heart.position.x += (tx - heart.position.x) * k;
      heart.position.y += (ty - heart.position.y) * k;
      const base = (heart.userData.s || ts);
      heart.userData.s = base + (ts - base) * k;
      const beat = G ? state.beat : 1 + 0.07 * Math.max(0, Math.sin(t * 4.2));
      heart.scale.setScalar(heart.userData.s * beat);
      heart.rotation.y = Math.sin(t * 0.9) * 0.5 + state.spin + pointer.x * 0.35;
      heart.rotation.x = Math.sin(t * 0.7) * 0.12 + pointer.y * 0.25;

      const scroll = scrollY * 0.004;
      bits.forEach((p, i) => {
        const depth = (p.z + 8) / 8; // nearer hearts move more with the scroll
        const y = (((p.y + t * p.vy + scroll * depth) % RANGE) + RANGE) % RANGE - RANGE / 2;
        dummy.position.set(p.x + Math.sin(t * 0.5 + p.ph) * 0.4, y, p.z);
        dummy.rotation.set(Math.sin(t * p.vr + p.ph) * 0.4, t * p.vr + p.ph, Math.sin(t * 0.6 + p.ph) * 0.3);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        field.setMatrixAt(i, dummy.matrix);
      });
      field.instanceMatrix.needsUpdate = true;
      sparks.rotation.y = t * 0.03;
      sparks.material.opacity = 0.5 + Math.sin(t * 1.7) * 0.25;

      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }
    function run() { if (!running) { running = true; requestAnimationFrame(frame); } }
    resize();
    addEventListener('resize', resize);
    addEventListener('pointermove', (e) => { pointer.x = e.clientX / W - 0.5; pointer.y = e.clientY / H - 0.5; }, { passive: true });
    document.addEventListener('visibilitychange', run);
    run();

    return {
      kick() { if (G) G.to(state, { spin: '+=6.2832', duration: 1.3, ease: 'power2.out' }); },
      celebrate() {
        if (!G) return;
        G.to(state, { spin: '+=18.85', duration: 3, ease: 'power3.out' });
        G.fromTo(state, { boost: 0.6 }, { boost: 1.25, duration: 1.6, ease: 'elastic.out(1, 0.35)' });
      },
    };
  })();
  if (!heart3d) sky.ambient(); // no WebGL → keep the 2D floating hearts

  /* ---------------- envelope ---------------- */
  const gate = $('#gate');
  say($('#gateName'), C.herName || 'you');
  document.title = `For ${C.herName || 'you'} ♥`;

  const audio = C.music ? new Audio(C.music) : null;
  const musicBtn = $('#music');
  if (audio) {
    audio.loop = true; audio.volume = 0.6;
    audio.addEventListener('error', () => { musicBtn.hidden = true; });
    audio.addEventListener('play', () => { musicBtn.classList.add('playing'); musicBtn.setAttribute('aria-pressed', 'true'); });
    audio.addEventListener('pause', () => { musicBtn.classList.remove('playing'); musicBtn.setAttribute('aria-pressed', 'false'); });
    musicBtn.hidden = false;
    musicBtn.addEventListener('click', () => (audio.paused ? audio.play().catch(() => {}) : audio.pause()));
  }

  function enter(instant) {
    if (audio && !instant) audio.play().catch(() => {});
    if (!instant) {
      let seen = false;
      try { seen = sessionStorage.getItem('opened'); sessionStorage.setItem('opened', '1'); } catch (e) { /* ignore */ }
      if (!seen) notify('She opened it 💌', 'She opened the envelope.');
    }
    gate.classList.add('open');
    setTimeout(() => {
      gate.classList.add('done');
      document.body.classList.remove('locked');
      document.body.classList.add('ready');
      if (!instant) sky.burst(innerWidth / 2, innerHeight * 0.45, 70, 12);
      if (heart3d && !instant) heart3d.kick();
      heroIntro();
      updateThread();
    }, instant || reduce ? 0 : 1700);
  }
  $('#seal').addEventListener('click', () => enter(false), { once: true });
  if (location.hash === '#skip') enter(true);

  /* ---------------- hero ---------------- */
  let heroIntro = () => {};
  (() => {
    const now = new Date();
    const m = monthsTogether(now);
    say($('#heroTo'), C.heroLine || `to ${C.herName || 'you'}, with all my heart`);
    const h1 = $('#heroTitle');
    let small = 'Happy', big;
    if (m === 0) { small = 'Our very'; big = 'First Month'; }
    else if (m % 12 === 0) big = `${ordinal(m / 12)} Anniversary`;
    else big = `${ordinal(m)} Monthsary`;
    if (m > 0 && !sameDay(addMonths(start, m), now)) {
      small = `${m} ${m === 1 ? 'month' : 'months'} and counting`;
      big = 'Still Us';
    }
    h1.setAttribute('aria-label', `${small} ${big}`);
    h1.append(el('span', 'pre', small));
    big.split(' ').forEach((word, i) => { // letters are wrapped so GSAP can animate them one by one
      if (i) h1.append(' ');
      const w = el('b', 'wd');
      w.style.font = 'inherit';
      [...word].forEach((ch) => w.append(el('i', 'ch', ch)));
      h1.append(w);
    });

    const out = { d: $('#cD'), h: $('#cH'), m: $('#cM'), s: $('#cS') };
    const pad = (n) => String(n).padStart(2, '0');
    let counting = false;
    if (G) heroIntro = () => {
      const days = { v: 0 }, total = Math.floor(Math.max(0, Date.now() - start) / DAY);
      counting = true;
      G.timeline({ defaults: { ease: 'power3.out' } })
        .from('.hero .eyebrow', { y: 24, opacity: 0, duration: 0.8 }, 0.1)
        .from('#heroTitle .pre', { y: 20, opacity: 0, duration: 0.6 }, '-=0.45')
        .from('#heroTitle .ch', { yPercent: 110, opacity: 0, rotation: 12, duration: 0.9, stagger: 0.045, ease: 'back.out(1.8)' }, '-=0.35')
        .from('.hero-sub', { y: 12, opacity: 0, duration: 0.6 }, '-=0.5')
        .from('.counter div', { y: 44, opacity: 0, scale: 0.8, duration: 0.7, stagger: 0.1, ease: 'back.out(2)' }, '-=0.35')
        .to(days, { v: total, duration: 1.4, ease: 'power2.out', onUpdate: () => { out.d.textContent = Math.round(days.v); }, onComplete: () => { counting = false; } }, '<')
        .from('.cue', { opacity: 0, duration: 0.8 }, '-=0.6');
      window.ScrollTrigger.refresh();
    };
    function tick() {
      const diff = Math.max(0, Date.now() - start);
      if (!counting) out.d.textContent = Math.floor(diff / DAY);
      out.h.textContent = pad(Math.floor(diff / 36e5) % 24);
      out.m.textContent = pad(Math.floor(diff / 6e4) % 60);
      out.s.textContent = pad(Math.floor(diff / 1e3) % 60);
    }
    tick();
    setInterval(tick, 1000);
  })();

  /* ---------------- reveal on scroll ---------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      e.target.dispatchEvent(new Event('reveal'));
      io.unobserve(e.target);
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('.head').forEach((h) => {
    if (!G) return io.observe(h);
    G.from(h.children, { y: 34, opacity: 0, duration: 0.9, stagger: 0.14, ease: 'power3.out', scrollTrigger: { trigger: h, start: 'top 84%' } });
  });

  /* ---------------- timeline + red thread ---------------- */
  const wrap = $('#threadWrap'), list = $('#timeline'), knotsBox = $('#knots');
  const svg = $('.thread'), ghost = $('.thread .ghost'), live = $('.thread .live');
  const lightbox = $('#lightbox');
  let knots = [], threadLen = 0;

  (C.memories || []).forEach((mem, i) => {
    const li = el('li');
    li.style.setProperty('--tilt', `${(i % 2 ? 1 : -1) * (1 + (i * 37 % 20) / 10)}deg`);
    li.style.setProperty('--tape', `${(i * 53 % 9) - 4}deg`);
    const fig = el('figure', 'polaroid');
    const photo = el('div', 'photo', mem.emoji || '♥');
    photo.style.setProperty('--hue', 335 + (i * 23) % 50);
    if (mem.photo) {
      const img = new Image();
      img.alt = mem.title || '';
      img.loading = 'lazy';
      img.onload = buildThread;
      img.onerror = () => img.remove();
      img.onclick = () => {
        $('img', lightbox).src = img.src;
        say($('p', lightbox), mem.title || '');
        lightbox.showModal();
      };
      img.src = mem.photo;
      photo.append(img);
    }
    fig.append(photo, el('span', 'when', mem.date), el('figcaption', '', mem.title), el('p', '', mem.text));
    li.append(fig);
    list.append(li);
    if (G) {
      const dir = innerWidth < 720 ? 1 : (i % 2 ? 1 : -1);
      const tilt = parseFloat(li.style.getPropertyValue('--tilt')) * (innerWidth < 720 ? 0.5 : 1);
      const st = { trigger: li, start: 'top 86%' };
      G.fromTo(li, { opacity: 0, x: dir * 90, y: 50, rotation: dir * 12, scale: 0.88 },
        { opacity: 1, x: 0, y: 0, rotation: tilt, scale: 1, duration: 1.1, ease: 'back.out(1.5)', scrollTrigger: st });
      G.from(fig.querySelectorAll('.when, figcaption, p'), { y: 16, opacity: 0, duration: 0.6, stagger: 0.1, delay: 0.35, ease: 'power2.out', scrollTrigger: st });
      li.addEventListener('pointerenter', () => G.to(li, { rotation: 0, scale: 1.03, duration: 0.4, ease: 'power2.out' }));
      li.addEventListener('pointerleave', () => G.to(li, { rotation: tilt, scale: 1, duration: 0.5, ease: 'power2.out' }));
    } else io.observe(li);
    const k = el('span', 'knot', '♥');
    knotsBox.append(k);
    knots.push({ node: k, li, y: 0 });
  });
  lightbox.addEventListener('click', () => lightbox.close());

  function buildThread() {
    const W = wrap.clientWidth, H = wrap.clientHeight;
    if (!W || !H) return;
    const mobile = innerWidth < 720;
    const pad = parseFloat(getComputedStyle(wrap).paddingLeft) || 40;
    const cx = mobile ? pad / 2 - 2 : W / 2, amp = mobile ? 6 : 34;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const pts = [[cx, 0]];
    knots.forEach((k, i) => {
      const x = cx + (i % 2 ? amp : -amp);
      k.y = k.li.offsetTop + k.li.offsetHeight / 2;
      k.node.style.left = `${x}px`;
      k.node.style.top = `${k.y}px`;
      pts.push([x, k.y]);
    });
    pts.push([cx, H]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], my = (y0 + y1) / 2;
      d += ` C${x0},${my} ${x1},${my} ${x1},${y1}`;
    }
    ghost.setAttribute('d', d);
    live.setAttribute('d', d);
    threadLen = live.getTotalLength();
    live.style.strokeDasharray = threadLen;
    updateThread();
    if (G) window.ScrollTrigger.refresh();
  }
  function updateThread() {
    if (!threadLen) return;
    const r = wrap.getBoundingClientRect();
    const p = reduce ? 1 : clamp((innerHeight * 0.62 - r.top) / r.height, 0, 1);
    live.style.strokeDashoffset = threadLen * (1 - p);
    knots.forEach((k) => k.node.classList.toggle('tied', p * r.height >= k.y - 4));
  }
  let queued = false;
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; updateThread(); });
  }, { passive: true });
  new ResizeObserver(buildThread).observe(wrap);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildThread);

  /* ---------------- reasons ---------------- */
  (() => {
    const reasons = C.reasons || [];
    if (!reasons.length) { $('#reasons').hidden = true; return; }
    const note = $('#note'), n = $('#noteN'), t = $('#noteT');
    let i = 0;
    const show = () => {
      n.textContent = `reason no. ${i + 1} of ${reasons.length}`;
      say(t, reasons[i]);
    };
    let swapTl;
    function next() {
      i = (i + 1) % reasons.length;
      if (reduce) return show();
      if (heart3d) heart3d.kick();
      if (G) {
        if (swapTl) swapTl.progress(1);
        swapTl = G.timeline()
          .to(note, { xPercent: 115, y: -30, rotation: 18, opacity: 0, duration: 0.3, ease: 'power2.in' })
          .call(show)
          .set(note, { xPercent: 0, x: -30, y: 40, rotation: -8, scale: 0.9 })
          .to(note, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' });
        const r0 = note.parentNode.getBoundingClientRect();
        sky.burst(r0.left + r0.width / 2, r0.top + r0.height / 2, 8, 5);
        return;
      }
      note.classList.remove('swap');
      void note.offsetWidth;
      note.classList.add('swap');
      setTimeout(show, 320);
      const r = note.getBoundingClientRect();
      sky.burst(r.left + r.width / 2, r.top + r.height / 2, 8, 5);
    }
    show();
    note.addEventListener('click', next);
    $('#noteNext').addEventListener('click', next);
  })();

  /* ---------------- letter (typewriter) ---------------- */
  (() => {
    const paper = $('#paper');
    const lines = (C.letter || []).map((text) => {
      const p = el('p'), typed = el('span'), rest = el('span', 'rest', text), chars = graphemes(text);
      if (MY.test(text)) p.lang = 'my';
      p.append(typed, rest);
      paper.append(p);
      return { text, typed, rest, chars };
    });
    paper.append(el('p', 'from', `— ${C.yourName || 'me'}`));
    const p_my = (l) => MY.test(l.text);
    const done = () => lines.forEach((l) => { l.typed.textContent = l.text; l.rest.textContent = ''; l.typed.classList.remove('caret'); });
    if (reduce) return done();
    paper.addEventListener('reveal', () => {
      let li = 0, ci = 0;
      (function type() {
        const l = lines[li];
        if (!l) return;
        l.typed.classList.add('caret');
        ci++;
        l.typed.textContent = l.chars.slice(0, ci).join('');
        l.rest.textContent = l.chars.slice(ci).join('');
        let wait = /[.,!?—…။၊]/.test(l.chars[ci - 1]) ? 260 : (p_my(l) ? 45 : 26);
        if (ci >= l.chars.length) { l.typed.classList.remove('caret'); li++; ci = 0; wait = 500; }
        setTimeout(type, wait);
      })();
    });
    io.observe(paper);
  })();

  /* ---------------- future ---------------- */
  (() => {
    const now = new Date();
    const m = monthsTogether(now);
    const last = addMonths(start, m), next = addMonths(start, m + 1);
    const daysLeft = Math.ceil((next - now) / DAY);
    const isAnniv = (m + 1) % 12 === 0;
    $('.next-label').textContent = isAnniv ? 'Our next anniversary' : `Our ${ordinal(m + 1)} monthsary`;
    $('#nextDate').textContent = fmt(next);
    $('#nextLeft').textContent = daysLeft <= 1 ? 'tomorrow, my love' : `${daysLeft} more sleeps`;
    const pct = clamp((now - last) / (next - last), 0.02, 1) * 100;
    const nextBox = $('.next');
    nextBox.addEventListener('reveal', () => {
      $('#nextBar').style.width = `${pct}%`;
      $('#nextHeart').style.left = `${pct}%`;
    });
    io.observe(nextBox);

    const miles = [
      ['100 days of us', new Date(+start + 100 * DAY)],
      ['Half a year', addMonths(start, 6)],
      ['Our first anniversary', addMonths(start, 12)],
      ['500 days of us', new Date(+start + 500 * DAY)],
      ['Two years', addMonths(start, 24)],
    ].sort((a, b) => a[1] - b[1]);
    const ul = $('#miles');
    miles.forEach(([label, date]) => {
      const li = el('li'), left = el('div');
      const days = Math.ceil((date - now) / DAY);
      left.append(el('b', '', label), el('small', '', fmt(date)));
      li.append(left, el('em', '', days <= 0 ? 'we made it ♥' : `in ${days} days`));
      if (days <= 0) li.className = 'done';
      ul.append(li);
    });

    // someday list — ticks and additions are remembered on this device
    const KEY = 'our-someday-list';
    let state = { done: {}, custom: [] };
    try { state = Object.assign(state, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* private mode */ }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };
    const dreams = $('#dreams');
    function addRow(text) {
      const li = el('li'), label = el('label'), box = el('input');
      box.type = 'checkbox';
      box.checked = !!state.done[text];
      box.addEventListener('change', () => {
        state.done[text] = box.checked;
        save();
        notify('Someday list', `${box.checked ? 'She ticked' : 'She un-ticked'}: "${text}"`);
        if (box.checked) { const r = box.getBoundingClientRect(); sky.burst(r.left + 12, r.top + 12, 14, 6); }
      });
      label.append(box, el('span', '', text));
      li.append(label);
      dreams.append(li);
    }
    [...(C.dreams || []), ...state.custom].forEach(addRow);
    $('#addDream').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#dreamIn'), text = input.value.trim();
      if (!text || (C.dreams || []).includes(text) || state.custom.includes(text)) { input.value = ''; return; }
      state.custom.push(text);
      save();
      notify('She added a dream ✨', `She added to the someday list: "${text}"`);
      addRow(text);
      input.value = '';
    });
  })();

  /* ---------------- the last question ---------------- */
  (() => {
    say($('#question'), C.question || 'Will you keep going with me?');
    const yes = $('#yes'), no = $('#no'), answers = $('#answers'), msg = $('#yesMsg'), sign = $('#sign');
    const lines = (C.noDodges && C.noDodges.length > 1) ? C.noDodges : ['Are you sure?', 'Think again…', 'Wrong button!', 'Nice try ♥', 'Okay, okay — yes!'];
    if (C.yesButton) say(yes, C.yesButton);
    if (C.noButton) say(no, C.noButton);
    let dodges = 0;

    function sayYes() {
      notify('She said YES ♥', `She pressed Yes${dodges ? ` (after chasing the No button ${dodges} time${dodges > 1 ? 's' : ''})` : ''}.`, true);
      answers.hidden = true;
      say(msg, C.yesMessage || 'Forever it is.');
      msg.hidden = false;
      say(sign, `— ${C.yourName || 'me'}`);
      const cx = innerWidth / 2, cy = innerHeight / 2;
      sky.burst(cx, cy, 90, 14);
      setTimeout(() => sky.burst(cx * 0.5, cy * 0.8, 60, 11), 350);
      setTimeout(() => sky.burst(cx * 1.5, cy * 0.8, 60, 11), 700);
    }
    let lastDodge = 0, tx = 0, ty = 0;
    function dodge(e) {
      if (dodges >= lines.length - 1) return;
      e.preventDefault();
      lastDodge = Date.now();
      say(no, lines[dodges++]);
      if (dodges >= lines.length - 1) { no.style.transform = ''; say(no, lines[lines.length - 1]); return; }
      // jump somewhere new, but always fully inside the screen (matters on small phones)
      no.style.transform = `translate(${tx}px, ${ty}px)`;
      const r = no.getBoundingClientRect(), edge = 14;
      const baseL = r.left - tx, baseT = r.top - ty;
      const maxL = Math.max(edge, document.documentElement.clientWidth - r.width - edge);
      let left = r.left;
      for (let tries = 0; tries < 12 && Math.abs(left - r.left) < 70; tries++) left = edge + Math.random() * (maxL - edge);
      const up = Math.random() < 0.5 ? -1 : 1;
      const top = clamp(baseT + up * (64 + Math.random() * 40), edge, innerHeight - r.height - edge);
      tx = left - baseL; ty = top - baseT;
      no.style.transform = `translate(${tx}px, ${ty}px) rotate(${(Math.random() - 0.5) * 16}deg)`;
    }
    if (G) {
      G.from('.panel', { y: 60, opacity: 0, duration: 0.9, stagger: 0.18, ease: 'power3.out', scrollTrigger: { trigger: '.future-grid', start: 'top 85%' } });
      G.from('#miles li, #dreams li', { x: -20, opacity: 0, duration: 0.5, stagger: 0.06, delay: 0.3, ease: 'power2.out', scrollTrigger: { trigger: '.future-grid', start: 'top 85%' } });
      G.from('#always > :not(.heart-spot)', { y: 40, opacity: 0, duration: 0.9, stagger: 0.18, ease: 'back.out(1.6)', scrollTrigger: { trigger: '#always', start: 'top 75%' } });
      G.to(yes, { scale: 1.06, duration: 0.7, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    }
    yes.addEventListener('click', () => { if (heart3d) heart3d.celebrate(); });
    yes.addEventListener('click', sayYes);
    no.addEventListener('pointerenter', dodge);
    no.addEventListener('click', (e) => {
      if (Date.now() - lastDodge < 400) return; // a tap fires pointerenter and click together
      if (dodges >= lines.length - 1) sayYes(); else dodge(e);
    });
  })();

  buildThread();
})();
