(function () {
  const LOGIN = "imaad666";

  // Shared pulse so badges + projects advance together
  const carouselHub = {
    controllers: [],
    timerId: null,
    period: 4600,
    register(controller) {
      this.controllers.push(controller);
    },
    next() {
      this.controllers.forEach((controller) => controller.next?.());
    },
    prev() {
      this.controllers.forEach((controller) => controller.prev?.());
    },
    restart() {
      if (this.timerId) clearInterval(this.timerId);
      if (this.controllers.length < 1) return;
      this.timerId = setInterval(() => this.next(), this.period);
    },
  };

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

  function renderHeatmap({ total, weeks }) {
    const heatmap = document.getElementById("contributions-heatmap");
    const totalEl = document.getElementById("contributions-total");
    const fallbackEl = document.getElementById("contributions-fallback");

    totalEl.textContent = `${Number(total).toLocaleString()} commits`;
    fallbackEl.hidden = true;
    heatmap.innerHTML = "";

    (weeks || []).forEach((week, weekIndex) => {
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

    const wrap = document.querySelector(".heatmap-wrap");
    if (wrap) {
      // Show the newest weeks first (right edge of the strip)
      requestAnimationFrame(() => {
        wrap.scrollLeft = wrap.scrollWidth;
      });
    }
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

  function renderBadgeDeck(badges) {
    const stack = document.getElementById("badge-stack");
    const track = document.getElementById("badge-track");
    const fallbackEl = document.getElementById("badges-fallback");
    if (!stack || !fallbackEl) return;

    stack.innerHTML = "";

    if (!badges.length) {
      fallbackEl.hidden = false;
      fallbackEl.textContent = "No public badges yet.";
      return;
    }

    fallbackEl.hidden = true;

    const items = badges.map((badge, index) => {
      const link = document.createElement("a");
      link.className = "badge-deck__item";
      link.href = badge.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.title = badge.issuer
        ? `${badge.name} — ${badge.issuer}`
        : badge.name;
      link.setAttribute("role", "option");
      link.dataset.index = String(index);

      const img = document.createElement("img");
      img.src = badge.image;
      img.alt = badge.name;
      img.loading = index < 10 ? "eager" : "lazy";
      img.draggable = false;
      img.style.animationDelay = `${index * 0.04}s`;

      link.appendChild(img);
      stack.appendChild(link);
      return link;
    });

    const n = items.length;
    let progress = 0; // continuous noodle position; ends connect via wrap
    let active = 0;
    let dragStartX = 0;
    let dragProgress = 0;
    let dragging = false;
    let didDrag = false;
    let animating = false;
    let animId = 0;
    let loopId = 0;
    let stepPx = 42;

    const visuals = items.map(() => ({
      x: 0,
      scale: 0.78,
      lift: 0,
      rotate: 0,
      gray: 1,
      opacity: 0,
    }));

    function measureStep() {
      const size = items[0]?.offsetWidth || 56;
      stepPx = size * 0.58;
    }

    // Shortest signed distance on the loop (connect the noodle ends)
    function loopDelta(index, from = progress) {
      let d = index - from;
      d = ((d % n) + n) % n;
      if (d > n / 2) d -= n;
      return d;
    }

    function normalizeProgress(value) {
      return ((value % n) + n) % n;
    }

    function markActive(index) {
      active = ((index % n) + n) % n;
      items.forEach((item, i) => {
        const on = i === active;
        item.classList.toggle("is-active", on);
        item.setAttribute("aria-selected", String(on));
        item.tabIndex = on ? 0 : -1;
      });
    }

    function sampleTargets() {
      measureStep();
      let best = 0;
      let bestAbs = Infinity;

      const targets = items.map((item, i) => {
        const d = loopDelta(i);
        const abs = Math.abs(d);
        if (abs < bestAbs) {
          bestAbs = abs;
          best = i;
        }

        const ease = 1 - Math.pow(1 - Math.min(abs / 1.35, 1), 1.65);
        const edgeFade = abs > 2.15 ? Math.max(0, 1 - (abs - 2.15) / 0.55) : 1;

        return {
          x: d * stepPx,
          scale: 1.22 - ease * 0.44,
          lift: (1 - ease) * 0.2,
          rotate: Math.max(-7, Math.min(7, d * -3.2)),
          gray: Math.min(1, ease * 1.15),
          opacity: Math.max(0, (1 - ease * 0.55) * edgeFade),
          z: Math.round(50 - abs * 12),
        };
      });

      if (best !== active) markActive(best);
      return targets;
    }

    function applyVisual(item, visual, z) {
      item.style.transform = `translate3d(calc(-50% + ${visual.x}px), ${-visual.lift}rem, 0) scale(${visual.scale}) rotate(${visual.rotate}deg)`;
      item.style.filter = `grayscale(${visual.gray}) contrast(${1.02 + (1 - visual.gray) * 0.08})`;
      item.style.opacity = String(visual.opacity);
      item.style.zIndex = String(z);
      item.style.pointerEvents = visual.opacity < 0.12 ? "none" : "auto";
    }

    function tick() {
      loopId = 0;
      const targets = sampleTargets();
      const k = dragging ? 0.55 : animating ? 0.24 : 0.18;
      let stillMoving = dragging || animating;

      items.forEach((item, i) => {
        const visual = visuals[i];
        const target = targets[i];
        if (!target) return;

        visual.x += (target.x - visual.x) * k;
        visual.scale += (target.scale - visual.scale) * k;
        visual.lift += (target.lift - visual.lift) * k;
        visual.rotate += (target.rotate - visual.rotate) * k;
        visual.gray += (target.gray - visual.gray) * k;
        visual.opacity += (target.opacity - visual.opacity) * k;

        if (
          Math.abs(target.x - visual.x) > 0.2 ||
          Math.abs(target.scale - visual.scale) > 0.0015 ||
          Math.abs(target.opacity - visual.opacity) > 0.004
        ) {
          stillMoving = true;
        }

        applyVisual(item, visual, target.z);
      });

      if (stillMoving) loopId = requestAnimationFrame(tick);
    }

    function kick() {
      if (!loopId) loopId = requestAnimationFrame(tick);
    }

    function animateTo(index, duration = 980) {
      index = ((index % n) + n) % n;
      if (!items[index]) return;
      if (animId) cancelAnimationFrame(animId);

      const start = progress;
      const delta = loopDelta(index, start);

      if (duration <= 0 || Math.abs(delta) < 0.001) {
        progress = normalizeProgress(index);
        animating = false;
        markActive(index);
        kick();
        return;
      }

      animating = true;
      const t0 = performance.now();
      kick();

      const step = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - p, 5);
        progress = start + delta * e;
        kick();
        if (p < 1) {
          animId = requestAnimationFrame(step);
        } else {
          animId = 0;
          progress = normalizeProgress(index);
          animating = false;
          markActive(index);
          kick();
        }
      };

      animId = requestAnimationFrame(step);
    }

    items.forEach((item, index) => {
      item.addEventListener("click", (event) => {
        if (didDrag) {
          event.preventDefault();
          didDrag = false;
          return;
        }
        if (index !== active) {
          event.preventDefault();
          animateTo(index, 1050);
          carouselHub.restart();
        }
      });
    });

    if (track) {
      track.addEventListener(
        "wheel",
        (event) => {
          event.preventDefault();
          const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX)
            ? event.deltaY
            : event.deltaX;
          progress = normalizeProgress(progress + delta * 0.0045);
          kick();
          carouselHub.restart();
        },
        { passive: false }
      );

      track.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if (animId) {
          cancelAnimationFrame(animId);
          animId = 0;
          animating = false;
        }
        dragging = true;
        didDrag = false;
        dragStartX = event.clientX;
        dragProgress = progress;
        track.setPointerCapture(event.pointerId);
        if (carouselHub.timerId) clearInterval(carouselHub.timerId);
        kick();
      });

      track.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        const dx = event.clientX - dragStartX;
        if (Math.abs(dx) > 5) didDrag = true;
        measureStep();
        progress = dragProgress - dx / stepPx;
        kick();
      });

      const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        progress = normalizeProgress(progress);
        const nearest = Math.round(progress) % n;
        animateTo(nearest, 820);
        carouselHub.restart();
      };

      track.addEventListener("pointerup", endDrag);
      track.addEventListener("pointercancel", endDrag);

      track.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          carouselHub.next();
          carouselHub.restart();
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          carouselHub.prev();
          carouselHub.restart();
        }
      });
    }

    window.addEventListener("resize", () => {
      measureStep();
      kick();
    });

    measureStep();
    animateTo(0, 0);
    kick();

    carouselHub.register({
      next: () => {
        const nextIndex = (Math.round(normalizeProgress(progress)) + 1) % n;
        animateTo(nextIndex, 1050);
      },
      prev: () => {
        const prevIndex = (Math.round(normalizeProgress(progress)) - 1 + n) % n;
        animateTo(prevIndex, 1050);
      },
    });
    carouselHub.restart();
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
    const items = Array.from(document.querySelectorAll(".project-stack__item"));
    if (!items.length) return;
    const prevBtn = document.getElementById("project-prev");
    const nextBtn = document.getElementById("project-next");

    let index = 0;

    function setActive(nextIndex) {
      index = nextIndex;
      items.forEach((item, i) => {
        const active = i === nextIndex;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-hidden", String(!active));
      });
    }

    function next() {
      setActive((index + 1) % items.length);
    }

    function prev() {
      setActive((index - 1 + items.length) % items.length);
    }

    setActive(index);

    if (items.length === 1) {
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        carouselHub.prev();
        carouselHub.restart();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        carouselHub.next();
        carouselHub.restart();
      });
    }

    carouselHub.register({ next, prev });
    carouselHub.restart();
  }

  document.addEventListener("DOMContentLoaded", initProjectCarousel);
})();
