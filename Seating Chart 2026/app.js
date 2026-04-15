const DATA_FILE = "unified_seating_assignments_with_roster.json";

const state = {
  data: null,
  currentPeriod: "period1",
  selectedSeatId: null,
  searchTerm: "",
  showEmptySeats: true,
  highlightMatches: true,
  controlsOpen: true,
  detailsOpen: true,
};

const els = {
  dashboard: document.getElementById("dashboard"),

  periodSelect: document.getElementById("periodSelect"),
  studentSearch: document.getElementById("studentSearch"),
  showEmptySeats: document.getElementById("showEmptySeats"),
  highlightMatches: document.getElementById("highlightMatches"),
  refreshBtn: document.getElementById("refreshBtn"),

  toggleControlsBtn: document.getElementById("toggleControlsBtn"),
  toggleDetailsBtn: document.getElementById("toggleDetailsBtn"),
  mobileToggleControlsBtn: document.getElementById("mobileToggleControlsBtn"),
  mobileToggleDetailsBtn: document.getElementById("mobileToggleDetailsBtn"),

  controlPanel: document.getElementById("controlPanel"),
  detailsPanel: document.getElementById("detailsPanel"),

  courseLabel: document.getElementById("courseLabel"),
  roomLabel: document.getElementById("roomLabel"),
  studentCount: document.getElementById("studentCount"),
  openSeatCount: document.getElementById("openSeatCount"),

  stageTitle: document.getElementById("stageTitle"),
  stageSubtitle: document.getElementById("stageSubtitle"),
  periodBadge: document.getElementById("periodBadge"),

  classroomGrid: document.getElementById("classroomGrid"),
  seatDetails: document.getElementById("seatDetails"),
  seatDetailsTemplate: document.getElementById("seatDetailsTemplate"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  wireEvents();
  applyDashboardLayoutState();
  await loadData();
}

function wireEvents() {
  els.periodSelect?.addEventListener("change", (event) => {
    state.currentPeriod = event.target.value;
    state.selectedSeatId = null;
    render();
  });

  els.studentSearch?.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim();
    render();
  });

  els.showEmptySeats?.addEventListener("change", (event) => {
    state.showEmptySeats = event.target.checked;
    render();
  });

  els.highlightMatches?.addEventListener("change", (event) => {
    state.highlightMatches = event.target.checked;
    render();
  });

  els.refreshBtn?.addEventListener("click", async () => {
    await loadData(true);
  });

  els.toggleControlsBtn?.addEventListener("click", () => {
    toggleControlsPanel();
  });

  els.toggleDetailsBtn?.addEventListener("click", () => {
    toggleDetailsPanel();
  });

  els.mobileToggleControlsBtn?.addEventListener("click", () => {
    toggleControlsPanel();
  });

  els.mobileToggleDetailsBtn?.addEventListener("click", () => {
    toggleDetailsPanel();
  });

  window.addEventListener("resize", () => {
    updateToggleButtonLabels();
  });
}

function toggleControlsPanel() {
  state.controlsOpen = !state.controlsOpen;
  applyDashboardLayoutState();
}

function toggleDetailsPanel() {
  state.detailsOpen = !state.detailsOpen;
  applyDashboardLayoutState();
}

function applyDashboardLayoutState() {
  if (!els.dashboard) return;

  els.dashboard.dataset.controls = state.controlsOpen ? "open" : "closed";
  els.dashboard.dataset.details = state.detailsOpen ? "open" : "closed";

  els.dashboard.classList.toggle("dashboard--controls-open", state.controlsOpen);
  els.dashboard.classList.toggle("dashboard--controls-closed", !state.controlsOpen);
  els.dashboard.classList.toggle("dashboard--details-open", state.detailsOpen);
  els.dashboard.classList.toggle("dashboard--details-closed", !state.detailsOpen);

  if (els.controlPanel) {
    els.controlPanel.hidden = !state.controlsOpen;
    els.controlPanel.setAttribute("aria-hidden", String(!state.controlsOpen));
  }

  if (els.detailsPanel) {
    els.detailsPanel.hidden = !state.detailsOpen;
    els.detailsPanel.setAttribute("aria-hidden", String(!state.detailsOpen));
  }

  updateToggleButtonLabels();
}

function updateToggleButtonLabels() {
  const controlsText = state.controlsOpen ? "Hide Controls" : "Show Controls";
  const detailsText = state.detailsOpen ? "Hide Details" : "Show Details";

  setButtonState(els.toggleControlsBtn, controlsText, state.controlsOpen);
  setButtonState(els.toggleDetailsBtn, detailsText, state.detailsOpen);

  setButtonState(
    els.mobileToggleControlsBtn,
    state.controlsOpen ? "Hide Controls" : "Show Controls",
    state.controlsOpen
  );

  setButtonState(
    els.mobileToggleDetailsBtn,
    state.detailsOpen ? "Hide Details" : "Show Details",
    state.detailsOpen
  );
}

function setButtonState(button, label, expanded) {
  if (!button) return;
  button.textContent = label;
  button.setAttribute("aria-expanded", String(expanded));
}

async function loadData(forceBust = false) {
  try {
    setLoadingState();

    const url = forceBust ? `${DATA_FILE}?t=${Date.now()}` : DATA_FILE;
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Failed to load ${DATA_FILE} (${response.status})`);
    }

    const data = await response.json();
    validateDataShape(data);

    state.data = data;

    if (!data.periods[state.currentPeriod]) {
      state.currentPeriod = Object.keys(data.periods)[0];
      if (els.periodSelect) {
        els.periodSelect.value = state.currentPeriod;
      }
    }

    render();
  } catch (error) {
    console.error("Error loading seating data:", error);
    renderFatalError(error);
  }
}

function validateDataShape(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid data file: root object missing.");
  }

  if (!data.layout || !Array.isArray(data.layout.seats)) {
    throw new Error("Invalid data file: layout.seats missing.");
  }

  if (!data.periods || typeof data.periods !== "object") {
    throw new Error("Invalid data file: periods missing.");
  }
}

function render() {
  if (!state.data) return;

  const periodData = getCurrentPeriodData();
  const seatMap = getSeatAssignmentMap(periodData);
  const layoutSeats = state.data.layout.seats;

  renderHeaderStats(periodData, seatMap, layoutSeats);
  renderClassroom(periodData, seatMap, layoutSeats);
  renderSeatDetails(periodData, seatMap, layoutSeats);
}

function getCurrentPeriodData() {
  return state.data.periods[state.currentPeriod];
}

function getSeatAssignmentMap(periodData) {
  const map = new Map();

  for (const assignment of periodData.assignments || []) {
    map.set(Number(assignment.seatId), assignment);
  }

  return map;
}

function renderHeaderStats(periodData, seatMap, layoutSeats) {
  const occupiedCount = Array.from(seatMap.values()).filter(
    (seat) => seat && seat.student
  ).length;

  const openCount = layoutSeats.length - occupiedCount;
  const periodNumber = getPeriodNumber(state.currentPeriod);

  if (els.courseLabel) {
    els.courseLabel.textContent =
      periodData.classLabel || periodData.courseTitle || "Unknown Course";
  }

  if (els.roomLabel) {
    els.roomLabel.textContent = periodData.room || "—";
  }

  if (els.studentCount) {
    els.studentCount.textContent = String(occupiedCount);
  }

  if (els.openSeatCount) {
    els.openSeatCount.textContent = String(openCount);
  }

  if (els.stageTitle) {
    els.stageTitle.textContent = `Period ${periodNumber} Seating Map`;
  }

  if (els.stageSubtitle) {
    const code = periodData.courseCode ? ` • ${periodData.courseCode}` : "";
    els.stageSubtitle.textContent = `Front of room is at the top${code}`;
  }

  if (els.periodBadge) {
    els.periodBadge.textContent = `Period ${periodNumber}`;
  }
}

function renderClassroom(periodData, seatMap, layoutSeats) {
  if (!els.classroomGrid) return;

  els.classroomGrid.innerHTML = "";

  const seatsByTable = groupSeatsByTable(layoutSeats);

  for (const [tableId, seats] of seatsByTable) {
    const deskGroup = document.createElement("section");
    deskGroup.className = "desk-group";
    deskGroup.dataset.tableId = String(tableId);
    deskGroup.dataset.tableLabel = `Table ${tableId}`;
    deskGroup.setAttribute("aria-label", `Table ${tableId}`);

    seats
      .sort((a, b) => Number(a.seatId) - Number(b.seatId))
      .forEach((layoutSeat) => {
        const assignment = seatMap.get(Number(layoutSeat.seatId)) || null;
        const seatCard = buildSeatCard(layoutSeat, assignment, periodData);

        if (!state.showEmptySeats && !assignment?.student) {
          seatCard.classList.add("hidden-seat");
        }

        deskGroup.appendChild(seatCard);
      });

    els.classroomGrid.appendChild(deskGroup);
  }
}

function groupSeatsByTable(layoutSeats) {
  const map = new Map();

  for (const seat of layoutSeats) {
    const tableId = Number(seat.tableId);

    if (!map.has(tableId)) {
      map.set(tableId, []);
    }

    map.get(tableId).push(seat);
  }

  return new Map([...map.entries()].sort((a, b) => a[0] - b[0]));
}

function buildSeatCard(layoutSeat, assignment, periodData) {
  const isOccupied = Boolean(assignment?.student);
  const isSelected = Number(layoutSeat.seatId) === Number(state.selectedSeatId);
  const isMatch = doesSeatMatchSearch(layoutSeat, assignment);
  const searchActive = state.searchTerm.length > 0;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "seat-card";
  button.dataset.seatId = String(layoutSeat.seatId);
  button.dataset.tableId = String(layoutSeat.tableId);
  button.dataset.zone = layoutSeat.zone;
  button.dataset.position = layoutSeat.position;
  button.setAttribute("aria-label", buildSeatAriaLabel(layoutSeat, assignment));
  button.setAttribute("title", buildSeatTitle(layoutSeat, assignment));

  button.classList.add(isOccupied ? "occupied" : "empty");

  if (isSelected) {
    button.classList.add("selected");
  }

  if (searchActive && state.highlightMatches && isMatch) {
    button.classList.add("match");
  }

  const topLine = document.createElement("div");
  topLine.className = "seat-topline";

  const seatId = document.createElement("span");
  seatId.className = "seat-id";
  seatId.textContent = `Seat ${layoutSeat.seatId}`;

  const seatPosition = document.createElement("span");
  seatPosition.className = "seat-position";
  seatPosition.textContent = formatPositionLabel(layoutSeat.position);

  topLine.appendChild(seatId);
  topLine.appendChild(seatPosition);

  const studentWrap = document.createElement("div");
  studentWrap.className = "seat-student";

  if (isOccupied) {
    const name = document.createElement("h3");
    name.className = "seat-name";
    name.textContent = assignment.student || "Unknown Student";

    const sub = document.createElement("p");
    sub.className = "seat-sub";

    const subParts = [];
    if (assignment.studentNumber) subParts.push(`#${assignment.studentNumber}`);
    if (assignment.rosterIndex) subParts.push(`Roster ${assignment.rosterIndex}`);

    sub.textContent = subParts.join(" • ") || "Assigned";

    studentWrap.appendChild(name);
    studentWrap.appendChild(sub);
  } else {
    const empty = document.createElement("p");
    empty.className = "seat-empty-label";
    empty.textContent = "Empty Seat";
    studentWrap.appendChild(empty);
  }

  const footer = document.createElement("div");
  footer.className = "seat-footer";

  const meta = document.createElement("span");
  meta.className = "seat-meta";
  meta.textContent = `${formatZoneLabel(layoutSeat.zone)} • Table ${layoutSeat.tableId}`;

  const pill = document.createElement("span");
  pill.className = "seat-pill";
  pill.textContent = isOccupied ? "Occupied" : "Open";

  footer.appendChild(meta);
  footer.appendChild(pill);

  button.appendChild(topLine);
  button.appendChild(studentWrap);
  button.appendChild(footer);

  button.addEventListener("click", () => {
    state.selectedSeatId = Number(layoutSeat.seatId);

    if (!state.detailsOpen) {
      state.detailsOpen = true;
      applyDashboardLayoutState();
    }

    render();
  });

  return button;
}

function doesSeatMatchSearch(layoutSeat, assignment) {
  if (!state.searchTerm) return false;

  const needle = normalizeText(state.searchTerm);

  const haystack = [
    assignment?.student,
    assignment?.matchedRosterName,
    assignment?.studentNumber,
    assignment?.rosterIndex,
    layoutSeat.seatId,
    layoutSeat.tableId,
    layoutSeat.zone,
    layoutSeat.position,
  ]
    .filter(Boolean)
    .map((value) => normalizeText(String(value)))
    .join(" ");

  return haystack.includes(needle);
}

function renderSeatDetails(periodData, seatMap, layoutSeats) {
  if (!els.seatDetails) return;

  if (!state.selectedSeatId) {
    renderEmptyDetails();
    return;
  }

  const layoutSeat = layoutSeats.find(
    (seat) => Number(seat.seatId) === Number(state.selectedSeatId)
  );

  if (!layoutSeat) {
    renderEmptyDetails("Selected seat not found.");
    return;
  }

  const assignment = seatMap.get(Number(layoutSeat.seatId)) || null;
  const fragment = els.seatDetailsTemplate.content.cloneNode(true);

  const setText = (id, value) => {
    const el = fragment.getElementById(id);
    if (el) el.textContent = value ?? "—";
  };

  setText("detailSeatId", `Seat ${layoutSeat.seatId}`);
  setText("detailSeatStatus", assignment?.student ? "Occupied" : "Open");
  setText("detailStudentName", assignment?.student || "Empty Seat");
  setText("detailMatchedRoster", assignment?.matchedRosterName || "No student assigned");
  setText("detailStudentNumber", assignment?.studentNumber || "—");
  setText("detailRosterIndex", assignment?.rosterIndex || "—");
  setText("detailTableId", layoutSeat.tableId);
  setText("detailSeatPosition", formatPositionLabel(layoutSeat.position));
  setText("detailZone", formatZoneLabel(layoutSeat.zone));
  setText("detailGrade", assignment?.grade || "—");

  const statusEl = fragment.getElementById("detailSeatStatus");
  if (statusEl && !assignment?.student) {
    statusEl.textContent = "Open";
    statusEl.style.background = "rgba(255,255,255,0.08)";
    statusEl.style.borderColor = "rgba(255,255,255,0.14)";
    statusEl.style.color = "var(--text-soft)";
  }

  els.seatDetails.innerHTML = "";
  els.seatDetails.appendChild(fragment);
}

function renderEmptyDetails(message = null) {
  els.seatDetails.innerHTML = `
    <div class="details-empty">
      <div class="details-placeholder-icon">🪑</div>
      <h3>${message ? "Nothing to Show" : "No Seat Selected"}</h3>
      <p>${
        message ||
        "Click a seat to view student name, student number, roster index, table location, and seat position."
      }</p>
    </div>
  `;
}

function setLoadingState() {
  if (els.classroomGrid) {
    els.classroomGrid.innerHTML = `
      <div class="details-empty" style="grid-column: 1 / -1; min-height: 320px;">
        <div class="details-placeholder-icon">📡</div>
        <h3>Loading Seating Data</h3>
        <p>Pulling classroom layout and student assignments...</p>
      </div>
    `;
  }

  renderEmptyDetails("Loading seat details...");
}

function renderFatalError(error) {
  const message = error instanceof Error ? error.message : "Unknown error";

  if (els.classroomGrid) {
    els.classroomGrid.innerHTML = `
      <div class="details-empty" style="grid-column: 1 / -1; min-height: 320px;">
        <div class="details-placeholder-icon">⚠️</div>
        <h3>Failed to Load Viewer</h3>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  if (els.seatDetails) {
    els.seatDetails.innerHTML = `
      <div class="details-empty">
        <div class="details-placeholder-icon">⚠️</div>
        <h3>Data Error</h3>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }
}

function buildSeatAriaLabel(layoutSeat, assignment) {
  if (assignment?.student) {
    return `Seat ${layoutSeat.seatId}, table ${layoutSeat.tableId}, ${assignment.student}, student number ${
      assignment.studentNumber || "unknown"
    }`;
  }

  return `Seat ${layoutSeat.seatId}, table ${layoutSeat.tableId}, empty seat`;
}

function buildSeatTitle(layoutSeat, assignment) {
  if (assignment?.student) {
    const parts = [
      `Seat ${layoutSeat.seatId}`,
      assignment.student,
      assignment.studentNumber ? `Student #${assignment.studentNumber}` : null,
      assignment.rosterIndex ? `Roster ${assignment.rosterIndex}` : null,
      `Table ${layoutSeat.tableId}`,
      formatPositionLabel(layoutSeat.position),
    ].filter(Boolean);

    return parts.join(" • ");
  }

  return `Seat ${layoutSeat.seatId} • Empty Seat • Table ${layoutSeat.tableId}`;
}

function getPeriodNumber(periodKey) {
  const match = String(periodKey).match(/\d+/);
  return match ? match[0] : periodKey;
}

function formatPositionLabel(value) {
  return String(value || "")
    .split("_")
    .map(capitalize)
    .join(" ");
}

function formatZoneLabel(value) {
  return String(value || "")
    .split("_")
    .map(capitalize)
    .join(" ");
}

function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeText(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}