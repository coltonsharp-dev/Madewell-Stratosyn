const DATA_FILE = "unified_seating_assignments_with_roster.json";

const state = {
  data: null,
  currentPeriod: "period1",
  selectedSeatIds: new Set(),
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

  clearSelectionBtn: document.getElementById("clearSelectionBtn"),
  mobileClearSelectionBtn: document.getElementById("mobileClearSelectionBtn"),

  controlPanel: document.getElementById("controlPanel"),
  detailsPanel: document.getElementById("detailsPanel"),

  courseLabel: document.getElementById("courseLabel"),
  roomLabel: document.getElementById("roomLabel"),
  studentCount: document.getElementById("studentCount"),
  openSeatCount: document.getElementById("openSeatCount"),

  stageTitle: document.getElementById("stageTitle"),
  stageSubtitle: document.getElementById("stageSubtitle"),
  periodBadge: document.getElementById("periodBadge"),
  selectionBadge: document.getElementById("selectionBadge"),
  selectedStudentCount: document.getElementById("selectedStudentCount"),
  behaviorTargetMode: document.getElementById("behaviorTargetMode"),

  classroomGrid: document.getElementById("classroomGrid"),
  seatDetails: document.getElementById("seatDetails"),
  seatDetailsTemplate: document.getElementById("seatDetailsTemplate"),
  multiSeatDetailsTemplate: document.getElementById("multiSeatDetailsTemplate"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  wireEvents();
  applyDashboardLayoutState();
  await loadData();
  render();
  renderReport();
}

function wireEvents() {
  els.periodSelect?.addEventListener("change", (event) => {
    state.currentPeriod = event.target.value;
    state.selectedSeatIds.clear();
    emitSeatSelectionEvent(null, null);
    render();
    renderReport();
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
    render();
    renderReport();
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

  els.clearSelectionBtn?.addEventListener("click", () => {
    clearSelection();
  });

  els.mobileClearSelectionBtn?.addEventListener("click", () => {
    clearSelection();
  });

  window.addEventListener("resize", () => {
    updateToggleButtonLabels();
  });

  els.controlPanel?.addEventListener("click", () => {
    if (!state.controlsOpen) {
      toggleControlsPanel();
    }
  });
}

function clearSelection() {
  state.selectedSeatIds.clear();
  emitSeatSelectionEvent(null, null);
  render();
}

function toggleSeatSelection(seatId, layoutSeat, assignment) {
  const normalizedSeatId = Number(seatId);

  if (state.selectedSeatIds.has(normalizedSeatId)) {
    state.selectedSeatIds.delete(normalizedSeatId);
  } else {
    state.selectedSeatIds.add(normalizedSeatId);
  }

  if (state.selectedSeatIds.size === 1) {
    emitSeatSelectionEvent(layoutSeat, assignment);
  } else if (state.selectedSeatIds.size === 0) {
    emitSeatSelectionEvent(null, null);
  } else {
    const firstSelectedSeatId = [...state.selectedSeatIds][0];
    const currentPeriodData = getCurrentPeriodData();
    const currentSeatMap = getSeatAssignmentMap(currentPeriodData);
    const firstLayoutSeat = state.data.layout.seats.find(
      (seat) => Number(seat.seatId) === Number(firstSelectedSeatId)
    );
    const firstAssignment = currentSeatMap.get(Number(firstSelectedSeatId)) || null;
    emitSeatSelectionEvent(firstLayoutSeat, firstAssignment);
  }
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

    if (window.BehaviorStore?.saveSeatingAssignments) {
      window.BehaviorStore.saveSeatingAssignments(data);
    }

    if (window.BehaviorStore?.saveRosterMap) {
      const rosterMap = Object.fromEntries(
        Object.entries(data.periods || {}).map(([periodId, periodData]) => [
          periodId,
          {
            updatedAt: new Date().toISOString(),
            students: Array.isArray(periodData.assignments)
              ? periodData.assignments
                  .filter((assignment) => assignment && assignment.student)
                  .map((assignment) => ({
                    studentId: assignment.studentId || assignment.studentNumber || "",
                    studentName: assignment.student || "",
                    studentNumber: assignment.studentNumber || "",
                    rosterIndex: assignment.rosterIndex ?? null,
                    grade: assignment.grade || "",
                  }))
              : [],
          },
        ])
      );
      window.BehaviorStore.saveRosterMap(rosterMap);
    }

    if (!data.periods[state.currentPeriod]) {
      state.currentPeriod = Object.keys(data.periods)[0];
      if (els.periodSelect) {
        els.periodSelect.value = state.currentPeriod;
      }
    }

    if (state.selectedSeatIds.size > 0) {
      const validSeatIds = new Set(
        data.layout.seats.map((seat) => Number(seat.seatId))
      );

      state.selectedSeatIds = new Set(
        [...state.selectedSeatIds].filter((seatId) => validSeatIds.has(Number(seatId)))
      );

      if (state.selectedSeatIds.size === 0) {
        emitSeatSelectionEvent(null, null);
      }
    } else {
      emitSeatSelectionEvent(null, null);
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
  updateSelectionUI(periodData, seatMap, layoutSeats);
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

function emitSeatSelectionEvent(layoutSeat, assignment) {
  if (!layoutSeat) {
    document.dispatchEvent(new CustomEvent("seat:cleared"));
    return;
  }

  document.dispatchEvent(
    new CustomEvent("seat:selected", {
      detail: {
        studentId: assignment?.studentId || assignment?.studentNumber || "",
        studentName: assignment?.student || "Empty Seat",
        studentNumber: assignment?.studentNumber || "",
        student: assignment?.student || "Empty Seat",
        matchedRosterName: assignment?.matchedRosterName || "",
        rosterIndex: assignment?.rosterIndex || "",
        grade: assignment?.grade || "",
        periodId: state.currentPeriod,
        seatId: Number(layoutSeat.seatId),
        tableId: Number(layoutSeat.tableId),
        zone: layoutSeat.zone || "",
        position: layoutSeat.position || "",
      },
    })
  );
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
  const isSelected = state.selectedSeatIds.has(Number(layoutSeat.seatId));
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
    toggleSeatSelection(layoutSeat.seatId, layoutSeat, assignment);

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

  const selectedSeatIds = [...state.selectedSeatIds];

  if (selectedSeatIds.length === 0) {
    renderEmptyDetails();
    return;
  }

  if (selectedSeatIds.length === 1) {
    const selectedSeatId = Number(selectedSeatIds[0]);
    const layoutSeat = layoutSeats.find(
      (seat) => Number(seat.seatId) === selectedSeatId
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
    return;
  }

  if (!els.multiSeatDetailsTemplate) {
    renderEmptyDetails("Multi-select template not found.");
    return;
  }

  const fragment = els.multiSeatDetailsTemplate.content.cloneNode(true);

  const selectedAssignments = selectedSeatIds.map((seatId) => {
    const numericSeatId = Number(seatId);
    const layoutSeat = layoutSeats.find((seat) => Number(seat.seatId) === numericSeatId);
    const assignment = seatMap.get(numericSeatId) || null;

    return {
      seatId: numericSeatId,
      tableId: layoutSeat?.tableId ?? "—",
      studentName: assignment?.student || "Empty Seat",
      periodId: state.currentPeriod,
    };
  });

  const names = selectedAssignments.map((item) => item.studentName).join(", ");
  const seats = selectedAssignments.map((item) => item.seatId).join(", ");
  const tables = [...new Set(selectedAssignments.map((item) => item.tableId))].join(", ");

  const countEl = fragment.getElementById("multiDetailCount");
  const namesEl = fragment.getElementById("multiDetailNames");
  const seatsEl = fragment.getElementById("multiDetailSeats");
  const tablesEl = fragment.getElementById("multiDetailTables");
  const periodEl = fragment.getElementById("multiDetailPeriod");

  if (countEl) countEl.textContent = `${selectedAssignments.length} Students Selected`;
  if (namesEl) namesEl.textContent = names || "No students selected";
  if (seatsEl) seatsEl.textContent = seats || "—";
  if (tablesEl) tablesEl.textContent = tables || "—";
  if (periodEl) periodEl.textContent = `Period ${getPeriodNumber(state.currentPeriod)}`;

  els.seatDetails.innerHTML = "";
  els.seatDetails.appendChild(fragment);
}

function updateSelectionUI(periodData, seatMap, layoutSeats) {
  const count = state.selectedSeatIds.size;

  if (els.selectedStudentCount) {
    els.selectedStudentCount.textContent = String(count);
  }

  if (els.selectionBadge) {
    els.selectionBadge.textContent = `${count} Selected`;
  }

  if (els.behaviorTargetMode) {
    els.behaviorTargetMode.textContent =
      count <= 1 ? "Single" : `Multi (${count})`;
  }
}

function renderEmptyDetails(message = null) {
  if (!els.seatDetails) return;

  els.seatDetails.innerHTML = `
    <div class="details-empty">
      <div class="details-placeholder-icon">🪑</div>
      <h3>${message ? "Nothing to Show" : "No Seat Selected"}</h3>
      <p>${
        message ||
        "Click one or more seats to view student information and apply behavior actions."
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

  emitSeatSelectionEvent(null, null);
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

(function initializeBehaviorSystem() {
  if (!window.BehaviorStore) return;

  window.BehaviorStore.migrateLegacyEvents();
  window.BehaviorStore.saveSeatingAssignments(state.data || {});
  window.BehaviorStore.rebuildDashboardCache();
})();

window.seatingViewer = {
  getState() {
    return {
      ...state,
      selectedSeatIds: [...state.selectedSeatIds],
    };
  },
};

/* ===============================
   CLASS REPORT SYSTEM
================================ */

const reportPanel = document.getElementById("classReportPanel");
const reportBody = document.getElementById("reportTableBody");
const reportSummary = document.getElementById("reportSummary");

const toggleReportBtn = document.getElementById("toggleReportBtn");
const clearReportBtn = document.getElementById("clearReportBtn");
const exportReportBtn = document.getElementById("exportReportBtn");
const saveReportBtn = document.getElementById("saveReportBtn");

let reportHidden = false;

toggleReportBtn?.addEventListener("click", () => {
  reportHidden = !reportHidden;

  if (reportSummary) {
    reportSummary.style.display = reportHidden ? "none" : "";
  }

  const tableWrap = reportPanel?.querySelector(".report-table-wrapper");
  if (tableWrap) {
    tableWrap.style.display = reportHidden ? "none" : "";
  }

  toggleReportBtn.textContent = reportHidden ? "Show" : "Hide";
});

clearReportBtn?.addEventListener("click", () => {
  window.seatBehaviorBridge?.clearBehaviorLog?.();
  renderReport();
});

exportReportBtn?.addEventListener("click", () => {
  exportCurrentPeriodReportToCSV();
});

saveReportBtn?.addEventListener("click", () => {
  saveCurrentPeriodSnapshot();
});

document.addEventListener("behavior:logged", () => {
  renderReport();
});

document.addEventListener("behavior:hydrated", () => {
  renderReport();
});

function renderReport() {
  if (!reportBody || !reportSummary) return;

  const { filtered, concern, recovery, totalScore } = buildCurrentPeriodReportData();

  reportSummary.innerHTML = `
    <div class="report-stat">
      <span>Total Logs</span>
      <strong>${filtered.length}</strong>
    </div>
    <div class="report-stat">
      <span>Concerns</span>
      <strong>${concern}</strong>
    </div>
    <div class="report-stat">
      <span>Recovery</span>
      <strong>${recovery}</strong>
    </div>
    <div class="report-stat">
      <span>Net Score</span>
      <strong>${totalScore}</strong>
    </div>
  `;

  if (!filtered.length) {
    reportBody.innerHTML = `
      <tr>
        <td colspan="7">No behavior entries logged for this class yet.</td>
      </tr>
    `;
    return;
  }

  reportBody.innerHTML = filtered
    .map((log) => {
      const time = new Date(log.loggedAt || log.timestamp).toLocaleTimeString();

      return `
        <tr>
          <td>${time}</td>
          <td>${log.studentName || "-"}</td>
          <td>${log.seatId || "-"}</td>
          <td>${log.modeId || "-"}</td>
          <td>${log.categoryId || "-"}</td>
          <td>${log.behaviorId || "-"}</td>
          <td>${log.score ?? "-"}</td>
        </tr>
      `;
    })
    .join("");
}

function exportCurrentPeriodReportToCSV() {
  const { filtered } = buildCurrentPeriodReportData();

  if (!filtered.length) {
    alert("No behavior entries to export for this class.");
    return;
  }

  const periodNumber = getPeriodNumber(currentPeriod);
  const dateStamp = buildDateStamp();
  const filename = `class_behavior_report_period_${periodNumber}_${dateStamp}.csv`;

  const headers = [
    "loggedAt",
    "periodId",
    "studentName",
    "studentNumber",
    "matchedRosterName",
    "rosterIndex",
    "grade",
    "seatId",
    "tableId",
    "zone",
    "position",
    "modeId",
    "categoryId",
    "behaviorId",
    "label",
    "score",
    "source",
  ];

  const rows = filtered.map((log) => [
    log.loggedAt || log.timestamp || "",
    log.periodId || "",
    log.studentName || "",
    log.studentNumber || "",
    log.matchedRosterName || "",
    log.rosterIndex || "",
    log.grade || "",
    log.seatId ?? "",
    log.tableId ?? "",
    log.zone || "",
    log.position || "",
    log.modeId || "",
    log.categoryId || "",
    log.behaviorId || "",
    log.label || "",
    log.score ?? "",
    log.source || "",
  ]);

  const csvContent = [
    headers.map(escapeCSVCell).join(","),
    ...rows.map((row) => row.map(escapeCSVCell).join(",")),
  ].join("\n");

  downloadCSV(filename, csvContent);
}

function escapeCSVCell(value) {
  const stringValue = String(value ?? "");
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function saveCurrentPeriodSnapshot() {
  const reportData = buildCurrentPeriodReportData();

  if (!reportData.filtered.length) {
    alert("No behavior entries to save for this class yet.");
    return;
  }

  const periodNumber = getPeriodNumber(state.currentPeriod);
  const label = `Period ${periodNumber} Snapshot ${buildDateStamp()}`;

  if (window.BehaviorStore?.addDashboardSnapshot) {
    const result = window.BehaviorStore.addDashboardSnapshot({
      label,
      periodId: state.currentPeriod,
      createdAt: new Date().toISOString(),
      summary: {
        totalEvents: reportData.filtered.length,
        concernCount: reportData.concern,
        recoveryCount: reportData.recovery,
        netScore: reportData.totalScore,
      },
      rows: reportData.filtered,
    });

    if (result?.ok) {
      alert(`Saved inside the system as ${label}.`);
      return;
    }
  }

  alert("Snapshot save is unavailable right now.");
}

function buildCurrentPeriodReportData() {
  const logs = window.seatBehaviorBridge?.getBehaviorLog?.() || [];
  const currentPeriod = state.currentPeriod;
  const filtered = logs.filter((l) => l.periodId === currentPeriod);

  let concern = 0;
  let recovery = 0;
  let totalScore = 0;

  filtered.forEach((l) => {
    if (l.modeId === "concern") concern++;
    if (l.modeId === "recovery") recovery++;
    totalScore += Number(l.score || 0);
  });

  return {
    logs,
    currentPeriod,
    filtered,
    concern,
    recovery,
    totalScore,
  };
}

function buildDateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}_${hour}${minute}`;
}