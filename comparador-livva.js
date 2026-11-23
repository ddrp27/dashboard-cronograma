(function () {
  "use strict";

  const SUPABASE_URL = "https://hrncxwfvupbvozazxdnw.supabase.co";
  const SUPABASE_KEY = "sb_publishable_ujFYyY_rS10N9LOSiw7g5A_J4oqhB_8";

  const DATA = window.LIVVA_COMPARE_DATA;
  if (!DATA) {
    console.error("No se encontró window.LIVVA_COMPARE_DATA.");
    return;
  }

  const TODAY_STR = new Date().toISOString().slice(0, 10);
  const MONTHS_ES = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
  ];
  const MONTHS_SHORT_ES = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
  ];
  const DAYS_ES = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];

  const DEFAULT_NAL_CAMPAIGNS = ["NAL_202710", "NAL_202711", "NAL_202712"];
  const DEFAULT_ADV_CAMPAIGNS = ["ADV_202708", "ADV_202709", "ADV_202710"];

  const state = {
    scope: "livva", // "livva" | "all_livva"
    mode: "nal", // "nal" | "adv"
    view: "calendar", // "calendar" | "table"
    selectedCampaignIds: new Set(DEFAULT_NAL_CAMPAIGNS),
    selectedCampaignYear: "ALL",
    selectedActivityUids: new Set(),
    onlyChanges: false,
    loadSupabaseEvents: false, // DESACTIVADO POR DEFECTO
    supabaseEvents: [],
    supabaseLoaded: false,
    searchQuery: "",
    calShowAllMonths: true,
    calCurrentMonthIndex: 0,
    drawerExpandedAreas: new Set(["Aglab"]),
    drawerExpandedProcs: new Set(),
  };

  let sbClient = null;

  /* ==========================================================================
     DOM REFS
     ========================================================================== */
  const els = {
    activeCampaignsPills: document.getElementById("cmpActiveCampaignsPills"),
    btnCampaigns: document.getElementById("cmpBtnCampaigns"),
    campaignCountBadge: document.getElementById("cmpCampaignCountBadge"),
    campaignSelectedCountLabel: document.getElementById("cmpCampaignSelectedCountLabel"),
    campaignDropdown: document.getElementById("cmpCampaignDropdown"),
    campaignSelectList: document.getElementById("cmpCampaignSelectList"),
    btnCampAll: document.getElementById("cmpBtnCampAll"),
    btnCampNone: document.getElementById("cmpBtnCampNone"),
    yearTabs: document.querySelectorAll("#cmpYearTabs .year-tab"),

    scopeBtns: document.querySelectorAll("#cmpScopeGroup .compare-mode-btn"),
    modeBtns: document.querySelectorAll("#cmpModeGroup .compare-mode-btn"),

    btnOpenDrawer: document.getElementById("cmpBtnOpenDrawer"),
    filterActiveBadge: document.getElementById("cmpFilterActiveBadge"),
    chkOnlyChanges: document.getElementById("cmpChkOnlyChanges"),
    onlyChangesWrap: document.getElementById("cmpOnlyChangesWrap"),
    chkSupabase: document.getElementById("cmpChkSupabase"),
    supabaseWrap: document.getElementById("cmpSupabaseWrap"),
    supabaseStatus: document.getElementById("cmpSupabaseStatus"),
    legendSupabase: document.getElementById("cmpLegendSupabase"),
    searchInput: document.getElementById("cmpSearchInput"),

    viewTabs: document.querySelectorAll(".view-tabs .tab-btn"),
    calNavControls: document.getElementById("cmpCalNavControls"),
    btnToday: document.getElementById("cmpBtnToday"),
    btnPrevMonth: document.getElementById("cmpBtnPrevMonth"),
    btnNextMonth: document.getElementById("cmpBtnNextMonth"),
    calMonthLabel: document.getElementById("cmpCalMonthLabel"),
    chkAllMonths: document.getElementById("cmpChkAllMonths"),

    kpiActivities: document.getElementById("kpiActivities"),
    kpiActivitiesSub: document.getElementById("kpiActivitiesSub"),
    kpiPairs: document.getElementById("kpiPairs"),
    kpiPairsSub: document.getElementById("kpiPairsSub"),
    kpiChanged: document.getElementById("kpiChanged"),
    kpiChangedSub: document.getElementById("kpiChangedSub"),
    kpiAvgDelta: document.getElementById("kpiAvgDelta"),
    kpiAvgDeltaSub: document.getElementById("kpiAvgDeltaSub"),

    drawerBackdrop: document.getElementById("cmpDrawerBackdrop"),
    drawer: document.getElementById("cmpDrawer"),
    btnCloseDrawer: document.getElementById("cmpBtnCloseDrawer"),
    btnDrawerApply: document.getElementById("cmpBtnDrawerApply"),
    btnDrawerAll: document.getElementById("cmpBtnDrawerAll"),
    btnDrawerClear: document.getElementById("cmpBtnDrawerClear"),
    btnExpandAll: document.getElementById("cmpBtnExpandAll"),
    btnCollapseAll: document.getElementById("cmpBtnCollapseAll"),
    drawerSearch: document.getElementById("cmpDrawerSearch"),
    drawerTree: document.getElementById("cmpDrawerTree"),
    drawerStatsActive: document.getElementById("cmpDrawerStatsActive"),
    drawerStatsTotal: document.getElementById("cmpDrawerStatsTotal"),

    calendarWrapper: document.getElementById("cmpCalendarWrapper"),
    calendarContainer: document.getElementById("cmpCalendarContainer"),
    tableWrapper: document.getElementById("cmpTableWrapper"),
    tableBody: document.getElementById("cmpTableBody"),
    tooltip: document.getElementById("cmpTooltip"),
    footerMeta: document.getElementById("cmpFooterMeta"),
  };

  /* ==========================================================================
     HELPERS
     ========================================================================== */
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatHumanDate(ymd) {
    if (!ymd) return "—";
    const parts = ymd.split("-");
    if (parts.length !== 3) return ymd;
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${parseInt(parts[2], 10)} ${MONTHS_SHORT_ES[mIdx] || parts[1]} ${parts[0]}`;
  }

  function getAreaDisplayName(area) {
    const lower = String(area || "").toLowerCase();
    if (lower === "aglab") return "🎨 AG LAB (Diseño Textil y Moda)";
    if (lower === "disgraf") return "📐 DisGraf (Diseño Gráfico)";
    if (lower === "ingenieria") return "⚙️ Patronaje e Ingeniería";
    if (lower === "mercadeo") return "📢 Mercadeo";
    if (lower === "produccion" || lower === "producción") return "🏭 Producción";
    if (lower === "star trading") return "🌐 Star Trading";
    if (lower === "planeacion estrategica" || lower === "planeación estratégica") return "📊 Planeación Estratégica";
    if (lower === "ventas") return "💼 Ventas y Facturación";
    if (lower === "compras" || lower.includes("compra")) return "📦 Compras";
    if (lower === "calidad") return "🔍 Calidad";
    if (lower === "ciencia de datos") return "📈 Ciencia de Datos";
    if (lower === "proveedor") return "🤝 Proveedor";
    if (lower.includes("logistica")) return "✈️ Logística Internacional";
    if (lower.startsWith("suministro")) return "📦 Suministros";
    if (lower.startsWith("ing peru")) return "⚙️ Ing Perú";
    return area || "Sin Área";
  }

  function getActiveCampaignPool() {
    return state.mode === "nal" ? DATA.campaignsNal : DATA.campaignsAdv;
  }

  function getScopedActivities() {
    if (state.scope === "livva") {
      return DATA.activities.filter((a) => a.marca === "Livva");
    }
    return DATA.activities;
  }

  function getActNoLabel(act) {
    if (act.noOct !== null && act.noNov !== null) {
      if (act.noOct === act.noNov) return `#${act.noNov}`;
      return `#${act.noOct}→#${act.noNov}`;
    }
    if (act.noNov !== null) return `#${act.noNov} (Nueva)`;
    return `#${act.noOct}`;
  }

  function getDeltaDisplay(pair) {
    if (!pair.oct && pair.nov) return { text: "Nueva", cls: "new-act" };
    if (pair.oct && !pair.nov) return { text: "Solo Oct", cls: "same" };
    if (pair.delta === 0) return { text: "Igual", cls: "same" };
    if (pair.delta > 0) return { text: `+${pair.delta}d`, cls: "pos" };
    return { text: `${pair.delta}d`, cls: "neg" };
  }

  function initDefaultSelectedActivities() {
    state.selectedActivityUids.clear();
    const scoped = getScopedActivities();
    for (const act of scoped) {
      if (String(act.area).toLowerCase() === "aglab") {
        state.selectedActivityUids.add(act.uid);
      }
    }
  }

  /* ==========================================================================
     OPTIONAL SUPABASE LOADER (SOLO SI EL USUARIO ACTIVA EL CHECKBOX)
     ========================================================================== */
  async function loadSupabaseCustomEventsIfNeeded() {
    if (!state.loadSupabaseEvents) return;
    if (state.supabaseLoaded) return;

    if (els.supabaseStatus) els.supabaseStatus.textContent = "Cargando...";
    try {
      if (!sbClient && window.supabase && typeof window.supabase.createClient === "function") {
        sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      }
      if (!sbClient) throw new Error("Cliente Supabase no disponible");

      const { data, error } = await sbClient
        .from("custom_events")
        .select("*")
        .order("date", { ascending: true });

      if (error) throw error;

      state.supabaseEvents = Array.isArray(data) ? data : [];
      state.supabaseLoaded = true;
      if (els.supabaseStatus) els.supabaseStatus.textContent = `(${state.supabaseEvents.length})`;
    } catch (err) {
      console.warn("No se pudieron cargar eventos extra de Supabase:", err);
      if (els.supabaseStatus) els.supabaseStatus.textContent = "(Error)";
    }
  }

  /* ==========================================================================
     CAMPAIGN SELECTOR & PILLS
     ========================================================================== */
  function renderCampaignPills() {
    const pool = getActiveCampaignPool();
    const selected = pool.filter((c) => state.selectedCampaignIds.has(c.id));
    els.campaignCountBadge.textContent = selected.length;
    if (els.campaignSelectedCountLabel) {
      els.campaignSelectedCountLabel.textContent = `${selected.length} seleccionada${selected.length === 1 ? "" : "s"}`;
    }

    els.activeCampaignsPills.innerHTML = "";
    const maxVisible = 3;
    selected.slice(0, maxVisible).forEach((c) => {
      const pill = document.createElement("span");
      pill.className = "active-camp-pill";
      pill.title = c.fullLabel;
      pill.innerHTML = `<span>${escapeHtml(c.shortLabel)}</span><button type="button" class="remove-camp-x" data-cid="${c.id}" title="Quitar campaña">×</button>`;
      pill.querySelector(".remove-camp-x").addEventListener("click", (e) => {
        e.stopPropagation();
        state.selectedCampaignIds.delete(c.id);
        renderCampaignPills();
        renderCampaignList();
        renderAll();
      });
      els.activeCampaignsPills.appendChild(pill);
    });

    if (selected.length > maxVisible) {
      const more = document.createElement("span");
      more.className = "active-camp-pill";
      more.style.background = "#f1f5f9";
      more.style.borderColor = "#cbd5e1";
      more.style.color = "#475569";
      more.textContent = `+${selected.length - maxVisible} más`;
      els.activeCampaignsPills.appendChild(more);
    }
  }

  function renderCampaignList() {
    const pool = getActiveCampaignPool();
    const filtered = pool.filter((c) => {
      if (state.selectedCampaignYear === "ALL") return true;
      return String(c.year) === String(state.selectedCampaignYear);
    });

    els.campaignSelectList.innerHTML = "";
    for (const c of filtered) {
      const isChecked = state.selectedCampaignIds.has(c.id);
      const item = document.createElement("label");
      item.className = `multi-option-item ${isChecked ? "is-checked" : ""}`;
      item.title = c.fullLabel;
      item.innerHTML = `
        <input type="checkbox" ${isChecked ? "checked" : ""} data-cid="${c.id}" />
        <div style="display:flex;flex-direction:column;gap:1px;min-width:0">
          <span style="font-weight:700;font-size:12px">${escapeHtml(c.shortLabel)}</span>
          <span style="font-size:10px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${
            state.mode === "nal"
              ? `Oct ADV ${c.octAdv} → Nov ADV ${c.novAdv}`
              : `Oct NAL ${c.nalOct} | Nov Livva ${c.nalLivvaNov || "—"}`
          }</span>
        </div>
      `;
      item.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checked) state.selectedCampaignIds.add(c.id);
        else state.selectedCampaignIds.delete(c.id);
        item.classList.toggle("is-checked", e.target.checked);
        renderCampaignPills();
        renderAll();
      });
      els.campaignSelectList.appendChild(item);
    }
  }

  /* ==========================================================================
     HIERARCHICAL ACTIVITY FILTER DRAWER (Área ➔ Proceso ➔ Actividades)
     ========================================================================== */
  function updateFilterBadge() {
    const scoped = getScopedActivities();
    const scopedUidSet = new Set(scoped.map((a) => a.uid));
    let activeCount = 0;
    state.selectedActivityUids.forEach((uid) => {
      if (scopedUidSet.has(uid)) activeCount++;
    });

    if (els.filterActiveBadge) {
      els.filterActiveBadge.textContent =
        activeCount === scoped.length ? `Todas (${activeCount})` : `${activeCount} act.`;
    }
    if (els.drawerStatsActive) {
      els.drawerStatsActive.innerHTML = `<strong>${activeCount}</strong> activas`;
    }
    if (els.drawerStatsTotal) {
      els.drawerStatsTotal.textContent = `${scoped.length} actividades ${state.scope === "livva" ? "Livva" : "Livva + Azz Livv"}`;
    }
  }

  function renderDrawerHierarchy() {
    const scoped = getScopedActivities();
    const q = (els.drawerSearch ? els.drawerSearch.value : "").trim().toLowerCase();

    const areaMap = new Map();
    for (const act of scoped) {
      if (!areaMap.has(act.area)) areaMap.set(act.area, new Map());
      const procMap = areaMap.get(act.area);
      if (!procMap.has(act.proceso)) procMap.set(act.proceso, []);
      procMap.get(act.proceso).push(act);
    }

    const sortedAreas = Array.from(areaMap.keys()).sort((a, b) => {
      const order = { aglab: 1, disgraf: 2, ingenieria: 3 };
      const oa = order[String(a).toLowerCase()] || 99;
      const ob = order[String(b).toLowerCase()] || 99;
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b, "es");
    });

    els.drawerTree.innerHTML = "";
    let totalMatches = 0;

    for (const area of sortedAreas) {
      const procMap = areaMap.get(area);
      const allAreaActs = [];
      procMap.forEach((acts) => allAreaActs.push(...acts));

      let areaHasMatches = false;
      const matchingProcs = [];

      for (const [proc, acts] of procMap.entries()) {
        const filteredActs = acts.filter((act) => {
          if (!q) return true;
          return (
            String(act.noOct || "").includes(q) ||
            String(act.noNov || "").includes(q) ||
            act.actividad.toLowerCase().includes(q) ||
            act.proceso.toLowerCase().includes(q) ||
            act.area.toLowerCase().includes(q) ||
            act.marca.toLowerCase().includes(q)
          );
        });
        if (filteredActs.length > 0) {
          areaHasMatches = true;
          totalMatches += filteredActs.length;
          matchingProcs.push({ proc, acts: filteredActs });
        }
      }

      if (q && !areaHasMatches) continue;

      const areaSelectedCount = allAreaActs.filter((a) => state.selectedActivityUids.has(a.uid)).length;
      const isAreaAll = areaSelectedCount === allAreaActs.length && allAreaActs.length > 0;
      const isAreaSome = areaSelectedCount > 0 && areaSelectedCount < allAreaActs.length;
      const isAreaOpen = q ? true : state.drawerExpandedAreas.has(area);

      const areaGroup = document.createElement("div");
      areaGroup.className = `drawer-area-group ${isAreaOpen ? "open" : ""} ${areaSelectedCount > 0 ? "has-selected" : ""}`;

      const areaId = `cmp-chk-area-${area.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const areaHeader = document.createElement("div");
      areaHeader.className = "drawer-area-header";
      areaHeader.innerHTML = `
        <span class="drawer-chevron">▶</span>
        <input type="checkbox" id="${areaId}" style="cursor:pointer" ${isAreaAll ? "checked" : ""} />
        <label for="${areaId}" class="drawer-area-title" style="cursor:pointer">
          <span>${getAreaDisplayName(area)}</span>
        </label>
        <span class="drawer-area-count">${areaSelectedCount}/${allAreaActs.length}</span>
        <button type="button" class="drawer-area-only-btn">Solo esta</button>
      `;

      const areaChk = areaHeader.querySelector(`#${areaId}`);
      if (isAreaSome) areaChk.indeterminate = true;

      areaChk.addEventListener("click", (e) => {
        e.stopPropagation();
        const checked = areaChk.checked;
        for (const a of allAreaActs) {
          if (checked) state.selectedActivityUids.add(a.uid);
          else state.selectedActivityUids.delete(a.uid);
        }
        updateFilterBadge();
        renderDrawerHierarchy();
        renderAll();
      });

      areaHeader.querySelector(".drawer-area-only-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        state.selectedActivityUids.clear();
        for (const a of allAreaActs) state.selectedActivityUids.add(a.uid);
        updateFilterBadge();
        renderDrawerHierarchy();
        renderAll();
      });

      areaHeader.addEventListener("click", (e) => {
        if (e.target === areaChk || e.target.classList.contains("drawer-area-only-btn")) return;
        const isOpen = areaGroup.classList.contains("open");
        if (isOpen) {
          areaGroup.classList.remove("open");
          state.drawerExpandedAreas.delete(area);
        } else {
          areaGroup.classList.add("open");
          state.drawerExpandedAreas.add(area);
        }
      });

      const areaBody = document.createElement("div");
      areaBody.className = "drawer-area-body";

      const procsToRender = q
        ? matchingProcs
        : Array.from(procMap.entries()).map(([proc, acts]) => ({ proc, acts }));

      for (const { proc, acts } of procsToRender) {
        const procKey = `${area}::${proc}`;
        const procSelectedCount = acts.filter((a) => state.selectedActivityUids.has(a.uid)).length;
        const isProcAll = procSelectedCount === acts.length && acts.length > 0;
        const isProcSome = procSelectedCount > 0 && procSelectedCount < acts.length;
        const isProcOpen = q ? true : (state.drawerExpandedProcs.has(procKey) || (area === "Aglab" && acts.length <= 6));

        const procGroup = document.createElement("div");
        procGroup.className = `drawer-proc-group ${isProcOpen ? "open" : ""} ${procSelectedCount > 0 ? "has-selected" : ""}`;

        const procChkId = `cmp-chk-proc-${procKey.replace(/[^a-zA-Z0-9]/g, "_")}`;
        const procHeader = document.createElement("div");
        procHeader.className = "drawer-proc-header";
        procHeader.innerHTML = `
          <span class="drawer-proc-chevron">▶</span>
          <input type="checkbox" id="${procChkId}" style="cursor:pointer" ${isProcAll ? "checked" : ""} />
          <label for="${procChkId}" class="drawer-proc-title" style="cursor:pointer">
            <span>${escapeHtml(proc)}</span>
          </label>
          <span class="drawer-proc-count">${procSelectedCount}/${acts.length}</span>
        `;

        const procChk = procHeader.querySelector(`#${procChkId}`);
        if (isProcSome) procChk.indeterminate = true;

        procChk.addEventListener("click", (e) => {
          e.stopPropagation();
          const checked = procChk.checked;
          for (const a of acts) {
            if (checked) state.selectedActivityUids.add(a.uid);
            else state.selectedActivityUids.delete(a.uid);
          }
          updateFilterBadge();
          renderDrawerHierarchy();
          renderAll();
        });

        procHeader.addEventListener("click", (e) => {
          if (e.target === procChk) return;
          const isOpen = procGroup.classList.contains("open");
          if (isOpen) {
            procGroup.classList.remove("open");
            state.drawerExpandedProcs.delete(procKey);
          } else {
            procGroup.classList.add("open");
            state.drawerExpandedProcs.add(procKey);
          }
        });

        const procBody = document.createElement("div");
        procBody.className = "drawer-proc-body";

        for (const act of acts) {
          const checked = state.selectedActivityUids.has(act.uid);
          const actItem = document.createElement("div");
          actItem.className = "drawer-act-item";
          const actId = `cmp-chk-act-${act.uid}`;
          const brandClass = act.marca === "Livva" ? "Livva" : "AzzLivv";

          actItem.innerHTML = `
            <input type="checkbox" id="${actId}" ${checked ? "checked" : ""} />
            <label for="${actId}" style="display:flex;align-items:flex-start;gap:8px;flex:1;cursor:pointer">
              <span class="drawer-act-no">${escapeHtml(getActNoLabel(act))}</span>
              <span class="drawer-act-brand ${brandClass}">${escapeHtml(act.marca)}</span>
              <span class="drawer-act-title">${escapeHtml(act.actividad)}</span>
              <span class="drawer-act-dh">${act.dias} DH</span>
            </label>
          `;

          actItem.querySelector("input").addEventListener("change", (e) => {
            if (e.target.checked) state.selectedActivityUids.add(act.uid);
            else state.selectedActivityUids.delete(act.uid);
            updateFilterBadge();
            renderDrawerHierarchy();
            renderAll();
          });

          procBody.appendChild(actItem);
        }

        procGroup.appendChild(procHeader);
        procGroup.appendChild(procBody);
        areaBody.appendChild(procGroup);
      }

      areaGroup.appendChild(areaHeader);
      areaGroup.appendChild(areaBody);
      els.drawerTree.appendChild(areaGroup);
    }

    if (totalMatches === 0 && q) {
      els.drawerTree.innerHTML = `<div style="padding:24px;text-align:center;color:#64748b;font-size:12.5px">No se encontraron actividades que coincidan con "<strong>${escapeHtml(q)}</strong>".</div>`;
    }
  }

  function applyDrawerPreset(preset) {
    const scoped = getScopedActivities();
    if (preset === "clear") {
      state.selectedActivityUids.clear();
    } else if (preset === "all") {
      for (const a of scoped) state.selectedActivityUids.add(a.uid);
    } else {
      for (const a of scoped) {
        const lower = String(a.area).toLowerCase();
        if (preset === "aglab" && lower === "aglab") state.selectedActivityUids.add(a.uid);
        else if (preset === "disgraf" && lower === "disgraf") state.selectedActivityUids.add(a.uid);
        else if (preset === "ingenieria" && lower === "ingenieria") state.selectedActivityUids.add(a.uid);
      }
    }
    updateFilterBadge();
    renderDrawerHierarchy();
    renderAll();
  }

  /* ==========================================================================
     COMPUTE FILTERED COMPARISON PAIRS
     ========================================================================== */
  function getComparisonPairs() {
    const pool = getActiveCampaignPool();
    const activeCamps = pool.filter((c) => state.selectedCampaignIds.has(c.id));
    const scoped = getScopedActivities();
    const q = state.searchQuery.trim().toLowerCase();

    const pairs = [];
    const activeActUids = new Set();

    for (const act of scoped) {
      if (!state.selectedActivityUids.has(act.uid)) continue;
      if (q) {
        const hay = `${act.noOct || ""} ${act.noNov || ""} ${act.actividad} ${act.proceso} ${act.area} ${act.marca}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      const dateMap = state.mode === "nal" ? act.datesNal : act.datesAdv;
      for (const camp of activeCamps) {
        const d = dateMap[camp.id];
        if (!d) continue;
        const isChanged = d.delta !== 0 || !d.oct || !d.nov;
        if (state.onlyChanges && !isChanged) continue;

        activeActUids.add(act.uid);
        pairs.push({
          act,
          camp,
          oct: d.oct,
          nov: d.nov,
          delta: d.delta,
          isChanged,
        });
      }
    }

    return { pairs, activeCamps, activeActCount: activeActUids.size };
  }

  /* ==========================================================================
     KPI STRIP
     ========================================================================== */
  function renderKpis(pairs, activeActCount, activeCamps) {
    const changedPairs = pairs.filter((p) => p.isChanged);
    const numericDeltas = pairs.map((p) => p.delta).filter((v) => typeof v === "number");
    const avgDelta = numericDeltas.length > 0
      ? (numericDeltas.reduce((acc, v) => acc + v, 0) / numericDeltas.length)
      : 0;

    els.kpiActivities.textContent = activeActCount;
    els.kpiActivitiesSub.textContent = `${state.scope === "livva" ? "Solo Livva" : "Livva + Azz Livv"} · ${activeCamps.length} camp.`;

    els.kpiPairs.textContent = pairs.length;
    els.kpiPairsSub.textContent = state.mode === "nal" ? "Cruce por NAL Livva" : "Cruce por Columna ADV";

    els.kpiChanged.textContent = changedPairs.length;
    const pct = pairs.length > 0 ? Math.round((changedPairs.length / pairs.length) * 100) : 0;
    els.kpiChangedSub.textContent = `${pct}% del filtro actual`;

    const sign = avgDelta > 0 ? "+" : "";
    els.kpiAvgDelta.textContent = `${sign}${avgDelta.toFixed(1)}d`;
    els.kpiAvgDeltaSub.textContent =
      state.mode === "nal"
        ? "Desplazamiento por pasar a Solo NAL"
        : "Variación dentro de misma col. ADV";
  }

  /* ==========================================================================
     RENDER CALENDAR VIEW (OCT = GRIS | NOV = AZUL ÍNDIGO)
     ========================================================================== */
  let visibleMonthsCache = [];

  function renderCalendar(pairs, activeCamps) {
    const byDate = new Map();
    const monthSet = new Set();

    function pushItem(ymd, item) {
      if (!ymd) return;
      if (!byDate.has(ymd)) byDate.set(ymd, []);
      byDate.get(ymd).push(item);
      monthSet.add(ymd.slice(0, 7));
    }

    for (const pair of pairs) {
      if (pair.oct && pair.oct.end) {
        pushItem(pair.oct.end, { kind: "oct", pair });
      }
      if (pair.nov && pair.nov.end) {
        pushItem(pair.nov.end, { kind: "nov", pair });
      }
    }

    // Optional Supabase custom events (ONLY if enabled)
    if (state.loadSupabaseEvents && state.supabaseEvents.length > 0) {
      const q = state.searchQuery.trim().toLowerCase();
      for (const ev of state.supabaseEvents) {
        const ymd = ev.date || ev.end_date || ev.start_date;
        if (!ymd) continue;
        if (q) {
          const hay = `${ev.title || ""} ${ev.area || ""} ${ev.notes || ""}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }
        pushItem(ymd.slice(0, 10), { kind: "supabase", ev });
      }
    }

    visibleMonthsCache = Array.from(monthSet).sort();

    if (visibleMonthsCache.length === 0) {
      els.calMonthLabel.textContent = "Sin fechas";
      els.calendarContainer.innerHTML = `
        <div class="empty-calendar-state" style="padding:48px 24px;text-align:center;color:#64748b">
          <div style="font-size:32px;margin-bottom:8px">📅</div>
          <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px">No hay fechas para mostrar con los filtros actuales</div>
          <div style="font-size:12.5px">Selecciona al menos una campaña y activa actividades desde <strong>Filtrar Actividades y Procesos</strong>.</div>
        </div>
      `;
      return;
    }

    if (state.calCurrentMonthIndex >= visibleMonthsCache.length) {
      state.calCurrentMonthIndex = 0;
    }

    const monthsToRender = state.calShowAllMonths
      ? visibleMonthsCache
      : [visibleMonthsCache[state.calCurrentMonthIndex]];

    if (state.calShowAllMonths) {
      els.calMonthLabel.textContent = `Todos los meses (${visibleMonthsCache.length})`;
    } else {
      const [yr, mo] = visibleMonthsCache[state.calCurrentMonthIndex].split("-");
      els.calMonthLabel.textContent = `${MONTHS_ES[parseInt(mo, 10) - 1]} ${yr} (${state.calCurrentMonthIndex + 1}/${visibleMonthsCache.length})`;
    }

    const htmlParts = [];
    for (const ym of monthsToRender) {
      const [yrStr, moStr] = ym.split("-");
      const yr = parseInt(yrStr, 10);
      const mo = parseInt(moStr, 10) - 1;

      const firstDay = new Date(yr, mo, 1);
      const lastDay = new Date(yr, mo + 1, 0);
      const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0
      const daysInMonth = lastDay.getDate();
      const prevMonthLastDay = new Date(yr, mo, 0).getDate();

      // Count events in this month
      let monthOctCount = 0;
      let monthNovCount = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const ymd = `${yrStr}-${moStr}-${String(d).padStart(2, "0")}`;
        const items = byDate.get(ymd) || [];
        for (const it of items) {
          if (it.kind === "oct") monthOctCount++;
          else if (it.kind === "nov") monthNovCount++;
        }
      }

      // Build weeks (7 days Mon-Sun)
      const weeks = [];
      let currentWeek = [];
      for (let p = startDow - 1; p >= 0; p--) {
        const dayNum = prevMonthLastDay - p;
        const prevDt = new Date(yr, mo - 1, dayNum, 12, 0, 0);
        const ymd = `${prevDt.getFullYear()}-${String(prevDt.getMonth() + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        currentWeek.push({ dayNum, ymd, isOtherMonth: true });
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const ymd = `${yrStr}-${moStr}-${String(d).padStart(2, "0")}`;
        currentWeek.push({ dayNum: d, ymd, isOtherMonth: false });
        if (currentWeek.length === 7) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }
      if (currentWeek.length > 0) {
        let nextDay = 1;
        while (currentWeek.length < 7) {
          const nextDt = new Date(yr, mo + 1, nextDay, 12, 0, 0);
          const ymd = `${nextDt.getFullYear()}-${String(nextDt.getMonth() + 1).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
          currentWeek.push({ dayNum: nextDay, ymd, isOtherMonth: true });
          nextDay++;
        }
        weeks.push(currentWeek);
      }

      const rowsHtml = [];
      for (const week of weeks) {
        const cellsHtml = [];
        for (const cell of week) {
          const isToday = cell.ymd === TODAY_STR;
          const items = cell.isOtherMonth ? [] : (byDate.get(cell.ymd) || []);

          items.sort((a, b) => {
            const ord = { nov: 1, oct: 2, supabase: 3 };
            return (ord[a.kind] || 9) - (ord[b.kind] || 9);
          });

          let cardsHtml = "";
          for (const it of items) {
            if (it.kind === "oct" || it.kind === "nov") {
              const { act, camp, oct, nov, delta } = it.pair;
              const isNov = it.kind === "nov";
              const cardCls = isNov ? "cal-compare-nov" : "cal-compare-oct";
              const tagCls = isNov ? "tag-nov" : "tag-oct";
              const tagTxt = isNov ? "NOV" : "OCT";
              const dInfo = getDeltaDisplay(it.pair);
              const deltaChip = isNov
                ? `<span class="compare-delta-chip ${dInfo.cls}">${dInfo.text}</span>`
                : "";

              cardsHtml += `
                <div class="calendar-event-card ${cardCls}"
                  data-tip-kind="${it.kind}"
                  data-tip-no="${escapeHtml(getActNoLabel(act))}"
                  data-tip-title="${escapeHtml(act.actividad)}"
                  data-tip-area="${escapeHtml(act.area)}"
                  data-tip-proc="${escapeHtml(act.proceso)}"
                  data-tip-marca="${escapeHtml(act.marca)}"
                  data-tip-camp="${escapeHtml(camp.shortLabel)}"
                  data-tip-campfull="${escapeHtml(camp.fullLabel)}"
                  data-tip-oct="${oct ? oct.end : ""}"
                  data-tip-nov="${nov ? nov.end : ""}"
                  data-tip-delta="${delta !== null && delta !== undefined ? delta : ""}"
                  data-tip-dh="${act.dias}">
                  <div class="event-meta-line">
                    <span class="compare-ver-tag ${tagCls}">${tagTxt}</span>
                    <span class="event-camp-badge">${escapeHtml(camp.shortLabel)}</span>
                    ${deltaChip}
                  </div>
                  <div class="event-full-title">
                    <span class="event-act-no">${escapeHtml(getActNoLabel(act))}</span> ${escapeHtml(act.actividad)}
                  </div>
                </div>
              `;
            } else if (it.kind === "supabase") {
              const ev = it.ev;
              cardsHtml += `
                <div class="calendar-event-card cal-compare-sb"
                  data-tip-kind="supabase"
                  data-tip-title="${escapeHtml(ev.title || "Evento extra")}"
                  data-tip-area="${escapeHtml(ev.area || "General")}"
                  data-tip-notes="${escapeHtml(ev.notes || "")}"
                  data-tip-date="${escapeHtml(cell.ymd)}">
                  <div class="event-meta-line">
                    <span class="compare-ver-tag tag-sb">EXTRA</span>
                    <span class="event-camp-badge">${escapeHtml(ev.area || "Supabase")}</span>
                  </div>
                  <div class="event-full-title">${escapeHtml(ev.title || "Evento extra")}</div>
                </div>
              `;
            }
          }

          cellsHtml.push(`
            <td class="calendar-day-cell ${cell.isOtherMonth ? "day-other-month" : ""} ${isToday ? "day-today" : ""}" data-date="${cell.ymd}">
              <div class="day-num-wrap">
                <span class="day-num ${cell.isOtherMonth ? "day-num-other" : ""}">${cell.dayNum}</span>
                ${isToday ? `<span class="today-chip">Hoy</span>` : ""}
              </div>
              <div class="calendar-events-list">${cardsHtml}</div>
            </td>
          `);
        }
        rowsHtml.push(`<tr>${cellsHtml.join("")}</tr>`);
      }

      htmlParts.push(`
        <div class="calendar-month-sheet" data-ym="${ym}">
          <div class="calendar-month-header">
            <div>
              <div class="calendar-month-title">${MONTHS_ES[mo]} ${yr}</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px">
                <span style="color:#475569;font-weight:700">${monthOctCount} hitos Oct (Gris)</span>
                •
                <span style="color:#4338ca;font-weight:700">${monthNovCount} hitos Nov (Azul Índigo)</span>
              </div>
            </div>
            <div class="calendar-campaign-meta">
              <span class="calendar-campaign-badge">${activeCamps.length} campañas seleccionadas</span>
              <span class="calendar-campaign-sub">COMPARATIVO LIVVA — 19 Oct vs 18 Nov</span>
            </div>
          </div>
          <table class="calendar-grid-table">
            <thead>
              <tr>${DAYS_ES.map((dn) => `<th>${dn}</th>`).join("")}</tr>
            </thead>
            <tbody>${rowsHtml.join("")}</tbody>
          </table>
        </div>
      `);
    }

    els.calendarContainer.innerHTML = htmlParts.join("");
    bindTooltips();
  }

  /* ==========================================================================
     RENDER COMPARISON TABLE VIEW
     ========================================================================== */
  function renderTable(pairs) {
    if (pairs.length === 0) {
      els.tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:36px;color:#64748b">
            No hay filas para comparar con los filtros actuales.
          </td>
        </tr>
      `;
      return;
    }

    const sorted = [...pairs].sort((a, b) => {
      const da = (a.nov && a.nov.end) || (a.oct && a.oct.end) || "";
      const db = (b.nov && b.nov.end) || (b.oct && b.oct.end) || "";
      if (da !== db) return da.localeCompare(db);
      return (a.act.noNov || a.act.noOct || 0) - (b.act.noNov || b.act.noOct || 0);
    });

    const rows = sorted.map((pair) => {
      const { act, camp, oct, nov } = pair;
      const dInfo = getDeltaDisplay(pair);
      const brandClass = act.marca === "Livva" ? "Livva" : "AzzLivv";
      return `
        <tr>
          <td><strong>${escapeHtml(getActNoLabel(act))}</strong></td>
          <td><span class="drawer-act-brand ${brandClass}">${escapeHtml(act.marca)}</span></td>
          <td style="max-width:340px">${escapeHtml(act.actividad)}</td>
          <td>
            <div style="font-weight:600;color:#0f172a">${escapeHtml(act.area)}</div>
            <div style="font-size:11px;color:#64748b">${escapeHtml(act.proceso)}</div>
          </td>
          <td title="${escapeHtml(camp.fullLabel)}"><strong>${escapeHtml(camp.shortLabel)}</strong></td>
          <td>${act.dias} DH</td>
          <td class="td-oct-date">${oct ? formatHumanDate(oct.end) : "—"}</td>
          <td class="td-nov-date">${nov ? formatHumanDate(nov.end) : "—"}</td>
          <td><span class="delta-pill-lg ${dInfo.cls}">${dInfo.text}</span></td>
        </tr>
      `;
    });

    els.tableBody.innerHTML = rows.join("");
  }

  /* ==========================================================================
     TOOLTIPS
     ========================================================================== */
  function moveTooltip(e) {
    if (!els.tooltip) return;
    const pad = 14;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = els.tooltip.getBoundingClientRect();
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + rect.width > vw - 10) x = e.clientX - rect.width - pad;
    if (y + rect.height > vh - 10) y = e.clientY - rect.height - pad;
    els.tooltip.style.left = `${Math.max(8, x)}px`;
    els.tooltip.style.top = `${Math.max(8, y)}px`;
  }

  function bindTooltips() {
    els.calendarContainer.querySelectorAll(".calendar-event-card").forEach((card) => {
      card.addEventListener("mouseenter", (e) => {
        const kind = card.getAttribute("data-tip-kind");
        if (kind === "supabase") {
          els.tooltip.innerHTML = `
            <h4>☁️ ${card.getAttribute("data-tip-title")}</h4>
            <div class="tooltip-grid">
              <span class="lbl">Origen:</span><span><strong>Evento Extra (Supabase)</strong></span>
              <span class="lbl">Área:</span><span>${card.getAttribute("data-tip-area")}</span>
              <span class="lbl">Fecha:</span><span>${formatHumanDate(card.getAttribute("data-tip-date"))}</span>
              ${card.getAttribute("data-tip-notes") ? `<span class="lbl">Notas:</span><span>${card.getAttribute("data-tip-notes")}</span>` : ""}
            </div>
          `;
        } else {
          const octYmd = card.getAttribute("data-tip-oct");
          const novYmd = card.getAttribute("data-tip-nov");
          const deltaRaw = card.getAttribute("data-tip-delta");
          let deltaTxt = "—";
          if (!octYmd && novYmd) deltaTxt = "Nueva en 18 Nov";
          else if (deltaRaw !== "") {
            const dn = parseInt(deltaRaw, 10);
            deltaTxt = dn === 0 ? "Sin cambio (0d)" : `${dn > 0 ? "+" : ""}${dn} días calendario`;
          }

          els.tooltip.innerHTML = `
            <h4>${card.getAttribute("data-tip-no")} — ${card.getAttribute("data-tip-title")}</h4>
            <div class="tooltip-grid">
              <span class="lbl">Marca / Área:</span><span><strong>${card.getAttribute("data-tip-marca")}</strong> · ${card.getAttribute("data-tip-area")}</span>
              <span class="lbl">Proceso:</span><span>${card.getAttribute("data-tip-proc")}</span>
              <span class="lbl">Campaña:</span><span><strong>${card.getAttribute("data-tip-camp")}</strong></span>
              <span class="lbl">Cruce:</span><span style="font-size:10.5px;color:#94a3b8">${card.getAttribute("data-tip-campfull")}</span>
              <span class="lbl">⬜ Fecha 19 Oct:</span><span style="color:#cbd5e1;font-weight:700">${octYmd ? formatHumanDate(octYmd) : "No existía"}</span>
              <span class="lbl">🟦 Fecha 18 Nov:</span><span style="color:#a5b4fc;font-weight:800">${novYmd ? formatHumanDate(novYmd) : "—"}</span>
              <span class="lbl">Diferencia:</span><span><strong>${deltaTxt}</strong></span>
            </div>
          `;
        }
        els.tooltip.style.display = "block";
        moveTooltip(e);
      });
      card.addEventListener("mousemove", moveTooltip);
      card.addEventListener("mouseleave", () => {
        els.tooltip.style.display = "none";
      });
    });
  }

  /* ==========================================================================
     MASTER RENDER
     ========================================================================== */
  function renderAll() {
    const { pairs, activeCamps, activeActCount } = getComparisonPairs();
    renderKpis(pairs, activeActCount, activeCamps);

    if (state.view === "calendar") {
      els.calendarWrapper.style.display = "block";
      els.tableWrapper.style.display = "none";
      els.calNavControls.style.display = "flex";
      renderCalendar(pairs, activeCamps);
    } else {
      els.calendarWrapper.style.display = "none";
      els.tableWrapper.style.display = "block";
      els.calNavControls.style.display = "none";
      renderTable(pairs);
    }
  }

  /* ==========================================================================
     EVENT LISTENERS
     ========================================================================== */
  function setupListeners() {
    // Campaign dropdown toggle with fixed viewport positioning
    els.btnCampaigns.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !els.campaignDropdown.classList.contains("open");
      els.campaignDropdown.classList.toggle("open", willOpen);
      if (willOpen) {
        const rect = els.btnCampaigns.getBoundingClientRect();
        const dropW = Math.min(460, window.innerWidth - 20);
        const left = Math.max(10, Math.min(rect.left, window.innerWidth - dropW - 10));
        els.campaignDropdown.style.position = "fixed";
        els.campaignDropdown.style.left = `${left}px`;
        els.campaignDropdown.style.top = `${rect.bottom + 6}px`;
        els.campaignDropdown.style.width = `${dropW}px`;
      }
    });
    document.addEventListener("click", (e) => {
      if (!els.campaignDropdown.contains(e.target) && !els.btnCampaigns.contains(e.target)) {
        els.campaignDropdown.classList.remove("open");
      }
    });

    els.btnCampAll.addEventListener("click", () => {
      getActiveCampaignPool().forEach((c) => state.selectedCampaignIds.add(c.id));
      renderCampaignPills();
      renderCampaignList();
      renderAll();
    });
    els.btnCampNone.addEventListener("click", () => {
      state.selectedCampaignIds.clear();
      renderCampaignPills();
      renderCampaignList();
      renderAll();
    });

    els.yearTabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        els.yearTabs.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.selectedCampaignYear = btn.getAttribute("data-year");
        renderCampaignList();
      });
    });

    // Scope toggle (Solo Livva vs Livva + Azz Livv)
    els.scopeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextScope = btn.getAttribute("data-scope");
        if (nextScope === state.scope) return;
        els.scopeBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.scope = nextScope;
        // If AG LAB was active, ensure newly visible AG LAB activities are included cleanly
        if (nextScope === "all_livva") {
          for (const a of DATA.activities) {
            if (String(a.area).toLowerCase() === "aglab") state.selectedActivityUids.add(a.uid);
          }
        }
        updateFilterBadge();
        renderDrawerHierarchy();
        renderAll();
      });
    });

    // Mode toggle (Por NAL Livva vs Por Columna ADV)
    els.modeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextMode = btn.getAttribute("data-mode");
        if (nextMode === state.mode) return;
        els.modeBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.mode = nextMode;
        state.selectedCampaignIds = new Set(
          nextMode === "nal" ? DEFAULT_NAL_CAMPAIGNS : DEFAULT_ADV_CAMPAIGNS
        );
        state.calCurrentMonthIndex = 0;
        renderCampaignPills();
        renderCampaignList();
        renderAll();
      });
    });

    // Drawer open / close
    els.btnOpenDrawer.addEventListener("click", () => {
      els.drawerBackdrop.style.display = "flex";
      renderDrawerHierarchy();
      updateFilterBadge();
      if (els.drawerSearch) setTimeout(() => els.drawerSearch.focus(), 60);
    });
    const closeDrawer = () => {
      els.drawerBackdrop.style.display = "none";
    };
    els.btnCloseDrawer.addEventListener("click", closeDrawer);
    els.btnDrawerApply.addEventListener("click", closeDrawer);
    els.drawerBackdrop.addEventListener("click", (e) => {
      if (e.target === els.drawerBackdrop) closeDrawer();
    });

    // Drawer presets & expand/collapse
    els.drawer.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => applyDrawerPreset(btn.getAttribute("data-preset")));
    });
    els.btnDrawerAll.addEventListener("click", () => applyDrawerPreset("all"));
    els.btnDrawerClear.addEventListener("click", () => applyDrawerPreset("clear"));
    els.drawerSearch.addEventListener("input", renderDrawerHierarchy);

    els.btnExpandAll.addEventListener("click", () => {
      getScopedActivities().forEach((a) => {
        state.drawerExpandedAreas.add(a.area);
        state.drawerExpandedProcs.add(`${a.area}::${a.proceso}`);
      });
      renderDrawerHierarchy();
    });
    els.btnCollapseAll.addEventListener("click", () => {
      state.drawerExpandedAreas.clear();
      state.drawerExpandedProcs.clear();
      renderDrawerHierarchy();
    });

    // Solo cambios toggle
    els.chkOnlyChanges.addEventListener("change", () => {
      state.onlyChanges = els.chkOnlyChanges.checked;
      els.onlyChangesWrap.classList.toggle("active-indigo", state.onlyChanges);
      renderAll();
    });

    // Optional Supabase toggle (DESACTIVADO por defecto)
    els.chkSupabase.addEventListener("change", async () => {
      state.loadSupabaseEvents = els.chkSupabase.checked;
      els.supabaseWrap.classList.toggle("active-green", state.loadSupabaseEvents);
      els.legendSupabase.style.display = state.loadSupabaseEvents ? "inline-flex" : "none";
      if (state.loadSupabaseEvents) {
        await loadSupabaseCustomEventsIfNeeded();
      }
      renderAll();
    });

    // Search input
    els.searchInput.addEventListener("input", () => {
      state.searchQuery = els.searchInput.value;
      renderAll();
    });

    // View tabs
    els.viewTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        els.viewTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        state.view = tab.getAttribute("data-view");
        renderAll();
      });
    });

    // Calendar navigation
    els.chkAllMonths.addEventListener("change", () => {
      state.calShowAllMonths = els.chkAllMonths.checked;
      renderAll();
    });
    els.btnPrevMonth.addEventListener("click", () => {
      if (visibleMonthsCache.length === 0) return;
      state.calShowAllMonths = false;
      els.chkAllMonths.checked = false;
      state.calCurrentMonthIndex = Math.max(0, state.calCurrentMonthIndex - 1);
      renderAll();
    });
    els.btnNextMonth.addEventListener("click", () => {
      if (visibleMonthsCache.length === 0) return;
      state.calShowAllMonths = false;
      els.chkAllMonths.checked = false;
      state.calCurrentMonthIndex = Math.min(visibleMonthsCache.length - 1, state.calCurrentMonthIndex + 1);
      renderAll();
    });
    els.btnToday.addEventListener("click", () => {
      const todayYm = TODAY_STR.slice(0, 7);
      const idx = visibleMonthsCache.indexOf(todayYm);
      if (idx >= 0) {
        if (state.calShowAllMonths) {
          const sheet = els.calendarContainer.querySelector(`.calendar-month-sheet[data-ym="${todayYm}"]`);
          if (sheet) sheet.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          state.calCurrentMonthIndex = idx;
          renderAll();
        }
      } else {
        const nearest = visibleMonthsCache.findIndex((ym) => ym >= todayYm);
        if (nearest >= 0) {
          const ym = visibleMonthsCache[nearest];
          const sheet = els.calendarContainer.querySelector(`.calendar-month-sheet[data-ym="${ym}"]`);
          if (sheet) sheet.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  }

  /* ==========================================================================
     INIT
     ========================================================================== */
  function init() {
    initDefaultSelectedActivities();
    if (els.footerMeta && DATA.generatedAt) {
      els.footerMeta.textContent = `Base: ${DATA.sourceOct} (${DATA.sheetOct}) vs Nuevo: ${DATA.sourceNov} (Hoja '${DATA.sheetNov}') · Actualizado: ${DATA.generatedAt}`;
    }
    renderCampaignPills();
    renderCampaignList();
    updateFilterBadge();
    setupListeners();
    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
