
(function () {
  class BehaviorBentoDashboard {
    constructor(root, options = {}) {
      if (!root) throw new Error("BehaviorBentoDashboard requires a root element.");
      this.root = root;
      this.options = {
        title: "Behavior Intelligence Deck",
        subtitle: "A modular classroom behavior view designed for embedded use inside your existing project.",
        storageKey: "seating_viewer_behavior_log_v1",
        maxTopStudents: 6,
        themeClass: "",
        ...options
      };
      this.root.classList.add("behavior-bento-dashboard");
      if (this.options.themeClass) this.root.classList.add(this.options.themeClass);
      this.events = [];
      this.renderShell();
      this.load();
    }

    static mount(selectorOrElement, options = {}) {
      const root = typeof selectorOrElement === "string"
        ? document.querySelector(selectorOrElement)
        : selectorOrElement;
      return new BehaviorBentoDashboard(root, options);
    }

    getStorageEvents() {
      try {
        const raw = localStorage.getItem(this.options.storageKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        console.warn("BehaviorBentoDashboard could not parse localStorage events.", err);
        return [];
      }
    }

    normalizeEvent(evt) {
      if (!evt || typeof evt !== "object") return null;
      const loggedAt = evt.loggedAt || evt.timestamp || evt.createdAt || new Date().toISOString();
      return {
        loggedAt,
        periodId: evt.periodId || "unknown_period",
        studentName: evt.studentName || "Unknown Student",
        studentNumber: String(evt.studentNumber || evt.studentId || ""),
        matchedRosterName: evt.matchedRosterName || evt.studentName || "Unknown Student",
        rosterIndex: Number.isFinite(Number(evt.rosterIndex)) ? Number(evt.rosterIndex) : null,
        grade: evt.grade || "",
        seatId: Number.isFinite(Number(evt.seatId)) ? Number(evt.seatId) : null,
        tableId: Number.isFinite(Number(evt.tableId)) ? Number(evt.tableId) : null,
        zone: evt.zone || "unknown_zone",
        position: evt.position || "",
        modeId: evt.modeId || (Number(evt.score) >= 0 ? "recovery" : "concern"),
        categoryId: evt.categoryId || "uncategorized",
        behaviorId: evt.behaviorId || "",
        label: evt.label || evt.behaviorId || "Unlabeled Event",
        score: Number.isFinite(Number(evt.score))
          ? Number(evt.score)
          : ((evt.modeId || "").toLowerCase() === "concern" ? -1 : 1),
        source: evt.source || "local"
      };
    }

    setEvents(events = []) {
      this.events = (Array.isArray(events) ? events : [])
        .map((evt) => this.normalizeEvent(evt))
        .filter(Boolean)
        .sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt));
      this.render();
    }

    load() {
      if (Array.isArray(this.options.events) && this.options.events.length) {
        this.setEvents(this.options.events);
        return;
      }
      this.setEvents(this.getStorageEvents());
    }

    refresh() {
      this.load();
    }

    destroy() {
      this.root.innerHTML = "";
      this.root.className = "";
    }

    renderShell() {
      this.root.innerHTML = `
        <div class="behavior-bento-dashboard__header">
          <div>
            <div class="behavior-bento-dashboard__eyebrow">behavior telemetry / embedded module</div>
            <h2 class="behavior-bento-dashboard__title">${this.escapeHtml(this.options.title)}</h2>
            <p class="behavior-bento-dashboard__subtitle">${this.escapeHtml(this.options.subtitle)}</p>
          </div>
          <div class="behavior-bento-dashboard__actions">
            <button type="button" class="behavior-bento-dashboard__button" data-action="refresh">Refresh</button>
            <button type="button" class="behavior-bento-dashboard__button" data-action="export">Export JSON</button>
          </div>
        </div>
        <div class="behavior-bento-dashboard__body"></div>
        <div class="behavior-bento-dashboard__footer">
          Safe embed mode: this dashboard only reads from the supplied data or localStorage and does not mutate your existing files.
        </div>
      `;
      this.body = this.root.querySelector(".behavior-bento-dashboard__body");
      this.root.addEventListener("click", (event) => {
        const button = event.target.closest("[data-action]");
        if (!button) return;
        const action = button.getAttribute("data-action");
        if (action === "refresh") this.refresh();
        if (action === "export") this.exportJson();
      });
    }

    exportJson() {
      const blob = new Blob([JSON.stringify(this.events, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "behavior-dashboard-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    render() {
      if (!this.events.length) {
        this.body.innerHTML = `
          <div class="behavior-bento-dashboard__empty">
            <div>
              <h3>No behavior events found</h3>
              <p>This module is live and ready, but the connected dataset is empty. Add events to localStorage under <code>${this.escapeHtml(this.options.storageKey)}</code> or pass an <code>events</code> array into the constructor.</p>
            </div>
          </div>
        `;
        return;
      }

      const stats = this.computeStats(this.events);
      this.body.innerHTML = `
        <div class="behavior-bento-dashboard__grid">
          <section class="behavior-bento-dashboard__card behavior-bento-dashboard__card--hero">
            <div class="behavior-bento-dashboard__label">
              <span>Pulse Score</span>
              <span>${this.escapeHtml(stats.periodLabel)}</span>
            </div>
            <h3 class="behavior-bento-dashboard__value">${this.formatSigned(stats.netScore)}</h3>
            <div class="behavior-bento-dashboard__micro">
              ${stats.totalEvents} logged events across ${stats.uniqueStudents} students. Recovery-to-concern ratio: <strong>${stats.recoveryCount}:${stats.concernCount}</strong>.
            </div>
            <div class="behavior-bento-dashboard__pill-row">
              <div class="behavior-bento-dashboard__pill"><strong>${stats.recoveryCount}</strong> recovery</div>
              <div class="behavior-bento-dashboard__pill"><strong>${stats.concernCount}</strong> concern</div>
              <div class="behavior-bento-dashboard__pill"><strong>${stats.uniqueTables}</strong> active tables</div>
              <div class="behavior-bento-dashboard__pill"><strong>${stats.uniqueSeats}</strong> touched seats</div>
            </div>
            <div class="behavior-bento-dashboard__spark">
              ${stats.sparkline.map(v => `<span class="behavior-bento-dashboard__spark-bar" style="height:${v}%"></span>`).join("")}
            </div>
            <div class="behavior-bento-dashboard__hero-ring"></div>
          </section>

          <section class="behavior-bento-dashboard__card">
            <div class="behavior-bento-dashboard__label">
              <span>Mode Balance</span>
              <span>live split</span>
            </div>
            <div class="behavior-bento-dashboard__split">
              <div class="behavior-bento-dashboard__split-panel" data-mode="recovery">
                <div class="behavior-bento-dashboard__micro">Recovery</div>
                <div class="behavior-bento-dashboard__split-value">${stats.recoveryCount}</div>
                <div class="behavior-bento-dashboard__micro">${stats.recoveryPct}% of logged activity</div>
                <div class="behavior-bento-dashboard__progress"><span style="width:${stats.recoveryPct}%; background: linear-gradient(90deg, rgba(102,242,181,1), rgba(124,200,255,0.75));"></span></div>
              </div>
              <div class="behavior-bento-dashboard__split-panel" data-mode="concern">
                <div class="behavior-bento-dashboard__micro">Concern</div>
                <div class="behavior-bento-dashboard__split-value">${stats.concernCount}</div>
                <div class="behavior-bento-dashboard__micro">${stats.concernPct}% of logged activity</div>
                <div class="behavior-bento-dashboard__progress"><span style="width:${stats.concernPct}%; background: linear-gradient(90deg, rgba(255,122,144,0.95), rgba(255,191,102,0.8));"></span></div>
              </div>
            </div>
          </section>

          <section class="behavior-bento-dashboard__card">
            <div class="behavior-bento-dashboard__label">
              <span>Behavior Pressure Map</span>
              <span>by category</span>
            </div>
            <div class="behavior-bento-dashboard__constellation">
              ${stats.categories.map(cat => `
                <div class="behavior-bento-dashboard__category">
                  <div>
                    <div class="behavior-bento-dashboard__category-name">${this.escapeHtml(this.labelize(cat.name))}</div>
                    <div class="behavior-bento-dashboard__bar">
                      <span style="width:${cat.share}%; background:${cat.net < 0
                        ? 'linear-gradient(90deg, rgba(255,122,144,0.95), rgba(255,191,102,0.9))'
                        : 'linear-gradient(90deg, rgba(102,242,181,1), rgba(124,200,255,0.85))'}"></span>
                    </div>
                  </div>
                  <div class="behavior-bento-dashboard__category-value">${this.formatSigned(cat.net)}</div>
                </div>
              `).join("")}
            </div>
          </section>

          <section class="behavior-bento-dashboard__card behavior-bento-dashboard__card--wide behavior-bento-dashboard__card--tall">
            <div class="behavior-bento-dashboard__label">
              <span>Student Impact Ladder</span>
              <span>net behavior score</span>
            </div>
            <div class="behavior-bento-dashboard__student-list">
              ${stats.students.map(student => `
                <div class="behavior-bento-dashboard__student">
                  <div class="behavior-bento-dashboard__student-head">
                    <div class="behavior-bento-dashboard__student-name">${this.escapeHtml(student.name)}</div>
                    <div class="behavior-bento-dashboard__score-badge" data-tone="${student.net > 0 ? "good" : student.net < 0 ? "bad" : "neutral"}">
                      ${this.formatSigned(student.net)}
                    </div>
                  </div>
                  <div class="behavior-bento-dashboard__student-meta">
                    ${student.events} event${student.events === 1 ? "" : "s"} · seat ${student.seatId ?? "—"} · table ${student.tableId ?? "—"} · strongest signal: ${this.escapeHtml(this.labelize(student.topCategory || "uncategorized"))}
                  </div>
                </div>
              `).join("")}
            </div>
          </section>

          <section class="behavior-bento-dashboard__card behavior-bento-dashboard__card--seat">
            <div class="behavior-bento-dashboard__label">
              <span>Zone / Table Heat</span>
              <span>room pressure</span>
            </div>
            <div class="behavior-bento-dashboard__heat-grid">
              ${stats.zoneHeat.map(zone => `
                <div class="behavior-bento-dashboard__heat-cell" style="${this.heatStyle(zone.net, zone.events)}">
                  <div class="behavior-bento-dashboard__heat-label">${this.escapeHtml(zone.name)}</div>
                  <div class="behavior-bento-dashboard__heat-value">${this.formatSigned(zone.net)}</div>
                  <div class="behavior-bento-dashboard__heat-sub">${zone.events} events · ${zone.tables} tables</div>
                </div>
              `).join("")}
            </div>
            <div class="behavior-bento-dashboard__pill-row" style="margin-top:14px;">
              ${stats.hotTables.map(table => `
                <div class="behavior-bento-dashboard__pill">Table ${table.tableId}: <strong>${this.formatSigned(table.net)}</strong></div>
              `).join("")}
            </div>
          </section>

          <section class="behavior-bento-dashboard__card behavior-bento-dashboard__card--wide">
            <div class="behavior-bento-dashboard__label">
              <span>Timeline Ribbon</span>
              <span>chronological intensity</span>
            </div>
            <div class="behavior-bento-dashboard__timeline">
              ${stats.timeline.map(slot => `
                <div class="behavior-bento-dashboard__timeline-slot">
                  <span style="height:${slot.height}%; background:${slot.net < 0
                    ? 'linear-gradient(180deg, rgba(255,191,102,0.9), rgba(255,122,144,0.98))'
                    : 'linear-gradient(180deg, rgba(124,200,255,0.9), rgba(102,242,181,1))'}"></span>
                </div>
              `).join("")}
            </div>
            <div class="behavior-bento-dashboard__timeline-labels">
              ${stats.timeline.map(slot => `<span>${this.escapeHtml(slot.label)}</span>`).join("")}
            </div>
          </section>
        </div>
      `;
    }

    computeStats(events) {
      const totalEvents = events.length;
      const recoveryEvents = events.filter((e) => e.modeId === "recovery");
      const concernEvents = events.filter((e) => e.modeId === "concern");
      const netScore = events.reduce((sum, e) => sum + (Number(e.score) || 0), 0);
      const uniqueStudents = new Set(events.map((e) => e.studentNumber || e.studentName)).size;
      const uniqueTables = new Set(events.map((e) => e.tableId).filter((v) => v != null)).size;
      const uniqueSeats = new Set(events.map((e) => e.seatId).filter((v) => v != null)).size;
      const periods = [...new Set(events.map((e) => e.periodId).filter(Boolean))];
      const periodLabel = periods.length === 1 ? periods[0] : `${periods.length} periods`;

      const recoveryCount = recoveryEvents.length;
      const concernCount = concernEvents.length;
      const recoveryPct = totalEvents ? Math.round((recoveryCount / totalEvents) * 100) : 0;
      const concernPct = totalEvents ? Math.round((concernCount / totalEvents) * 100) : 0;

      const categoryMap = new Map();
      events.forEach((e) => {
        const key = e.categoryId || "uncategorized";
        if (!categoryMap.has(key)) categoryMap.set(key, { name: key, net: 0, events: 0 });
        const item = categoryMap.get(key);
        item.net += Number(e.score) || 0;
        item.events += 1;
      });
      const categories = [...categoryMap.values()]
        .sort((a, b) => b.events - a.events)
        .slice(0, 5)
        .map((cat) => ({
          ...cat,
          share: Math.max(10, Math.round((cat.events / totalEvents) * 100))
        }));

      const studentMap = new Map();
      events.forEach((e) => {
        const key = e.studentNumber || e.studentName;
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            name: e.studentName,
            net: 0,
            events: 0,
            seatId: e.seatId,
            tableId: e.tableId,
            categories: new Map()
          });
        }
        const item = studentMap.get(key);
        item.net += Number(e.score) || 0;
        item.events += 1;
        item.seatId = item.seatId ?? e.seatId;
        item.tableId = item.tableId ?? e.tableId;
        const count = item.categories.get(e.categoryId) || 0;
        item.categories.set(e.categoryId, count + 1);
      });
      const students = [...studentMap.values()]
        .map((student) => {
          const topCategory = [...student.categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
          return { ...student, topCategory };
        })
        .sort((a, b) => {
          const magnitudeDiff = Math.abs(b.net) - Math.abs(a.net);
          if (magnitudeDiff !== 0) return magnitudeDiff;
          return b.events - a.events;
        })
        .slice(0, this.options.maxTopStudents);

      const zoneMap = new Map();
      events.forEach((e) => {
        const key = e.zone || "unknown_zone";
        if (!zoneMap.has(key)) zoneMap.set(key, { name: key.replaceAll("_", " "), net: 0, events: 0, tables: new Set() });
        const item = zoneMap.get(key);
        item.net += Number(e.score) || 0;
        item.events += 1;
        if (e.tableId != null) item.tables.add(e.tableId);
      });
      const zoneHeat = [...zoneMap.values()]
        .map((z) => ({ ...z, tables: z.tables.size }))
        .sort((a, b) => b.events - a.events)
        .slice(0, 6);

      const tableMap = new Map();
      events.forEach((e) => {
        if (e.tableId == null) return;
        if (!tableMap.has(e.tableId)) tableMap.set(e.tableId, { tableId: e.tableId, net: 0, events: 0 });
        const item = tableMap.get(e.tableId);
        item.net += Number(e.score) || 0;
        item.events += 1;
      });
      const hotTables = [...tableMap.values()]
        .sort((a, b) => b.events - a.events || Math.abs(b.net) - Math.abs(a.net))
        .slice(0, 5);

      const timelineBuckets = 12;
      const minTs = new Date(events[0].loggedAt).getTime();
      const maxTs = new Date(events[events.length - 1].loggedAt).getTime();
      const range = Math.max(maxTs - minTs, 1);
      const slots = Array.from({ length: timelineBuckets }, (_, index) => ({
        label: `${index + 1}`,
        net: 0,
        events: 0
      }));
      events.forEach((e) => {
        const ts = new Date(e.loggedAt).getTime();
        const rawIndex = Math.floor(((ts - minTs) / range) * timelineBuckets);
        const index = Math.min(timelineBuckets - 1, Math.max(0, rawIndex));
        slots[index].net += Number(e.score) || 0;
        slots[index].events += 1;
      });
      const maxTimelineEvents = Math.max(...slots.map((s) => s.events), 1);
      const timeline = slots.map((slot, index) => ({
        ...slot,
        label: this.timelineLabel(index, timelineBuckets),
        height: slot.events ? Math.max(14, Math.round((slot.events / maxTimelineEvents) * 100)) : 8
      }));

      const sparkSource = timeline.map((t) => t.events);
      const maxSpark = Math.max(...sparkSource, 1);
      const sparkline = sparkSource.map((v) => Math.max(10, Math.round((v / maxSpark) * 100)));

      return {
        totalEvents,
        netScore,
        uniqueStudents,
        uniqueTables,
        uniqueSeats,
        periodLabel,
        recoveryCount,
        concernCount,
        recoveryPct,
        concernPct,
        categories,
        students,
        zoneHeat,
        hotTables,
        timeline,
        sparkline
      };
    }

    timelineLabel(index, total) {
      const pct = Math.round((index / (total - 1)) * 100);
      return `${pct}%`;
    }

    heatStyle(net, events) {
      const intensity = Math.min(0.42, 0.12 + (events * 0.035));
      const glow = net < 0
        ? `background: linear-gradient(180deg, rgba(255,122,144,${intensity}), rgba(255,191,102,0.05));`
        : `background: linear-gradient(180deg, rgba(102,242,181,${intensity}), rgba(124,200,255,0.05));`;
      return glow;
    }

    labelize(value) {
      return String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
    }

    formatSigned(value) {
      const num = Number(value) || 0;
      if (num > 0) return `+${num}`;
      return `${num}`;
    }

    escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }
  }

  window.BehaviorBentoDashboard = BehaviorBentoDashboard;
})();
