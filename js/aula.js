(function () {
  const cfg = window.ANTENADOS || {};
  const aula = cfg.aula || {};
  const cues = Array.isArray(aula.cues) ? aula.cues : [];
  const checkoutUrl = cfg.checkoutUrl || "#oferta";

  const LEAD_KEY = "antenados-aula-lead";
  const SESSION_KEY = "antenados-aula-session";
  const WATCH_KEY = "antenados-aula-watch";
  const CUE_KEY = "antenados-aula-cues";

  const frame = document.getElementById("aula-frame");
  const poster = document.getElementById("aula-poster");
  const cover = document.getElementById("aula-cover");
  const playBtn = document.getElementById("aula-play");
  const playLabel = document.getElementById("aula-play-label");
  const form = document.getElementById("aula-form");
  const nameInput = document.getElementById("aula-name");
  const whatsInput = document.getElementById("aula-whatsapp");
  const formError = document.getElementById("aula-form-error");
  const submitBtn = document.getElementById("aula-submit");
  const controls = document.getElementById("aula-controls");
  const reveal = document.getElementById("aula-reveal");
  const pauseBtn = document.getElementById("aula-pause");
  const scrub = document.getElementById("aula-scrub");
  const cueBar = document.getElementById("aula-cue");
  const cueBtn = document.getElementById("aula-cue-btn");
  const cueDismiss = document.getElementById("aula-cue-dismiss");
  const missing = document.getElementById("aula-missing");
  const checkout = document.getElementById("aula-checkout");
  const offer = document.getElementById("oferta");

  const sessionId = loadSession();
  let player = null;
  let playerGen = 0;
  let mode = readLead() ? "lesson" : "intro";
  let pendingPlay = false;
  let apiReady = false;
  let playing = false;
  let lastSample = null;
  let watched = 0;
  let maxTime = 0;
  let duration = 0;
  let timer = null;
  let progressSentAt = 0;
  let introStarted = false;
  let lessonStarted = false;
  let capture = null;
  let scrubbing = false;
  let controlsTimer = null;
  let activeCue = null;
  const milestonesSent = new Set();
  const seenCues = new Set(loadSeenCues());

  if (checkout && checkoutUrl && checkoutUrl !== "#oferta") {
    checkout.setAttribute("href", checkoutUrl);
  }

  if (cover && aula.coverSrc) cover.src = aula.coverSrc;
  playCover();

  if (mode === "lesson") {
    playLabel.textContent = "Continuar a aula";
    loadWatch();
    syncLessonBar();
  }

  window.onYouTubeIframeAPIReady = function () {
    apiReady = true;
    if (mode === "intro" && !pendingPlay) return;
    mount(mode).then(function (instance) {
      if (!pendingPlay || !instance) return;
      if (mode === "intro") beginRealIntro(instance);
      else if (instance.playVideo) instance.playVideo();
    });
  };

  playBtn.addEventListener("click", onPlay);
  pauseBtn.addEventListener("click", function () {
    togglePlay();
    bumpControls();
  });
  reveal.addEventListener("click", bumpControls);
  controls.addEventListener("pointerdown", function () {
    showControls();
    stopControlsTimer();
  });
  scrub.addEventListener("pointerdown", function () { scrubbing = true; });
  scrub.addEventListener("pointerup", function () {
    scrubbing = false;
    bumpControls();
  });
  window.addEventListener("pointerup", function () {
    if (!scrubbing) return;
    scrubbing = false;
    bumpControls();
  });
  scrub.addEventListener("input", onScrub);
  scrub.addEventListener("change", function () {
    scrubbing = false;
    onScrub();
    bumpControls();
  });
  form.addEventListener("submit", onSubmit);
  cueBtn.addEventListener("click", onCueClick);
  cueDismiss.addEventListener("click", hideCue);
  checkout.addEventListener("click", onCheckoutClick);
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });

  function onPlay() {
    pendingPlay = true;
    const videoId = mode === "lesson" ? aula.lessonVideoId : aula.introVideoId;
    if (!videoId) {
      if (mode === "intro") {
        if (!introStarted) {
          introStarted = true;
          track("intro_started");
        }
        track("intro_completed");
        showForm();
      } else {
        showMissing();
      }
      return;
    }
    if (mode === "intro") {
      if (player) beginRealIntro(player);
      else if (apiReady) mount("intro").then(function (instance) {
        if (instance) beginRealIntro(instance);
      });
      return;
    }
    if (player && typeof player.playVideo === "function") player.playVideo();
  }

  function beginRealIntro(instance) {
    const target = instance || player;
    if (!target) return;
    if (typeof target.seekTo === "function") target.seekTo(0, true);
    if (typeof target.unMute === "function") target.unMute();
    if (typeof target.setVolume === "function") target.setVolume(100);
    if (typeof target.playVideo === "function") target.playVideo();
  }

  function playCover() {
    if (!cover || poster.hidden || poster.classList.contains("is-continue")) return;
    const pending = cover.play();
    if (pending && pending.catch) pending.catch(function () {});
  }

  function stopCover() {
    if (!cover || cover.paused) return;
    cover.pause();
  }

  function onSubmit(event) {
    event.preventDefault();
    const name = cleanName(nameInput.value);
    const whatsapp = normalizeWhatsapp(whatsInput.value);
    if (!name) return showError("Escreva seu nome.");
    if (!whatsapp) return showError("Confira o WhatsApp com DDD.");
    showError("");

    const proposedId = uuid();
    capture = track("identify", { leadId: proposedId, name: name, whatsapp: whatsapp })
      .then(function (result) {
        if (!result || !result.id) return null;
        saveLead({ id: result.id, name: name, whatsapp: whatsapp });
        if (window.fbq) window.fbq("track", "Lead");
        return result;
      });
    startLesson();
    syncLessonBar();
  }

  function startLesson() {
    mode = "lesson";
    hideForm();
    hideCue();
    hidePoster();
    pendingPlay = true;
    if (!aula.lessonVideoId) {
      showMissing();
      return Promise.resolve();
    }
    return mount("lesson").then(function (instance) {
      if (instance && instance.playVideo) instance.playVideo();
      window.setTimeout(function () {
        if (!playing) showContinue();
      }, 1200);
    });
  }

  function showContinue() {
    if (playing || mode !== "lesson") return;
    playLabel.textContent = "Continuar a aula";
    stopCover();
    poster.classList.add("is-continue");
    poster.hidden = false;
    syncLessonBar();
  }

  function mount(kind) {
    const gen = ++playerGen;
    const videoId = kind === "lesson" ? aula.lessonVideoId : aula.introVideoId;
    destroyPlayer();
    if (!videoId || !apiReady || !window.YT || !window.YT.Player) {
      return Promise.resolve(null);
    }

    const mountEl = document.createElement("div");
    mountEl.id = "aula-player";
    frame.insertBefore(mountEl, frame.firstChild);

    return new Promise(function (resolve) {
      player = new window.YT.Player("aula-player", {
        videoId: videoId,
        playerVars: playerVars(kind),
        events: {
          onReady: function (event) {
            if (gen !== playerGen) return;
            player = event.target;
            resolve(player);
          },
          onStateChange: function (event) {
            if (gen !== playerGen) return;
            onStateChange(event);
          },
        },
      });
    });
  }

  function playerVars(kind) {
    const base = {
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      fs: 0,
      iv_load_policy: 3,
      origin: location.origin,
    };
    if (kind === "intro") {
      base.controls = 0;
      base.disablekb = 1;
    } else {
      base.controls = 0;
      base.disablekb = 0;
    }
    return base;
  }

  function onStateChange(event) {
    const state = event.data;
    const playingState = window.YT && window.YT.PlayerState ? window.YT.PlayerState.PLAYING : 1;
    const endedState = window.YT && window.YT.PlayerState ? window.YT.PlayerState.ENDED : 0;

    if (state === playingState) {
      playing = true;
      lastSample = safeTime();
      hidePoster();
      hideMissing();
      if (mode === "intro" && !introStarted) {
        introStarted = true;
        track("intro_started");
      }
      if (mode === "lesson" && !lessonStarted) {
        lessonStarted = true;
        track("lesson_start", snapshot());
      }
      startTimer();
      syncLessonBar();
      return;
    }

    sample();
    playing = false;
    lastSample = null;
    stopTimer();
    syncLessonBar();
    if (mode === "lesson") sendProgress();

    if (state === endedState) {
      if (mode === "intro") {
        track("intro_completed");
        showForm();
      } else {
        sendMilestone(100);
        sendProgress();
      }
    }
  }

  function startTimer() {
    if (timer) return;
    timer = window.setInterval(sample, 1000);
  }

  function stopTimer() {
    if (!timer) return;
    window.clearInterval(timer);
    timer = null;
  }

  function sample() {
    const t = safeTime();
    const d = safeDuration();
    if (d > 0) duration = d;
    if (playing && lastSample != null) {
      const delta = t - lastSample;
      if (delta > 0 && delta < 2.5) watched += delta;
    }
    lastSample = t;
    if (t > maxTime) maxTime = t;
    if (mode !== "lesson") return;
    syncScrub(t, d);
    checkMilestones();
    checkCues(t);
    if (Date.now() - progressSentAt >= 15000) sendProgress();
  }

  function lessonOpen() {
    return mode === "lesson" && poster.hidden && form.hidden && missing.hidden;
  }

  function syncLessonBar() {
    pauseBtn.textContent = playing ? "Pausar" : "Continuar";
    if (!lessonOpen()) {
      reveal.hidden = true;
      controls.hidden = true;
      controls.classList.remove("is-idle");
      frame.classList.remove("is-controls");
      stopControlsTimer();
      return;
    }
    reveal.hidden = false;
    if (!playing || scrubbing) {
      showControls();
      stopControlsTimer();
      return;
    }
    if (controls.hidden || controls.classList.contains("is-idle")) showControls();
    armControlsTimer();
  }

  function bumpControls() {
    if (!lessonOpen()) return;
    showControls();
    if (playing && !scrubbing) armControlsTimer();
    else stopControlsTimer();
  }

  function showControls() {
    controls.hidden = false;
    controls.classList.remove("is-idle");
    frame.classList.add("is-controls");
  }

  function idleControls() {
    controlsTimer = null;
    if (!playing || scrubbing || !lessonOpen()) return;
    controls.classList.add("is-idle");
    frame.classList.remove("is-controls");
  }

  function armControlsTimer() {
    stopControlsTimer();
    if (!playing || scrubbing) return;
    controlsTimer = window.setTimeout(idleControls, 3000);
  }

  function stopControlsTimer() {
    if (!controlsTimer) return;
    window.clearTimeout(controlsTimer);
    controlsTimer = null;
  }

  function togglePlay() {
    if (!player) return;
    if (playing && typeof player.pauseVideo === "function") player.pauseVideo();
    else if (typeof player.playVideo === "function") player.playVideo();
  }

  function seekToTime(seconds) {
    if (!player || typeof player.seekTo !== "function") return;
    const spot = Math.max(0, seconds);
    player.seekTo(spot, true);
    lastSample = spot;
  }

  function onScrub() {
    seekToTime(Number(scrub.value) || 0);
  }

  function syncScrub(time, total) {
    if (scrubbing) return;
    const length = total || duration || 0;
    if (length > 0) scrub.max = String(Math.floor(length));
    scrub.value = String(Math.floor(Math.max(0, time || 0)));
  }

  function checkMilestones() {
    if (!duration) return;
    const percent = (maxTime / duration) * 100;
    [25, 50, 75].forEach(function (mark) {
      if (percent >= mark) sendMilestone(mark);
    });
  }

  function checkCues(t) {
    const due = cues.filter(function (cue) {
      return cue && cue.id && t + 0.25 >= Number(cue.at) && !seenCues.has(cue.id);
    });
    if (!due.length) return;
    due.slice(0, -1).forEach(function (cue) {
      seenCues.add(cue.id);
    });
    const cue = due[due.length - 1];
    seenCues.add(cue.id);
    saveSeenCues();
    showCue(cue);
  }

  function showCue(cue) {
    activeCue = cue;
    const checkoutCue = cue.action === "checkout";
    cueBtn.disabled = false;
    cueBtn.textContent = cue.label || (checkoutCue
      ? "Quero começar agora por R$ 47"
      : "Quero o IA para Antenados");
    cueBar.hidden = false;
    cueBar.classList.remove("is-hot");
    void cueBar.offsetWidth;
    cueBar.classList.add("is-hot");
    if (offer) {
      offer.classList.remove("is-hot");
      void offer.offsetWidth;
      offer.classList.add("is-hot");
    }
  }

  function hideCue() {
    cueBar.hidden = true;
    activeCue = null;
  }

  function onCueClick() {
    if (!activeCue) return;
    const cue = activeCue;
    const videoTime = safeTime();
    if (cue.action === "checkout") {
      goCheckout(cue.id, videoTime);
      return;
    }
    track("cta_intent", { cueId: cue.id, videoTime: videoTime, ...snapshot() });
    cueBtn.textContent = "Interesse anotado";
    cueBtn.disabled = true;
  }

  function onCheckoutClick(event) {
    event.preventDefault();
    goCheckout("offer_card", safeTime());
  }

  function goCheckout(cueId, videoTime) {
    track("cta_checkout", { cueId: cueId, videoTime: videoTime, ...snapshot() }, { beacon: true });
    if (window.fbq) window.fbq("track", "InitiateCheckout");
    if (checkoutUrl && checkoutUrl !== "#oferta") location.assign(checkoutUrl);
  }

  function sendMilestone(value) {
    if (milestonesSent.has(value)) return;
    milestonesSent.add(value);
    persistWatch();
    track("milestone", Object.assign({ milestone: value }, snapshot())).then(function (ok) {
      if (!ok) milestonesSent.delete(value);
    });
  }

  function sendProgress() {
    if (mode !== "lesson" || !readLead()) return;
    progressSentAt = Date.now();
    persistWatch();
    track("progress", snapshot());
  }

  function flush() {
    if (mode !== "lesson" || !readLead()) return;
    if (playing) sample();
    track("progress", snapshot(), { beacon: true });
  }

  function snapshot() {
    return {
      videoTime: round(safeTime() || maxTime),
      watchedSeconds: round(watched),
      maxSeconds: round(maxTime),
      durationSeconds: duration ? round(duration) : undefined,
    };
  }

  function track(event, extra, opts) {
    const needsLead = event !== "identify" && event !== "intro_started" && event !== "intro_completed";
    if (needsLead && !readLead() && capture) {
      return capture.then(function () {
        if (!readLead()) return false;
        return track(event, extra, opts);
      });
    }

    const body = { event: event, sessionId: sessionId };
    const lead = readLead();
    if (lead && lead.id) body.leadId = lead.id;
    if (extra) {
      if (event === "identify") {
        body.leadId = extra.leadId;
        body.name = extra.name;
        body.whatsapp = extra.whatsapp;
      }
      ["videoTime", "watchedSeconds", "maxSeconds", "durationSeconds", "cueId", "milestone"].forEach(function (key) {
        if (extra[key] != null) body[key] = extra[key];
      });
    }

    const json = JSON.stringify(body);
    if (opts && opts.beacon && navigator.sendBeacon) {
      const blob = new Blob([json], { type: "application/json" });
      return Promise.resolve(navigator.sendBeacon("/api/lead", blob));
    }

    return fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
      keepalive: true,
    })
      .then(function (res) {
        if (!res.ok) throw new Error("request_failed");
        return res.json().catch(function () { return { ok: true }; });
      })
      .catch(function () {
        return event === "identify" ? null : false;
      });
  }

  function showForm() {
    hidePoster();
    form.hidden = false;
    nameInput.focus();
  }

  function hideForm() {
    form.hidden = true;
  }

  function showPoster() {
    poster.hidden = false;
  }

  function hidePoster() {
    poster.hidden = true;
    poster.classList.remove("is-continue");
    stopCover();
  }

  function showMissing() {
    hidePoster();
    missing.hidden = false;
  }

  function hideMissing() {
    missing.hidden = true;
  }

  function showError(message) {
    formError.hidden = !message;
    formError.textContent = message || "";
  }

  function destroyPlayer() {
    stopTimer();
    playing = false;
    lastSample = null;
    if (player && typeof player.destroy === "function") {
      try { player.destroy(); } catch (e) { /* player already gone */ }
    }
    player = null;
    const leftover = document.getElementById("aula-player");
    if (leftover) leftover.remove();
  }

  function safeTime() {
    try {
      return player && player.getCurrentTime ? player.getCurrentTime() || 0 : 0;
    } catch (e) {
      return 0;
    }
  }

  function safeDuration() {
    try {
      return player && player.getDuration ? player.getDuration() || 0 : 0;
    } catch (e) {
      return 0;
    }
  }

  function readLead() {
    const raw = storageGet(localStorage, LEAD_KEY);
    if (!raw) return null;
    try {
      const lead = JSON.parse(raw);
      if (!lead || !lead.id) return null;
      return lead;
    } catch (e) {
      return null;
    }
  }

  function saveLead(lead) {
    storageSet(localStorage, LEAD_KEY, JSON.stringify(lead));
  }

  function loadWatch() {
    const lead = readLead();
    const raw = storageGet(localStorage, WATCH_KEY);
    if (!lead || !raw) return;
    try {
      const saved = JSON.parse(raw);
      if (!saved || saved.leadId !== lead.id) return;
      watched = Number(saved.watched) || 0;
      maxTime = Number(saved.maxTime) || 0;
      (saved.milestones || []).forEach(function (mark) {
        milestonesSent.add(mark);
      });
    } catch (e) { /* ignore broken watch cache */ }
  }

  function persistWatch() {
    const lead = readLead();
    if (!lead) return;
    storageSet(localStorage, WATCH_KEY, JSON.stringify({
      leadId: lead.id,
      watched: round(watched),
      maxTime: round(maxTime),
      milestones: Array.from(milestonesSent),
    }));
  }

  function loadSeenCues() {
    const raw = storageGet(sessionStorage, CUE_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw) || []; } catch (e) { return []; }
  }

  function saveSeenCues() {
    storageSet(sessionStorage, CUE_KEY, JSON.stringify(Array.from(seenCues)));
  }

  function loadSession() {
    const existing = storageGet(sessionStorage, SESSION_KEY);
    if (existing) return existing;
    const id = uuid();
    storageSet(sessionStorage, SESSION_KEY, id);
    return id;
  }

  function storageGet(store, key) {
    try { return store.getItem(key); } catch (e) { return null; }
  }

  function storageSet(store, key, value) {
    try { store.setItem(key, value); } catch (e) { /* private mode */ }
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function round(value) {
    return Math.round(Number(value) * 10) / 10;
  }

  function cleanName(raw) {
    const name = String(raw || "").replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 80) return "";
    return name;
  }

  function normalizeWhatsapp(raw) {
    let digits = String(raw || "").replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (!(digits.startsWith("55") && digits.length >= 12)) {
      if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
    }
    if (!/^55[1-9]{2}\d{8,9}$/.test(digits)) return "";
    return digits;
  }
})();
