(function () {
  const cfg = window.ANTENADOS || {};
  const checkoutUrl = cfg.checkoutUrl || "#oferta";
  const whatsappUrl = cfg.whatsappUrl || "https://wa.me/5535997160702";
  const whatsappDisplay = cfg.whatsappDisplay || "(35) 99716-0702";

  function isPlaceholderCheckout(url) {
    return !url || url.includes("REPLACE_ME") || url === "#oferta";
  }

  // Checkout links
  document.querySelectorAll(".js-checkout").forEach((el) => {
    if (!isPlaceholderCheckout(checkoutUrl)) {
      el.setAttribute("href", checkoutUrl);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    } else {
      el.setAttribute("href", "#oferta");
    }
  });

  // WhatsApp links
  ["close-whatsapp", "faq-wa-1", "faq-wa-2"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute("href", whatsappUrl);
    if (id.startsWith("faq-wa")) {
      el.textContent = whatsappDisplay;
    }
  });

  // Instructor photo
  const instructorSlot = document.getElementById("instructor-photo");
  if (instructorSlot && cfg.instructorPhoto) {
    const wrap = document.createElement("div");
    wrap.className = "bridge__photo-wrap";
    const img = document.createElement("img");
    img.src = cfg.instructorPhoto;
    img.alt = "Matheus Paiva";
    img.className = "bridge__photo";
    wrap.appendChild(img);
    instructorSlot.replaceWith(wrap);
  }

  // VSL
  const vslPlayer = document.getElementById("vsl-player");
  const vslPlay = document.getElementById("vsl-play");

  if (vslPlayer && cfg.vsl) {
    if (cfg.vsl.videoSrc) vslPlayer.src = cfg.vsl.videoSrc;
    if (cfg.vsl.posterSrc) vslPlayer.poster = cfg.vsl.posterSrc;
  }

  if (vslPlay && vslPlayer) {
    vslPlay.addEventListener("click", function () {
      vslPlayer.controls = true;
      vslPlayer.play();
      vslPlay.remove();
    });
  }

  // Testimonials (simple message cards)
  const testimonialsRoot = document.getElementById("testimonials");
  const testimonials = cfg.testimonials || [];

  if (testimonialsRoot) {
    testimonials.forEach((item) => {
      const card = document.createElement("article");
      card.className = "testimonial";

      const avatar = document.createElement("div");
      avatar.className = "testimonial__avatar";

      if (item.photoSrc) {
        const img = document.createElement("img");
        img.src = item.photoSrc;
        img.alt = item.name || "Depoimento";
        avatar.appendChild(img);
      } else {
        const fallback = document.createElement("span");
        fallback.className = "testimonial__avatar-fallback";
        fallback.textContent = (item.name || "?").charAt(0);
        fallback.setAttribute("aria-hidden", "true");
        avatar.appendChild(fallback);
      }

      const body = document.createElement("div");
      body.className = "testimonial__body";

      const stars = document.createElement("div");
      stars.className = "stars stars--5";
      stars.setAttribute("aria-label", "5 de 5 estrelas");
      stars.innerHTML = Array.from({ length: 5 }, () =>
        "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3 6.2 20.4l1.1-6.5L2.6 9.3l6.5-.9L12 2.5z'/></svg>"
      ).join("");

      const quote = document.createElement("blockquote");
      quote.textContent = "“" + (item.quote || "") + "”";

      const cite = document.createElement("cite");
      cite.textContent = [item.name, item.detail].filter(Boolean).join(" · ");

      body.appendChild(stars);
      body.appendChild(quote);
      body.appendChild(cite);
      card.appendChild(avatar);
      card.appendChild(body);
      testimonialsRoot.appendChild(card);
    });
  }

  // FAQ: only one open at a time
  const faqItems = Array.from(document.querySelectorAll(".faq__item"));
  faqItems.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      faqItems.forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });

  // Sticky CTA
  const sticky = document.getElementById("sticky-cta");
  const offer = document.getElementById("oferta");
  const storySection = document.querySelector(".story-scroll");

  function updateSticky() {
    if (!sticky || !offer) return;

    const vh = window.innerHeight || 1;
    const offerRect = offer.getBoundingClientRect();
    const offerVisible =
      offerRect.top < vh * 0.85 && offerRect.bottom > 80;

    const storyTop = storySection
      ? storySection.getBoundingClientRect().top
      : vh;
    const pastHero = storyTop < vh * 0.55;

    sticky.classList.toggle("is-visible", pastHero && !offerVisible);
    sticky.classList.toggle("is-hidden-offer", offerVisible);
    sticky.setAttribute("aria-hidden", pastHero && !offerVisible ? "false" : "true");
  }

  window.addEventListener("scroll", updateSticky, { passive: true });
  window.addEventListener("resize", updateSticky);
  updateSticky();

  // Story scroll: hero cover parallax + card motion in middle third
  function initStoryScroll() {
    const section = document.querySelector(".story-scroll");
    const heroSticky = document.getElementById("hero-pin-sticky");
    if (!section) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion) return;

    const panels = Array.from(
      section.querySelectorAll("[data-story-panel]")
    );
    const cards = panels.map((panel) =>
      panel.querySelector(".story-scroll__card")
    );
    const backgrounds = Array.from(
      section.querySelectorAll("[data-story-bg]")
    );
    if (!panels.length) return;

    let ticking = false;
    let activeIndex = -1;

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function setActiveBg(index) {
      if (index === activeIndex) return;
      activeIndex = index;

      panels.forEach((panel, i) => {
        const on = i === index;
        panel.classList.toggle("is-active", on);
        panel.setAttribute("aria-hidden", on ? "false" : "true");
      });

      backgrounds.forEach((img, i) => {
        img.classList.toggle("is-active", i === index);
      });
    }

    // Cover ends at timeline ≈ 1/3 (section height 300vh, first 100vh = cover).
    // Card 1 segment is built so its peak lands exactly on that cover end.
    const COVER_END = 1 / 3;
    const card1End = 0.42;
    const peakLocal = COVER_END / card1End; // ≈ 0.794

    // Card 2 (middle): travels 62% → 38% with scroll-linked fade — unchanged feel
    function cardStyle(t) {
      const progress = clamp(t, 0, 1);
      let opacity;
      if (progress < 0.18) opacity = progress / 0.18;
      else if (progress > 0.82) opacity = (1 - progress) / 0.18;
      else opacity = 1;

      const yPercent = 62 - progress * (62 - 38);
      return { opacity: clamp(opacity, 0, 1), yPercent };
    }

    // Card 1 (intro): peaks at center + full opacity when cover completes (timeline ≈ 1/3)
    function cardStyleIntro(t) {
      const progress = clamp(t, 0, 1);
      const yStart = 70;
      const yPeak = 50;
      const yEnd = 40;
      let opacity;
      let yPercent;

      if (progress <= peakLocal) {
        const p = peakLocal > 0 ? progress / peakLocal : 1;
        opacity = p;
        yPercent = yStart + (yPeak - yStart) * p;
      } else {
        const p = (progress - peakLocal) / (1 - peakLocal);
        opacity = 1 - p;
        yPercent = yPeak + (yEnd - yPeak) * p;
      }

      return { opacity: clamp(opacity, 0, 1), yPercent };
    }

    // Card 3 (exit): from center onward fades out so opacity hits 0 as section unpins
    function cardStyleExit(t) {
      const progress = clamp(t, 0, 1);
      let opacity;
      if (progress < 0.18) opacity = progress / 0.18;
      else if (progress < 0.5) opacity = 1;
      else opacity = (1 - progress) / 0.5;

      const yPercent = 62 - progress * (62 - 38);
      return { opacity: clamp(opacity, 0, 1), yPercent };
    }

    // Cards 1–2 only; card 3 is timed to the sticky unpin phase below
    const SEGMENTS = [
      { start: 0, end: card1End, style: cardStyleIntro },
      { start: 0.38, end: 0.72, style: cardStyle },
    ];
    const CARD3_ENTER = 0.7;

    function applyCard(index, t, styleFn) {
      const card = cards[index];
      if (!card) return;
      if (!(t >= 0 && t <= 1)) {
        card.style.opacity = "0";
        card.style.pointerEvents = "none";
        return;
      }
      const { opacity, yPercent } = styleFn(t);
      card.style.top = yPercent + "%";
      card.style.opacity = String(opacity);
      card.style.transform = "translate(-50%, -50%)";
      card.style.pointerEvents = opacity > 0.4 ? "auto" : "none";
    }

    function update() {
      ticking = false;
      const vh = window.innerHeight || 1;
      const rect = section.getBoundingClientRect();
      const storyTop = rect.top;
      const count = panels.length;
      const total = Math.max(section.offsetHeight, 1);

      // Pre-lift (~3vh) before story enters, then cover: story invades; hero rises 30%
      const coverProgress = clamp((vh - storyTop) / vh, 0, 1);
      if (heroSticky) {
        const LIFT = 0.03 * vh;
        const preLift = clamp(vh + LIFT - storyTop, 0, LIFT);
        const coverY = 0.3 * vh * coverProgress;
        heroSticky.style.transform =
          "translateY(" + -(preLift + coverY) + "px)";
      }

      if (storyTop >= vh || storyTop <= -total) {
        for (let i = 0; i < count; i++) applyCard(i, -1, cardStyle);
        setActiveBg(0);
        return;
      }

      // Continuous timeline: cover + pinned scroll (cards 1–2)
      // When storyTop hits 0, timeline ≈ 1/3 — card 1 peaks (center, full opacity)
      const traveled = clamp(vh - storyTop, 0, total);
      const timeline = clamp(traveled / total, 0, 1);

      // Sticky releases when parent bottom meets viewport bottom
      const unpinStartTop = -(total - vh);
      const unpinProgress =
        storyTop < unpinStartTop
          ? clamp((unpinStartTop - storyTop) / vh, 0, 1)
          : 0;

      // Card 3: enter during late pin (local 0→0.5), fade during native unpin (0.5→1)
      let local3 = -1;
      if (unpinProgress > 0) {
        local3 = 0.5 + unpinProgress * 0.5;
      } else if (timeline >= CARD3_ENTER) {
        local3 = ((timeline - CARD3_ENTER) / (1 - CARD3_ENTER)) * 0.5;
      }

      let bestIndex = 0;
      let bestScore = -1;

      for (let i = 0; i < SEGMENTS.length; i++) {
        const seg = SEGMENTS[i];
        const span = seg.end - seg.start;
        const local = span > 0 ? (timeline - seg.start) / span : -1;
        applyCard(i, local, seg.style);
        if (local >= 0 && local <= 1) {
          const peak = i === 0 ? peakLocal : 0.5;
          const score = 1 - Math.abs(local - peak);
          if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
          }
        }
      }

      // Card 3 (index 2) — not in SEGMENTS; synced with sticky unpin
      applyCard(2, local3, cardStyleExit);
      if (local3 >= 0 && local3 <= 1) {
        const score = 1 - Math.abs(local3 - 0.5);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = 2;
        }
      }

      setActiveBg(bestIndex);
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  initStoryScroll();

  // Hero: layered parallax on story cover progress
  function initHeroParallax() {
    const story = document.querySelector(".story-scroll");
    const copy = document.querySelector(".hero__copy");
    const media = document.querySelector(".hero__media");
    const actions = document.querySelector(".hero__actions");
    if (!story || (!copy && !media && !actions)) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function clamp(n, min, max) {
      return Math.min(max, Math.max(min, n));
    }

    function clearTransforms() {
      if (copy) copy.style.transform = "";
      if (media) media.style.transform = "";
      if (actions) actions.style.transform = "";
    }

    if (reduceMotion.matches) {
      clearTransforms();
      return;
    }

    let ticking = false;

    function update() {
      ticking = false;
      const vh = window.innerHeight || 1;
      const storyTop = story.getBoundingClientRect().top;
      const progress = clamp((vh - storyTop) / vh, 0, 1);

      if (copy) {
        copy.style.transform = "translate3d(0, " + -18 * progress + "px, 0)";
      }
      if (media) {
        media.style.transform = "translate3d(0, " + -28 * progress + "px, 0)";
      }
      if (actions) {
        actions.style.transform = "translate3d(0, " + -12 * progress + "px, 0)";
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    if (typeof reduceMotion.addEventListener === "function") {
      reduceMotion.addEventListener("change", () => {
        if (reduceMotion.matches) {
          clearTransforms();
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onScroll);
        }
      });
    }

    update();
  }

  initHeroParallax();

  // Shared scroll reveal: L→R slide + blur/opacity (outcomes + testimonials)
  function initScrollReveal(cardList) {
    const cards = Array.from(cardList || []);
    if (!cards.length) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const maxBlur = 16;

    function showAll() {
      cards.forEach((card) => {
        card.style.opacity = "1";
        card.style.filter = "none";
        card.style.transform = "none";
      });
    }

    if (reduceMotion.matches) {
      showAll();
      return;
    }

    function clamp(n, min, max) {
      return Math.min(max, Math.max(min, n));
    }

    let ticking = false;

    function update() {
      ticking = false;
      const vh = window.innerHeight || 1;
      const offset = Math.min(window.innerWidth * 0.28, 160);
      // Start at bottom 20% band (0.80vh), finish mid-viewport (0.55vh)
      const startY = vh * 0.8;
      const endY = vh * 0.55;

      cards.forEach((card) => {
        const top = card.getBoundingClientRect().top;
        const p = clamp((startY - top) / (startY - endY), 0, 1);
        card.style.opacity = String(p);
        card.style.filter = p >= 1 ? "none" : `blur(${(1 - p) * maxBlur}px)`;
        card.style.transform =
          p >= 1 ? "none" : `translateX(${(1 - p) * -offset}px)`;
      });
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    function onMotionChange() {
      if (reduceMotion.matches) {
        showAll();
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    if (typeof reduceMotion.addEventListener === "function") {
      reduceMotion.addEventListener("change", onMotionChange);
    }
    update();
  }

  initScrollReveal(document.querySelectorAll(".outcome"));
  initScrollReveal(document.querySelectorAll(".testimonial"));

  // Bonus section: scroll-linked background glow behind the card
  function initBonusGlow() {
    const section = document.querySelector(".section--bonus");
    if (!section) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function clamp(n, min, max) {
      return Math.min(max, Math.max(min, n));
    }

    function setGlow(yPercent) {
      section.style.setProperty("--bonus-glow-y", yPercent + "%");
    }

    if (reduceMotion.matches) {
      setGlow(50);
      return;
    }

    let ticking = false;

    function update() {
      ticking = false;
      const vh = window.innerHeight || 1;
      const rect = section.getBoundingClientRect();
      const travel = vh + rect.height;
      if (travel <= 0) {
        setGlow(50);
        return;
      }
      const progress = clamp((vh - rect.top) / travel, 0, 1);
      setGlow(progress * 100);
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    if (typeof reduceMotion.addEventListener === "function") {
      reduceMotion.addEventListener("change", () => {
        if (reduceMotion.matches) {
          setGlow(50);
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onScroll);
        }
      });
    }
    update();
  }

  initBonusGlow();

  // How it works carousel: autoplay + arrows + swipe
  function initHowCarousel() {
    const root = document.querySelector("[data-how-carousel]");
    if (!root) return;

    const cards = Array.from(root.querySelectorAll("[data-how-card]"));
    const prevBtn = root.querySelector("[data-how-prev]");
    const nextBtn = root.querySelector("[data-how-next]");
    const viewport = root.querySelector(".how-carousel__viewport");
    if (!cards.length || !viewport) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const AUTOPLAY_MS = 5000;
    let index = Math.max(
      0,
      cards.findIndex((card) => card.classList.contains("is-active"))
    );
    let timer = null;
    let pointerId = null;
    let startX = 0;
    let dragging = false;

    function render() {
      const total = cards.length;
      cards.forEach((card, i) => {
        card.classList.remove("is-active", "is-next", "is-prev");
        if (i === index) card.classList.add("is-active");
        else if (i === (index + 1) % total) card.classList.add("is-next");
        else if (i === (index - 1 + total) % total) card.classList.add("is-prev");
      });
    }

    function goTo(nextIndex) {
      const total = cards.length;
      index = ((nextIndex % total) + total) % total;
      render();
      restartAutoplay();
    }

    function next() {
      goTo(index + 1);
    }

    function prev() {
      goTo(index - 1);
    }

    function stopAutoplay() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function startAutoplay() {
      stopAutoplay();
      if (reduceMotion.matches) return;
      timer = window.setInterval(next, AUTOPLAY_MS);
    }

    function restartAutoplay() {
      startAutoplay();
    }

    if (prevBtn) prevBtn.addEventListener("click", prev);
    if (nextBtn) nextBtn.addEventListener("click", next);

    root.addEventListener("mouseenter", stopAutoplay);
    root.addEventListener("mouseleave", startAutoplay);
    root.addEventListener("focusin", stopAutoplay);
    root.addEventListener("focusout", (event) => {
      if (!root.contains(event.relatedTarget)) startAutoplay();
    });

    viewport.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      dragging = true;
      viewport.setPointerCapture(pointerId);
      stopAutoplay();
    });

    viewport.addEventListener("pointerup", (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      dragging = false;
      pointerId = null;
      if (Math.abs(dx) > 42) {
        if (dx < 0) next();
        else prev();
      } else {
        startAutoplay();
      }
    });

    viewport.addEventListener("pointercancel", () => {
      dragging = false;
      pointerId = null;
      startAutoplay();
    });

    if (typeof reduceMotion.addEventListener === "function") {
      reduceMotion.addEventListener("change", () => {
        if (reduceMotion.matches) stopAutoplay();
        else startAutoplay();
      });
    }

    render();
    startAutoplay();
  }

  initHowCarousel();
})();
