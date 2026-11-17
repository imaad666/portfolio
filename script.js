(function () {
  const LOGIN = "imaad666";

  // Shared pulse so badges + projects advance together
  const carouselHub = {
    controllers: [],
    timerId: null,
    period: 4500,
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

    totalEl.textContent = `${Number(total).toLocaleString()} · year`;
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
      requestAnimationFrame(() => {
        wrap.scrollLeft = 0;
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

      link.appendChild(img);
      stack.appendChild(link);
      return link;
    });

    let active = 0;
    let dragStartX = 0;
    let dragScrollLeft = 0;
    let dragging = false;
    let didDrag = false;
    let syncing = false;
    let rafId = 0;
    let scrollAnimId = 0;

    function markActive(index) {
      active = index;
      items.forEach((item, i) => {
        const on = i === index;
        item.classList.toggle("is-active", on);
        item.setAttribute("aria-selected", String(on));
        item.tabIndex = on ? 0 : -1;
      });
    }

    function paint() {
      rafId = 0;
      if (!track || !items.length) return;

      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;

      items.forEach((item, i) => {
        const width = item.offsetWidth || 1;
        const center = item.offsetLeft + width / 2;
        const px = center - mid;
        const absPx = Math.abs(px);
        if (absPx < bestDist) {
          bestDist = absPx;
          best = i;
        }

        const t = px / (width * 1.05);
        const abs = Math.min(Math.abs(t), 2.2);
        const ease = Math.min(abs / 1.15, 1);
        const scale = 1.1 - ease * 0.2;
        const lift = (1 - ease) * 0.1;
        const rotate = Math.max(-3.5, Math.min(3.5, t * -2));
        const gray = Math.min(1, ease * 1.1);
        const opacity = 1 - ease * 0.32;

        item.style.transform = `translate3d(0, ${-lift}rem, 0) scale(${scale}) rotate(${rotate}deg)`;
        item.style.filter = `grayscale(${gray}) contrast(${1.03 + (1 - gray) * 0.04})`;
        item.style.opacity = String(Math.max(0.52, opacity));
        item.style.zIndex = String(Math.round(40 - abs * 10));
      });

      if (best !== active) markActive(best);
    }

    function requestPaint() {
      if (rafId) return;
      rafId = requestAnimationFrame(paint);
    }

    function targetScrollLeft(index) {
      const item = items[index];
      if (!track || !item) return 0;
      return Math.max(0, item.offsetLeft - (track.clientWidth / 2 - item.offsetWidth / 2));
    }

    function animateTo(index, duration = 1100) {
      if (!track || !items[index]) return;
      if (scrollAnimId) cancelAnimationFrame(scrollAnimId);

      const start = track.scrollLeft;
      const end = targetScrollLeft(index);
      const delta = end - start;

      if (duration <= 0 || Math.abs(delta) < 0.5) {
        track.scrollLeft = end;
        syncing = false;
        markActive(index);
        requestPaint();
        return;
      }

      syncing = true;
      const t0 = performance.now();

      const step = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        // smooth ease-in-out
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        track.scrollLeft = start + delta * e;
        requestPaint();
        if (p < 1) {
          scrollAnimId = requestAnimationFrame(step);
        } else {
          scrollAnimId = 0;
          syncing = false;
          markActive(index);
          requestPaint();
        }
      };

      scrollAnimId = requestAnimationFrame(step);
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
          animateTo(index, 1200);
          carouselHub.restart();
        }
      });
    });

    if (track) {
      track.addEventListener(
        "scroll",
        () => {
          if (!syncing) requestPaint();
        },
        { passive: true }
      );

      track.addEventListener(
        "wheel",
        (event) => {
          if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            event.preventDefault();
            track.scrollLeft += event.deltaY * 0.7;
          }
          requestPaint();
          carouselHub.restart();
        },
        { passive: false }
      );

      track.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
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
        if (carouselHub.timerId) clearInterval(carouselHub.timerId);
      });

      track.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        const dx = event.clientX - dragStartX;
        if (Math.abs(dx) > 5) didDrag = true;
        track.scrollLeft = dragScrollLeft - dx;
        requestPaint();
      });

      const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        paint();
        animateTo(active, 900);
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

    function padForCenter() {
      if (!track || !items[0]) return;
      const pad = Math.max(12, track.clientWidth / 2 - items[0].offsetWidth / 2);
      stack.style.paddingLeft = `${pad}px`;
      stack.style.paddingRight = `${pad}px`;
      requestPaint();
    }

    padForCenter();
    window.addEventListener("resize", padForCenter);
    requestPaint();
    animateTo(0, 0);

    carouselHub.register({
      next: () => animateTo((active + 1) % items.length, 1100),
      prev: () => animateTo((active - 1 + items.length) % items.length, 1100),
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
    const countEl = document.getElementById("project-count");

    if (countEl) countEl.textContent = String(items.length);

    let index = 0;

    function setActive(nextIndex) {
      index = nextIndex;
      items.forEach((item, i) => {
        const active = i === nextIndex;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-hidden", String(!active));
      });
      if (countEl) countEl.textContent = `${nextIndex + 1} / ${items.length}`;
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
