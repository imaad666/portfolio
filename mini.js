(function () {
  const LOGIN = "imaad666";
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

  function monthLabel(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleString("en-US", { month: "short" });
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
    const weekday = first.getDay(); // 0 Sun
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

  function renderMonths(weeks, monthsEl) {
    // `weeks` is already in the same order the heatmap columns are drawn in
    // (newest week first) — do not re-reverse here or labels drift out of
    // sync with the columns they sit above.
    monthsEl.innerHTML = "";
    let lastMonth = null;

    weeks.forEach((week) => {
      const firstDay = week.contributionDays.find((d) => d.date);
      const slot = document.createElement("span");
      slot.className = "heatmap-month";
      slot.style.width = "11px";

      if (firstDay?.date) {
        const label = monthLabel(firstDay.date);
        if (label !== lastMonth) {
          slot.textContent = label;
          lastMonth = label;
        }
      }

      monthsEl.appendChild(slot);
    });

    monthsEl.hidden = false;
  }

  function renderSkeleton() {
    const skeletonEl = document.getElementById("heatmap-skeleton");
    if (!skeletonEl || skeletonEl.childElementCount) return;

    const weekCount = 53;
    for (let w = 0; w < weekCount; w++) {
      const weekCol = document.createElement("div");
      weekCol.className = "heatmap-week";

      for (let d = 0; d < 7; d++) {
        const cell = document.createElement("div");
        cell.className = "heatmap-day";
        weekCol.appendChild(cell);
      }

      skeletonEl.appendChild(weekCol);
    }
  }

  function hideSkeleton() {
    const skeletonEl = document.getElementById("heatmap-skeleton");
    if (skeletonEl) skeletonEl.classList.add("is-hidden");
  }

  function renderHeatmap({ total, weeks }) {
    const heatmap = document.getElementById("contributions-heatmap");
    const totalEl = document.getElementById("contributions-total");
    const monthsEl = document.getElementById("heatmap-months");
    const fallbackEl = document.getElementById("contributions-fallback");

    totalEl.textContent = `${Number(total).toLocaleString()} in the last year`;
    fallbackEl.hidden = true;
    heatmap.innerHTML = "";

    const orderedWeeks = [...weeks].reverse();
    if (monthsEl && orderedWeeks.length) renderMonths(orderedWeeks, monthsEl);

    orderedWeeks.forEach((week, weekIndex) => {
      const weekCol = document.createElement("div");
      weekCol.className = "heatmap-week";
      const delay = `${weekIndex * 0.012}s`;

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

      // Ensure 7 rows even if week is short
      while (weekCol.children.length < 7) {
        const pad = document.createElement("div");
        pad.className = "heatmap-day";
        pad.style.visibility = "hidden";
        pad.style.animationDelay = delay;
        weekCol.appendChild(pad);
      }

      heatmap.appendChild(weekCol);
    });

    const wrap = heatmap.parentElement;
    if (wrap) {
      requestAnimationFrame(() => {
        wrap.scrollLeft = 0;
      });
    }

    hideSkeleton();
  }

  async function loadGitHubContributions() {
    const heatmap = document.getElementById("contributions-heatmap");
    const totalEl = document.getElementById("contributions-total");
    const fallbackEl = document.getElementById("contributions-fallback");
    const monthsEl = document.getElementById("heatmap-months");

    if (!heatmap || !totalEl || !fallbackEl) return;

    renderSkeleton();

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
      if (monthsEl) monthsEl.hidden = true;
      hideSkeleton();
    }
  }

  document.addEventListener("DOMContentLoaded", loadGitHubContributions);

  function hideBadgeSkeleton() {
    const skeletonEl = document.getElementById("badge-skeleton");
    if (skeletonEl) skeletonEl.classList.add("is-hidden");
  }

  async function loadCredlyBadges() {
    const stack = document.getElementById("badge-stack");
    const fallbackEl = document.getElementById("badges-fallback");
    if (!stack || !fallbackEl) return;

    try {
      const response = await fetch("/api/credly-badges");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || "Could not load badges");
      }

      const top = (data.badges || []).slice(0, 3);
      stack.innerHTML = "";
      hideBadgeSkeleton();

      if (!top.length) {
        fallbackEl.hidden = false;
        fallbackEl.textContent = "No public badges yet.";
        return;
      }

      top.forEach((badge, index) => {
        const link = document.createElement("a");
        link.className = "badge-stack__item";
        link.style.animationDelay = `${index * 0.08}s`;
        link.href = badge.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.title = badge.issuer ? `${badge.name} — ${badge.issuer}` : badge.name;

        const img = document.createElement("img");
        img.src = badge.image;
        img.alt = badge.name;
        img.loading = "lazy";

        link.appendChild(img);
        stack.appendChild(link);
      });
    } catch (error) {
      hideBadgeSkeleton();
      fallbackEl.hidden = false;
      fallbackEl.textContent = "Could not load badges right now.";
      stack.innerHTML = "";
    }
  }

  document.addEventListener("DOMContentLoaded", loadCredlyBadges);

  function initProjectCarousel() {
    const items = Array.from(document.querySelectorAll(".project-stack__item"));
    if (!items.length) return;
    const prevBtn = document.getElementById("project-prev");
    const nextBtn = document.getElementById("project-next");

    let index = 0;
    let timerId = null;

    function setActive(nextIndex) {
      items.forEach((item, i) => {
        const active = i === nextIndex;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-hidden", String(!active));
      });
    }

    function next() {
      index = (index + 1) % items.length;
      setActive(index);
    }

    function prev() {
      index = (index - 1 + items.length) % items.length;
      setActive(index);
    }

    function startAutoRotate() {
      if (timerId) clearInterval(timerId);
      timerId = setInterval(next, 5000);
    }

    setActive(index);

    if (items.length === 1) {
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        prev();
        startAutoRotate();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        next();
        startAutoRotate();
      });
    }

    startAutoRotate();
  }

  document.addEventListener("DOMContentLoaded", initProjectCarousel);

  // —— Aurora background: a slow-drifting fbm color field, multiplied under
  // the paper texture. Same technique as playgrnd's Aura tool (seeded value
  // noise → fbm → warped multi-ink blend), reimplemented with our own muted
  // palette instead of its neon defaults.
  const AURA_INKS = ["#8a6a45", "#5c4a34", "#726b52", "#c9b98c"].map(auraHexToRgb);
  const AURA_SEED = 4021;
  const AURA_WARP = 0.9;
  const AURA_CONTRAST = 2.6;
  const AURA_SCALE = 1.6;
  const AURA_PERIOD = 80; // seconds per full drift cycle
  const AURA_TAU = Math.PI * 2;
  const AURA_BUFFER_EDGE = 140;

  function auraHexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function auraHash(x, y, seed) {
    let n =
      Math.imul(x | 0, 374761393) ^
      Math.imul(y | 0, 668265263) ^
      Math.imul(seed | 0, 1013904223);
    n = Math.imul(n ^ (n >>> 15), 2246822519);
    n = Math.imul(n ^ (n >>> 13), 3266489917);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }

  function auraValueNoise(x, y, seed) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = auraHash(xi, yi, seed);
    const b = auraHash(xi + 1, yi, seed);
    const c = auraHash(xi, yi + 1, seed);
    const d = auraHash(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function auraFbm(x, y, seed) {
    return (
      auraValueNoise(x, y, seed) * 0.55 +
      auraValueNoise(x * 2.13, y * 2.13, seed + 11) * 0.28 +
      auraValueNoise(x * 4.31, y * 4.31, seed + 23) * 0.17
    );
  }

  function initAuraBackground() {
    const canvas = document.getElementById("paperAura");
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const buffer = document.createElement("canvas");
    const bufferCtx = buffer.getContext("2d");
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let currentT = 0;
    const startTime = performance.now();

    function paintBuffer(bw, bh, t) {
      if (buffer.width !== bw || buffer.height !== bh) {
        buffer.width = bw;
        buffer.height = bh;
      }
      const img = bufferCtx.createImageData(bw, bh);
      const d = img.data;
      const mind = Math.min(bw, bh);
      const zx = 0.5 * Math.cos(t);
      const zy = 0.5 * Math.sin(t);
      let p = 0;
      for (let y = 0; y < bh; y++) {
        const ny = ((y - bh / 2) / mind) * AURA_SCALE;
        for (let x = 0; x < bw; x++) {
          const nx = ((x - bw / 2) / mind) * AURA_SCALE;
          const q1 = auraFbm(nx + 11.3, ny + 7.9, AURA_SEED + 81);
          const q2 = auraFbm(nx + 3.7, ny + 19.1, AURA_SEED + 82);
          const wx = nx + AURA_WARP * (q1 - 0.5) + zx;
          const wy = ny + AURA_WARP * (q2 - 0.5) + zy;
          let sw = 0;
          let r = 0;
          let g = 0;
          let b = 0;
          for (let i = 0; i < AURA_INKS.length; i++) {
            const nz = auraFbm(
              wx * 1.15 + i * 5.3,
              wy * 1.15 - i * 4.1,
              AURA_SEED + 60 + i
            );
            const w = Math.pow(Math.max(nz, 0.002), AURA_CONTRAST);
            const ink = AURA_INKS[i];
            sw += w;
            r += w * ink[0];
            g += w * ink[1];
            b += w * ink[2];
          }
          d[p] = r / sw;
          d[p + 1] = g / sw;
          d[p + 2] = b / sw;
          d[p + 3] = 255;
          p += 4;
        }
      }
      bufferCtx.putImageData(img, 0, 0);
    }

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round((rect.width || window.innerWidth) * dpr));
      const h = Math.max(1, Math.round((rect.height || window.innerHeight) * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    function draw() {
      resizeCanvas();
      const bw = AURA_BUFFER_EDGE;
      const bh = Math.max(20, Math.round((bw * canvas.height) / canvas.width));
      paintBuffer(bw, bh, currentT);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
    }

    let paintRaf = null;
    function tick() {
      currentT =
        ((performance.now() - startTime) / 1000) * (AURA_TAU / AURA_PERIOD);
      if (paintRaf) return;
      paintRaf = requestAnimationFrame(() => {
        paintRaf = null;
        draw();
      });
    }

    let intervalId = null;
    function startLoop() {
      if (intervalId || reduceMotion) return;
      intervalId = setInterval(tick, 120);
    }
    function stopLoop() {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    }

    draw();
    startLoop();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopLoop();
      else startLoop();
    });

    let resizeRaf = null;
    window.addEventListener("resize", () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        draw();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", initAuraBackground);
})();
