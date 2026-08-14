/* ============================================================================
   Meram — interaction layer

   Two things on this page are the real product rather than a picture of it:

     1. The Aurora Ribbon. Same geometry (300×64 viewBox, 64 samples, three
        curtains, 16px amplitude), same spring constants, same stroke weights,
        same state machine — ported from the app's AuroraRibbon.tsx to plain
        SVG + one rAF loop. If you lend it your microphone it is driven by a
        real AnalyserNode, exactly as it is in the app.
     2. The arithmetic. The time-saved dial computes from your own numbers.

   Everything else is honestly labelled as an example, because a marketing page
   that fakes a transcription is a page that lies about the one thing the
   product does.

   Motion follows "Designing Fluid Interfaces": springs rather than durations,
   retargeting that keeps position AND velocity, 1:1 dragging with rubber-band
   past the bounds, and momentum that is bounded because a slider is a control
   with friction, not a scroll surface.
   ========================================================================== */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  };
  const LANG = (document.documentElement.lang || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en';

  /* ══════════════════════  0. CONFIG  ═══════════════════════════════════
     The one place the release facts live. Every price, requirement and
     download link on the site renders from this. The static HTML carries the
     same values inline as a no-JS fallback — keep the two in sync. */

  const CONFIG = {
    SITE: 'https://meram.app',
    GITHUB_REPO: 'kuntayerkus/Meram',
    SUPPORT_EMAIL: 'kuntayerkus@gmail.com',

    /* Today */
    BETA: true,
    PRICE_TODAY: 0,
    PLATFORM_TODAY: 'Windows 10/11 · x64',
    SIGNED: false,                 // no Authenticode certificate exists yet

    /* Planned — shown only under a heading that says "planned", never as a
       thing you can buy. Flip PURCHASE_ENABLED when checkout is real. */
    PURCHASE_ENABLED: false,
    CHECKOUT_URL: '',
    PLAN_PRO_MONTHLY: 10,
    PLAN_BYOK_MONTHLY: 4,
    TRIAL_DAYS: 14,

    /* The dial's assumptions, in one place so they can be argued with. */
    DICTATION_WPM: 130,            // Meram's own dashboard average, incl. pauses
    WORKDAYS_PER_YEAR: 230
  };

  const I18N = {
    en: {
      ready: 'Ready', listening: 'Listening', thinking: 'Thinking',
      done: 'Done', error: 'Not heard', copy: 'Copy',
      speak: 'Hold to speak', speakRelease: 'Release to finish',
      micOn: 'Use my microphone', micOff: 'Release microphone',
      micDenied: 'Microphone declined — running the scripted take instead.',
      micFail: 'No microphone available — running the scripted take instead.',
      micLive: 'Live: the thread is reading your voice in this tab. Nothing is recorded, nothing is sent.',
      typed: 'Meram lands the finished text in the field you were already in — no window switch, no paste.',
      /* The example dictation. Deliberately messy, the way real speech is. */
      raw: 'um so about the deploy, like, today I wrote a worker on cloud flare and uh the p95 latency stayed under forty milliseconds, um I will wire up the paddle webhook tomorrow',
      fillers: 'um+|uh+|er+|like|you know|i mean|sort of|kind of|basically|actually',
      dict: [['cloud flare', 'Cloudflare'], ['paddle', 'Paddle'], ['p95', 'p95']],
      tones: {
        neutral: 'About the deploy: today I wrote a Worker on Cloudflare and the p95 latency stayed under 40 ms. I will wire up the Paddle webhook tomorrow.',
        formal: 'Regarding the deployment: I implemented a Worker on Cloudflare today, and p95 latency remained below 40 ms. I will complete the Paddle webhook integration tomorrow.',
        casual: 'Wrote a Worker on Cloudflare today — p95 latency stayed under 40 ms. I will hook up the Paddle webhook tomorrow.',
        bullets: '• Wrote a Worker on Cloudflare\n• p95 latency under 40 ms\n• Paddle webhook to be wired up tomorrow'
      },
      toneNames: { neutral: 'Neutral', formal: 'Formal', casual: 'Casual', bullets: 'Bullet points' },
      metaWords: (a, b) => `${a} words → ${b} words`,
      metaFill: (n) => `${n} disfluenc${n === 1 ? 'y' : 'ies'} removed`,
      metaDict: (n) => `${n} dictionary term${n === 1 ? '' : 's'} applied`,
      perDay: 'a day', perWeek: 'a week', perYear: 'a year',
      minutes: (n) => `${n} min`, hours: (n) => `${n} h`,
      dialOut: (m) => `${m} minutes a day`,
      dialSub: (w, y) => `${w} a week · about ${y} a year`,
      notifyOpen: 'Opening your email app — send the message and you are on the list.',
      relFallbackA: 'Release notes load from GitHub — if this does not resolve, ',
      relFallbackB: 'read them directly on GitHub',
      locale: 'en-US'
    },
    tr: {
      ready: 'Hazır', listening: 'Dinliyor', thinking: 'Düşünüyor',
      done: 'Tamam', error: 'Duyulmadı', copy: 'Kopyala',
      speak: 'Basılı tut, konuş', speakRelease: 'Bitirmek için bırak',
      micOn: 'Mikrofonumu kullan', micOff: 'Mikrofonu bırak',
      micDenied: 'Mikrofon reddedildi — kayıtlı örnek oynatılıyor.',
      micFail: 'Mikrofon bulunamadı — kayıtlı örnek oynatılıyor.',
      micLive: 'Canlı: ışık şeridi sesini bu sekmede okuyor. Hiçbir şey kaydedilmiyor, hiçbir yere gönderilmiyor.',
      typed: 'Meram bitmiş metni zaten içinde olduğun alana bırakır — pencere değiştirmeden, yapıştırmadan.',
      raw: 'ııı şu deploy konusunda, yani, bugün cloud flare üzerinde bir worker yazdım ve şey, p95 gecikme kırk milisaniyenin altında kaldı, ııı yarın da paddle webhook’unu bağlarım',
      fillers: 'ıı+ı*|ee+e*|şey|yani|hani|işte|falan|filan',
      dict: [['cloud flare', 'Cloudflare'], ['paddle', 'Paddle'], ['p95', 'p95']],
      tones: {
        neutral: 'Deploy konusunda: bugün Cloudflare üzerinde bir Worker yazdım ve p95 gecikme 40 ms’nin altında kaldı. Yarın Paddle webhook’unu bağlayacağım.',
        formal: 'Deploy süreciyle ilgili olarak bugün Cloudflare üzerinde bir Worker geliştirdim; p95 gecikme 40 ms’nin altında kaldı. Paddle webhook entegrasyonunu yarın tamamlayacağım.',
        casual: 'Bugün Cloudflare’de bir Worker yazdım, p95 gecikme 40 ms’nin altında kaldı. Paddle webhook’unu da yarın bağlarım.',
        bullets: '• Cloudflare üzerinde bir Worker yazıldı\n• p95 gecikme 40 ms’nin altında\n• Paddle webhook’u yarın bağlanacak'
      },
      toneNames: { neutral: 'Nötr', formal: 'Resmî', casual: 'Samimi', bullets: 'Madde imleri' },
      metaWords: (a, b) => `${a} kelime → ${b} kelime`,
      metaFill: (n) => `${n} duraksama silindi`,
      metaDict: (n) => `${n} sözlük terimi uygulandı`,
      perDay: 'günde', perWeek: 'haftada', perYear: 'yılda',
      minutes: (n) => `${n} dk`, hours: (n) => `${n} sa`,
      dialOut: (m) => `günde ${m} dakika`,
      dialSub: (w, y) => `haftada ${w} · yılda yaklaşık ${y}`,
      notifyOpen: 'E-posta uygulaman açılıyor — mesajı gönderdiğinde listedesin.',
      relFallbackA: 'Sürüm notları GitHub’dan yükleniyor — açılmazsa ',
      relFallbackB: 'doğrudan GitHub’da okuyabilirsin',
      locale: 'tr-TR'
    }
  };
  const T = I18N[LANG];

  function applyConfig() {
    const text = {
      'price-today': CONFIG.PRICE_TODAY === 0 ? (LANG === 'tr' ? 'Ücretsiz' : 'Free') : String(CONFIG.PRICE_TODAY),
      'plan-pro': '$' + CONFIG.PLAN_PRO_MONTHLY,
      'plan-byok': '$' + CONFIG.PLAN_BYOK_MONTHLY,
      'trial-days': String(CONFIG.TRIAL_DAYS),
      'platform-today': CONFIG.PLATFORM_TODAY,
      'support-email': CONFIG.SUPPORT_EMAIL,
      'dictation-wpm': String(CONFIG.DICTATION_WPM)
    };
    document.querySelectorAll('[data-cfg]').forEach((el) => {
      const k = el.getAttribute('data-cfg');
      if (k in text) el.textContent = text[k];
    });
    document.querySelectorAll('[data-cfg-href]').forEach((el) => {
      const k = el.getAttribute('data-cfg-href');
      if (k === 'support-email-mailto') el.href = 'mailto:' + CONFIG.SUPPORT_EMAIL;
      if (k === 'github-releases') el.href = `https://github.com/${CONFIG.GITHUB_REPO}/releases`;
    });
  }
  applyConfig();

  /* ══════════════════════  1. SPRING  ══════════════════════════════════
     Apple's two designer-facing parameters — damping ratio and response (in
     seconds). Not a duration: a spring has none; its settle time emerges. */

  const ticker = (() => {
    const subs = new Set();
    let raf = 0, last = 0;
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      subs.forEach((fn) => fn(dt, now));
      raf = subs.size ? requestAnimationFrame(frame) : 0;
    };
    return {
      add(fn) { subs.add(fn); if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
      remove(fn) { subs.delete(fn); }
    };
  })();

  class Spring {
    constructor({ value = 0, damping = 1, response = 0.4, onUpdate, onRest } = {}) {
      this.value = value; this.target = value; this.velocity = 0;
      this.damping = damping; this.response = response;
      this.onUpdate = onUpdate; this.onRest = onRest;
      this._running = false;
      this._tick = this._tick.bind(this);
    }
    setTarget(target, velocity) {
      this.target = target;
      if (velocity !== undefined) this.velocity = velocity;
      this.start();
    }
    hold(value) { this.stop(); this.value = value; this.target = value; this.velocity = 0; }
    start() {
      if (this._running) return;
      if (reduceMotion.matches) {
        this.value = this.target; this.velocity = 0;
        this.onUpdate && this.onUpdate(this.value);
        this.onRest && this.onRest(this.value);
        return;
      }
      this._running = true;
      ticker.add(this._tick);
    }
    stop() { if (this._running) { this._running = false; ticker.remove(this._tick); } }
    _tick(dt) {
      const w0 = (2 * Math.PI) / this.response;
      const z = this.damping;
      const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const a = -w0 * w0 * (this.value - this.target) - 2 * z * w0 * this.velocity;
        this.velocity += a * h;
        this.value += this.velocity * h;
      }
      this.onUpdate && this.onUpdate(this.value);
      if (Math.abs(this.value - this.target) < 0.0004 && Math.abs(this.velocity) < 0.0025) {
        this.value = this.target; this.velocity = 0;
        this.onUpdate && this.onUpdate(this.value);
        this.stop();
        this.onRest && this.onRest(this.value);
      }
    }
  }

  /* A spring driven by the shared loop instead of owning one — used inside
     the ribbon, where sixty of them starting and stopping would thrash. */
  class Follower {
    constructor(value, damping, response) {
      this.value = value; this.target = value; this.velocity = 0;
      this.damping = damping; this.response = response;
    }
    step(dt) {
      const w0 = (2 * Math.PI) / this.response;
      const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const a = -w0 * w0 * (this.value - this.target) - 2 * this.damping * w0 * this.velocity;
        this.velocity += a * h;
        this.value += this.velocity * h;
      }
      return this.value;
    }
  }

  const project = (velocity, decelerationRate = 0.998) =>
    (velocity / 1000) * decelerationRate / (1 - decelerationRate);
  const rubberband = (overshoot, dimension, constant = 0.55) =>
    (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
  function momentumTarget(value, velocity, { decel = 0.95, maxGlide = 0.18, lo = 0, hi = 1 } = {}) {
    const raw = project(velocity, decel);
    const glide = Math.max(-maxGlide, Math.min(maxGlide, raw));
    const scale = raw === 0 ? 1 : glide / raw;
    const target = clamp(value + glide, lo, hi);
    return { target, velocity: velocity * scale, atBound: target === lo || target === hi };
  }
  class Tracker {
    constructor() { this.samples = []; }
    reset() { this.samples.length = 0; }
    push(pos) {
      this.samples.push({ pos, t: performance.now() });
      while (this.samples.length > 6) this.samples.shift();
    }
    velocity() {
      const s = this.samples;
      if (s.length < 2) return 0;
      const last = s[s.length - 1];
      let first = s[0];
      for (let i = s.length - 1; i >= 0; i--) { if (last.t - s[i].t > 120) break; first = s[i]; }
      const dt = (last.t - first.t) / 1000;
      return dt <= 0.001 ? 0 : (last.pos - first.pos) / dt;
    }
  }

  /* ══════════════════════  2. REVEAL + NAV  ════════════════════════════ */

  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  const nav = document.getElementById('nav');
  const navLinks = [...document.querySelectorAll('.nav__links a')]
    .map((a) => {
      const href = a.getAttribute('href') || '';
      return { a, section: href.charAt(0) === '#' ? document.querySelector(href) : null };
    })
    .filter((x) => x.section);

  let currentLink = null;
  const spy = () => {
    const line = window.scrollY + innerHeight * 0.38;
    let found = null;
    navLinks.forEach((x) => { if (x.section.offsetTop <= line) found = x.a; });
    if (found === currentLink) return;
    if (currentLink) currentLink.classList.remove('is-current');
    if (found) found.classList.add('is-current');
    currentLink = found;
  };
  const onScroll = () => {
    if (nav) nav.classList.toggle('is-stuck', window.scrollY > 12);
    spy();
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ══════════════════════  3. VOICE  ═══════════════════════════════════
     Four bands, 0..1, the same shape the app's readBands() produces. Either
     from a real AnalyserNode, or synthesised with syllable gating so the
     scripted take moves like speech rather than like a sine wave. */

  function readBands(analyser, data) {
    analyser.getByteFrequencyData(data);
    const n = data.length;
    const edges = [0, Math.floor(n * 0.08), Math.floor(n * 0.22), Math.floor(n * 0.45), n];
    const boost = [1.7, 2.0, 2.4, 3.0];
    const out = [];
    for (let b = 0; b < 4; b++) {
      let sum = 0;
      for (let i = edges[b]; i < edges[b + 1]; i++) sum += data[i];
      out.push(Math.min(1, (sum / Math.max(1, edges[b + 1] - edges[b]) / 255) * boost[b]));
    }
    return out;
  }

  function makeVoice(seed = 1) {
    let t = seed * 3.1, gate = 0.42, open = true, syl = 0;
    return (dt) => {
      t += dt;
      gate -= dt;
      if (gate <= 0) {
        open = !open;
        /* Words run 0.24–0.5s, gaps 0.08–0.34s — a speaking rhythm, not a tone. */
        gate = open ? 0.24 + Math.random() * 0.26 : 0.08 + Math.random() * 0.26;
        if (open) syl = 0.55 + Math.random() * 0.45;
      }
      if (!open) return [0, 0, 0, 0];
      const e = syl * (0.65 + 0.35 * Math.sin(t * 15.5));
      return [
        clamp(e * (0.62 + 0.3 * Math.sin(t * 2.3))),
        clamp(e * (0.72 + 0.26 * Math.sin(t * 3.7 + 1))),
        clamp(e * (0.6 + 0.34 * Math.sin(t * 6.1 + 2))),
        clamp(e * (0.4 + 0.3 * Math.sin(t * 9.3 + 3)))
      ];
    };
  }

  /* Shared microphone lease. Opened only on a click, released the moment the
     page is done with it — the same discipline the app applies to its own
     recorder, and the reason the button says "release" rather than "stop". */
  const mic = {
    stream: null, ctx: null, analyser: null, data: null, active: false,
    async open() {
      if (this.active) return true;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('unsupported');
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true }
      });
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.72;
      src.connect(this.analyser);          // deliberately NOT connected to the destination
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      this.active = true;
      return true;
    },
    read() { return this.active ? readBands(this.analyser, this.data) : null; },
    close() {
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      if (this.ctx && this.ctx.state !== 'closed') this.ctx.close();
      this.stream = this.ctx = this.analyser = this.data = null;
      this.active = false;
    }
  };
  addEventListener('pagehide', () => mic.close());

  /* ══════════════════════  4. THE AURORA RIBBON  ═══════════════════════
     A faithful port. Three curtains of 64 samples over a 300×64 viewBox with
     16px amplitude and a sin(πu)^0.9 edge taper, a blurred copy of the thread
     for real emitted light, a 0.6px filament on top, and a comet with a
     trail. Spring constants converted from the app's framer-motion values:
     response = 2π/√(k/m), damping ratio = c/(2√(km)). */

  const TAU = Math.PI * 2;
  const CURTAINS = [
    { k1: 1.4, s1: 0.9,   k2: 2.2, s2: -0.6, phase: 0.0, scale: 1.0 },
    { k1: 2.3, s1: -1.15, k2: 3.1, s2: 0.7,  phase: 1.0, scale: 0.8 },
    { k1: 3.6, s1: 1.5,   k2: 4.7, s2: -0.9, phase: 2.1, scale: 0.6 }
  ];
  const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

  function curtainAmps(a) {
    return [
      [a[0] * 0.8 + a[1] * 0.4, a[1] * 0.22],
      [a[1] * 0.5 + a[2] * 0.6, a[2] * 0.28],
      [a[2] * 0.4 + a[3] * 0.7, a[3] * 0.24]
    ];
  }

  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs) => {
    const n = document.createElementNS(SVGNS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  class Ribbon {
    constructor(root, { W = 300, H = 64, N = 64, AMP = 16, id = 'r' } = {}) {
      this.W = W; this.H = H; this.N = N; this.AMP = AMP; this.CY = H / 2;
      this.root = root;
      this.mode = 'rest';
      this.reduced = reduceMotion.matches;
      this.held = [0, 0, 0, 0];
      this.bufs = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
      this.phase = 0; this.trail = [];
      this.igniteAt = -1e9; this.doneAt = -1e9; this.errAt = -1e9;
      this.prevMode = null; this.prevBass = 0; this.flash = 0;
      this.voice = makeVoice(2);
      this.source = null;                       // () => [b0..b3] | null

      this.bands = [
        new Follower(0, 1.140, 0.276),          // SPRING_LOW
        new Follower(0, 1.140, 0.276),
        new Follower(0, 1.056, 0.210),          // SPRING_MID
        new Follower(0, 0.985, 0.146)           // SPRING_HIGH
      ];
      this.think = new Follower(0, 1.197, 0.444);  // SPRING_THINK

      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
      const defs = el('defs');
      const filt = el('filter', { id: `ar-bloom-${id}`, filterUnits: 'userSpaceOnUse', x: -20, y: -H, width: W + 40, height: H * 3 });
      filt.appendChild(el('feGaussianBlur', { stdDeviation: 2.6 }));
      defs.appendChild(filt);
      svg.appendChild(defs);

      this.flashEl = el('circle', { class: 'ar__flash', cx: W / 2, cy: this.CY, r: 9, opacity: 0 });
      svg.appendChild(this.flashEl);

      const bloom = el('g', { class: 'ar__bloom', filter: `url(#ar-bloom-${id})` });
      this.bloomPaths = [2, 1, 0].map((i) => {
        const p = el('path', { class: `ar__b ar__b${i}` });
        bloom.appendChild(p);
        return { i, p };
      });
      svg.appendChild(bloom);

      const lines = el('g', { class: 'ar__lines' });
      this.linePaths = [2, 1, 0].map((i) => {
        const p = el('path', { class: `ar__line ar__l${i}` });
        lines.appendChild(p);
        return { i, p };
      });
      svg.appendChild(lines);

      this.filament = el('path', { class: 'ar__filament' });
      svg.appendChild(this.filament);

      const comet = el('g', { class: 'ar__comet' });
      this.tails = [3, 2, 1].map((k) => {
        const c = el('circle', { class: `ar__tail ar__t${k}`, r: k === 3 ? 0.8 : k === 2 ? 1.1 : 1.4, cx: W / 2, cy: this.CY });
        comet.appendChild(c);
        return c;
      }).reverse();
      this.head = el('circle', { class: 'ar__head', cx: W / 2, cy: this.CY, r: 1.8 });
      comet.appendChild(this.head);
      this.comet = comet;
      svg.appendChild(comet);

      /* The stage element keeps its own layout box; the ribbon gets a layer of
         its own inside it, so the capsule can still size itself from it. */
      const layer = document.createElement('span');
      layer.className = 'ar';
      layer.setAttribute('data-mode', 'rest');
      layer.setAttribute('data-theme', 'dark');
      layer.appendChild(svg);
      root.appendChild(layer);
      this.layer = layer;
    }

    setMode(mode) { this.mode = mode; }
    setSource(fn) { this.source = fn; }

    step(dt, tMs) {
      const { W, N, AMP, CY } = this;
      const t = tMs * 0.001;
      const reduced = this.reduced;
      const mode = this.mode;

      if (this.prevMode === null) this.igniteAt = tMs;
      if (this.prevMode !== 'speaking' && mode === 'speaking') this.igniteAt = tMs;
      if (this.prevMode !== 'done' && mode === 'done') { this.doneAt = tMs; this.flash = 1; }
      if (this.prevMode !== 'error' && mode === 'error') this.errAt = tMs;
      if (this.prevMode !== mode) {
        this.layer.setAttribute('data-mode', mode);
        this.layer.setAttribute('data-theme', mode === 'thinking' ? 'light' : 'dark');
      }
      this.prevMode = mode;

      const ignite = clamp(1 - (tMs - this.igniteAt) / 620);
      const errP = clamp(1 - (tMs - this.errAt) / 680);

      /* Peak-hold with an exponential release, so the thread is fluid but
         never jitters on a single loud frame. */
      if (mode === 'speaking') {
        const b = (this.source && this.source(dt)) || this.voice(dt);
        const fall = Math.pow(0.01, dt);
        for (let i = 0; i < 4; i++) this.held[i] = Math.max(b[i], this.held[i] * fall);
      } else {
        for (let i = 0; i < 4; i++) this.held[i] = 0;
      }

      const amps = this.bands.map((s, i) => { s.target = this.held[i]; return s.step(dt); });
      this.think.target = mode === 'thinking' ? 1 : 0;
      const think = this.think.step(dt);

      const energy = amps[0] * 0.4 + amps[1] * 0.3 + amps[2] * 0.2 + amps[3] * 0.1;
      const cAmps = curtainAmps(amps);
      const thinkBreath = reduced ? 0.35 : 0.55 + 0.45 * Math.sin(t * 0.9);
      const idleBreath = reduced ? 0 : Math.sin(t * 0.5);
      const dip = reduced || mode !== 'error' ? 0 : Math.sin(Math.PI * errP) * 3.2;

      for (let c = 0; c < CURTAINS.length; c++) {
        const cur = CURTAINS[c], buf = this.bufs[c];
        const a1 = cAmps[c][0], a2 = cAmps[c][1];
        for (let i = 0; i < N; i++) {
          const u = i / (N - 1);
          const edge = Math.pow(Math.sin(Math.PI * u), 0.9);
          const audio = reduced || mode !== 'speaking' ? 0
            : (Math.sin(u * TAU * cur.k1 + t * cur.s1 + cur.phase) * a1 +
               Math.sin(u * TAU * cur.k2 + t * cur.s2 + cur.phase) * a2) * AMP * cur.scale;
          const thinkWave = reduced ? 0
            : Math.sin(u * TAU * 1.3 + t * 1.1 + c * 0.5) * AMP * (0.3 - c * 0.07) * thinkBreath;
          const idle = c === 0 && !reduced ? edge * idleBreath * AMP * 0.03 * (1 - energy) * (1 - think) : 0;
          buf[i] = CY + edge * ((1 - think) * audio + think * thinkWave + dip) + idle;
        }
        /* Both stacks are built back-to-front (2,1,0), so curtain c lives at
           index 2−c in each — the glow and the crisp line share one path. */
        const d = this.buildPath(buf);
        this.bloomPaths[2 - c].p.setAttribute('d', d);
        this.linePaths[2 - c].p.setAttribute('d', d);
        if (c === 0) this.filament.setAttribute('d', d);
      }

      /* The comet. In "done" it stops orbiting and makes one decisive
         left-to-right sweep — the confirmation the user actually reads. */
      const inSweep = mode === 'done' && !reduced && tMs - this.doneAt < 560;
      let u, boost = 0;
      if (inSweep) {
        const p = Math.min(1, (tMs - this.doneAt) / 560);
        u = 0.06 + 0.88 * easeOutExpo(p);
        boost = 1 - p;
      } else {
        this.phase += (1.0 + energy * 3.4 + ignite * 5.5) * dt;
        u = 0.5 + 0.42 * Math.sin(this.phase);
      }
      const fi = u * (N - 1), i0 = Math.floor(fi), i1 = Math.min(N - 1, i0 + 1), fr = fi - i0;
      const core = this.bufs[0];
      const hx = u * W, hy = core[i0] * (1 - fr) + core[i1] * fr;

      this.trail.unshift([hx, hy]);
      if (this.trail.length > 18) this.trail.pop();
      const at = (k) => this.trail[Math.min(this.trail.length - 1, k)] || [hx, hy];
      this.head.setAttribute('cx', hx.toFixed(2)); this.head.setAttribute('cy', hy.toFixed(2));
      [[this.tails[0], 4], [this.tails[1], 9], [this.tails[2], 14]].forEach(([c, k]) => {
        const p = at(k);
        c.setAttribute('cx', p[0].toFixed(2)); c.setAttribute('cy', p[1].toFixed(2));
      });

      const edgeC = Math.pow(Math.sin(Math.PI * u), 0.9);
      let vis = (1 - think) * (0.55 + 0.45 * edgeC) * (0.6 + 0.4 * ignite + energy * 0.5) + boost * 0.6;
      if (reduced || mode === 'error') vis = 0;
      this.comet.setAttribute('opacity', Math.min(1, vis).toFixed(3));
      this.head.setAttribute('r', (1.7 + energy * 2.4 + ignite * 1.6 + boost * 2).toFixed(2));

      if (mode === 'speaking' && !reduced) {
        const b = amps[0];
        if (b - this.prevBass > 0.16 && b > 0.45) this.flash = 1;
        this.prevBass = b;
      } else this.prevBass = 0;
      this.flash *= Math.pow(0.015, dt);
      this.flashEl.setAttribute('opacity', (reduced ? 0 : this.flash * 0.5 * (1 - think)).toFixed(3));
    }

    buildPath(ys) {
      const n = ys.length, W = this.W;
      const x = (i) => (i / (n - 1)) * W;
      let d = `M${x(0).toFixed(2)} ${ys[0].toFixed(2)}`;
      for (let i = 1; i < n - 1; i++) {
        const xc = (x(i) + x(i + 1)) / 2, yc = (ys[i] + ys[i + 1]) / 2;
        d += `Q${x(i).toFixed(2)} ${ys[i].toFixed(2)} ${xc.toFixed(2)} ${yc.toFixed(2)}`;
      }
      d += `T${x(n - 1).toFixed(2)} ${ys[n - 1].toFixed(2)}`;
      return d;
    }
  }

  /* ══════════════════════  5. THE HERO DEMO  ═══════════════════════════
     One capsule over somebody else's window. The take runs: hold → speak →
     think → done → the text types itself into the field and the capsule
     evaporates. Either scripted, or driven by a real microphone. */

  const heroPill = document.getElementById('heroPill');
  let heroRibbon = null, heroVisible = false;

  if (heroPill) {
    const ribbonHost = heroPill.querySelector('.pill__ribbon');
    heroRibbon = new Ribbon(ribbonHost, { id: 'hero' });

    const holder = document.getElementById('pillHolder');
    const labelEl = document.getElementById('pillLabel');
    const copyBtn = document.getElementById('pillCopy');
    const appText = document.getElementById('appText');
    const appWin = document.getElementById('appWin');
    const chord = document.getElementById('heroChord');
    const runBtn = document.getElementById('demoRun');
    const micBtn = document.getElementById('demoMic');
    const noteEl = document.getElementById('demoNote');

    /* The label cross-fades by swapping elements rather than by rewriting
       text — a word that changes mid-transition reads as a glitch. */
    let labelRef = labelEl;
    const label = (txt) => {
      if (!labelRef || labelRef.textContent === txt) return;
      const old = labelRef;
      const next = old.cloneNode(false);
      next.textContent = txt;
      next.classList.add('is-in-from');
      old.parentNode.appendChild(next);
      old.classList.add('is-out');
      requestAnimationFrame(() => next.classList.remove('is-in-from'));
      setTimeout(() => { if (old.parentNode) old.remove(); }, 240);
      labelRef = next;
    };

    let state = 'idle', timers = [], typeTimer = 0, micMode = false;
    const clearTimers = () => { timers.forEach(clearTimeout); timers.length = 0; clearInterval(typeTimer); };
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));

    const setState = (s) => {
      state = s;
      heroPill.setAttribute('data-status', s === 'idle' ? 'idle' : s);
      heroPill.setAttribute('data-theme', s === 'thinking' ? 'light' : 'dark');
      heroRibbon.setMode(s === 'listening' ? 'speaking' : s === 'idle' ? 'rest' : s);
      label(s === 'idle' ? T.ready : s === 'listening' ? T.listening : s === 'thinking' ? T.thinking : s === 'error' ? T.error : T.done);
      if (chord) chord.classList.toggle('is-down', s === 'listening');
      if (holder) holder.classList.remove('is-hidden');
      if (runBtn) runBtn.setAttribute('aria-pressed', String(s === 'listening'));
    };

    const typeOut = (text, done) => {
      if (!appText) return done && done();
      appText.textContent = '';
      appWin && appWin.classList.add('is-target');
      if (reduceMotion.matches) { appText.textContent = text; return done && done(); }
      let i = 0;
      clearInterval(typeTimer);
      typeTimer = setInterval(() => {
        /* Meram commits in one transaction, but a page that pasted the whole
           paragraph at once would read as a screenshot. This types fast
           enough to feel like a machine and slow enough to be watchable. */
        i = Math.min(text.length, i + 2);
        appText.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(typeTimer); done && done(); }
      }, 22);
    };

    const reset = () => {
      clearTimers();
      setState('idle');
      if (appText) appText.textContent = '';
      appWin && appWin.classList.remove('is-target');
    };

    const finish = () => {
      setState('thinking');
      later(() => {
        setState('done');
        later(() => typeOut(T.tones.neutral, () => {
          later(() => {
            /* "Evaporates when done" — it does not pop out, it fades. */
            holder && holder.classList.add('is-hidden');
            later(() => { if (state === 'done') reset(); }, 900);
          }, 700);
        }), 380);
      }, 1150);
    };

    const startScripted = () => {
      clearTimers();
      if (appText) appText.textContent = '';
      heroRibbon.setSource(null);
      setState('listening');
      later(finish, 3400);
    };

    runBtn && runBtn.addEventListener('click', () => {
      if (state === 'listening' && !micMode) { clearTimers(); finish(); return; }
      startScripted();
    });

    /* The real thing: hold the actual shortcut on this page. */
    addEventListener('keydown', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (!e.shiftKey || e.code !== 'Space') return;
      if (e.repeat) return;
      e.preventDefault();
      if (state !== 'listening') startScripted();
    });

    /* Microphone: opened on a click, released the moment the take ends. The
       analyser is never connected to the destination, so nothing is played
       back and nothing is recorded. */
    const micStop = () => {
      micMode = false;
      heroRibbon.setSource(null);
      mic.close();
      if (micBtn) { micBtn.textContent = T.micOn; micBtn.classList.remove('is-live'); micBtn.setAttribute('aria-pressed', 'false'); }
      if (noteEl) noteEl.textContent = '';
    };

    micBtn && micBtn.addEventListener('click', async () => {
      if (micMode) { micStop(); reset(); return; }
      try {
        await mic.open();
        micMode = true;
        heroRibbon.setSource(() => mic.read() || [0, 0, 0, 0]);
        micBtn.textContent = T.micOff;
        micBtn.classList.add('is-live');
        micBtn.setAttribute('aria-pressed', 'true');
        if (noteEl) noteEl.textContent = T.micLive;
        clearTimers();
        if (appText) appText.textContent = '';
        setState('listening');
      } catch (err) {
        if (noteEl) noteEl.textContent = err && err.name === 'NotAllowedError' ? T.micDenied : T.micFail;
        micMode = false;
        startScripted();
      }
    });

    copyBtn && copyBtn.addEventListener('click', () => {
      const txt = (appText && appText.textContent) || T.tones.neutral;
      if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
      copyBtn.textContent = '✓';
      setTimeout(() => { copyBtn.textContent = T.copy; }, 1200);
    });
    if (copyBtn) copyBtn.textContent = T.copy;
    if (micBtn) micBtn.textContent = T.micOn;

    setState('idle');

    new IntersectionObserver((es) => {
      heroVisible = es[0].isIntersecting;
      /* An off-screen microphone stays open only as long as it is being
         watched — leaving it live in a background tab would be indefensible. */
      if (!heroVisible && micMode) { micStop(); reset(); }
    }, { threshold: 0.08 }).observe(heroPill);

    ticker.add((dt, now) => { if (heroVisible) heroRibbon.step(dt, now); });

    /* Run the scripted take once, shortly after it is first seen. With reduced
       motion the take is not played at all — but an empty mock-up would say
       nothing, so it is shown already finished instead. The still frame is the
       equivalent, not the absence of one. */
    if (!reduceMotion.matches) {
      let fired = false;
      new IntersectionObserver((es) => {
        if (es[0].isIntersecting && !fired) { fired = true; setTimeout(() => { if (state === 'idle') startScripted(); }, 1100); }
      }, { threshold: 0.35 }).observe(heroPill);
    } else {
      setState('done');
      if (appText) appText.textContent = T.tones.neutral;
      appWin && appWin.classList.add('is-target');
    }
  }

  /* The same capsule, frozen in the state nobody designs for: the commit
     failed, the text is on the clipboard, and the only control the capsule
     ever grows is the one that gives it back. */
  const fallbackPill = document.getElementById('fallbackPill');
  if (fallbackPill) {
    const r = new Ribbon(fallbackPill.querySelector('.pill__ribbon'), { id: 'fb' });
    r.setMode('done');
    const lbl = fallbackPill.querySelector('.pill__labelText');
    if (lbl) lbl.textContent = T.done;
    const cp = fallbackPill.querySelector('.pill__copy');
    if (cp) cp.textContent = T.copy;
    let on = false;
    new IntersectionObserver((es) => { on = es[0].isIntersecting; }, { threshold: 0.2 }).observe(fallbackPill);
    ticker.add((dt, now) => { if (on) r.step(dt, now); });
  }

  /* ══════════════════════  6. THE FLOW  ════════════════════════════════
     The page runs the capsule's own five states at poster scale. Act 03 is
     "thinking", and the product turns to paper while it thinks — so the
     viewport does too. */

  const flow = document.getElementById('flow');
  const flowCanvas = document.getElementById('flowCanvas');

  if (flow && flowCanvas && !reduceMotion.matches) {
    const ctx = flowCanvas.getContext('2d');
    const acts = [...flow.querySelectorAll('.act')];
    const stepEl = document.getElementById('flowStep');
    const railEl = document.getElementById('flowRail');
    const sticky = flow.querySelector('.flow__sticky');

    let W = 0, H = 0, dpr = 1, progress = 0, current = -1, time = 0, visible = false;
    const voice = makeVoice(5);
    const held = [0, 0, 0, 0];
    const bands = [new Follower(0, 1.14, 0.276), new Follower(0, 1.14, 0.276),
                   new Follower(0, 1.056, 0.21), new Follower(0, 0.985, 0.146)];
    const paper = new Follower(0, 1, 0.55);
    let cometPhase = 0, doneAt = -1e9, trail = [];

    const resize = () => {
      const r = flowCanvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      flowCanvas.width = Math.round(W * dpr);
      flowCanvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(sticky);

    const readProgress = () => {
      const rect = flow.getBoundingClientRect();
      const total = flow.offsetHeight - innerHeight;
      progress = total > 0 ? clamp(-rect.top / total) : 0;
    };

    const setAct = (i) => {
      if (i === current) return;
      if (i === 3 && current !== 3) doneAt = performance.now();
      current = i;
      acts.forEach((a, k) => a.classList.toggle('is-on', k === i));
      if (stepEl) stepEl.textContent = String(i + 1).padStart(2, '0');
      const isPaper = i === 2;
      sticky.classList.toggle('is-paper', isPaper);
      if (nav) nav.classList.toggle('is-inverted', isPaper && flow.getBoundingClientRect().top <= 0);
    };

    /* Where the copy column actually is, measured rather than guessed — the
       thread then fits whatever space is left and can never run under type. */
    const copyBox = () => {
      const a = acts.find((x) => x.classList.contains('is-on')) || acts[0];
      const c = flowCanvas.getBoundingClientRect();
      if (!a) return { right: W * 0.5, top: H };
      const r = a.getBoundingClientRect();
      return { right: r.right - c.left, top: r.top - c.top };
    };

    const mixInk = (t, alpha) => {
      /* white light → #1C1C1E ink, in step with the paper flip. */
      const r = Math.round(lerp(255, 28, t)), g = Math.round(lerp(255, 28, t)), b = Math.round(lerp(255, 30, t));
      return `rgba(${r},${g},${b},${alpha})`;
    };

    function draw(dt) {
      if (!W) return;
      ctx.clearRect(0, 0, W, H);

      const p = progress;
      const act = current;
      const speakP = smoothstep(0.13, 0.28, p) * (1 - smoothstep(0.36, 0.46, p));
      paper.target = act === 2 ? 1 : 0;
      const ink = paper.step(dt);

      /* Voice only while the speaking act is on screen. */
      if (act === 1) {
        const b = voice(dt);
        const fall = Math.pow(0.01, dt);
        for (let i = 0; i < 4; i++) held[i] = Math.max(b[i], held[i] * fall);
      } else {
        for (let i = 0; i < 4; i++) held[i] *= Math.pow(0.02, dt);
      }
      const amps = bands.map((s, i) => { s.target = held[i]; return s.step(dt); });
      const energy = amps[0] * 0.4 + amps[1] * 0.3 + amps[2] * 0.2 + amps[3] * 0.1;
      const cAmps = curtainAmps(amps);

      const wide = W > 1080;
      const box = copyBox();
      const bandTop = wide ? H * 0.16 : 100;
      const bandBottom = wide ? H * 0.84 : Math.max(bandTop + 80, box.top - 26);
      const centerY = (bandTop + bandBottom) / 2;
      const available = bandBottom - bandTop;

      const left = wide ? Math.min(box.right + 64, W * 0.6) : W * 0.06;
      const right = wide ? W * 0.93 : W * 0.92;
      const span = right - left;
      const AMP = Math.min(available * 0.34, 130);

      /* Act 05 forks: the proven target above, the clipboard fallback below. */
      const forkP = smoothstep(0.80, 0.94, p);
      const targetY = centerY - Math.min(available * 0.19, 78);
      const clipY = centerY + Math.min(available * 0.19, 78);

      const N = 128;
      const thinkBreath = 0.55 + 0.45 * Math.sin(time * 0.9);

      for (let c = 0; c < CURTAINS.length; c++) {
        const cur = CURTAINS[c];
        const a1 = cAmps[c][0], a2 = cAmps[c][1];
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const edge = Math.pow(Math.sin(Math.PI * u), 0.9);
          const audio = (Math.sin(u * TAU * cur.k1 + time * cur.s1 + cur.phase) * a1 +
                         Math.sin(u * TAU * cur.k2 + time * cur.s2 + cur.phase) * a2) * AMP * cur.scale * speakP;
          const thinkWave = Math.sin(u * TAU * 1.3 + time * 1.1 + c * 0.5) * AMP * (0.22 - c * 0.05) * thinkBreath * ink;
          const idle = c === 0 ? edge * Math.sin(time * 0.5) * 3 * (1 - energy) : 0;
          /* The lane bends toward its destination only in the final act. */
          const bend = forkP * smoothstep(0.46, 1, u);
          const home = lerp(centerY, c === 2 ? clipY : targetY, bend);
          const y = home + edge * (audio + thinkWave) + idle;
          const x = left + u * span;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        /* The app draws 1.6px on a 34px capsule. At stage scale that same
           ratio is what keeps the thread reading as one thing rather than a
           hairline — so the stroke is derived from the amplitude, not fixed. */
        const scale = clamp(AMP / 46, 1, 2.6);
        const w = [1.6, 1.1, 0.8][c] * scale;
        const alpha = [1, 0.62, 0.4][c];
        /* Emitted light: a wide soft pass under a crisp one. On paper the
           glow is switched off entirely, because ink does not glow. */
        if (ink < 0.99) {
          ctx.save();
          ctx.strokeStyle = mixInk(ink, alpha * 0.5 * (1 - ink));
          ctx.lineWidth = w * 2.4;
          ctx.shadowColor = `rgba(255,255,255,${0.55 * (1 - ink)})`;
          ctx.shadowBlur = 16;
          ctx.stroke();
          ctx.restore();
        }
        ctx.strokeStyle = mixInk(ink, alpha);
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      /* The comet. One decisive sweep when act 04 arrives, orbiting otherwise. */
      const now = performance.now();
      const inSweep = act === 3 && now - doneAt < 900;
      let u;
      if (inSweep) u = 0.06 + 0.88 * easeOutExpo(Math.min(1, (now - doneAt) / 900));
      else { cometPhase += (0.7 + energy * 2.6) * dt; u = 0.5 + 0.42 * Math.sin(cometPhase); }
      const edgeC = Math.pow(Math.sin(Math.PI * u), 0.9);
      const cx = left + u * span;
      const cy = lerp(centerY, targetY, forkP * smoothstep(0.46, 1, u)) +
                 edgeC * (Math.sin(u * TAU * 1.4 + time * 0.9) * AMP * cAmps[0][0] * speakP);
      trail.unshift([cx, cy]);
      if (trail.length > 16) trail.pop();
      const cometVis = (1 - ink) * (0.5 + 0.5 * edgeC);
      if (cometVis > 0.02) {
        ctx.save();
        ctx.shadowColor = 'rgba(255,255,255,.9)';
        ctx.shadowBlur = 14;
        trail.forEach(([tx, ty], i) => {
          ctx.beginPath();
          ctx.arc(tx, ty, Math.max(0.6, 3.4 - i * 0.2), 0, TAU);
          ctx.fillStyle = `rgba(255,255,255,${cometVis * (1 - i / trail.length) * 0.8})`;
          ctx.fill();
        });
        ctx.restore();
      }

      /* Act 04: the text materialises at the end of the thread — the moment
         the dictation stops being sound and becomes somebody's sentence. It
         clears again as act 05 forks, so the two ideas never share the frame. */
      const landP = act >= 3 ? smoothstep(0.62, 0.76, p) * (1 - forkP) : 0;
      if (landP > 0.01) {
        const lines = [0.86, 1, 0.72, 0.44];
        const lx = wide ? right - Math.min(span * 0.42, 260) : left;
        const lw = wide ? Math.min(span * 0.42, 260) : span * 0.8;
        ctx.save();
        lines.forEach((frac, i) => {
          const a = clamp((landP - i * 0.1) / 0.5);
          if (a <= 0) return;
          ctx.fillStyle = `rgba(255,255,255,${0.13 * a})`;
          const y = targetY + 26 + i * 13;
          const wpx = lw * frac * a;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(lx, y, wpx, 5, 2.5);
          else ctx.rect(lx, y, wpx, 5);
          ctx.fill();
        });
        ctx.restore();
      }

      /* Act 05: two named destinations, and the honest one is dashed. */
      if (forkP > 0.03) {
        ctx.save();
        ctx.globalAlpha = forkP;
        const endX = Math.min(right + 24, W - 4);
        [[targetY, LANG === 'tr' ? 'KANITLANMIŞ HEDEF' : 'PROVEN TARGET', false],
         [clipY, LANG === 'tr' ? 'PANO — YEDEK' : 'CLIPBOARD — FALLBACK', true]].forEach(([y, name, dashed]) => {
          ctx.strokeStyle = 'rgba(255,255,255,.2)';
          ctx.lineWidth = 1;
          ctx.setLineDash(dashed ? [4, 5] : []);
          ctx.beginPath();
          ctx.moveTo(right, y); ctx.lineTo(endX, y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,255,255,.52)';
          ctx.font = '600 10px -apple-system, system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(name, endX, y - 7);
          ctx.textAlign = 'left';
        });
        ctx.restore();
      }
    }

    ticker.add((dt) => {
      if (!visible) return;
      time += dt;
      readProgress();
      setAct(Math.min(acts.length - 1, Math.floor(progress * acts.length)));
      if (railEl) railEl.style.width = (progress * 100).toFixed(1) + '%';
      draw(dt);
    });
    /* The inverted nav has to let go the moment the stage stops covering it. */
    addEventListener('scroll', () => {
      if (!nav || !sticky.classList.contains('is-paper')) return;
      const r = flow.getBoundingClientRect();
      nav.classList.toggle('is-inverted', r.top <= 0 && r.bottom > 80);
    }, { passive: true });

    resize();
    addEventListener('resize', resize, { passive: true });
    readProgress();
    setAct(0);
    draw(0.016);
  }

  /* A quieter thread across the full-bleed beat — same engine, one curtain. */
  const bleedCanvas = document.getElementById('bleedThread');
  if (bleedCanvas && !reduceMotion.matches) {
    const ctx = bleedCanvas.getContext('2d');
    let W = 0, H = 0, t = 0, on = false;
    const resize = () => {
      const r = bleedCanvas.getBoundingClientRect();
      if (!r.width) return;
      const d = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      bleedCanvas.width = Math.round(W * d); bleedCanvas.height = Math.round(H * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    new IntersectionObserver((es) => { on = es[0].isIntersecting; }, { threshold: 0 }).observe(bleedCanvas);
    ticker.add((dt) => {
      if (!on || !W) return;
      t += dt;
      ctx.clearRect(0, 0, W, H);
      const cy = H * 0.5, amp = Math.min(H * 0.16, 54);
      for (let c = 0; c < 2; c++) {
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const u = i / 120;
          const edge = Math.pow(Math.sin(Math.PI * u), 0.9);
          const y = cy + edge * Math.sin(u * TAU * (1.3 + c * 0.9) + t * (0.55 - c * 0.2)) * amp * (1 - c * 0.45);
          const x = u * W;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${0.1 - c * 0.045})`;
        ctx.lineWidth = 1.4 - c * 0.5;
        ctx.shadowColor = 'rgba(255,255,255,.35)';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();
      }
    });
    resize();
    addEventListener('resize', resize, { passive: true });
  }

  /* ══════════════════════  7. THE REFINE DEMO  ═════════════════════════
     The disfluency pass is computed here, in front of you, from the raw
     string. The tone rewrites are recorded examples of what the model
     returns — the page says so rather than pretending otherwise. */

  const rewrite = document.getElementById('rewrite');
  if (rewrite) {
    const rawEl = document.getElementById('rewriteRaw');
    const outEl = document.getElementById('rewriteOut');
    const metaEl = document.getElementById('rewriteMeta');
    const nameEl = document.getElementById('rewriteTone');
    const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

    /* Turkish's ı, ş, ç, ğ are not \w, so \b cannot see the edges of "ııı" or
       "şey" — the boundary has to be Unicode-aware, which needs a lookbehind.
       Built through new RegExp with a fallback, so an engine without lookbehind
       degrades to the ASCII boundary instead of throwing a syntax error and
       taking the whole file down with it. */
    const tokenRe = (alt) => {
      try { return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})(?![\\p{L}\\p{N}])[,]?\\s*`, 'giu'); }
      catch (_) { return new RegExp(`\\b(?:${alt})\\b[,]?\\s*`, 'gi'); }
    };

    const raw = T.raw;
    const fillerMatches = raw.match(tokenRe(T.fillers)) || [];

    /* Left pane: what you said, with the removals struck through and the
       dictionary hits marked, so nothing is taken out invisibly. */
    let markedRaw = esc(raw).replace(tokenRe(T.fillers), (m) => `<s>${m.trim()}</s> `);
    let dictHits = 0;
    T.dict.forEach(([from, to]) => {
      /* Compared exactly, not case-insensitively: "paddle → Paddle" is a real
         dictionary correction and the most common kind there is. Only a term
         that is already identical has nothing to apply. */
      if (from === to) return;
      const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      if (re.test(markedRaw)) dictHits++;
      markedRaw = markedRaw.replace(re, (m) => `<mark>${m}</mark>`);
    });
    if (rawEl) rawEl.innerHTML = markedRaw;

    const paint = (tone) => {
      const out = T.tones[tone] || T.tones.neutral;
      let html = esc(out);
      T.dict.forEach(([from, to]) => {
        /* Only terms the dictionary actually changed are marked — otherwise the
           highlight count would not match the "n terms applied" figure. */
        if (!to || from === to) return;
        const re = new RegExp(to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        html = html.replace(re, (m) => `<mark>${m}</mark>`);
      });
      if (outEl) outEl.innerHTML = html.replace(/\n/g, '<br>');
      if (nameEl) nameEl.textContent = T.toneNames[tone] || '';
      if (metaEl) {
        metaEl.innerHTML = [
          T.metaWords(words(raw), words(out.replace(/[•\n]/g, ' '))),
          T.metaFill(fillerMatches.length),
          T.metaDict(dictHits)
        ].map((s) => `<span>${esc(s)}</span>`).join('');
      }
    };

    rewrite.querySelectorAll('[data-tone]').forEach((chip) => {
      chip.addEventListener('click', () => {
        rewrite.querySelectorAll('[data-tone]').forEach((c) => c.classList.toggle('is-on', c === chip));
        paint(chip.dataset.tone);
      });
    });
    paint('neutral');
  }

  /* ══════════════════════  8. THE ARITHMETIC  ══════════════════════════
     Two sliders and division. Every number under them is computed from the
     numbers in them — the one claim on this page you can check yourself. */

  const dial = document.getElementById('dial');
  if (dial) {
    const WORDS_MIN = 200, WORDS_MAX = 4000;
    const WPM_MIN = 20, WPM_MAX = 90;
    const outBig = document.getElementById('dialBig');
    const outSub = document.getElementById('dialSub');

    const fmtDur = (mins) => {
      if (mins < 60) return T.minutes(Math.round(mins));
      const h = Math.floor(mins / 60), m = Math.round(mins % 60);
      return m ? `${T.hours(h)} ${T.minutes(m)}` : T.hours(h);
    };
    /* The yearly figure stays in hours. "2.1 days" sounds like two days off
       and is really fifty working hours — the vaguer unit reads as the bigger
       claim, which is the wrong way round for a number meant to be checked. */
    const fmtLong = (mins) => (mins < 60 ? fmtDur(mins) : T.hours(Math.round(mins / 60)));

    const st = { words: 900, wpm: 45 };
    const recompute = () => {
      const typeMin = st.words / st.wpm;
      const speakMin = st.words / CONFIG.DICTATION_WPM;
      const savedPerDay = Math.max(0, typeMin - speakMin);
      if (outBig) outBig.textContent = T.dialOut(Math.round(savedPerDay));
      if (outSub) outSub.textContent = T.dialSub(fmtDur(savedPerDay * 5), fmtLong(savedPerDay * CONFIG.WORKDAYS_PER_YEAR));
    };

    const bind = (id, key, min, max, fmt) => {
      const root = document.getElementById(id);
      if (!root) return;
      const fill = root.querySelector('.slider__fill');
      const knob = root.querySelector('.slider__knob');
      const valueEl = document.getElementById(id + 'Value');
      const spring = new Spring({ value: (st[key] - min) / (max - min), damping: 1, response: 0.3 });
      const paint = (v) => {
        const t = clamp(v);
        fill.style.width = t * 100 + '%';
        knob.style.left = t * 100 + '%';
        st[key] = Math.round(lerp(min, max, t) / (key === 'words' ? 25 : 1)) * (key === 'words' ? 25 : 1);
        if (valueEl) valueEl.textContent = fmt(st[key]);
        knob.setAttribute('aria-valuenow', String(st[key]));
        recompute();
      };
      spring.onUpdate = paint;
      paint(spring.value);
      makeDraggable({ handle: knob, hitArea: root, spring, onInput: paint,
        onDragChange: (on) => root.classList.toggle('is-drag', on) });
    };

    function makeDraggable({ handle, hitArea, spring, onInput, onDragChange }) {
      const tracker = new Tracker();
      let dragging = false, grabOffset = 0, extent = 1;
      const posToValue = (px) => {
        const r = hitArea.getBoundingClientRect();
        return r.width ? (px - r.left) / r.width : 0;
      };
      hitArea.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        hitArea.setPointerCapture(e.pointerId);
        dragging = true;
        extent = hitArea.getBoundingClientRect().width;
        const onHandle = handle && (e.target === handle || handle.contains(e.target));
        grabOffset = onHandle ? posToValue(e.clientX) - spring.value : 0;
        const rawV = onHandle ? spring.value : clamp(posToValue(e.clientX));
        spring.hold(rawV); onInput(rawV);
        tracker.reset(); tracker.push(e.clientX);
        onDragChange && onDragChange(true);
      });
      hitArea.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        e.preventDefault();
        tracker.push(e.clientX);
        const rawV = posToValue(e.clientX) - grabOffset;
        let shown = rawV;
        if (rawV > 1) shown = 1 + rubberband((rawV - 1) * extent, extent) / extent;
        else if (rawV < 0) shown = rubberband(rawV * extent, extent) / extent;
        spring.hold(shown); onInput(shown);
      });
      const end = (e) => {
        if (!dragging) return;
        dragging = false;
        try { hitArea.releasePointerCapture(e.pointerId); } catch (_) {}
        onDragChange && onDragChange(false);
        const m = momentumTarget(spring.value, tracker.velocity() / extent);
        const thrown = Math.abs(m.velocity) > 0.3 && !m.atBound;
        spring.damping = thrown ? 0.82 : 1;
        spring.response = thrown ? 0.4 : 0.32;
        spring.setTarget(m.target, m.velocity);
      };
      hitArea.addEventListener('pointerup', end);
      hitArea.addEventListener('pointercancel', end);
      if (handle) handle.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 0.01 : 0.05;
        let next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = clamp(spring.value + step);
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = clamp(spring.value - step);
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = 1;
        if (next === null) return;
        e.preventDefault();
        spring.damping = 1; spring.response = 0.3;
        spring.setTarget(next, 0);
      });
    }

    bind('dialWords', 'words', WORDS_MIN, WORDS_MAX, (v) => v.toLocaleString(T.locale));
    bind('dialWpm', 'wpm', WPM_MIN, WPM_MAX, (v) => `${v} ${LANG === 'tr' ? 'kelime/dk' : 'wpm'}`);
    recompute();
  }

  /* ══════════════════════  9. RELEASES  ════════════════════════════════
     Download buttons point at a real /download/ page so they still go
     somewhere with JS off; this swaps in the actual asset when GitHub
     answers. The changelog renders from the same source rather than a
     hand-typed history that drifts the moment a build ships. */

  async function fetchLatestRelease() {
    try {
      const res = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO}/releases`);
      if (!res.ok) return null;
      const list = await res.json();
      if (!Array.isArray(list) || !list.length) return null;
      const rel = list[0];
      const asset = (rel.assets || []).find((a) => /\.exe$/i.test(a.name)) ||
                    (rel.assets || []).find((a) => /\.(dmg|zip)$/i.test(a.name));
      if (asset) document.querySelectorAll('.js-latest').forEach((b) => { b.href = asset.browser_download_url; });
      const v = document.getElementById('dlVersion');
      if (v && rel.tag_name) v.textContent = rel.tag_name;
      const size = document.getElementById('dlSize');
      if (size && asset) size.textContent = (asset.size / 1048576).toFixed(1) + ' MB';
      return list;
    } catch (_) { return null; }
  }

  const releaseListEl = document.getElementById('releaseList');
  fetchLatestRelease().then((list) => {
    if (!releaseListEl) return;
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    if (!list) {
      releaseListEl.innerHTML = `<p class="body body--sm">${T.relFallbackA}<a href="https://github.com/${CONFIG.GITHUB_REPO}/releases">${T.relFallbackB}</a>.</p>`;
      return;
    }
    const fmtDate = (iso) => new Date(iso).toLocaleDateString(T.locale, { year: 'numeric', month: 'long', day: 'numeric' });
    releaseListEl.innerHTML = list.map((rel, i) => {
      const body = (rel.body || '—').split(/\r?\n/).map((l) => esc(l.trim())).filter(Boolean)
        .map((l) => `<p>${l}</p>`).join('');
      const tag = i === 0 ? `<span class="release__tag">${rel.prerelease ? (LANG === 'tr' ? 'Güncel beta' : 'Current beta') : (LANG === 'tr' ? 'En son' : 'Latest')}</span>` : '';
      return `<article class="release">
        <div class="release__head">
          <span class="release__version">${esc(rel.name || rel.tag_name)}</span>
          ${tag}
          <time class="release__date" datetime="${esc(rel.published_at || '')}">${rel.published_at ? fmtDate(rel.published_at) : ''}</time>
        </div>
        <div class="body body--sm body--wide">${body}</div>
      </article>`;
    }).join('');
  });

  /* ══════════════════════  10. NOTIFY  ═════════════════════════════════
     PURCHASE_ENABLED gates two entirely real flows and never a dead end.
     Off: a working email capture. On: the checkout, once one exists. */

  const notifyModal = document.getElementById('notifyModal');
  document.querySelectorAll('.js-notify').forEach((btn) => {
    if (CONFIG.PURCHASE_ENABLED && CONFIG.CHECKOUT_URL) { btn.href = CONFIG.CHECKOUT_URL; return; }
    if (!notifyModal) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      notifyModal.showModal();
      const email = notifyModal.querySelector('input[type="email"]');
      if (email) email.focus();
    });
  });
  if (notifyModal) {
    const form = notifyModal.querySelector('form');
    const note = notifyModal.querySelector('.modal__note');
    const closeBtn = notifyModal.querySelector('.modal__close');
    form && form.addEventListener('submit', (e) => {
      e.preventDefault();
      const field = form.querySelector('input[type="email"]');
      const value = field ? field.value.trim() : '';
      if (!value) return;
      const subject = encodeURIComponent(LANG === 'tr' ? 'Meram Pro çıkınca haber ver' : 'Notify me when Meram Pro ships');
      const body = encodeURIComponent(`${value}`);
      window.location.href = `mailto:${CONFIG.SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
      if (note) { note.hidden = false; note.textContent = T.notifyOpen; }
    });
    closeBtn && closeBtn.addEventListener('click', () => notifyModal.close());
    notifyModal.addEventListener('click', (e) => { if (e.target === notifyModal) notifyModal.close(); });
  }

  /* ══════════════════════  11. LIVE CLOCK IN THE MOCK-UP  ══════════════
     A frozen 9:41 is a screenshot tell. The mock-up reads the visitor's own
     clock, because their desktop would. */
  const clockEl = document.querySelector('.taskbar__clock');
  if (clockEl) {
    const paint = () => {
      const d = new Date();
      clockEl.textContent = d.toLocaleTimeString(T.locale, { hour: '2-digit', minute: '2-digit' });
    };
    paint();
    setInterval(paint, 20000);
  }
})();
