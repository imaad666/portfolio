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

    orderedWeeks.forEach((week) => {
      const weekCol = document.createElement("div");
      weekCol.className = "heatmap-week";

      week.contributionDays.forEach((day) => {
        const cell = document.createElement("div");
        cell.className = "heatmap-day";

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
  }

  async function loadGitHubContributions() {
    const heatmap = document.getElementById("contributions-heatmap");
    const totalEl = document.getElementById("contributions-total");
    const fallbackEl = document.getElementById("contributions-fallback");
    const monthsEl = document.getElementById("heatmap-months");

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
      if (monthsEl) monthsEl.hidden = true;
    }
  }

  document.addEventListener("DOMContentLoaded", loadGitHubContributions);

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

      if (!top.length) {
        fallbackEl.hidden = false;
        fallbackEl.textContent = "No public badges yet.";
        return;
      }

      top.forEach((badge) => {
        const link = document.createElement("a");
        link.className = "badge-stack__item";
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
})();
