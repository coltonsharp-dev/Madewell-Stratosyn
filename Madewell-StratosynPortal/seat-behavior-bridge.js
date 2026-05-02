(function () {
  const STORAGE_KEY = "seating_viewer_behavior_log_v1";

  const BRIDGE_STATE = {
    radial: null,
    lastSeatContext: null,
    behaviorLog: [],
  };

  document.addEventListener("DOMContentLoaded", initSeatBehaviorBridge);

  function initSeatBehaviorBridge() {
    const mountEl = document.getElementById("behaviorRadialMount");

    if (!mountEl) {
      console.warn("[seat-behavior-bridge] #behaviorRadialMount not found.");
      return;
    }

    if (typeof window.initBehaviorRadial !== "function") {
      console.error("[seat-behavior-bridge] initBehaviorRadial is not available.");
      return;
    }

    BRIDGE_STATE.behaviorLog = loadBehaviorLog();

    BRIDGE_STATE.radial = window.initBehaviorRadial({
      mountId: "behaviorRadialMount",
      jsonPath: "behavior_radial_structure.json",
      student: buildFallbackStudent(),
      onLog(payload) {
        handleBehaviorLog(payload);
      },
    });

    document.addEventListener("seat:selected", handleSeatSelected);
    document.addEventListener("seat:cleared", handleSeatCleared);

    window.seatBehaviorBridge = {
      getLastSeatContext,
      getBehaviorLog,
      clearBehaviorLog,
      syncFromSeatContext,
      updateFromSeatContext,
      getSelectedSeatContexts,
    };
  }

  function handleSeatSelected(event) {
    const detail = event?.detail || null;

    if (!detail || typeof detail !== "object") {
      return;
    }

    BRIDGE_STATE.lastSeatContext = detail;
    syncFromSeatContext(detail);
  }

  function handleSeatCleared() {
    BRIDGE_STATE.lastSeatContext = null;

    if (BRIDGE_STATE.radial) {
      BRIDGE_STATE.radial.updateStudent(buildFallbackStudent());
      BRIDGE_STATE.radial.reset();
    }
  }

  function syncFromSeatContext(seatContext) {
    if (!BRIDGE_STATE.radial) return;

    const selectedContexts = getSelectedSeatContexts();

    if (selectedContexts.length === 1) {
      const only = selectedContexts[0];

      BRIDGE_STATE.radial.updateStudent({
        id: only.studentId || only.studentNumber || "",
        name: only.studentName || only.student || "Empty Seat",
        periodId: only.periodId || "",
        seatId: only.seatId ?? "",
        tableId: only.tableId ?? "",
        zone: only.zone || "",
        position: only.position || "",
      });
    } else if (selectedContexts.length > 1) {
      BRIDGE_STATE.radial.updateStudent({
        id: "multi-select",
        name: `${selectedContexts.length} Students Selected`,
        periodId: selectedContexts[0]?.periodId || "",
        seatId: "",
        tableId: "",
        zone: "",
        position: "",
      });
    } else if (seatContext) {
      BRIDGE_STATE.radial.updateStudent({
        id: seatContext.studentId || seatContext.studentNumber || "",
        name: seatContext.studentName || seatContext.student || "Empty Seat",
        periodId: seatContext.periodId || "",
        seatId: seatContext.seatId ?? "",
        tableId: seatContext.tableId ?? "",
        zone: seatContext.zone || "",
        position: seatContext.position || "",
      });
    } else {
      BRIDGE_STATE.radial.updateStudent(buildFallbackStudent());
    }

    BRIDGE_STATE.radial.reset();
  }

  function updateFromSeatContext(seatContext) {
    BRIDGE_STATE.lastSeatContext = seatContext || null;

    if (!seatContext) {
      handleSeatCleared();
      return;
    }

    syncFromSeatContext(seatContext);
  }

  function handleBehaviorLog(payload) {
    const selectedContexts = getSelectedSeatContexts();

    if (selectedContexts.length > 1) {
      selectedContexts.forEach((seatContext) => {
        const mergedPayload = {
          ...buildSeatContextDefaults(seatContext),
          ...payload,
          studentId: seatContext.studentId || seatContext.studentNumber || "",
          studentName: seatContext.studentName || seatContext.student || "",
          studentNumber: seatContext.studentNumber || "",
          periodId: seatContext.periodId || "",
          seatId: seatContext.seatId ?? "",
          tableId: seatContext.tableId ?? "",
          zone: seatContext.zone || "",
          position: seatContext.position || "",
          matchedRosterName: seatContext.matchedRosterName || "",
          rosterIndex: seatContext.rosterIndex || "",
          grade: seatContext.grade || "",
          loggedAt: payload?.loggedAt || new Date().toISOString(),
        };

        BRIDGE_STATE.behaviorLog.unshift(mergedPayload);

        document.dispatchEvent(
          new CustomEvent("behavior:logged", {
            detail: mergedPayload,
          })
        );
      });

      trimBehaviorLog();
      saveBehaviorLog();
      return;
    }

    const baseContext = selectedContexts[0] || BRIDGE_STATE.lastSeatContext || null;

    const mergedPayload = {
      ...buildSeatContextDefaults(baseContext),
      ...payload,
      loggedAt: payload?.loggedAt || new Date().toISOString(),
    };

    BRIDGE_STATE.behaviorLog.unshift(mergedPayload);
    trimBehaviorLog();
    saveBehaviorLog();

    console.log("[seat-behavior-bridge] Behavior event:", mergedPayload);

    window.seatBehaviorBridge = {
      getLastSeatContext,
      getBehaviorLog,
      clearBehaviorLog,
      syncFromSeatContext,
      updateFromSeatContext,
      getSelectedSeatContexts,
    };

document.dispatchEvent(
  new CustomEvent("behavior:hydrated", {
    detail: {
      count: BRIDGE_STATE.behaviorLog.length,
    },
  })
);
  }

  function trimBehaviorLog() {
    if (BRIDGE_STATE.behaviorLog.length > 250) {
      BRIDGE_STATE.behaviorLog.length = 250;
    }
  }

  function getSelectedSeatContexts() {
    const viewerState = window.seatingViewer?.getState?.();
    const selectedSeatIds = viewerState?.selectedSeatIds;

    if (!viewerState || !viewerState.data || !selectedSeatIds) {
      return [];
    }

    const periodId = viewerState.currentPeriod;
    const periodData = viewerState.data?.periods?.[periodId];
    const layoutSeats = viewerState.data?.layout?.seats || [];

    if (!periodData || !Array.isArray(periodData.assignments)) {
      return [];
    }

    const selectedIds = Array.isArray(selectedSeatIds)
      ? selectedSeatIds.map(Number)
      : [];

    if (!selectedIds.length) {
      return [];
    }

    const assignmentMap = new Map(
      periodData.assignments.map((assignment) => [
        Number(assignment.seatId),
        assignment,
      ])
    );

    const layoutMap = new Map(
      layoutSeats.map((seat) => [Number(seat.seatId), seat])
    );

    return selectedIds.map((seatId) => {
      const assignment = assignmentMap.get(Number(seatId)) || null;
      const layoutSeat = layoutMap.get(Number(seatId)) || null;

      return {
        studentId: assignment?.studentId || assignment?.studentNumber || "",
        studentName: assignment?.student || "Empty Seat",
        student: assignment?.student || "Empty Seat",
        studentNumber: assignment?.studentNumber || "",
        matchedRosterName: assignment?.matchedRosterName || "",
        rosterIndex: assignment?.rosterIndex || "",
        grade: assignment?.grade || "",
        periodId,
        seatId: Number(seatId),
        tableId: layoutSeat?.tableId ?? "",
        zone: layoutSeat?.zone || "",
        position: layoutSeat?.position || "",
      };
    });
  }

  function buildSeatContextDefaults(seatContext) {
    if (!seatContext) {
      return {
        studentId: "",
        studentName: "",
        studentNumber: "",
        periodId: "",
        seatId: "",
        tableId: "",
        zone: "",
        position: "",
        matchedRosterName: "",
        rosterIndex: "",
        grade: "",
      };
    }

    return {
      studentId: seatContext.studentId || seatContext.studentNumber || "",
      studentName: seatContext.studentName || seatContext.student || "",
      studentNumber: seatContext.studentNumber || "",
      periodId: seatContext.periodId || "",
      seatId: seatContext.seatId ?? "",
      tableId: seatContext.tableId ?? "",
      zone: seatContext.zone || "",
      position: seatContext.position || "",
      matchedRosterName: seatContext.matchedRosterName || "",
      rosterIndex: seatContext.rosterIndex || "",
      grade: seatContext.grade || "",
    };
  }

  function buildFallbackStudent() {
    return {
      id: "",
      name: "No seat selected",
      periodId: "",
      seatId: "",
      tableId: "",
      zone: "",
      position: "",
    };
  }

  function getLastSeatContext() {
    return BRIDGE_STATE.lastSeatContext;
  }

  function getBehaviorLog() {
    return [...BRIDGE_STATE.behaviorLog];
  }

  function clearBehaviorLog() {
    BRIDGE_STATE.behaviorLog = [];
    clearSavedBehaviorLog();
  }

  function saveBehaviorLog() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(BRIDGE_STATE.behaviorLog));
    } catch (error) {
      console.warn("[seat-behavior-bridge] Failed to save behavior log:", error);
    }
  }

  function loadBehaviorLog() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("[seat-behavior-bridge] Failed to load behavior log:", error);
      return [];
    }
  }

  function clearSavedBehaviorLog() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("[seat-behavior-bridge] Failed to clear saved behavior log:", error);
    }
  }
})();


