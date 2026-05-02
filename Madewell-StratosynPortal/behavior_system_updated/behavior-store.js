(function (window) {
  "use strict";

  const BehaviorStore = (function () {
    const KEYS = Object.freeze({
      LEGACY_EVENTS: "seating_viewer_behavior_log_v1",
      EVENTS: "stratosyn.behavior.events.v1",
      SEATING_ASSIGNMENTS: "stratosyn.behavior.seating_assignments.v1",
      ROSTERS: "stratosyn.behavior.rosters.v1",
      UI_STATE: "stratosyn.behavior.ui_state.v1",
      DASHBOARD_PREFERENCES: "stratosyn.behavior.dashboard_preferences.v1",
      DASHBOARD_FILTERS: "stratosyn.behavior.dashboard_filters.v1",
      DASHBOARD_CACHE: "stratosyn.behavior.dashboard_cache.v1",
      DASHBOARD_SNAPSHOTS: "stratosyn.behavior.dashboard_snapshots.v1",
      TREND_CACHE: "stratosyn.behavior.trend_cache.v1",
      STUDENT_NOTES: "stratosyn.behavior.student_notes.v1",
      INTERVENTIONS: "stratosyn.behavior.interventions.v1",
      FLAGS: "stratosyn.behavior.flags.v1"
    });

    const DEFAULTS = Object.freeze({
      uiState: {
        selectedPeriodId: null,
        selectedStudentId: null,
        selectedSeatId: null,
        activePanel: null,
        lastUpdated: null
      },
      dashboardPreferences: {
        layoutMode: "bento",
        compactCards: false,
        showTimeline: true,
        showHeatmap: true,
        defaultMetric: "net_score",
        timeGrouping: "session"
      },
      dashboardFilters: {
        periodId: null,
        studentIds: [],
        categoryIds: [],
        modeIds: [],
        timeRange: {
          type: "today"
        }
      },
      dashboardCache: {
        generatedAt: null,
        storageSourceHash: null,
        summary: {
          totalEvents: 0,
          concernCount: 0,
          recoveryCount: 0,
          netScore: 0
        },
        topCategories: []
      },
      trendCache: {
        generatedAt: null
      },
      seatingAssignments: {},
      rosters: {},
      studentNotes: {},
      interventions: [],
      flags: { students: {} },
      dashboardSnapshots: []
    });

    function hasStorage() {
      try {
        const testKey = "__behavior_store_test__";
        window.localStorage.setItem(testKey, "1");
        window.localStorage.removeItem(testKey);
        return true;
      } catch (error) {
        return false;
      }
    }

    function nowIso() {
      return new Date().toISOString();
    }

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function safeParse(json, fallback) {
      try {
        return JSON.parse(json);
      } catch (error) {
        return fallback;
      }
    }

    function isPlainObject(value) {
      return !!value && typeof value === "object" && !Array.isArray(value);
    }

    function safeGetRaw(key) {
      if (!hasStorage()) return null;
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    }

    function safeSetRaw(key, value) {
      if (!hasStorage()) return false;
      try {
        window.localStorage.setItem(key, value);
        return true;
      } catch (error) {
        return false;
      }
    }

    function safeRemove(key) {
      if (!hasStorage()) return false;
      try {
        window.localStorage.removeItem(key);
        return true;
      } catch (error) {
        return false;
      }
    }

    function getJSON(key, fallback) {
      const raw = safeGetRaw(key);
      if (raw == null) return clone(fallback);
      return safeParse(raw, clone(fallback));
    }

    function setJSON(key, value) {
      return safeSetRaw(key, JSON.stringify(value));
    }

    function sortEventsByTimestampAsc(events) {
      return events.slice().sort(function (a, b) {
        const aTime = Date.parse(a.timestamp || a.loggedAt || 0) || 0;
        const bTime = Date.parse(b.timestamp || b.loggedAt || 0) || 0;
        return aTime - bTime;
      });
    }

    function normalizeString(value, fallback) {
      if (value == null) return fallback || "";
      return String(value).trim();
    }

    function normalizeNullableString(value) {
      if (value == null || value === "") return null;
      return String(value).trim();
    }

    function normalizeNumber(value, fallback) {
      if (value == null || value === "") return fallback;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    function normalizeArray(value) {
      return Array.isArray(value) ? value : [];
    }

    function createEventId() {
      return "evt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    }

    function normalizeModeId(modeId) {
      const value = normalizeString(modeId).toLowerCase();
      if (value === "concern" || value === "recovery") return value;
      return null;
    }

    function normalizeScore(score, modeId) {
      const numeric = normalizeNumber(score, null);
      if (numeric !== null) return numeric;
      if (modeId === "concern") return -1;
      if (modeId === "recovery") return 1;
      return 0;
    }

    function isValidEventRecord(record) {
      if (!isPlainObject(record)) return false;
      const requiredStringFields = [
        "studentId",
        "studentName",
        "periodId",
        "modeId",
        "categoryId",
        "behaviorId"
      ];
      for (let i = 0; i < requiredStringFields.length; i += 1) {
        const key = requiredStringFields[i];
        if (!normalizeString(record[key])) return false;
      }
      if (!normalizeModeId(record.modeId)) return false;
      const timestamp = normalizeString(record.timestamp || record.loggedAt);
      if (!timestamp) return false;
      return true;
    }

    function normalizeEventRecord(record) {
      if (!isPlainObject(record)) return null;
      const modeId = normalizeModeId(record.modeId);
      if (!modeId) return null;
      const timestamp = normalizeString(record.timestamp || record.loggedAt || nowIso());
      const loggedAt = normalizeString(record.loggedAt || timestamp || nowIso());
      const normalized = {
        eventId: normalizeString(record.eventId) || createEventId(),
        studentId: normalizeString(record.studentId),
        studentName: normalizeString(record.studentName),
        studentNumber: normalizeNullableString(record.studentNumber),
        matchedRosterName: normalizeNullableString(record.matchedRosterName),
        rosterIndex: normalizeNumber(record.rosterIndex, null),
        grade: normalizeNullableString(record.grade),
        periodId: normalizeString(record.periodId),
        seatId: normalizeNumber(record.seatId, null),
        tableId: normalizeNumber(record.tableId, null),
        zone: normalizeNullableString(record.zone),
        position: normalizeNullableString(record.position),
        modeId: modeId,
        categoryId: normalizeString(record.categoryId),
        behaviorId: normalizeString(record.behaviorId),
        label: normalizeNullableString(record.label) || normalizeString(record.behaviorId),
        score: normalizeScore(record.score, modeId),
        severity: normalizeNullableString(record.severity) || "standard",
        source: normalizeNullableString(record.source) || "unknown",
        note: normalizeNullableString(record.note) || "",
        timestamp: timestamp,
        loggedAt: loggedAt,
        meta: isPlainObject(record.meta)
          ? record.meta
          : {
              appVersion: "1.0.0",
              device: "browser",
              entryMethod: normalizeNullableString(record.source) || "unknown"
            }
      };
      if (!isValidEventRecord(normalized)) return null;
      return normalized;
    }

    function normalizeEventList(records) {
      const list = normalizeArray(records).map(normalizeEventRecord).filter(Boolean);
      const seen = new Set();
      const deduped = [];
      for (let i = 0; i < list.length; i += 1) {
        const record = list[i];
        if (seen.has(record.eventId)) continue;
        seen.add(record.eventId);
        deduped.push(record);
      }
      return sortEventsByTimestampAsc(deduped);
    }

    function buildStorageSourceHash(events) {
      const list = normalizeArray(events);
      const total = list.length;
      const last = total ? (list[total - 1].loggedAt || list[total - 1].timestamp || "none") : "none";
      return "evtcount_" + total + "_last_" + last;
    }

    function getEvents() {
      const primary = getJSON(KEYS.EVENTS, null);
      if (Array.isArray(primary)) return normalizeEventList(primary);
      const legacy = getJSON(KEYS.LEGACY_EVENTS, []);
      return normalizeEventList(legacy);
    }

    function saveEvents(events) {
      return setJSON(KEYS.EVENTS, normalizeEventList(events));
    }

    function addEvent(eventRecord) {
      const normalized = normalizeEventRecord(eventRecord);
      if (!normalized) return { ok: false, error: "INVALID_EVENT" };
      const events = getEvents();
      events.push(normalized);
      const success = saveEvents(events);
      return { ok: success, event: normalized, totalEvents: success ? events.length : null, error: success ? null : "SAVE_FAILED" };
    }

    function addEvents(eventRecords) {
      const incoming = normalizeArray(eventRecords).map(normalizeEventRecord).filter(Boolean);
      if (!incoming.length) return { ok: false, added: 0, error: "NO_VALID_EVENTS" };
      const merged = getEvents().concat(incoming);
      const success = saveEvents(merged);
      return { ok: success, added: success ? incoming.length : 0, totalEvents: success ? normalizeEventList(merged).length : null, error: success ? null : "SAVE_FAILED" };
    }

    function clearEvents() { return safeRemove(KEYS.EVENTS); }

    function migrateLegacyEvents(options) {
      const settings = Object.assign({ removeLegacy: false, overwriteExisting: false }, options || {});
      const legacy = getJSON(KEYS.LEGACY_EVENTS, []);
      const normalizedLegacy = normalizeEventList(legacy);
      if (!normalizedLegacy.length) return { ok: true, migrated: 0, skipped: true, reason: "NO_LEGACY_EVENTS" };
      const existing = getJSON(KEYS.EVENTS, null);
      if (Array.isArray(existing) && existing.length && !settings.overwriteExisting) {
        return { ok: true, migrated: 0, skipped: true, reason: "PRIMARY_ALREADY_EXISTS" };
      }
      const saved = setJSON(KEYS.EVENTS, normalizedLegacy);
      if (!saved) return { ok: false, migrated: 0, skipped: false, reason: "SAVE_FAILED" };
      if (settings.removeLegacy) safeRemove(KEYS.LEGACY_EVENTS);
      return { ok: true, migrated: normalizedLegacy.length, skipped: false, reason: null };
    }

    function getSeatingAssignments() {
      const value = getJSON(KEYS.SEATING_ASSIGNMENTS, DEFAULTS.seatingAssignments);
      return isPlainObject(value) ? value : clone(DEFAULTS.seatingAssignments);
    }
    function saveSeatingAssignments(data) { return setJSON(KEYS.SEATING_ASSIGNMENTS, isPlainObject(data) ? data : clone(DEFAULTS.seatingAssignments)); }
    function getRosterMap() {
      const value = getJSON(KEYS.ROSTERS, DEFAULTS.rosters);
      return isPlainObject(value) ? value : clone(DEFAULTS.rosters);
    }
    function saveRosterMap(data) { return setJSON(KEYS.ROSTERS, isPlainObject(data) ? data : clone(DEFAULTS.rosters)); }
    function getUiState() {
      const value = getJSON(KEYS.UI_STATE, DEFAULTS.uiState);
      return Object.assign({}, clone(DEFAULTS.uiState), isPlainObject(value) ? value : {});
    }
    function saveUiState(nextState) {
      const merged = Object.assign({}, getUiState(), isPlainObject(nextState) ? nextState : {}, { lastUpdated: nowIso() });
      return setJSON(KEYS.UI_STATE, merged);
    }
    function getDashboardPreferences() {
      const value = getJSON(KEYS.DASHBOARD_PREFERENCES, DEFAULTS.dashboardPreferences);
      return Object.assign({}, clone(DEFAULTS.dashboardPreferences), isPlainObject(value) ? value : {});
    }
    function saveDashboardPreferences(nextPrefs) {
      const merged = Object.assign({}, getDashboardPreferences(), isPlainObject(nextPrefs) ? nextPrefs : {});
      return setJSON(KEYS.DASHBOARD_PREFERENCES, merged);
    }
    function getDashboardFilters() {
      const value = getJSON(KEYS.DASHBOARD_FILTERS, DEFAULTS.dashboardFilters);
      const merged = Object.assign({}, clone(DEFAULTS.dashboardFilters), isPlainObject(value) ? value : {});
      merged.studentIds = normalizeArray(merged.studentIds);
      merged.categoryIds = normalizeArray(merged.categoryIds);
      merged.modeIds = normalizeArray(merged.modeIds);
      merged.timeRange = isPlainObject(merged.timeRange) ? merged.timeRange : { type: "today" };
      return merged;
    }
    function saveDashboardFilters(nextFilters) {
      const merged = Object.assign({}, getDashboardFilters(), isPlainObject(nextFilters) ? nextFilters : {});
      merged.studentIds = normalizeArray(merged.studentIds);
      merged.categoryIds = normalizeArray(merged.categoryIds);
      merged.modeIds = normalizeArray(merged.modeIds);
      merged.timeRange = isPlainObject(merged.timeRange) ? merged.timeRange : { type: "today" };
      return setJSON(KEYS.DASHBOARD_FILTERS, merged);
    }
    function getDashboardCache() {
      const value = getJSON(KEYS.DASHBOARD_CACHE, DEFAULTS.dashboardCache);
      return isPlainObject(value) ? value : clone(DEFAULTS.dashboardCache);
    }
    function saveDashboardCache(cache) { return setJSON(KEYS.DASHBOARD_CACHE, isPlainObject(cache) ? cache : clone(DEFAULTS.dashboardCache)); }
    function rebuildDashboardCache() {
      const events = getEvents();
      const summary = {
        totalEvents: events.length,
        concernCount: events.filter((event) => event.modeId === "concern").length,
        recoveryCount: events.filter((event) => event.modeId === "recovery").length,
        netScore: events.reduce((sum, event) => sum + normalizeNumber(event.score, 0), 0)
      };
      const categoryMap = {};
      for (let i = 0; i < events.length; i += 1) {
        const event = events[i];
        const key = event.categoryId || "unknown";
        if (!categoryMap[key]) categoryMap[key] = { categoryId: key, count: 0, netScore: 0, concernCount: 0, recoveryCount: 0 };
        categoryMap[key].count += 1;
        categoryMap[key].netScore += normalizeNumber(event.score, 0);
        if (event.modeId === "concern") categoryMap[key].concernCount += 1;
        if (event.modeId === "recovery") categoryMap[key].recoveryCount += 1;
      }
      const topCategories = Object.keys(categoryMap).map((key) => categoryMap[key]).sort((a, b) => b.count - a.count);
      const cache = { generatedAt: nowIso(), storageSourceHash: buildStorageSourceHash(events), summary, topCategories };
      saveDashboardCache(cache);
      return cache;
    }
    function getDashboardSnapshots() { return normalizeArray(getJSON(KEYS.DASHBOARD_SNAPSHOTS, DEFAULTS.dashboardSnapshots)); }
    function saveDashboardSnapshots(list) { return setJSON(KEYS.DASHBOARD_SNAPSHOTS, normalizeArray(list)); }
    function addDashboardSnapshot(snapshot) {
      const snapshots = getDashboardSnapshots();
      const record = Object.assign({ snapshotId: "snap_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), label: "Dashboard Snapshot", createdAt: nowIso(), periodId: null, summary: {} }, isPlainObject(snapshot) ? snapshot : {});
      snapshots.push(record);
      const success = saveDashboardSnapshots(snapshots);
      return { ok: success, snapshot: record, totalSnapshots: success ? snapshots.length : null };
    }
    function removeDashboardSnapshot(snapshotId) {
      const snapshots = getDashboardSnapshots();
      const next = snapshots.filter((item) => item.snapshotId !== snapshotId);
      const changed = next.length !== snapshots.length;
      const success = changed ? saveDashboardSnapshots(next) : true;
      return { ok: success, removed: changed };
    }
    function getTrendCache() { const value = getJSON(KEYS.TREND_CACHE, DEFAULTS.trendCache); return isPlainObject(value) ? value : clone(DEFAULTS.trendCache); }
    function saveTrendCache(data) { return setJSON(KEYS.TREND_CACHE, isPlainObject(data) ? data : clone(DEFAULTS.trendCache)); }
    function getStudentNotesMap() { const value = getJSON(KEYS.STUDENT_NOTES, DEFAULTS.studentNotes); return isPlainObject(value) ? value : clone(DEFAULTS.studentNotes); }
    function saveStudentNotesMap(data) { return setJSON(KEYS.STUDENT_NOTES, isPlainObject(data) ? data : clone(DEFAULTS.studentNotes)); }
    function getStudentNotes(studentId) { return normalizeArray(getStudentNotesMap()[normalizeString(studentId)]); }
    function addStudentNote(studentId, noteData) {
      const key = normalizeString(studentId);
      if (!key) return { ok: false, error: "INVALID_STUDENT_ID" };
      const map = getStudentNotesMap();
      const existing = normalizeArray(map[key]);
      const note = Object.assign({ noteId: "note_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), createdAt: nowIso(), updatedAt: nowIso(), periodId: null, text: "", tagIds: [] }, isPlainObject(noteData) ? noteData : {});
      note.text = normalizeString(note.text);
      note.tagIds = normalizeArray(note.tagIds);
      if (!note.text) return { ok: false, error: "EMPTY_NOTE" };
      existing.push(note); map[key] = existing;
      const success = saveStudentNotesMap(map);
      return { ok: success, note, totalNotes: success ? existing.length : null };
    }
    function updateStudentNote(studentId, noteId, patch) {
      const key = normalizeString(studentId); const map = getStudentNotesMap(); const notes = normalizeArray(map[key]); let updated = null;
      for (let i = 0; i < notes.length; i += 1) {
        if (notes[i].noteId === noteId) { notes[i] = Object.assign({}, notes[i], isPlainObject(patch) ? patch : {}, { updatedAt: nowIso() }); notes[i].text = normalizeString(notes[i].text); notes[i].tagIds = normalizeArray(notes[i].tagIds); updated = notes[i]; break; }
      }
      if (!updated) return { ok: false, error: "NOTE_NOT_FOUND" };
      map[key] = notes; const success = saveStudentNotesMap(map); return { ok: success, note: updated };
    }
    function removeStudentNote(studentId, noteId) {
      const key = normalizeString(studentId); const map = getStudentNotesMap(); const notes = normalizeArray(map[key]); const next = notes.filter((note) => note.noteId !== noteId); const changed = next.length !== notes.length;
      if (!changed) return { ok: false, removed: false, error: "NOTE_NOT_FOUND" };
      map[key] = next; const success = saveStudentNotesMap(map); return { ok: success, removed: true };
    }
    function getInterventions() { return normalizeArray(getJSON(KEYS.INTERVENTIONS, DEFAULTS.interventions)); }
    function saveInterventions(list) { return setJSON(KEYS.INTERVENTIONS, normalizeArray(list)); }
    function addIntervention(interventionData) {
      const intervention = Object.assign({ interventionId: "int_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), studentId: null, periodId: null, type: "general", label: "General Intervention", notes: "", createdAt: nowIso(), updatedAt: nowIso() }, isPlainObject(interventionData) ? interventionData : {});
      intervention.studentId = normalizeNullableString(intervention.studentId); intervention.periodId = normalizeNullableString(intervention.periodId); intervention.type = normalizeString(intervention.type) || "general"; intervention.label = normalizeString(intervention.label) || "General Intervention"; intervention.notes = normalizeNullableString(intervention.notes) || "";
      const list = getInterventions(); list.push(intervention); const success = saveInterventions(list); return { ok: success, intervention, totalInterventions: success ? list.length : null };
    }
    function getFlags() { const value = getJSON(KEYS.FLAGS, DEFAULTS.flags); return isPlainObject(value) ? value : clone(DEFAULTS.flags); }
    function saveFlags(data) { return setJSON(KEYS.FLAGS, isPlainObject(data) ? data : clone(DEFAULTS.flags)); }
    function getStudentFlags(studentId) { const flags = getFlags(); const record = flags.students && flags.students[normalizeString(studentId)] ? flags.students[normalizeString(studentId)] : null; return record && Array.isArray(record.flags) ? record.flags : []; }
    function setStudentFlags(studentId, flagList) {
      const key = normalizeString(studentId); if (!key) return { ok: false, error: "INVALID_STUDENT_ID" };
      const flags = getFlags(); if (!isPlainObject(flags.students)) flags.students = {};
      flags.students[key] = { flags: normalizeArray(flagList).map((flag) => normalizeString(flag)).filter(Boolean), updatedAt: nowIso() };
      const success = saveFlags(flags); return { ok: success, studentId: key, flags: flags.students[key].flags };
    }
    function addStudentFlag(studentId, flag) { return setStudentFlags(studentId, Array.from(new Set(getStudentFlags(studentId).concat([normalizeString(flag)]).filter(Boolean)))); }
    function removeStudentFlag(studentId, flag) { return setStudentFlags(studentId, getStudentFlags(studentId).filter((item) => item !== normalizeString(flag))); }
    function resetNonSourceData() {
      return { ok: true, results: { uiState: safeRemove(KEYS.UI_STATE), dashboardPreferences: safeRemove(KEYS.DASHBOARD_PREFERENCES), dashboardFilters: safeRemove(KEYS.DASHBOARD_FILTERS), dashboardCache: safeRemove(KEYS.DASHBOARD_CACHE), dashboardSnapshots: safeRemove(KEYS.DASHBOARD_SNAPSHOTS), trendCache: safeRemove(KEYS.TREND_CACHE), studentNotes: safeRemove(KEYS.STUDENT_NOTES), interventions: safeRemove(KEYS.INTERVENTIONS), flags: safeRemove(KEYS.FLAGS) } };
    }
    function exportAll() {
      return { exportedAt: nowIso(), keys: clone(KEYS), data: { events: getEvents(), seatingAssignments: getSeatingAssignments(), rosters: getRosterMap(), uiState: getUiState(), dashboardPreferences: getDashboardPreferences(), dashboardFilters: getDashboardFilters(), dashboardCache: getDashboardCache(), dashboardSnapshots: getDashboardSnapshots(), trendCache: getTrendCache(), studentNotes: getStudentNotesMap(), interventions: getInterventions(), flags: getFlags() } };
    }
    function importAll(payload, options) {
      const settings = Object.assign({ overwrite: false }, options || {});
      if (!isPlainObject(payload) || !isPlainObject(payload.data)) return { ok: false, error: "INVALID_IMPORT_PAYLOAD" };
      const data = payload.data;
      const writes = [];
      if (settings.overwrite || !getEvents().length) writes.push(saveEvents(data.events || []));
      writes.push(saveSeatingAssignments(data.seatingAssignments || {}));
      writes.push(saveRosterMap(data.rosters || {}));
      writes.push(saveUiState(data.uiState || {}));
      writes.push(saveDashboardPreferences(data.dashboardPreferences || {}));
      writes.push(saveDashboardFilters(data.dashboardFilters || {}));
      writes.push(saveDashboardCache(data.dashboardCache || {}));
      writes.push(saveDashboardSnapshots(data.dashboardSnapshots || []));
      writes.push(saveTrendCache(data.trendCache || {}));
      writes.push(saveStudentNotesMap(data.studentNotes || {}));
      writes.push(saveInterventions(data.interventions || []));
      writes.push(saveFlags(data.flags || {}));
      return { ok: writes.every(Boolean), importedAt: nowIso() };
    }
    function getSystemHealth() {
      const events = getEvents();
      return { storageReady: hasStorage(), keys: clone(KEYS), eventCount: events.length, latestEventAt: events.length ? (events[events.length - 1].loggedAt || events[events.length - 1].timestamp) : null, sourceHash: buildStorageSourceHash(events), hasLegacyEvents: Array.isArray(getJSON(KEYS.LEGACY_EVENTS, null)), timestampCheckedAt: nowIso() };
    }

    return Object.freeze({
      KEYS, DEFAULTS, hasStorage, getSystemHealth,
      getEvents, saveEvents, addEvent, addEvents, clearEvents, migrateLegacyEvents,
      getSeatingAssignments, saveSeatingAssignments,
      getRosterMap, saveRosterMap,
      getUiState, saveUiState,
      getDashboardPreferences, saveDashboardPreferences,
      getDashboardFilters, saveDashboardFilters,
      getDashboardCache, saveDashboardCache, rebuildDashboardCache,
      getDashboardSnapshots, saveDashboardSnapshots, addDashboardSnapshot, removeDashboardSnapshot,
      getTrendCache, saveTrendCache,
      getStudentNotesMap, saveStudentNotesMap, getStudentNotes, addStudentNote, updateStudentNote, removeStudentNote,
      getInterventions, saveInterventions, addIntervention,
      getFlags, saveFlags, getStudentFlags, setStudentFlags, addStudentFlag, removeStudentFlag,
      resetNonSourceData, exportAll, importAll
    });
  })();

  window.BehaviorStore = BehaviorStore;
})(window);
