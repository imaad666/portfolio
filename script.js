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
      // Pin to the newest weeks so the latest activity is what’s in view
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
      // Same settle-in cadence as the heatmap cells
      img.style.animationDelay = `${index * 0.04}s`;

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
    let scrollAnimId = 0;
    let loopId = 0;

    const visuals = items.map(() => ({
      scale: 0.78,
      lift: 0,
      rotate: 0,
      gray: 1,
      opacity: 0.42,
    }));

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
        // Soft falloff so the focused badge clearly blooms
        const ease = 1 - Math.pow(1 - Math.min(abs / 1.25, 1), 1.65);

        // Hide badges that would only show as half-cut edge scraps
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
      // Faster while dragging so it tracks the hand; slower otherwise = grace
      const k = dragging ? 0.5 : syncing ? 0.22 : 0.16;
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
          Math.abs(target.opacity - visual.opacity) > 0.004
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
        // Ease-out quint — long glide into place
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
        "scroll",
        () => {
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
          kick();
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
      kick();
    }

    padForCenter();
    window.addEventListener("resize", padForCenter);
    animateTo(0, 0);
    kick();

    carouselHub.register({
      next: () => animateTo((active + 1) % items.length, 1050),
      prev: () => animateTo((active - 1 + items.length) % items.length, 1050),
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

    const visuals = items.map(() => ({
      scale: 0.94,
      opacity: 0.45,
    }));

    items.forEach((item, index) => {
      item.dataset.index = String(index);
    });

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
          animateTo(index, 1050);
          carouselHub.restart();
        }
      });
    });

    track.addEventListener("scroll", () => kick(), { passive: true });

    track.addEventListener(
      "wheel",
      (event) => {
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
          event.preventDefault();
          track.scrollLeft += event.deltaY * 0.55;
        }
        kick();
        carouselHub.restart();
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
      if (carouselHub.timerId) clearInterval(carouselHub.timerId);
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

    carouselHub.register({
      next: () => animateTo((active + 1) % items.length, 1050),
      prev: () => animateTo((active - 1 + items.length) % items.length, 1050),
    });
    carouselHub.restart();
  }

  document.addEventListener("DOMContentLoaded", initProjectCarousel);
})();
