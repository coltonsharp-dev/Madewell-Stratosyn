(function () {
  function initBehaviorRadial(config) {
    if (!config || typeof config !== "object") {
      throw new Error("initBehaviorRadial requires a config object.");
    }

    const mountEl =
      typeof config.mountId === "string"
        ? document.getElementById(config.mountId)
        : config.mountEl;

    if (!mountEl) {
      throw new Error("Behavior radial mount element not found.");
    }

    const state = {
      data: null,
      categoriesOpen: false,
      behaviorsOpen: false,
      currentCategory: null,
      currentMode: null,
      selectedCategoryNode: null,
      student: normalizeStudent(config.student || {}),
      jsonPath: config.jsonPath || "behavior_radial_structure.json",
      onLog: typeof config.onLog === "function" ? config.onLog : null,
      mountEl,
      ui: {},
      outsideClickHandler: null,
      keyHandler: null
    };

    renderShell(state);
    cacheUI(state);
    wireBaseEvents(state);
    loadBehaviorStructure(state);

    return {
      updateStudent(nextStudent) {
        state.student = normalizeStudent(nextStudent || {});
        closeAll(state);
      },
      reset() {
        closeAll(state);
      },
      destroy() {
        teardown(state);
      },
      getState() {
        return {
          student: state.student,
          currentCategory: state.currentCategory,
          currentMode: state.currentMode,
          categoriesOpen: state.categoriesOpen,
          behaviorsOpen: state.behaviorsOpen
        };
      }
    };
  }

  function normalizeStudent(student) {
    return {
      id: student.id || "",
      name: student.name || "No student selected",
      periodId: student.periodId || "",
      seatId: student.seatId ?? "",
      tableId: student.tableId ?? "",
      zone: student.zone || "",
      position: student.position || ""
    };
  }

  function renderShell(state) {
    state.mountEl.innerHTML = `
      <section class="behavior-radial behavior-radial--button-only">
        <div class="behavior-radial__stage" data-br="radialStage">
          <div class="behavior-radial__orbit" data-br="categoryOrbit"></div>
          <div class="behavior-radial__orbit" data-br="behaviorOrbit"></div>

          <button
            class="behavior-radial__center"
            data-br="centerTrigger"
            type="button"
            aria-label="Open behavior radial"
            aria-expanded="false"
          >
            <span class="behavior-radial__center-ring"></span>
            <i class="fa-solid fa-bullseye"></i>
            <span class="behavior-radial__center-label">Behavior</span>
          </button>
        </div>

        <div class="behavior-radial__toast" data-br="toast" role="status" aria-live="polite"></div>
      </section>
    `;
  }

  function cacheUI(state) {
    const root = state.mountEl;

    state.ui = {
      root: root.querySelector(".behavior-radial"),
      radialStage: root.querySelector('[data-br="radialStage"]'),
      centerTrigger: root.querySelector('[data-br="centerTrigger"]'),
      categoryOrbit: root.querySelector('[data-br="categoryOrbit"]'),
      behaviorOrbit: root.querySelector('[data-br="behaviorOrbit"]'),
      toast: root.querySelector('[data-br="toast"]')
    };
  }

  function wireBaseEvents(state) {
    state.ui.centerTrigger.addEventListener("click", (event) => {
      event.stopPropagation();

      if (!state.data) return;

      if (state.categoriesOpen) {
        closeAll(state);
      } else {
        openCategoryOrbit(state);
      }
    });

    state.outsideClickHandler = (event) => {
      if (!state.mountEl.contains(event.target)) {
        closeAll(state);
      }
    };

    state.keyHandler = (event) => {
      if (event.key === "Escape") {
        closeAll(state);
      }
    };

    document.addEventListener("click", state.outsideClickHandler);
    document.addEventListener("keydown", state.keyHandler);
  }

  async function loadBehaviorStructure(state) {
    try {
      const response = await fetch(state.jsonPath, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Failed to load ${state.jsonPath} (${response.status})`);
      }

      const data = await response.json();
      validateBehaviorStructure(data);
      state.data = data;
      buildCategoryOrbit(state);
    } catch (error) {
      console.error("Behavior radial JSON load failed:", error);
      showToast(state, "Behavior model failed to load.");
    }
  }

  function validateBehaviorStructure(data) {
    if (!data || typeof data !== "object") {
      throw new Error("JSON root is missing or invalid.");
    }

    if (!Array.isArray(data.categories)) {
      throw new Error("JSON categories array is missing.");
    }

    for (const category of data.categories) {
      if (!category.categoryId || !category.label || !category.icon) {
        throw new Error("A category is missing categoryId, label, or icon.");
      }

      if (!category.modes || !category.modes.concern || !category.modes.recovery) {
        throw new Error(`Category "${category.categoryId}" is missing concern/recovery modes.`);
      }

      if (!Array.isArray(category.modes.concern.behaviors)) {
        throw new Error(`Category "${category.categoryId}" concern behaviors missing.`);
      }

      if (!Array.isArray(category.modes.recovery.behaviors)) {
        throw new Error(`Category "${category.categoryId}" recovery behaviors missing.`);
      }
    }
  }

  function buildCategoryOrbit(state) {
    const { categoryOrbit, behaviorOrbit } = state.ui;
    categoryOrbit.innerHTML = "";
    behaviorOrbit.innerHTML = "";

    const categories = [...state.data.categories].sort(
      (a, b) => (a.sortOrder || 999) - (b.sortOrder || 999)
    );

    const concernAngles = distributeArc(165, 345, categories.length);
    const recoveryAngles = distributeArc(15, 195, categories.length);

    categories.forEach((category, index) => {
      const concernNode = createCategoryNode(category, "concern");
      const recoveryNode = createCategoryNode(category, "recovery");

      const concernAngle = concernAngles[index];
      const recoveryAngle = recoveryAngles[index];

      positionNode(concernNode, concernAngle, 82);
      positionNode(recoveryNode, recoveryAngle, 82);

      concernNode.dataset.angle = String(concernAngle);
      recoveryNode.dataset.angle = String(recoveryAngle);

      concernNode.addEventListener("click", (event) => {
        event.stopPropagation();
        openBehaviorOrbit(state, category, "concern", concernNode);
      });

      recoveryNode.addEventListener("click", (event) => {
        event.stopPropagation();
        openBehaviorOrbit(state, category, "recovery", recoveryNode);
      });

      categoryOrbit.appendChild(concernNode);
      categoryOrbit.appendChild(recoveryNode);
    });
  }

  function createCategoryNode(category, mode) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `behavior-radial__node behavior-radial__node--category behavior-radial__node--${mode}`;
    button.dataset.categoryId = category.categoryId;
    button.dataset.mode = mode;
    button.dataset.label = category.label;
    button.setAttribute(
      "aria-label",
      `${mode === "concern" ? "Concern" : "Recovery"} category ${category.label}`
    );

    const icon = document.createElement("i");
    icon.className = category.icon;
    button.appendChild(icon);

    return button;
  }

  function createBehaviorNode(behavior, mode) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `behavior-radial__node behavior-radial__node--behavior behavior-radial__node--${mode}`;
    button.dataset.behaviorId = behavior.behaviorId;
    button.dataset.mode = mode;
    button.dataset.label = behavior.label;
    button.setAttribute("aria-label", behavior.label);

    const icon = document.createElement("i");
    icon.className = behavior.icon;
    button.appendChild(icon);

    return button;
  }

  function openCategoryOrbit(state) {
    state.categoriesOpen = true;
    state.behaviorsOpen = false;
    state.currentCategory = null;
    state.currentMode = null;
    state.selectedCategoryNode = null;

    const ui = state.ui;
    ui.radialStage.classList.add("is-open");
    ui.radialStage.classList.remove("has-category");
    ui.centerTrigger.setAttribute("aria-expanded", "true");

    ui.behaviorOrbit.innerHTML = "";
    hideOrbitNodes(ui.behaviorOrbit);
    clearActiveCategoryNodes(ui.categoryOrbit);
    showOrbitNodes(ui.categoryOrbit);
  }

  function openBehaviorOrbit(state, category, mode, sourceNode) {
    state.categoriesOpen = true;
    state.behaviorsOpen = true;
    state.currentCategory = category;
    state.currentMode = mode;
    state.selectedCategoryNode = sourceNode;

    const ui = state.ui;
    ui.radialStage.classList.add("is-open", "has-category");
    ui.centerTrigger.setAttribute("aria-expanded", "true");

    clearActiveCategoryNodes(ui.categoryOrbit);
    sourceNode.classList.add("is-active");

    ui.behaviorOrbit.innerHTML = "";

    const behaviors = category.modes[mode].behaviors || [];
    const sourceAngle = Number(sourceNode.dataset.angle || 0);
    const behaviorAngles = distributeLocalBehaviorArc(sourceAngle, behaviors.length);

    behaviors.forEach((behavior, index) => {
      const node = createBehaviorNode(behavior, mode);
      positionNode(node, behaviorAngles[index], 118);

      node.addEventListener("click", (event) => {
        event.stopPropagation();
        logBehaviorEvent(state, category, mode, behavior);
      });

      node.style.transitionDelay = `${index * 18}ms`;
      ui.behaviorOrbit.appendChild(node);
    });

    showOrbitNodes(ui.behaviorOrbit);
  }

  function logBehaviorEvent(state, category, mode, behavior) {
    const s = state.student;

    const payload = {
      studentId: s.id || "",
      studentName: s.name || "",
      periodId: s.periodId || "",
      seatId: s.seatId ?? "",
      tableId: s.tableId ?? "",
      zone: s.zone || "",
      position: s.position || "",
      modeId: mode,
      categoryId: category.categoryId,
      behaviorId: behavior.behaviorId,
      label: behavior.label,
      score: behavior.score ?? (mode === "concern" ? -1 : 1),
      timestamp: new Date().toISOString(),
      source: "radial_menu"
    };

    if (state.onLog) {
      state.onLog(payload);
    }

    showToast(
      state,
      `${mode === "concern" ? "Concern" : "Recovery"}: ${behavior.label}`
    );

    closeAll(state);
  }

  function closeAll(state) {
    state.categoriesOpen = false;
    state.behaviorsOpen = false;
    state.currentCategory = null;
    state.currentMode = null;
    state.selectedCategoryNode = null;

    const ui = state.ui;
    ui.centerTrigger.setAttribute("aria-expanded", "false");
    ui.radialStage.classList.remove("is-open", "has-category");

    clearActiveCategoryNodes(ui.categoryOrbit);
    hideOrbitNodes(ui.categoryOrbit);
    hideOrbitNodes(ui.behaviorOrbit);

    setTimeout(() => {
      if (!state.categoriesOpen && !state.behaviorsOpen) {
        ui.behaviorOrbit.innerHTML = "";
      }
    }, 260);
  }

  function showOrbitNodes(orbitEl) {
    const nodes = orbitEl.querySelectorAll(".behavior-radial__node");
    nodes.forEach((node, index) => {
      if (!node.style.transitionDelay) {
        node.style.transitionDelay = `${index * 16}ms`;
      }
      node.classList.add("is-visible");
    });
  }

  function hideOrbitNodes(orbitEl) {
    orbitEl.querySelectorAll(".behavior-radial__node").forEach((node) => {
      node.classList.remove("is-visible");
      node.classList.remove("is-active");
      node.style.transitionDelay = "0ms";
    });
  }

  function clearActiveCategoryNodes(orbitEl) {
    orbitEl.querySelectorAll(".behavior-radial__node.is-active").forEach((node) => {
      node.classList.remove("is-active");
    });
  }

  function positionNode(node, angleRadians, radius) {
    const center = 140;
    const x = center + Math.cos(angleRadians) * radius;
    const y = center + Math.sin(angleRadians) * radius;

    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
  }

  function distributeArc(startDeg, endDeg, count) {
    if (count <= 0) return [];
    if (count === 1) return [toRadians((startDeg + endDeg) / 2)];

    const result = [];
    const step = (endDeg - startDeg) / (count - 1);

    for (let i = 0; i < count; i++) {
      result.push(toRadians(startDeg + step * i));
    }

    return result;
  }

  function distributeLocalBehaviorArc(sourceAngle, count) {
    if (count <= 0) return [];
    if (count === 1) return [sourceAngle];

    const outwardOffset = toRadians(22);

    const spreadDeg =
      count === 2 ? 24 :
      count === 3 ? 36 :
      count === 4 ? 48 :
      count === 5 ? 60 : 72;

    const start = (sourceAngle + outwardOffset) - toRadians(spreadDeg / 2);
    const end = (sourceAngle + outwardOffset) + toRadians(spreadDeg / 2);

    const result = [];
    const step = (end - start) / (count - 1);

    for (let i = 0; i < count; i++) {
      result.push(start + step * i);
    }

    return result;
  }

  function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  function showToast(state, message) {
    const toast = state.ui.toast;
    toast.textContent = message;
    toast.classList.add("is-visible");

    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 1500);
  }

  function teardown(state) {
    document.removeEventListener("click", state.outsideClickHandler);
    document.removeEventListener("keydown", state.keyHandler);
    state.mountEl.innerHTML = "";
  }

  window.initBehaviorRadial = initBehaviorRadial;
})();