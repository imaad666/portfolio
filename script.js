(function () {
  const LOGIN = "imaad666";
  // Compact graph — ~6 months reads cleaner next to the badge coverflow
  const HEATMAP_WEEKS = 26;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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

  function trimWeeks(weeks) {
    if (!Array.isArray(weeks) || weeks.length <= HEATMAP_WEEKS) return weeks || [];
    return weeks.slice(weeks.length - HEATMAP_WEEKS);
  }

  function sumContributions(weeks) {
    return weeks.reduce((total, week) => {
      const days = week.contributionDays || [];
      return (
        total +
        days.reduce((sum, day) => sum + (day.contributionCount || day.count || 0), 0)
      );
    }, 0);
  }

  function renderSkeleton() {
    const skeletonEl = document.getElementById("heatmap-skeleton");
    if (!skeletonEl || skeletonEl.childElementCount) return;

    for (let w = 0; w < HEATMAP_WEEKS; w++) {
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

  function renderMonthLabels(orderedWeeks) {
    const monthsEl = document.getElementById("heatmap-months");
    if (!monthsEl) return;

    const gap = 2;
    const daySize = (() => {
      const probe = document.querySelector(".heatmap-day");
      return probe ? probe.getBoundingClientRect().width || 8 : 8;
    })();
    const weekWidth = daySize + gap;

    monthsEl.innerHTML = "";
    monthsEl.style.position = "relative";
    monthsEl.style.width = `${Math.max(orderedWeeks.length * weekWidth - gap, 0)}px`;

    let lastMonth = -1;
    orderedWeeks.forEach((week, weekIndex) => {
      const day = (week.contributionDays || []).find((d) => d.date);
      if (!day || !day.date) return;

      const date = new Date(day.date + "T00:00:00");
      const month = date.getMonth();
      if (month === lastMonth) return;
      lastMonth = month;

      const label = document.createElement("span");
      label.className = "heatmap-month";
      label.textContent = MONTHS[month];
      label.style.position = "absolute";
      label.style.left = `${weekIndex * weekWidth}px`;
      monthsEl.appendChild(label);
    });
  }

  function renderHeatmap({ total, weeks }) {
    const heatmap = document.getElementById("contributions-heatmap");
    const totalEl = document.getElementById("contributions-total");
    const fallbackEl = document.getElementById("contributions-fallback");

    // Show recent half-year so ~6 month labels fit cleanly in the bento cell
    const orderedWeeks = trimWeeks(weeks);
    const recentTotal = sumContributions(orderedWeeks);
    totalEl.textContent = `${Number(recentTotal || total).toLocaleString()} · 6 mo`;
    fallbackEl.hidden = true;
    heatmap.innerHTML = "";

    renderMonthLabels(orderedWeeks);

    orderedWeeks.forEach((week, weekIndex) => {
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

    hideSkeleton();
  }

  async function loadGitHubContributions() {
    const heatmap = document.getElementById("contributions-heatmap");
    const totalEl = document.getElementById("contributions-total");
    const fallbackEl = document.getElementById("contributions-fallback");

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
      hideSkeleton();
    }
  }

  document.addEventListener("DOMContentLoaded", loadGitHubContributions);

  function hideBadgeSkeleton() {
    const skeletonEl = document.getElementById("badge-skeleton");
    if (skeletonEl) skeletonEl.classList.add("is-hidden");
  }

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
    hideBadgeSkeleton();

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
    let timerId = null;
    let dragStartX = 0;
    let dragScrollLeft = 0;
    let dragging = false;
    let didDrag = false;
    let syncing = false;

    function setActive(index, { scroll = false } = {}) {
      active = index;
      items.forEach((item, i) => {
        const on = i === index;
        item.classList.toggle("is-active", on);
        item.setAttribute("aria-selected", String(on));
        item.tabIndex = on ? 0 : -1;
      });
      if (scroll && track) {
        syncing = true;
        const item = items[index];
        const target =
          item.offsetLeft - (track.clientWidth / 2 - item.offsetWidth / 2);
        track.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
        setTimeout(() => {
          syncing = false;
        }, 380);
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

    function next() {
      setActive((active + 1) % items.length, { scroll: true });
    }

    function prev() {
      setActive((active - 1 + items.length) % items.length, { scroll: true });
    }

    function startAuto() {
      if (timerId) clearInterval(timerId);
      if (items.length < 2) return;
      timerId = setInterval(next, 3800);
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
          setActive(index, { scroll: true });
          startAuto();
        }
      });
    });

    if (track) {
      track.addEventListener(
        "scroll",
        () => {
          if (syncing) return;
          const idx = nearestIndex();
          if (idx !== active) setActive(idx);
        },
        { passive: true }
      );

      // Map vertical wheel to horizontal scroll so trackpads always work
      track.addEventListener(
        "wheel",
        (event) => {
          if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            event.preventDefault();
            track.scrollLeft += event.deltaY;
          }
          if (timerId) clearInterval(timerId);
          startAuto();
        },
        { passive: false }
      );

      track.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        dragging = true;
        didDrag = false;
        dragStartX = event.clientX;
        dragScrollLeft = track.scrollLeft;
        track.setPointerCapture(event.pointerId);
        if (timerId) clearInterval(timerId);
      });

      track.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        const dx = event.clientX - dragStartX;
        if (Math.abs(dx) > 6) didDrag = true;
        track.scrollLeft = dragScrollLeft - dx;
      });

      const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        setActive(nearestIndex(), { scroll: true });
        startAuto();
      };

      track.addEventListener("pointerup", endDrag);
      track.addEventListener("pointercancel", endDrag);

      track.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          next();
          startAuto();
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          prev();
          startAuto();
        }
      });
    }

    function padForCenter() {
      if (!track || !items[0]) return;
      const pad = Math.max(12, track.clientWidth / 2 - items[0].offsetWidth / 2);
      stack.style.paddingLeft = `${pad}px`;
      stack.style.paddingRight = `${pad}px`;
    }

    padForCenter();
    window.addEventListener("resize", padForCenter);
    setActive(0, { scroll: true });
    startAuto();
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
      hideBadgeSkeleton();
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
    let timerId = null;

    function setActive(nextIndex) {
      items.forEach((item, i) => {
        const active = i === nextIndex;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-hidden", String(!active));
      });
      if (countEl) countEl.textContent = `${nextIndex + 1} / ${items.length}`;
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
})();
