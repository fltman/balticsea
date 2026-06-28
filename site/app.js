/* ===== Östersjön — en resa neråt ===== */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const ICON_SPEAKER = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z"/><path d="M14 3.2v2.1c2.9.9 5 3.6 5 6.7s-2.1 5.8-5 6.7v2.1c4-.9 7-4.5 7-8.8s-3-7.9-7-8.8z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  const ICON_MIC = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/><path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V23h2v-3.06A9 9 0 0 0 21 11h-2z"/></svg>';
  const ICON_END = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.3 5.71 12 12 5.71 5.71 4.29 7.12 10.59 13l-6.3 6.29 1.42 1.42L12 14.41l6.29 6.3 1.42-1.42L13.41 13l6.3-6.29z"/></svg>';

  // talk-UI strings + level/language mapping for the live conversation
  const LANG_NAME = { sv: 'svenska', en: 'English', fi: 'suomi', de: 'Deutsch' };
  const LEVEL_INSTRUCTION = {
    academic: 'Prata på en akademisk, vetenskaplig nivå med korrekt terminologi, som med en student eller insatt vuxen.',
    general: 'Prata på en vardaglig, lättförståelig nivå, som med en intresserad vuxen besökare.',
    child: 'Prata enkelt, varmt och konkret, som med ett nyfiket barn i 9–12-årsåldern. Undvik svåra facktermer.',
    preschool: 'Prata jätteenkelt och lekfullt, som med en 3–5-åring. Mycket korta meningar, enkla ord och glad ton.',
  };
  const TALK_UI = {
    sv: { talk: 'Prata med mig', greet: (n) => `Hej! Jag är ${n}. Vad vill du fråga mig?`, connecting: 'Kopplar upp…', listening: 'Lyssnar…', speaking: 'Pratar…', end: 'Avsluta', mic: 'Tillåt mikrofonen för att prata', err: 'Kunde inte starta samtalet' },
    en: { talk: 'Talk to me', greet: (n) => `Hi! I'm the ${n}. What would you like to ask me?`, connecting: 'Connecting…', listening: 'Listening…', speaking: 'Speaking…', end: 'End', mic: 'Allow the microphone to talk', err: 'Could not start the conversation' },
    fi: { talk: 'Puhu kanssani', greet: (n) => `Hei! Olen ${n}. Mitä haluaisit kysyä minulta?`, connecting: 'Yhdistetään…', listening: 'Kuuntelee…', speaking: 'Puhuu…', end: 'Lopeta', mic: 'Salli mikrofoni puhuaksesi', err: 'Keskustelua ei voitu aloittaa' },
    de: { talk: 'Sprich mit mir', greet: (n) => `Hallo! Ich bin ${n}. Was möchtest du mich fragen?`, connecting: 'Verbinde…', listening: 'Hört zu…', speaking: 'Spricht…', end: 'Beenden', mic: 'Erlaube das Mikrofon zum Sprechen', err: 'Gespräch konnte nicht gestartet werden' },
  };
  const tui = (L) => TALK_UI[L] || TALK_UI.sv;

  const MAX_DEPTH_M = 459; // Landsortsdjupet, Östersjöns djupaste punkt
  let PXPM = 40;           // pixels per metre on the linear depth axis — auto-fitted in layout()
  const MIN_PXPM = 16, MAX_PXPM = 130;
  const DEAD_DEPTH = 110;  // where the dead-zone caption sits on the axis (metres)
  const depthMQ = window.matchMedia('(min-width: 821px)');

  // metre depth → colour of the water column (surface → abyss)
  const STOPS = [
    [0,   [126, 200, 227]],
    [10,  [74, 163, 199]],
    [25,  [44, 140, 180]],
    [50,  [28, 104, 146]],
    [80,  [16, 72, 104]],
    [150, [9, 46, 70]],
    [300, [5, 26, 42]],
    [459, [2, 14, 22]],
  ];
  function seaColor(m) {
    for (let i = 1; i < STOPS.length; i++) {
      if (m <= STOPS[i][0]) {
        const [d0, c0] = STOPS[i - 1], [d1, c1] = STOPS[i];
        const t = (m - d0) / (d1 - d0 || 1);
        const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
        return `rgb(${c[0]},${c[1]},${c[2]})`;
      }
    }
    const c = STOPS[STOPS.length - 1][1];
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  const state = {
    lang: localStorage.getItem('bs_lang') || 'sv',
    level: parseInt(localStorage.getItem('bs_level') ?? '1', 10),
  };
  let data = null;
  const refs = []; // creature element refs

  // ---------- load ----------
  async function init() {
    try {
      const res = await fetch('content.json', { cache: 'no-cache' });
      data = await res.json();
    } catch (e) {
      $('introText').textContent = 'Kunde inte ladda innehållet (content.json).';
      console.error(e);
      return;
    }
    if (!data.langs?.includes(state.lang)) state.lang = data.langs?.[0] || 'sv';
    state.level = clamp(state.level, 0, (data.levels?.length || 4) - 1);

    buildLangButtons();
    buildCreatures();
    wireControls();
    generateFx();
    await loadManifest();
    render();
    layout();
    setupGauge();
    onScroll();
    window.addEventListener('scroll', queueScroll, { passive: true });
    window.addEventListener('resize', () => { layout(); queueScroll(); }, { passive: true });
    window.addEventListener('load', scheduleLayout);
    if (depthMQ.addEventListener) depthMQ.addEventListener('change', () => { layout(); onScroll(); });
    observeScenes();
  }

  // ---------- language buttons ----------
  function buildLangButtons() {
    const wrap = $('langButtons');
    wrap.innerHTML = '';
    data.langs.forEach((lg) => {
      const b = el('button');
      b.type = 'button';
      b.textContent = lg;
      b.dataset.lang = lg;
      b.addEventListener('click', () => {
        state.lang = lg;
        localStorage.setItem('bs_lang', lg);
        render();
      });
      wrap.appendChild(b);
    });
  }

  // ---------- build creature scenes ----------
  function buildCreatures() {
    const host = $('creatures');
    host.innerHTML = '';
    refs.length = 0;
    const order = data.order || Object.keys(data.creatures || {});
    const n = order.length;
    order.forEach((id, i) => {
      const c = data.creatures?.[id];
      if (!c) return;
      const scene = el('section', 'scene' + (i % 2 ? ' right' : ''));
      scene.dataset.deep = i >= Math.floor(n * 0.55) ? '1' : '0';

      const inner = el('div', 'scene-inner');

      const figure = el('div', 'crea-figure');
      const img = el('img');
      img.src = `assets/creatures/${id}.png`;
      img.loading = 'lazy';
      img.dataset.id = id;
      img.addEventListener('click', () => swapFrame(img, id));
      img.addEventListener('load', scheduleLayout);
      figure.appendChild(img);

      const card = el('div', 'card');
      const head = el('div', 'crea-head');
      const name = el('h2', 'crea-name');
      const latin = el('span', 'crea-latin');
      latin.textContent = c.latin || '';
      head.append(name, latin);
      const role = el('p', 'crea-role');
      const chips = el('div', 'crea-chips');
      const status = el('span', 'crea-status');
      const depth = el('span', 'crea-depth');
      chips.append(status, depth);
      const airnote = el('div', 'crea-airnote');
      const text = el('p', 'crea-text');
      const fact = el('div', 'crea-fact');
      const factLabel = el('b');
      const factTxt = el('span');
      fact.append(factLabel, factTxt);

      const play = el('button', 'crea-play');
      play.type = 'button';
      play.setAttribute('aria-label', 'Spela upp rösten');
      play.innerHTML = ICON_SPEAKER;
      play.addEventListener('click', () => togglePlay(play));

      const talk = el('button', 'crea-talk');
      talk.type = 'button';
      const talkLabel = el('span', 'crea-talk-label');
      talk.append(Object.assign(el('span', 'crea-talk-ic'), { innerHTML: ICON_MIC }), talkLabel);
      talk.addEventListener('click', () => startConversation(id, talk));

      card.append(head, role, chips, airnote, text, fact, talk, play);
      inner.append(figure, card);
      scene.append(inner);
      host.appendChild(scene);

      refs.push({ id, scene, img, name, latin, role, status, depth, airnote, text, fact, factLabel, factTxt, play, talk, talkLabel });
    });
    // dead-zone caption lives inside the depth container so it positions on the axis
    const dz = $('deadzone');
    if (dz) host.appendChild(dz);
  }

  function swapFrame(img, id) {
    const f = Math.floor(Math.random() * 9);
    img.src = `assets/frames/${id}_${f}.png`;
    img.style.transform = 'scale(1.08)';
    setTimeout(() => (img.style.transform = ''), 180);
  }

  // ---------- render text for current lang + level ----------
  function render() {
    const L = data.langs.includes(state.lang) ? state.lang : data.langs[0];
    const levelKey = data.levels[state.level];
    const ui = (data.ui && data.ui[L]) || {};
    const fr = (data.framing && data.framing[L]) || {};

    stopAudio(); // language/level changed → stop any clip so it can't mismatch
    endConversation(); // a live call is bound to its start language/level
    document.documentElement.lang = L;
    document.title = `${ui.title || 'Östersjön'} — ${ui.subtitle || ''}`.trim();

    const txt = (id, v) => { const n = $(id); if (n && v != null) n.textContent = v; };
    txt('brand', ui.title);
    txt('title', ui.title);
    txt('subtitle', ui.subtitle);
    txt('scrollHint', ui.scrollHint);
    txt('levelTitle', ui.levelTitle);
    txt('langLabel', ui.langLabel);
    txt('aboutTitle', ui.aboutTitle);
    txt('restart', ui.restart);
    txt('gaugeTop', ui.depthSurface);
    txt('gaugeBottom', ui.depthDeep);
    const lvlName = ui['level' + cap(levelKey)];
    txt('levelName', lvlName);
    $('scrollHint').appendChild(Object.assign(el('span', 'chev'), { textContent: '⌄' }));

    txt('introText', fr.intro && fr.intro[levelKey]);
    txt('outroText', fr.outro && fr.outro[levelKey]);
    txt('aboutText', fr.about);
    if (fr.deadzone) { txt('deadTitle', fr.deadzone.title); txt('deadText', fr.deadzone.text); }

    // active lang button
    [...$('langButtons').children].forEach((b) => b.classList.toggle('active', b.dataset.lang === L));

    // creatures
    refs.forEach((r) => {
      const c = data.creatures[r.id];
      const t = (c.i18n && c.i18n[L]) || {};
      r.name.textContent = t.name || r.id;
      r.img.alt = t.name || r.id;
      r.role.textContent = t.role || '';
      r.status.textContent = t.status || '';
      r.status.style.display = t.status ? '' : 'none';
      r.depth.textContent = (c.depth != null ? c.depth : '?') + ' m';
      if (c.airBreather && ui.airBreatherNote) { r.airnote.textContent = ui.airBreatherNote; r.airnote.style.display = ''; }
      else r.airnote.style.display = 'none';
      // tiny fade on text change
      r.text.style.opacity = 0;
      const body = (t.levels && t.levels[levelKey]) || '';
      r.text.textContent = body;
      requestAnimationFrame(() => (r.text.style.opacity = 1));
      if (t.fact) {
        r.fact.style.display = '';
        r.factLabel.textContent = ui.factLabel || 'Visste du att';
        r.factTxt.textContent = t.fact;
      } else {
        r.fact.style.display = 'none';
      }
      const akey = `${r.id}_${L}_${levelKey}`;
      r.play.dataset.audio = `assets/audio/${akey}.mp3`;
      r.play.classList.remove('noaudio');
      r.play.style.display = (!audioManifest || audioManifest.has(akey)) ? '' : 'none';
      // live conversation button (only if this creature has a configured agent)
      r.talkLabel.textContent = tui(L).talk;
      r.talk.style.display = c.agentId ? '' : 'none';
    });
    scheduleLayout(); // card heights changed → refit the depth scale (no overlap)
  }

  // ---------- audio (pre-generated ElevenLabs clips) ----------
  let audioManifest = null;
  const audioEl = new Audio();
  let curBtn = null;
  audioEl.addEventListener('ended', () => setPlaying(null));
  function setPlaying(btn) {
    if (curBtn && curBtn !== btn) { curBtn.classList.remove('playing'); curBtn.innerHTML = ICON_SPEAKER; }
    curBtn = btn;
    if (btn) { btn.classList.add('playing'); btn.innerHTML = ICON_PAUSE; }
  }
  function stopAudio() { try { audioEl.pause(); } catch (_) {} setPlaying(null); }
  function togglePlay(btn) {
    const src = btn.dataset.audio; if (!src) return;
    if (curBtn === btn && !audioEl.paused) { audioEl.pause(); setPlaying(null); return; }
    audioEl.src = src;
    audioEl.play().then(() => setPlaying(btn))
      .catch(() => { btn.classList.add('noaudio'); btn.title = 'Ljudet är inte genererat än'; setPlaying(null); });
  }
  async function loadManifest() {
    try {
      const r = await fetch('assets/audio/manifest.json', { cache: 'no-cache' });
      if (r.ok) audioManifest = new Set(await r.json());
    } catch (_) { audioManifest = null; }
  }

  // ---------- live conversation (ElevenLabs Conversational AI) ----------
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@elevenlabs/client/+esm';
  let ConvCtor = null, convo = null, convoId = null, convoStarting = false, convoUI = null;

  async function loadSDK() {
    if (ConvCtor) return ConvCtor;
    const mod = await import(SDK_URL);
    ConvCtor = mod.Conversation || (mod.default && mod.default.Conversation);
    if (!ConvCtor) throw new Error('Conversation SDK not found');
    return ConvCtor;
  }

  function ensureConvoUI() {
    if (convoUI) return convoUI;
    const wrap = el('div', 'convo'); wrap.id = 'convo';
    wrap.innerHTML =
      '<div class="convo-card">' +
        '<div class="convo-avatar"><img id="convoAvatar" alt=""><span class="convo-ring"></span></div>' +
        '<div class="convo-meta"><div class="convo-name" id="convoName"></div><div class="convo-status" id="convoStatus"></div></div>' +
        '<button class="convo-end" id="convoEnd" type="button"></button>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.querySelector('#convoEnd').addEventListener('click', () => endConversation());
    convoUI = wrap;
    return wrap;
  }
  function openConvoUI(id, name, status) {
    ensureConvoUI();
    $('convoAvatar').src = `assets/creatures/${id}.png`;
    $('convoName').textContent = name;
    $('convoStatus').textContent = status;
    $('convoEnd').innerHTML = ICON_END + '<span>' + tui(state.lang).end + '</span>';
    convoUI.classList.add('open');
    convoUI.classList.remove('speaking');
    document.body.classList.add('in-call');
  }
  function setConvoStatus(s) { const n = $('convoStatus'); if (n) n.textContent = s; }
  function closeConvoUI() { if (convoUI) convoUI.classList.remove('open', 'speaking'); document.body.classList.remove('in-call'); }
  function markTalkButtons() {
    refs.forEach((r) => {
      const on = r.id === convoId;
      r.talk.classList.toggle('incall', on);
      r.talkLabel.textContent = on ? tui(state.lang).end : tui(state.lang).talk;
    });
  }

  async function startConversation(id, btn) {
    if (convoId === id) { endConversation(); return; }   // tapping the active one hangs up
    if (convoStarting) return;
    if (convo) await endConversation();
    const c = data.creatures[id];
    const agentId = c && c.agentId;
    if (!agentId) return;
    const L = data.langs.includes(state.lang) ? state.lang : data.langs[0];
    const levelKey = data.levels[state.level];
    const t = (c.i18n && c.i18n[L]) || {};
    const tk = tui(L);
    const name = t.name || id;

    stopAudio();                         // don't overlap a clip with the live voice
    convoStarting = true;
    openConvoUI(id, name, tk.connecting);
    try {
      const Conversation = await loadSDK();
      convo = await Conversation.startSession({
        agentId,
        connectionType: 'webrtc',
        dynamicVariables: {
          greeting: tk.greet(name),
          language_name: LANG_NAME[L] || 'svenska',
          level_instruction: LEVEL_INSTRUCTION[levelKey] || LEVEL_INSTRUCTION.general,
        },
        overrides: { agent: { language: L } },
        onConnect: () => { setConvoStatus(tk.listening); },
        onModeChange: (m) => {
          const speaking = m && m.mode === 'speaking';
          setConvoStatus(speaking ? tk.speaking : tk.listening);
          if (convoUI) convoUI.classList.toggle('speaking', !!speaking);
        },
        onDisconnect: () => { convo = null; convoId = null; closeConvoUI(); markTalkButtons(); },
        onError: (e) => { console.error('[convai]', e); setConvoStatus(tk.err); },
      });
      convoId = id;
      markTalkButtons();
    } catch (e) {
      console.error('[convai] start failed', e);
      setConvoStatus(tk.mic);
      convo = null; convoId = null;
      setTimeout(() => { if (!convoId) closeConvoUI(); }, 3200);
    } finally {
      convoStarting = false;
    }
  }

  async function endConversation() {
    const had = convo;
    convo = null; convoId = null;
    if (had) { try { await had.endSession(); } catch (_) {} }
    closeConvoUI();
    markTalkButtons();
  }

  // ---------- controls ----------
  function wireControls() {
    const range = $('levelRange');
    range.max = String(data.levels.length - 1);
    range.value = String(state.level);
    range.addEventListener('input', () => {
      state.level = parseInt(range.value, 10);
      localStorage.setItem('bs_level', String(state.level));
      render();
    });
    $('restart').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // ---------- linear depth-map layout (scroll distance == real metres) ----------
  function depthMode() { return depthMQ.matches; }
  let layoutTimer = null;
  const depthOf = (i) => { const c = data.creatures[refs[i].id]; return c && c.depth != null ? c.depth : 0; };
  function layout() {
    const dm = depthMode();
    const wasDepth = document.body.classList.contains('depthmode');
    const keepDepth = wasDepth ? currentDepth() : 0;
    document.body.classList.toggle('depthmode', dm);
    const host = $('creatures');
    const dz = $('deadzone');
    if (!dm) {
      host.style.height = '';
      refs.forEach((r) => { r.scene.style.top = ''; });
      if (dz) dz.style.top = '';
      return;
    }
    // auto-fit the scale: same-side neighbours are creatures i and i+2; the gauge
    // stays perfectly linear, we just pick pixels-per-metre big enough that the
    // tallest card can't reach the next card on its side.
    const GAP = 64;
    let need = MIN_PXPM;
    for (let i = 0; i + 2 < refs.length; i++) {
      const dgap = depthOf(i + 2) - depthOf(i);
      if (dgap > 0) need = Math.max(need, (refs[i].scene.offsetHeight + GAP) / dgap);
    }
    PXPM = clamp(Math.ceil(need), MIN_PXPM, MAX_PXPM);
    host.style.height = (MAX_DEPTH_M * PXPM) + 'px';
    refs.forEach((r, i) => { r.scene.style.top = (depthOf(i) * PXPM) + 'px'; });
    if (dz) dz.style.top = (DEAD_DEPTH * PXPM) + 'px';
    scrollToDepth(keepDepth);
  }
  function scheduleLayout() { clearTimeout(layoutTimer); layoutTimer = setTimeout(() => { layout(); onScroll(); }, 120); }

  // depth (metres) at the viewport centre — linear with scroll position
  function currentDepth() {
    const y = window.scrollY, ih = window.innerHeight;
    if (depthMode()) {
      const host = $('creatures');
      return clamp((y + ih / 2 - host.offsetTop) / (MAX_DEPTH_M * PXPM || 1), 0, 1) * MAX_DEPTH_M;
    }
    const max = document.documentElement.scrollHeight - ih;
    return clamp(max > 0 ? y / max : 0, 0, 1) * MAX_DEPTH_M;
  }

  let ticking = false;
  function queueScroll() { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }
  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    const m = currentDepth();
    const f = clamp(m / MAX_DEPTH_M, 0, 1);

    $('sea').style.backgroundColor = seaColor(m);
    $('vignette').style.opacity = clamp((m - 60) / 200, 0, 0.85);
    $('caustics').style.opacity = clamp(0.6 - m / 45, 0, 0.6);

    $('gaugeFill').style.height = (f * 100) + '%';
    $('gaugeKnob').style.top = (f * 100) + '%';
    $('gaugeDepth').textContent = Math.round(m) + ' m';
    const tr = $('gaugeTrack');
    if (tr) { tr.setAttribute('aria-valuenow', Math.round(m)); tr.setAttribute('aria-valuetext', Math.round(m) + ' meter'); }

    // parallax (uses CSS `translate` so it composes with transform-based keyframes)
    document.querySelectorAll('.parallax').forEach((n) => {
      const d = parseFloat(n.dataset.depth || '0');
      n.style.translate = `0 ${y * d * 0.25}px`;
    });
  }

  // ---------- draggable depth gauge ----------
  function scrollToDepth(d, smooth) {
    const host = $('creatures');
    let top;
    if (depthMode()) top = host.offsetTop + d * PXPM - window.innerHeight / 2;
    else { const max = document.documentElement.scrollHeight - window.innerHeight; top = (d / MAX_DEPTH_M) * max; }
    window.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
  }
  function setupGauge() {
    const track = $('gaugeTrack');
    if (!track) return;
    let dragging = false;
    const depthFromY = (cy) => {
      const r = track.getBoundingClientRect();
      return clamp((cy - r.top) / (r.height || 1), 0, 1) * MAX_DEPTH_M;
    };
    track.addEventListener('pointerdown', (e) => {
      dragging = true; try { track.setPointerCapture(e.pointerId); } catch (_) {}
      scrollToDepth(depthFromY(e.clientY)); e.preventDefault();
    });
    track.addEventListener('pointermove', (e) => { if (dragging) scrollToDepth(depthFromY(e.clientY)); });
    const end = (e) => { if (dragging) { dragging = false; try { track.releasePointerCapture(e.pointerId); } catch (_) {} } };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 25 : 5;
      let d = currentDepth();
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') d += step;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') d -= step;
      else if (e.key === 'Home') d = 0;
      else if (e.key === 'End') d = MAX_DEPTH_M;
      else return;
      e.preventDefault(); scrollToDepth(clamp(d, 0, MAX_DEPTH_M), true);
    });
  }

  // ---------- reveal on enter ----------
  function observeScenes() {
    const targets = document.querySelectorAll('.scene, #deadzone');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((s) => s.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.22 });
    targets.forEach((s) => io.observe(s));
  }

  // ---------- decorative bubbles + marine snow ----------
  function generateFx() {
    const fx = $('fx');
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 20; i++) {
      const b = el('div', 'bubble');
      const sz = 6 + Math.random() * 22;
      b.style.width = b.style.height = sz + 'px';
      b.style.left = (Math.random() * 100) + 'vw';
      b.style.animationDuration = (9 + Math.random() * 14) + 's';
      b.style.animationDelay = (-Math.random() * 18) + 's';
      frag.appendChild(b);
    }
    for (let i = 0; i < 28; i++) {
      const s = el('div', 'snow');
      s.style.left = (Math.random() * 100) + 'vw';
      const sz = 2 + Math.random() * 4;
      s.style.width = s.style.height = sz + 'px';
      s.style.animationDuration = (16 + Math.random() * 20) + 's';
      s.style.animationDelay = (-Math.random() * 30) + 's';
      frag.appendChild(s);
    }
    fx.appendChild(frag);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
