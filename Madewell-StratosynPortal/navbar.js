


/* =========================================================
   Focus Planning Rail — Polished JS (Final)
   Key UI contracts (with your latest CSS):
   - #tbTime is a "two-line time pill" using:
       data-time-h="09" and data-time-m="30"
   - #tbMinsLeft digits render as <span class="d">1</span>...
     CSS controls whether they are horizontal/vertical.
========================================================= */

/* --------------------------------------------
   Keyboard focus ring helper (Tab = show)
-------------------------------------------- */
(() => {
  const onKey = (e) => { if (e.key === "Tab") document.body.classList.add("kbd"); };
  const onMouse = () => document.body.classList.remove("kbd");
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("mousedown", onMouse, true);
  window.addEventListener("pointerdown", onMouse, true);
})();

/* --------------------------------------------
   Icon plumbing (GitHub raw links)
-------------------------------------------- */
const EMOJI_BASE = "https://raw.githubusercontent.com/coltonsharp-dev/SharpsConsultingEmojis/refs/heads/main/";
const iconUrl = (relPath) => EMOJI_BASE + relPath;

const PERIOD_ICON_SRC = {
  0: "48354-kotlin-emojigg-pack/2560-composemultiplatform.png",
  "1st": "83719-brojevi-emojigg-pack/3944-number-1.png",
  "2nd": "83719-brojevi-emojigg-pack/1244-number-2.png",
  "3rd": "83719-brojevi-emojigg-pack/4442-number-3.png",
  "4th": "83719-brojevi-emojigg-pack/2271-number-4.png",
  "5th": "83719-brojevi-emojigg-pack/2271-number-5.png",
  "6th": "83719-brojevi-emojigg-pack/2080-number-6.png",
  "7th": "83719-brojevi-emojigg-pack/4748-number-7.png",
  "8th": "83719-brojevi-emojigg-pack/4748-number-8.png",
  "9th": "83719-brojevi-emojigg-pack/4994-number-9.png",
  "10th": "83719-brojevi-emojigg-pack/1705-number-10.png",
  Lunch: "9081-among-emojigg-pack/26926-vent-amongus.gif",
  Before: "17162-stars-emojigg-pack/58848-green.gif",
  After: "39318-mario-bros-emotes-pack-emojigg-pack/5805-mariobros-koopahide.gif"
};

const PERIOD_COLOR = {
  Before: "rgba(120,220,255,.85)",
  0: "rgba(120,180,255,.95)",
  "1st": "rgba(255,140,120,.95)",
  "2nd": "rgba(170,120,255,.95)",
  "3rd": "rgba(120,255,190,.95)",
  "4th": "rgba(255,165,70,.95)",
  "5th": "rgba(120,220,255,.95)",
  "6th": "rgba(255,140,200,.95)",
  "7th": "rgba(200,255,140,.95)",
  "8th": "rgba(255,170,90,.95)",
  "9th": "rgba(140,200,255,.95)",
  "10th": "rgba(235,235,235,.92)",
  Lunch: "rgba(255,214,40,.92)",
  Passing: "rgba(255,255,255,.70)",
  After: "rgba(255,255,255,.55)"
};
const colorFor = (label) => PERIOD_COLOR[label] || "rgba(255,212,0,.85)";

/* --------------------------------------------
   Small utilities
-------------------------------------------- */
const pad2 = (n) => String(n).padStart(2, "0");
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const parseHM = (hm) => { const [h, m] = hm.split(":").map(Number); return { h, m }; };

const atToday = (hm, base) => {
  const { h, m } = parseHM(hm);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
};

const minutesBetween = (a, b) => Math.max(0, Math.round((b - a) / 60000));

/* --------------------------------------------
   TIME FORMAT (HHMM)
   - 12-hour clock (01..12)
   - 2-digit hour, 2-digit minute
   - no colon, no am/pm
-------------------------------------------- */
function fmtTimeCompactHHMM(d) {
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  const m = d.getMinutes();
  return pad2(h) + pad2(m); // "HHMM"
}

/* Write time for the CSS two-line pill:
   CSS expects data-time-h="HH" data-time-m="MM" */
function setTimePill(el, hhmm) {
  if (!el) return;
  const s = String(hhmm || "0000").padStart(4, "0");
  el.textContent = "";               // avoid accidental single-line text
  el.setAttribute("data-time-h", s.slice(0, 2));
  el.setAttribute("data-time-m", s.slice(2, 4));
}

/* Digits renderer (CSS decides horizontal vs vertical) */
function renderDigits(el, digits) {
  if (!el) return;
  const s = String(digits);
  el.innerHTML = s.split("").map(c => `<span class="d">${c}</span>`).join("");
}

/* Icon setter */
function setPeriodImg(imgEl, label) {
  if (!imgEl) return;
  const rel = PERIOD_ICON_SRC[label];
  if (rel) {
    imgEl.src = iconUrl(rel);
    imgEl.alt = label;
    return;
  }
  imgEl.src = iconUrl(PERIOD_ICON_SRC["0"]);
  imgEl.alt = label || "";
}

/* --------------------------------------------
   Bell schedules
-------------------------------------------- */
const BELL = {
  full: {
    A: [["0","07:20","08:10"],["1st","08:15","09:03"],["2nd","09:08","09:57"],["3rd","10:02","10:50"],["Lunch","10:55","11:23"],["4th","11:28","12:16"],["5th","12:21","13:09"],["6th","13:14","14:02"],["7th","14:07","14:55"]],
    B: [["0","07:20","08:10"],["1st","08:15","09:03"],["2nd","09:08","09:57"],["3rd","10:02","10:50"],["4th","10:55","11:43"],["Lunch","11:48","12:16"],["5th","12:21","13:09"],["6th","13:14","14:02"],["7th","14:07","14:55"]]
  },
  homeroom2: {
    A: [["0","07:20","08:10"],["1st","08:15","09:00"],["2nd","09:05","10:10"],["3rd","10:15","11:00"],["Lunch","11:05","11:35"],["4th","11:40","12:25"],["5th","12:30","13:15"],["6th","13:20","14:05"],["7th","14:10","14:55"]],
    B: [["0","07:20","08:10"],["1st","08:15","09:00"],["2nd","09:05","10:10"],["3rd","10:15","11:00"],["4th","11:05","11:50"],["Lunch","11:55","12:25"],["5th","12:30","13:15"],["6th","13:20","14:05"],["7th","14:10","14:55"]]
  },
  early1pm: {
    A: [["0","07:20","08:10"],["1st","08:15","08:46"],["2nd","08:51","09:24"],["3rd","09:29","10:00"],["Lunch","10:05","10:36"],["4th","10:41","11:12"],["5th","11:17","11:48"],["6th","11:53","12:24"],["7th","12:29","13:00"]],
    B: [["0","07:20","08:10"],["1st","08:15","08:46"],["2nd","08:51","09:24"],["3rd","09:29","10:00"],["4th","10:05","10:36"],["Lunch","10:41","11:12"],["5th","11:17","11:48"],["6th","11:53","12:24"],["7th","12:29","13:00"]]
  },
  testing_tue_67: {
    A: [["0","07:20","08:10"],["1st","08:15","08:50"],["2nd","08:55","09:30"],["3rd","09:35","10:10"],["Lunch","10:15","10:45"],["4th","10:50","11:25"],["5th","11:30","12:05"],["6th","12:10","13:30"],["7th","13:35","14:55"]],
    B: [["0","07:20","08:10"],["1st","08:15","08:50"],["2nd","08:55","09:30"],["3rd","09:35","10:10"],["4th","10:15","10:50"],["Lunch","10:55","11:25"],["5th","11:30","12:05"],["6th","12:10","13:30"],["7th","13:35","14:55"]]
  },
  testing_wed_345: {
    A: [["0","07:20","08:10"],["1st","08:15","08:39"],["2nd","08:44","09:08"],["3rd","09:13","10:33"],["Lunch","10:38","11:07"],["4th","11:12","12:32"],["5th","12:37","13:57"],["6th","14:02","14:26"],["7th","14:31","14:55"]],
    B: [["0","07:20","08:10"],["1st","08:15","08:39"],["2nd","08:44","09:08"],["3rd","09:13","10:33"],["4th","10:38","11:58"],["Lunch","12:03","12:32"],["5th","12:37","13:57"],["6th","14:02","14:26"],["7th","14:31","14:55"]]
  },
  testing_thu_12: {
    A: [["0","07:20","08:10"],["1st","08:15","09:35"],["2nd","09:40","11:00"],["3rd","11:05","11:40"],["Lunch","11:45","12:15"],["4th","12:20","12:55"],["5th","13:00","13:35"],["6th","13:40","14:15"],["7th","14:20","14:55"]],
    B: [["0","07:20","08:10"],["1st","08:15","09:35"],["2nd","09:40","11:00"],["3rd","11:05","11:40"],["4th","11:45","12:20"],["Lunch","12:25","12:55"],["5th","13:00","13:35"],["6th","13:40","14:15"],["7th","14:20","14:55"]]
  }
};

function getScheduleRows(dayTypeKey, track) {
  return (BELL[dayTypeKey] && BELL[dayTypeKey][track]) ? BELL[dayTypeKey][track] : null;
}

function buildTodaySchedule(rows, base) {
  return rows.map(([label, start, end]) => ({
    label,
    start: atToday(start, base),
    end: atToday(end, base),
    startStr: start,
    endStr: end
  }));
}

/* Find the current “block” and next block (handles passing time) */
function getActiveBlock(schedule, now) {
  if (!schedule || schedule.length === 0) return { nowBlock: null, nextBlock: null };

  const first = schedule[0];
  const last = schedule[schedule.length - 1];

  if (now < first.start) return { nowBlock: { label: "Before", start: null, end: first.start }, nextBlock: first };
  if (now >= last.end) return { nowBlock: { label: "After", start: last.end, end: null }, nextBlock: null };

  for (let i = 0; i < schedule.length; i++) {
    const cur = schedule[i];
    const next = schedule[i + 1] || null;

    if (now >= cur.start && now < cur.end) return { nowBlock: cur, nextBlock: next };
    if (next && now >= cur.end && now < next.start) {
      return { nowBlock: { label: "Passing", start: cur.end, end: next.start }, nextBlock: next };
    }
  }

  return { nowBlock: null, nextBlock: null };
}

/* --------------------------------------------
   Persistence keys
-------------------------------------------- */
const LS = {
  dayType: "nrDayType",
  lunch: "nrLunch",
  pinned: "nrPinned",
  railTop: "nrTopPx",
  focusMode: "nr_focus_mode"
};

function loadState() {
  return {
    dayType: localStorage.getItem(LS.dayType) || "full",
    lunch: localStorage.getItem(LS.lunch) || "A",
    pinned: localStorage.getItem(LS.pinned) === "1",
    railTop: Number(localStorage.getItem(LS.railTop)),
    focusMode: localStorage.getItem(LS.focusMode) || "planning"
  };
}

const saveDayType = (v) => localStorage.setItem(LS.dayType, v);
const saveLunch = (v) => localStorage.setItem(LS.lunch, v);
const setPinned = (on) => localStorage.setItem(LS.pinned, on ? "1" : "0");
const isPinned = () => localStorage.getItem(LS.pinned) === "1";
const saveFocusMode = (v) => localStorage.setItem(LS.focusMode, v);

/* --------------------------------------------
   UI element bindings
-------------------------------------------- */
const rail = document.getElementById("notchRail");
const handle = document.getElementById("nrHandle");
const drawer = document.getElementById("nrDrawer");

const tbNowImg = document.getElementById("tbNowImg");
const tbNextImg = document.getElementById("tbNextImg");
const tbTime = document.getElementById("tbTime");
const tbMins = document.getElementById("tbMinsLeft");

const schedHost = document.getElementById("nrSchedule");
const nrIconGallery = document.getElementById("nrIconGallery");

const selLunch = document.getElementById("selLunch");
const selDayType = document.getElementById("selDayType");
const rngOverride = document.getElementById("rngOverride");
const lblOverride = document.getElementById("lblOverride");

const nrJumps = document.getElementById("nrJumps");

/* --------------------------------------------
   Drawer open/close + pin
-------------------------------------------- */
function syncPinChip() {
  if (!drawer) return;
  const chip = drawer.querySelector('[data-action="pin"]');
  if (!chip) return;
  const pinned = isPinned();
  chip.setAttribute("aria-pressed", pinned ? "true" : "false");
  chip.textContent = pinned ? "Pinned" : "Pin";
}

function setOpen(on) {
  document.body.classList.toggle("nr-open", !!on);
  if (handle) handle.setAttribute("aria-expanded", on ? "true" : "false");
  if (drawer) drawer.setAttribute("aria-hidden", on ? "false" : "true");
  syncPinChip();
}

function toggleOpen() {
  setOpen(!document.body.classList.contains("nr-open"));
}

drawer?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const a = btn.dataset.action;

  if (a === "pin") {
    const next = !isPinned();
    setPinned(next);
    syncPinChip();
    if (next) setOpen(true);
    return;
  }

  if (a === "close") {
    if (!isPinned()) setOpen(false);
    return;
  }

  if (a === "top") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
});

handle?.addEventListener("dblclick", (e) => {
  e.preventDefault();
  e.stopPropagation();
  toggleOpen();
});

handle?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    toggleOpen();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !isPinned()) setOpen(false);
});

drawer?.addEventListener("mouseleave", () => {
  if (!isPinned()) setOpen(false);
});

drawer?.addEventListener("focusout", (e) => {
  if (!drawer.contains(e.relatedTarget) && !isPinned()) setOpen(false);
});

/* --------------------------------------------
   Time override (slider)
-------------------------------------------- */
let overrideMin = 0;
const getNowWithOverride = () => new Date(Date.now() + overrideMin * 60000);

function setOverrideLabel(mins) {
  if (!lblOverride) return;
  lblOverride.textContent = (mins > 0 ? "+" : "") + String(mins);
}

/* --------------------------------------------
   Accents
-------------------------------------------- */
function applyRailAccent(nowLabel, nextLabel) {
  if (!rail) return;
  rail.style.setProperty("--tb-now", colorFor(nowLabel));
  rail.style.setProperty("--tb-next", colorFor(nextLabel));
}

/* --------------------------------------------
   Schedule preview render (drawer)
-------------------------------------------- */
const to12NoSuffix = (hhmm) => {
  const [H, M] = hhmm.split(":").map(Number);
  const h12 = ((H + 11) % 12) + 1;
  return `${h12}:${pad2(M)}`;
};

function renderSchedulePreview(dayTypeKey, track) {
  if (!schedHost) return;
  const rows = getScheduleRows(dayTypeKey, track);

  if (!rows) {
    schedHost.innerHTML = `<div class="nr-row"><div class="nr-time">Schedule data not available.</div></div>`;
    return;
  }

  schedHost.innerHTML = rows.map(([p, s, e]) => {
    const rel = PERIOD_ICON_SRC[p] || PERIOD_ICON_SRC["0"];
    const pcol = colorFor(p);
    return `
      <div class="nr-row" style="--pcol:${pcol}">
        <div class="nr-left">
          <div class="nr-badge"><img alt="${p}" src="${iconUrl(rel)}" loading="lazy" decoding="async"></div>
          <div>
            <div class="nr-period">${p}</div>
            <div class="nr-time">${to12NoSuffix(s)} – ${to12NoSuffix(e)}</div>
          </div>
        </div>
        <div class="nr-time">${s}–${e}</div>
      </div>
    `;
  }).join("");
}

/* --------------------------------------------
   Icon reference gallery (drawer)
-------------------------------------------- */
const ICON_GALLERY = [
  { name:"before", path:"17162-stars-emojigg-pack/58848-green.gif" },
  { name:"period-0", path:"48354-kotlin-emojigg-pack/2560-composemultiplatform.png" },
  { name:"period-1", path:"83719-brojevi-emojigg-pack/3944-number-1.png" },
  { name:"period-2", path:"83719-brojevi-emojigg-pack/1244-number-2.png" },
  { name:"period-3", path:"83719-brojevi-emojigg-pack/4442-number-3.png" },
  { name:"period-4", path:"83719-brojevi-emojigg-pack/2271-number-4.png" },
  { name:"period-5", path:"83719-brojevi-emojigg-pack/2271-number-5.png" },
  { name:"period-6", path:"83719-brojevi-emojigg-pack/2080-number-6.png" },
  { name:"period-7", path:"83719-brojevi-emojigg-pack/4748-number-7.png" },
  { name:"period-8", path:"83719-brojevi-emojigg-pack/4748-number-8.png" },
  { name:"period-9", path:"83719-brojevi-emojigg-pack/4994-number-9.png" },
  { name:"period-10", path:"83719-brojevi-emojigg-pack/1705-number-10.png" },
  { name:"lunch", path:"9081-among-emojigg-pack/26926-vent-amongus.gif" },
  { name:"after", path:"39318-mario-bros-emotes-pack-emojigg-pack/5805-mariobros-koopahide.gif" }
];

function renderIconGallery() {
  if (!nrIconGallery) return;

  nrIconGallery.innerHTML = ICON_GALLERY.map((it) => {
    const u = iconUrl(it.path);
    const file = it.path.split("/").pop();
    return `
      <div class="nr-ic">
        <img src="${u}" alt="${it.name}" loading="lazy" decoding="async">
        <div>
          <div class="fn">${file}</div>
          <div class="url">${u}</div>
        </div>
      </div>
    `;
  }).join("");
}

/* --------------------------------------------
   Jump buttons (drawer)
-------------------------------------------- */
function computeOverrideTo(targetDate) {
  const realNow = new Date();
  return Math.round((targetDate - realNow) / 60000);
}

function setOverrideMinutes(mins) {
  overrideMin = mins;
  if (rngOverride) rngOverride.value = String(mins);
  setOverrideLabel(mins);
  updateRailTimebar(selDayType?.value, selLunch?.value);
  markCurrentJump();
}

function buildJumpButtons(dayTypeKey, track) {
  if (!nrJumps) return;

  const base = new Date();
  const rows = getScheduleRows(dayTypeKey, track);

  const buttons = [{ label: "Now", when: base }];

  if (rows) {
    const schedule = buildTodaySchedule(rows, base);
    buttons.push({ label: "Before", when: new Date(schedule[0].start.getTime() - 10 * 60000) });
    for (const b of schedule) buttons.push({ label: b.label, when: b.start });
    buttons.push({ label: "After", when: new Date(schedule[schedule.length - 1].end.getTime() + 10 * 60000) });
  }

  nrJumps.innerHTML = buttons.map(b => {
    const pcol = colorFor(b.label);
    return `<button class="nr-jump" type="button" data-jump="${b.label}" style="--pcol:${pcol}">${b.label}</button>`;
  }).join("");

  markCurrentJump();
}

function markCurrentJump() {
  if (!nrJumps) return;

  const now = getNowWithOverride();
  const rows = getScheduleRows(selDayType?.value, selLunch?.value);

  let curLabel = "After";
  if (rows) {
    const schedule = buildTodaySchedule(rows, now);
    const { nowBlock } = getActiveBlock(schedule, now);
    curLabel = nowBlock?.label || "After";
  }

  nrJumps.querySelectorAll(".nr-jump").forEach(btn => {
    btn.setAttribute("aria-current", btn.dataset.jump === curLabel ? "true" : "false");
  });
}

nrJumps?.addEventListener("click", (e) => {
  const btn = e.target.closest(".nr-jump");
  if (!btn) return;

  const key = btn.dataset.jump;

  if (key === "Now") {
    setOverrideMinutes(0);
    return;
  }

  const rows = getScheduleRows(selDayType?.value, selLunch?.value);
  if (!rows) return;

  const base = new Date();
  const schedule = buildTodaySchedule(rows, base);

  let target = base;
  if (key === "Before") target = new Date(schedule[0].start.getTime() - 10 * 60000);
  else if (key === "After") target = new Date(schedule[schedule.length - 1].end.getTime() + 10 * 60000);
  else {
    const match = schedule.find(x => x.label === key);
    if (match) target = match.start;
  }

  const mins = clamp(
    computeOverrideTo(target),
    Number(rngOverride?.min ?? -360),
    Number(rngOverride?.max ?? 360)
  );

  setOverrideMinutes(mins);
});

/* --------------------------------------------
   Rail update core
-------------------------------------------- */
function updateRailTimebar(dayTypeKey, track) {
  const now = getNowWithOverride();

  // Time pill: set HH/MM for two-line CSS
  setTimePill(tbTime, fmtTimeCompactHHMM(now));

  const rows = getScheduleRows(dayTypeKey, track);
  if (!rows) {
    setPeriodImg(tbNowImg, "Before");
    renderDigits(tbMins, "0");
    setPeriodImg(tbNextImg, "0");
    applyRailAccent("Before", "0");
    return;
  }

  const schedule = buildTodaySchedule(rows, now);
  const { nowBlock, nextBlock } = getActiveBlock(schedule, now);

  const nowLabel = nowBlock?.label || "After";
  const nextLabel = nextBlock ? nextBlock.label : "After";

  setPeriodImg(tbNowImg, PERIOD_ICON_SRC[nowLabel] ? nowLabel : "0");

  let minsLeft = 0;
  if (nowLabel === "Before" && nextBlock) minsLeft = minutesBetween(now, nextBlock.start);
  else if (nowLabel === "After") minsLeft = 0;
  else if (nowBlock && nowBlock.end) minsLeft = minutesBetween(now, nowBlock.end);

  renderDigits(tbMins, String(minsLeft));
  setPeriodImg(tbNextImg, PERIOD_ICON_SRC[nextLabel] ? nextLabel : "After");

  applyRailAccent(nowLabel, nextLabel);
  markCurrentJump();
}

/* --------------------------------------------
   Controls wiring
-------------------------------------------- */
function applyAndRender() {
  const dayTypeKey = selDayType?.value;
  const track = selLunch?.value;

  if (dayTypeKey) saveDayType(dayTypeKey);
  if (track) saveLunch(track);

  renderSchedulePreview(dayTypeKey, track);
  buildJumpButtons(dayTypeKey, track);
  updateRailTimebar(dayTypeKey, track);
}

selLunch?.addEventListener("change", applyAndRender);
selDayType?.addEventListener("change", applyAndRender);

rngOverride?.addEventListener("input", () => {
  overrideMin = Number(rngOverride.value) || 0;
  setOverrideLabel(overrideMin);
  updateRailTimebar(selDayType?.value, selLunch?.value);
});

/* --------------------------------------------
   Focus Modes (Live / Planning / Lecture)
-------------------------------------------- */
const FOCUS_MODES = [
  { id: "live",     icon: "🟢", title: "Live mode" },
  { id: "planning", icon: "🗓️", title: "Planning mode" },
  { id: "lecture",  icon: "🎤", title: "Lecture mode" }
];

let currentFocusMode = "planning";

function setFocusMode(modeId) {
  if (!FOCUS_MODES.some(m => m.id === modeId)) return;

  currentFocusMode = modeId;
  saveFocusMode(modeId);

  document.body.classList.remove("mode-live", "mode-planning", "mode-lecture");
  document.body.classList.add(`mode-${modeId}`);

  const host = document.getElementById("fpActions");
  if (host) {
    host.querySelectorAll(".fp-action").forEach(btn => {
      btn.setAttribute("aria-pressed", btn.dataset.mode === modeId ? "true" : "false");
    });
  }

  // Behavior preference: planning opens drawer for calendar view
  if (modeId === "planning") setOpen(true);
  else if (!isPinned()) setOpen(false);
}

function mountFocusModes() {
  const host = document.getElementById("fpActions");
  if (!host) return;

  host.innerHTML = FOCUS_MODES.map(m => `
    <button class="fp-action"
      type="button"
      data-mode="${m.id}"
      aria-label="${m.title}"
      title="${m.title}"
      aria-pressed="false"
    ><span class="fp-ico" aria-hidden="true">${m.icon}</span></button>
  `).join("");

  // Prevent rail drag/toggle from stealing pointer events
  host.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".fp-action")) e.stopPropagation();
  }, true);

  host.addEventListener("click", (e) => {
    const btn = e.target.closest(".fp-action");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    setFocusMode(btn.dataset.mode);
  });

  setFocusMode(currentFocusMode);
}

/* --------------------------------------------
   Rail drag behavior (pointer)
-------------------------------------------- */
let pointerActive = false;
let activePointerId = null;
let dragging = false;
let startY = 0;
let startTop = 0;
let tapStartX = 0;
let tapStartY = 0;

handle?.addEventListener("pointerdown", (ev) => {
  // If you click the focus buttons, do not start dragging
  if (ev.target.closest && ev.target.closest(".fp-action")) return;

  pointerActive = true;
  activePointerId = ev.pointerId;
  handle.setPointerCapture(ev.pointerId);
  ev.preventDefault();

  startY = ev.clientY;
  tapStartX = ev.clientX;
  tapStartY = ev.clientY;

  const r = rail?.getBoundingClientRect();
  startTop = r ? (r.top + r.height / 2) : startTop;

  dragging = false;

  // When you start dragging, close if not pinned
  if (!isPinned()) setOpen(false);
});

window.addEventListener("pointermove", (ev) => {
  if (!pointerActive) return;
  if (activePointerId !== null && ev.pointerId !== activePointerId) return;
  if (!rail) return;

  const dx = Math.abs(ev.clientX - tapStartX);
  const dy = Math.abs(ev.clientY - tapStartY);

  // treat move as a drag after small threshold
  if (!dragging && (dx > 6 || dy > 6)) {
    dragging = true;
    rail.style.top = `${startTop}px`;
    rail.style.transform = "translateY(-50%)";
  }
  if (!dragging) return;

  const ddy = ev.clientY - startY;
  rail.style.top = `${clamp(startTop + ddy, 90, window.innerHeight - 90)}px`;
});

function endPointer() {
  if (!pointerActive) return;

  if (dragging && rail) {
    dragging = false;
    try {
      const topPx = parseFloat(getComputedStyle(rail).top);
      if (!Number.isNaN(topPx)) localStorage.setItem(LS.railTop, String(topPx));
    } catch {}
  }

  pointerActive = false;
  activePointerId = null;
}
window.addEventListener("pointerup", endPointer);
window.addEventListener("pointercancel", endPointer);

/* --------------------------------------------
   Init
-------------------------------------------- */
(() => {
  const st = loadState();

  // Restore rail Y position
  if (rail && !Number.isNaN(st.railTop) && st.railTop > 0) {
    rail.style.top = `${st.railTop}px`;
    rail.style.transform = "translateY(-50%)";
  }

  if (selDayType) selDayType.value = st.dayType;
  if (selLunch) selLunch.value = st.lunch;

  overrideMin = 0;
  if (rngOverride) rngOverride.value = "0";
  setOverrideLabel(0);

  setPinned(st.pinned);
  syncPinChip();
  setOpen(st.pinned ? true : false);

  renderIconGallery();
  renderSchedulePreview(selDayType?.value, selLunch?.value);
  buildJumpButtons(selDayType?.value, selLunch?.value);
  updateRailTimebar(selDayType?.value, selLunch?.value);

  currentFocusMode = st.focusMode || "planning";
  mountFocusModes();

  // Refresh time every 10s (smooth enough, low cost)
  setInterval(() => updateRailTimebar(selDayType?.value, selLunch?.value), 10000);
})();
