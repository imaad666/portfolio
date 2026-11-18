(function () {
  const LOGIN = "imaad666";

  // Independent auto-advance for each strip (not synced)
  function createAutoAdvance(period) {
    let timerId = null;
    let nextFn = null;
    let prevFn = null;
    let blocked = false;
    return {
      bind({ next, prev }) {
        nextFn = next;
        prevFn = prev;
      },
      next() {
        if (blocked) return;
        nextFn?.();
      },
      prev() {
        if (blocked) return;
        prevFn?.();
      },
      pause() {
        if (timerId) clearInterval(timerId);
        timerId = null;
      },
      block() {
        blocked = true;
        this.pause();
      },
      unblock() {
        blocked = false;
      },
      restart() {
        this.pause();
        blocked = false;
        if (!nextFn) return;
        timerId = setInterval(() => {
          if (!blocked) nextFn();
        }, period);
      },
    };
  }

  const LEVELS = [
    null,
    "heatmap-day--l1",
    "heatmap-day--l2",
    "heatmap-day--l3",
    "heatmap-day--l4",
  ];

  function levelClass(level, count) {
    if (typeof level === "number" && level >= 0) {
      return LEVELS[Math.min(level, 4)];
    }
    if (!count) return null;
    if (count <= 2) return LEVELS[1];
    if (count <= 5) return LEVELS[2];
    if (count <= 10) return LEVELS[3];
    return LEVELS[4];
  }

  function daysToWeeks(days) {
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push({
        contributionDays: days.slice(i, i + 7).map((d) => ({
          date: d.date,
          contributionCount: d.count ?? d.contributionCount ?? 0,
          level: d.level,
        })),
      });
    }
    return weeks;
  }

  function padWeeksToSunday(days) {
    if (!days.length) return days;
    const first = new Date(days[0].date + "T00:00:00");
    const weekday = first.getDay();
    const padded = [];
    for (let i = 0; i < weekday; i++) {
      padded.push({ date: "", count: 0, level: 0, empty: true });
    }
    return padded.concat(days);
  }

  async function fetchLocal() {
    const response = await fetch("/api/github-contributions");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.error || "Local API failed");
    }
    return {
      total: data.totalContributions,
      weeks: data.weeks,
    };
  }

  async function fetchPublic() {
    const response = await fetch(
      `https://github-contributions-api.jogruber.de/v4/${LOGIN}?y=last`
    );
    if (!response.ok) throw new Error("Public contributions API failed");
    const data = await response.json();
    const days = padWeeksToSunday(data.contributions || []);
    return {
      total: data.total?.lastYear ?? 0,
      weeks: daysToWeeks(days),
    };
  }

  function weeksForViewport(weeks) {
    if (!Array.isArray(weeks) || !weeks.length) return weeks || [];
    const narrow = window.matchMedia("(max-width: 720px)").matches;
    if (!narrow) return weeks;

    // Fit as many recent weeks as the phone width can hold (flush to the right edge)
    const daySize = window.matchMedia("(max-width: 420px)").matches ? 6.5 : 7;
    const gap = 2;
    const weekW = daySize + gap;
    const available = Math.max(
      14,
      Math.floor((window.innerWidth - 28) / weekW)
    );
    const keep = Math.min(weeks.length, available);
    return weeks.slice(weeks.length - keep);
  }

  function pinHeatmapToLatest() {
    const wrap = document.querySelector(".heatmap-wrap");
    const heatmap = document.getElementById("contributions-heatmap");
    if (!wrap || !heatmap) return;

    // Newest weeks sit against the right edge of the phone
    heatmap.style.marginLeft = "auto";
    wrap.scrollLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
  }

  function renderHeatmap({ total, weeks }) {
    const heatmap = document.getElementById("contributions-heatmap");
    const totalEl = document.getElementById("contributions-total");
    const fallbackEl = document.getElementById("contributions-fallback");

    totalEl.textContent = `${Number(total).toLocaleString()} commits`;
    fallbackEl.hidden = true;
    heatmap.innerHTML = "";
    heatmap.style.marginLeft = "";

    weeksForViewport(weeks).forEach((week, weekIndex) => {
      const weekCol = document.createElement("div");
      weekCol.className = "heatmap-week";
      const delay = `${weekIndex * 0.018}s`;

      week.contributionDays.forEach((day) => {
        const cell = document.createElement("div");
        cell.className = "heatmap-day";
        cell.style.animationDelay = delay;

        if (day.empty || !day.date) {
          cell.style.visibility = "hidden";
        } else {
          const cls = levelClass(day.level, day.contributionCount);
          if (cls) cell.classList.add(cls);
          cell.title = `${day.date}: ${day.contributionCount} contribution${
            day.contributionCount === 1 ? "" : "s"
          }`;
          cell.setAttribute("aria-label", cell.title);
        }

        weekCol.appendChild(cell);
      });

      while (weekCol.children.length < 7) {
        const pad = document.createElement("div");
        pad.className = "heatmap-day";
        pad.style.visibility = "hidden";
        pad.style.animationDelay = delay;
        weekCol.appendChild(pad);
      }

      heatmap.appendChild(weekCol);
    });

    requestAnimationFrame(() => {
      pinHeatmapToLatest();
      // Second pass after layout settles (fonts / safe areas)
      requestAnimationFrame(pinHeatmapToLatest);
    });
  }

  async function loadGitHubContributions() {
    const heatmap = document.getElementById("contributions-heatmap");
    const totalEl = document.getElementById("contributions-total");
    const fallbackEl = document.getElementById("contributions-fallback");

    if (!heatmap || !totalEl || !fallbackEl) return;

    try {
      let payload;
      try {
        payload = await fetchLocal();
      } catch {
        payload = await fetchPublic();
      }
      renderHeatmap(payload);
    } catch (error) {
      totalEl.textContent = "unavailable";
      fallbackEl.hidden = false;
      fallbackEl.textContent = "Could not load contribution data right now.";
      heatmap.innerHTML = "";
    }
  }

  document.addEventListener("DOMContentLoaded", loadGitHubContributions);

  async function fetchBadgeSource(url) {
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.error || `Failed ${url}`);
    }
    return (data.badges || []).map((badge) => ({
      ...badge,
      source: badge.source || (url.includes("accredible") ? "accredible" : "credly"),
    }));
  }

  function dedupeBadges(badges) {
    const seen = new Set();
    return badges.filter((badge) => {
      const key = `${badge.name}|${badge.image}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(badge.image);
    });
  }

  function formatBadgeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function renderBadgeDeck(badges) {
    const stack = document.getElementById("badge-stack");
    const track = document.getElementById("badge-track");
    const fallbackEl = document.getElementById("badges-fallback");
    const focusEl = document.getElementById("badge-focus");
    const focusName = document.getElementById("badge-focus-name");
    const focusMeta = document.getElementById("badge-focus-meta");
    const focusHint = document.getElementById("badge-focus-hint");
    if (!stack || !fallbackEl) return;

    stack.innerHTML = "";

    if (!badges.length) {
      fallbackEl.hidden = false;
      fallbackEl.textContent = "No public badges yet.";
      return;
    }

    fallbackEl.hidden = true;

    const items = badges.map((badge, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "badge-deck__item";
      button.title = badge.issuer
        ? `${badge.name} — ${badge.issuer}`
        : badge.name;
      button.setAttribute("role", "option");
      button.dataset.index = String(index);
      button.dataset.url = badge.url || "";

      const img = document.createElement("img");
      img.src = badge.image;
      img.alt = badge.name;
      img.loading = index < 10 ? "eager" : "lazy";
      img.draggable = false;
      // Same settle-in cadence as the heatmap cells
      img.style.animationDelay = `${index * 0.04}s`;

      button.appendChild(img);
      stack.appendChild(button);
      return button;
    });

    let active = 0;
    let primedIndex = -1;
    let dragStartX = 0;
    let dragScrollLeft = 0;
    let dragging = false;
    let didDrag = false;
    let syncing = false;
    let programmatic = false;
    let scrollAnimId = 0;
    let loopId = 0;
    let resumeTimer = null;
    let progTimer = null;
    const auto = createAutoAdvance(5200);
    // Touch: native swipe momentum; desktop: custom drag. Both keep curved lerp.
    const touchy =
      window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;

    const visuals = items.map(() => ({
      scale: 0.78,
      lift: 0,
      rotate: 0,
      gray: 1,
      opacity: 0.42,
    }));

    function cancelProgrammaticScroll() {
      if (scrollAnimId) {
        cancelAnimationFrame(scrollAnimId);
        scrollAnimId = 0;
      }
      syncing = false;
    }

    // Manual input wins — stop timed advances until the user goes idle
    function noteManual() {
      auto.block();
      cancelProgrammaticScroll();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        auto.unblock();
        auto.restart();
      }, 2400);
    }

    function hideFocus() {
      primedIndex = -1;
      const deck = document.getElementById("badge-deck");
      if (deck) deck.classList.remove("is-focused");
      if (!focusEl) return;
      focusEl.classList.remove("is-visible");
      focusEl.hidden = true;
      if (focusHint) {
        focusHint.textContent = "";
        focusHint.hidden = true;
      }
    }

    function showFocus(badge, index) {
      if (!focusEl || !focusName || !focusMeta) return;
      const issued = formatBadgeDate(badge.issued);
      const provider =
        badge.source === "accredible"
          ? "Accredible"
          : badge.source === "credly"
            ? "Credly"
            : null;
      const bits = [badge.issuer, issued, provider].filter(Boolean);

      primedIndex = index;
      focusName.textContent = badge.name || "Badge";
      focusMeta.textContent = bits.join(" · ");
      if (focusHint) {
        focusHint.textContent = "tap again to open";
        focusHint.hidden = false;
      }
      focusEl.hidden = false;
      const deck = document.getElementById("badge-deck");
      if (deck) deck.classList.add("is-focused");
      requestAnimationFrame(() => focusEl.classList.add("is-visible"));
    }

    function markActive(index) {
      active = index;
      items.forEach((item, i) => {
        const on = i === index;
        item.classList.toggle("is-active", on);
        item.setAttribute("aria-selected", String(on));
        item.tabIndex = on ? 0 : -1;
      });

      // Coverflow stays quiet by default — only a tap opens the focus panel
      if (
        primedIndex !== -1 &&
        index !== primedIndex &&
        !syncing &&
        !programmatic
      ) {
        hideFocus();
      }
    }

    function nearestIndex() {
      if (!track || !items.length) return 0;
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      items.forEach((item, i) => {
        const center = item.offsetLeft + item.offsetWidth / 2;
        const dist = Math.abs(center - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      return best;
    }

    function sampleTargets() {
      if (!track) return [];
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;

      const edgePad = track.clientWidth * 0.14;
      const viewLeft = track.scrollLeft + edgePad;
      const viewRight = track.scrollLeft + track.clientWidth - edgePad;

      const targets = items.map((item, i) => {
        const width = item.offsetWidth || 1;
        const center = item.offsetLeft + width / 2;
        const px = center - mid;
        const absPx = Math.abs(px);
        if (absPx < bestDist) {
          bestDist = absPx;
          best = i;
        }

        const t = px / (width * 0.95);
        const abs = Math.min(Math.abs(t), 2.4);
        const ease = 1 - Math.pow(1 - Math.min(abs / 1.25, 1), 1.65);

        let edgeFade = 1;
        if (center < viewLeft) {
          edgeFade = Math.max(0, 1 - (viewLeft - center) / (width * 0.7));
        } else if (center > viewRight) {
          edgeFade = Math.max(0, 1 - (center - viewRight) / (width * 0.7));
        }

        return {
          scale: 1.22 - ease * 0.44,
          lift: (1 - ease) * 0.2,
          rotate: Math.max(-7, Math.min(7, t * -3.8)),
          gray: Math.min(1, ease * 1.15),
          opacity: Math.max(0, (1 - ease * 0.55) * edgeFade),
          z: Math.round(50 - abs * 12),
        };
      });

      if (best !== active) markActive(best);
      return targets;
    }

    function applyVisual(item, visual, z) {
      item.style.transform = `translate3d(0, ${-visual.lift}rem, 0) scale(${visual.scale}) rotate(${visual.rotate}deg)`;
      item.style.filter = `grayscale(${visual.gray}) contrast(${1.02 + (1 - visual.gray) * 0.08})`;
      item.style.opacity = String(visual.opacity);
      item.style.zIndex = String(z);
    }

    function tick() {
      loopId = 0;
      if (!track || !items.length) return;

      const targets = sampleTargets();
      const k = dragging ? 0.55 : syncing ? 0.2 : 0.14;
      let stillMoving = dragging || syncing;

      items.forEach((item, i) => {
        const visual = visuals[i];
        const target = targets[i];
        if (!target) return;

        visual.scale += (target.scale - visual.scale) * k;
        visual.lift += (target.lift - visual.lift) * k;
        visual.rotate += (target.rotate - visual.rotate) * k;
        visual.gray += (target.gray - visual.gray) * k;
        visual.opacity += (target.opacity - visual.opacity) * k;

        if (
          Math.abs(target.scale - visual.scale) > 0.0015 ||
          Math.abs(target.gray - visual.gray) > 0.004 ||
          Math.abs(target.opacity - visual.opacity) > 0.004 ||
          Math.abs(target.rotate - visual.rotate) > 0.05
        ) {
          stillMoving = true;
        }

        applyVisual(item, visual, target.z);
      });

      if (stillMoving) {
        loopId = requestAnimationFrame(tick);
      }
    }

    function kick() {
      if (!loopId) loopId = requestAnimationFrame(tick);
    }

    function targetScrollLeft(index) {
      const item = items[index];
      if (!track || !item) return 0;
      return Math.max(0, item.offsetLeft - (track.clientWidth / 2 - item.offsetWidth / 2));
    }

    function animateTo(index, duration = 980) {
      if (!track || !items[index]) return;
      cancelProgrammaticScroll();

      const end = targetScrollLeft(index);
      const start = track.scrollLeft;
      const delta = end - start;

      if (duration <= 0 || Math.abs(delta) < 0.5) {
        track.scrollLeft = end;
        syncing = false;
        markActive(index);
        kick();
        return;
      }

      // On touch, prefer native smooth scroll so momentum isn’t stolen mid-swipe
      if (touchy) {
        programmatic = true;
        markActive(index);
        track.scrollTo({ left: end, behavior: "smooth" });
        clearTimeout(progTimer);
        progTimer = setTimeout(() => {
          programmatic = false;
        }, 650);
        kick();
        return;
      }

      syncing = true;
      markActive(index);
      const t0 = performance.now();
      kick();

      const step = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - p, 5);
        track.scrollLeft = start + delta * e;
        kick();
        if (p < 1) {
          scrollAnimId = requestAnimationFrame(step);
        } else {
          scrollAnimId = 0;
          syncing = false;
          markActive(index);
          kick();
        }
      };

      scrollAnimId = requestAnimationFrame(step);
    }

    items.forEach((item, index) => {
      item.addEventListener("click", () => {
        if (didDrag) {
          didDrag = false;
          return;
        }

        // Already focused → open Credly / Accredible
        if (primedIndex === index) {
          const url = badges[index]?.url || item.dataset.url;
          if (url) window.open(url, "_blank", "noopener,noreferrer");
          return;
        }

        noteManual();
        showFocus(badges[index], index);
        if (index !== active) animateTo(index, touchy ? 500 : 1050);
        else markActive(index);
      });
    });

    if (track) {
      track.addEventListener(
        "scroll",
        () => {
          // User (or momentum) scrolling — never let auto fight it
          if (!syncing && !programmatic) noteManual();
          kick();
        },
        { passive: true }
      );

      track.addEventListener(
        "wheel",
        (event) => {
          if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            event.preventDefault();
            track.scrollLeft += event.deltaY * 0.55;
          }
          noteManual();
          kick();
        },
        { passive: false }
      );

      if (!touchy) {
        track.addEventListener("pointerdown", (event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          cancelProgrammaticScroll();
          dragging = true;
          didDrag = false;
          dragStartX = event.clientX;
          dragScrollLeft = track.scrollLeft;
          track.setPointerCapture(event.pointerId);
          noteManual();
          kick();
        });

        track.addEventListener("pointermove", (event) => {
          if (!dragging) return;
          const dx = event.clientX - dragStartX;
          if (Math.abs(dx) > 5) didDrag = true;
          track.scrollLeft = dragScrollLeft - dx;
          kick();
        });

        const endDrag = () => {
          if (!dragging) return;
          dragging = false;
          animateTo(nearestIndex(), 820);
          noteManual();
        };

        track.addEventListener("pointerup", endDrag);
        track.addEventListener("pointercancel", endDrag);
      } else {
        track.addEventListener(
          "touchstart",
          () => {
            noteManual();
          },
          { passive: true }
        );
      }

      track.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          noteManual();
          animateTo((active + 1) % items.length, 900);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          noteManual();
          animateTo((active - 1 + items.length) % items.length, 900);
        }
      });
    }

    function padForCenter() {
      if (!track || !items[0]) return;
      const pad = Math.max(12, track.clientWidth / 2 - items[0].offsetWidth / 2);
      stack.style.paddingLeft = `${pad}px`;
      stack.style.paddingRight = `${pad}px`;
      kick();
    }

    padForCenter();
    window.addEventListener("resize", padForCenter);
    animateTo(0, 0);
    kick();

    auto.bind({
      next: () => animateTo((active + 1) % items.length, touchy ? 600 : 1050),
      prev: () =>
        animateTo((active - 1 + items.length) % items.length, touchy ? 600 : 1050),
    });
    auto.restart();
  }

  async function loadBadges() {
    const stack = document.getElementById("badge-stack");
    const fallbackEl = document.getElementById("badges-fallback");
    if (!stack || !fallbackEl) return;

    try {
      const results = await Promise.allSettled([
        fetchBadgeSource("/api/credly-badges"),
        fetchBadgeSource("/api/accredible-badges"),
      ]);

      const badges = dedupeBadges(
        results.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      ).sort((a, b) => new Date(b.issued || 0) - new Date(a.issued || 0));

      if (!badges.length) {
        const firstError = results.find((result) => result.status === "rejected");
        throw firstError?.reason || new Error("No badges");
      }

      renderBadgeDeck(badges);
    } catch (error) {
      fallbackEl.hidden = false;
      fallbackEl.textContent = "Could not load badges right now.";
      stack.innerHTML = "";
    }
  }

  document.addEventListener("DOMContentLoaded", loadBadges);

  function initProjectCarousel() {
    const track = document.getElementById("project-track");
    const strip = document.getElementById("project-stack");
    const items = Array.from(document.querySelectorAll(".project-deck__item"));
    if (!track || !strip || !items.length) return;

    let active = 0;
    let dragStartX = 0;
    let dragScrollLeft = 0;
    let dragging = false;
    let didDrag = false;
    let syncing = false;
    let scrollAnimId = 0;
    let loopId = 0;
    let resumeTimer = null;
    const auto = createAutoAdvance(6200);

    const visuals = items.map(() => ({
      scale: 0.94,
      opacity: 0.45,
    }));

    items.forEach((item, index) => {
      item.dataset.index = String(index);
    });

    function noteManual() {
      auto.block();
      if (scrollAnimId) {
        cancelAnimationFrame(scrollAnimId);
        scrollAnimId = 0;
        syncing = false;
      }
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        auto.unblock();
        auto.restart();
      }, 2400);
    }

    function markActive(index) {
      active = index;
      items.forEach((item, i) => {
        const on = i === index;
        item.classList.toggle("is-active", on);
        item.setAttribute("aria-selected", String(on));
        item.tabIndex = on ? 0 : -1;
      });
    }

    function sampleTargets() {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      const edgePad = track.clientWidth * 0.12;
      const viewLeft = track.scrollLeft + edgePad;
      const viewRight = track.scrollLeft + track.clientWidth - edgePad;

      const targets = items.map((item, i) => {
        const width = item.offsetWidth || 1;
        const center = item.offsetLeft + width / 2;
        const absPx = Math.abs(center - mid);
        if (absPx < bestDist) {
          bestDist = absPx;
          best = i;
        }

        const abs = Math.min(absPx / (width * 0.9), 2);
        const ease = Math.min(abs / 1.2, 1);
        let edgeFade = 1;
        if (center < viewLeft) {
          edgeFade = Math.max(0, 1 - (viewLeft - center) / (width * 0.65));
        } else if (center > viewRight) {
          edgeFade = Math.max(0, 1 - (center - viewRight) / (width * 0.65));
        }

        return {
          scale: 1.02 - ease * 0.1,
          opacity: Math.max(0, (1 - ease * 0.55) * edgeFade),
        };
      });

      if (best !== active) markActive(best);
      return targets;
    }

    function tick() {
      loopId = 0;
      const targets = sampleTargets();
      const k = dragging ? 0.5 : syncing ? 0.22 : 0.16;
      let stillMoving = dragging || syncing;

      items.forEach((item, i) => {
        const visual = visuals[i];
        const target = targets[i];
        if (!target) return;
        visual.scale += (target.scale - visual.scale) * k;
        visual.opacity += (target.opacity - visual.opacity) * k;
        if (
          Math.abs(target.scale - visual.scale) > 0.0015 ||
          Math.abs(target.opacity - visual.opacity) > 0.004
        ) {
          stillMoving = true;
        }
        item.style.transform = `scale(${visual.scale})`;
        item.style.opacity = String(visual.opacity);
      });

      if (stillMoving) loopId = requestAnimationFrame(tick);
    }

    function kick() {
      if (!loopId) loopId = requestAnimationFrame(tick);
    }

    function targetScrollLeft(index) {
      const item = items[index];
      if (!item) return 0;
      return Math.max(0, item.offsetLeft - (track.clientWidth / 2 - item.offsetWidth / 2));
    }

    function animateTo(index, duration = 980) {
      if (!items[index]) return;
      if (scrollAnimId) cancelAnimationFrame(scrollAnimId);

      const start = track.scrollLeft;
      const end = targetScrollLeft(index);
      const delta = end - start;

      if (duration <= 0 || Math.abs(delta) < 0.5) {
        track.scrollLeft = end;
        syncing = false;
        markActive(index);
        kick();
        return;
      }

      syncing = true;
      const t0 = performance.now();
      kick();

      const step = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - p, 5);
        track.scrollLeft = start + delta * e;
        kick();
        if (p < 1) {
          scrollAnimId = requestAnimationFrame(step);
        } else {
          scrollAnimId = 0;
          syncing = false;
          markActive(index);
          kick();
        }
      };

      scrollAnimId = requestAnimationFrame(step);
    }

    items.forEach((item, index) => {
      item.addEventListener("click", (event) => {
        if (event.target.closest("a")) return;
        if (didDrag) {
          event.preventDefault();
          didDrag = false;
          return;
        }
        if (index !== active) {
          noteManual();
          animateTo(index, 1050);
        }
      });
    });

    track.addEventListener(
      "scroll",
      () => {
        if (!syncing) noteManual();
        kick();
      },
      { passive: true }
    );

    track.addEventListener(
      "wheel",
      (event) => {
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
          event.preventDefault();
          track.scrollLeft += event.deltaY * 0.55;
        }
        noteManual();
        kick();
      },
      { passive: false }
    );

    track.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target.closest("a")) return;
      if (scrollAnimId) {
        cancelAnimationFrame(scrollAnimId);
        scrollAnimId = 0;
        syncing = false;
      }
      dragging = true;
      didDrag = false;
      dragStartX = event.clientX;
      dragScrollLeft = track.scrollLeft;
      track.setPointerCapture(event.pointerId);
      noteManual();
      kick();
    });

    track.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const dx = event.clientX - dragStartX;
      if (Math.abs(dx) > 5) didDrag = true;
      track.scrollLeft = dragScrollLeft - dx;
      kick();
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      animateTo(active, 820);
      noteManual();
    };

    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);

    track.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        noteManual();
        animateTo((active + 1) % items.length, 900);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        noteManual();
        animateTo((active - 1 + items.length) % items.length, 900);
      }
    });

    function padForCenter() {
      const pad = Math.max(16, track.clientWidth / 2 - items[0].offsetWidth / 2);
      strip.style.paddingLeft = `${pad}px`;
      strip.style.paddingRight = `${pad}px`;
      kick();
    }

    padForCenter();
    window.addEventListener("resize", padForCenter);
    animateTo(0, 0);
    kick();

    auto.bind({
      next: () => animateTo((active + 1) % items.length, 1050),
      prev: () => animateTo((active - 1 + items.length) % items.length, 1050),
    });
    auto.restart();
  }

  document.addEventListener("DOMContentLoaded", initProjectCarousel);
})();
