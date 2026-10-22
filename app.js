(function () {
  "use strict";

  /* ==========================================================================
     1. SUPABASE CLOUD & STORAGE CONFIGURATION
     ========================================================================== */
  const SUPABASE_URL = "https://hrncxwfvupbvozazxdnw.supabase.co";
  const SUPABASE_KEY = "sb_publishable_ujFYyY_rS10N9LOSiw7g5A_J4oqhB_8";

  const SESSION_STORAGE_KEY = "AZZORTI_ACTIVE_USER_SESSION_V2";
  const LOCAL_USERS_CACHE_KEY = "AZZORTI_USERS_CACHE_V2";
  const LOCAL_CUSTOM_EVENTS_KEY = "AZZORTI_CUSTOM_EVENTS_CACHE_V2";
  const LOCAL_MASTER_CACHE_KEY = "AZZORTI_CUSTOM_CRONOGRAMA_V1";
  const TODAY_STR = new Date().toISOString().slice(0, 10);

  const DEFAULT_CAMPAIGNS = [
    "ADV_202708_NAL_202711",
    "ADV_202709_NAL_202712",
    "ADV_202710_NAL_202713",
  ];

  const TEAM_PROFILES = [
    { id: "MARI", name: "MARI", role: "designer", color: "#ec4899", defaultPin: "1234" },
    { id: "BRY", name: "BRY", role: "designer", color: "#8b5cf6", defaultPin: "1234" },
    { id: "JOHA", name: "JOHA", role: "designer", color: "#06b6d4", defaultPin: "1234" },
    { id: "YEYE", name: "YEYE", role: "designer", color: "#10b981", defaultPin: "1234" },
    { id: "CARO", name: "CARO", role: "designer", color: "#f59e0b", defaultPin: "1234" },
    { id: "CATA", name: "CATA", role: "designer", color: "#6366f1", defaultPin: "1234" },
    { id: "LAU A", name: "LAU A", role: "designer", color: "#f43f5e", defaultPin: "1234" },
    { id: "LAU L", name: "LAU L", role: "designer", color: "#14b8a6", defaultPin: "1234" },
    { id: "ELI", name: "ELI", role: "designer", color: "#a855f7", defaultPin: "1234" },
    { id: "LEIDY", name: "LEIDY", role: "designer", color: "#3b82f6", defaultPin: "1234" },
    { id: "ANDRE", name: "ANDRE", role: "designer", color: "#eab308", defaultPin: "1234" },
    { id: "DANI", name: "DANI", role: "admin", color: "#d97706", defaultPin: "1234" },
  ];

  const CUSTOM_EVENT_AREAS = [
    "Diseño Textil (Aglab)",
    "Diseño Gráfico (DisGraf)",
    "Desarrollos Moda MO",
    "Patronaje e Ingeniería",
    "Muestras y Taller",
    "Reunión / Fit / Comité",
    "Compras y Suministros",
    "Mercadeo y Ventas",
    "General / Equipo",
  ];

  // Initialize Supabase Client if available
  let sbClient = null;
  try {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
  } catch (err) {
    console.warn("Supabase client init warning:", err);
  }

  /* ==========================================================================
     2. APPLICATION STATE
     ========================================================================== */
  let rawData = null;
  let usersMap = new Map(); // id -> { id, name, role, pin, preferences }
  let customEvents = []; // Array of custom events from cloud

  let state = {
    loggedInUserId: null, // Who logged in (e.g. "MARI" or "DANI")
    targetUserId: null, // Whose calendar we are viewing/editing (same as loggedInUserId, unless DANI selects someone else)
    selectedLoginCandidateId: null,

    // User-persisted preferences (All areas/processes/activities OFF by default on first login!)
    include2026: false,
    selectedCampaignIds: new Set(DEFAULT_CAMPAIGNS),
    selectedActivityNos: new Set(), // Empty by default = ALL official areas/processes OFF
    brand: "ALL",
    includeSharedBrand: true,
    showCustomEvents: true,
    customFilterTags: new Set(), // Empty = show all custom events; otherwise filter by "AREA:..." or "USER:..."

    // UI transient state
    searchQuery: "",
    viewMode: "calendar", // Calendar is the main official view!
    calCurrentMonthIndex: 0,
    calShowAllMonths: true,
    showCatalogInGantt: false,
    groupByProceso: true,
    collapsedGroups: new Set(),
    sortBy: "date",
    zoom: "week",
  };

  let savePrefsTimeout = null;
  const els = {};

  function initDomRefs() {
    // Login Overlay
    els.loginOverlay = document.getElementById("loginOverlay");
    els.loginUsersGrid = document.getElementById("loginUsersGrid");
    els.loginPinForm = document.getElementById("loginPinForm");
    els.loginSelectedAvatar = document.getElementById("loginSelectedAvatar");
    els.loginSelectedName = document.getElementById("loginSelectedName");
    els.loginSelectedRole = document.getElementById("loginSelectedRole");
    els.btnChangeLoginUser = document.getElementById("btnChangeLoginUser");
    els.loginPinInput = document.getElementById("loginPinInput");
    els.chkRememberSession = document.getElementById("chkRememberSession");
    els.loginErrorMsg = document.getElementById("loginErrorMsg");

    // Header & Admin
    els.cloudStatusBadge = document.getElementById("cloudStatusBadge");
    els.statusBadge = document.getElementById("dataStatusBadge");
    els.adminControlBar = document.getElementById("adminControlBar");
    els.adminTargetUserSelect = document.getElementById("adminTargetUserSelect");
    els.btnAdminManagePins = document.getElementById("btnAdminManagePins");
    els.adminEditingBanner = document.getElementById("adminEditingBanner");
    els.adminEditingTargetName = document.getElementById("adminEditingTargetName");
    els.adminEditingTargetName2 = document.getElementById("adminEditingTargetName2");
    els.btnReturnToDani = document.getElementById("btnReturnToDani");

    els.btnOpenAddEvent = document.getElementById("btnOpenAddEvent");
    els.btnExportPdfCalendar = document.getElementById("btnExportPdfCalendar");
    els.btnExportPdfGantt = document.getElementById("btnExportPdfGantt");
    els.btnExportIcs = document.getElementById("btnExportIcs");
    els.btnExportCsv = document.getElementById("btnExportCsv");
    els.fileInput = document.getElementById("excelFileInput");
    els.btnUpload = document.getElementById("btnUploadExcel");
    els.btnResetData = document.getElementById("btnResetData");
    els.btnSwitchUser = document.getElementById("btnSwitchUser");
    els.headerUserAvatar = document.getElementById("headerUserAvatar");
    els.headerUserName = document.getElementById("headerUserName");

    // Filters
    els.chkInclude2026 = document.getElementById("chkInclude2026");
    els.campaignBtn = document.getElementById("campaignDropdownBtn");
    els.campaignDropdown = document.getElementById("campaignDropdown");
    els.campaignSearch = document.getElementById("campaignSearchInput");
    els.campaignList = document.getElementById("campaignOptionsList");
    els.campaignSelectAll = document.getElementById("campaignSelectAll");
    els.campaignSelect2027 = document.getElementById("campaignSelect2027");
    els.campaignSelect2028 = document.getElementById("campaignSelect2028");
    els.campaignClearAll = document.getElementById("campaignClearAll");

    els.areaBtn = document.getElementById("areaDropdownBtn");
    els.areaDropdown = document.getElementById("areaDropdown");
    els.areaSearch = document.getElementById("areaSearchInput");
    els.areaList = document.getElementById("areaOptionsList");
    els.areaSelectAll = document.getElementById("areaSelectAll");
    els.areaClearAll = document.getElementById("areaClearAll");

    els.procesoBtn = document.getElementById("procesoDropdownBtn");
    els.procesoDropdown = document.getElementById("procesoDropdown");
    els.procesoSearch = document.getElementById("procesoSearchInput");
    els.procesoList = document.getElementById("procesoOptionsList");
    els.procesoSelectAll = document.getElementById("procesoSelectAll");
    els.procesoClearAll = document.getElementById("procesoClearAll");

    els.actBtn = document.getElementById("actDropdownBtn");
    els.actDropdown = document.getElementById("actDropdown");
    els.actSearch = document.getElementById("actChecklistSearchInput");
    els.actList = document.getElementById("actOptionsList");
    els.actSelectVisible = document.getElementById("actSelectVisible");
    els.actQuickTextil = document.getElementById("actQuickTextil");
    els.actClearAll = document.getElementById("actClearAll");

    els.chkShowCustomEvents = document.getElementById("chkShowCustomEvents");
    els.customFilterBtn = document.getElementById("customFilterDropdownBtn");
    els.customFilterDropdown = document.getElementById("customFilterDropdown");
    els.customFilterList = document.getElementById("customFilterOptionsList");
    els.customFilterSelectAll = document.getElementById("customFilterSelectAll");
    els.customFilterOnlyMine = document.getElementById("customFilterOnlyMine");
    els.customFilterClear = document.getElementById("customFilterClear");

    els.brandPills = document.querySelectorAll(".brand-pill");
    els.chkSharedBrand = document.getElementById("chkSharedBrand");
    els.sharedBrandWrap = document.getElementById("sharedBrandWrap");
    els.searchInput = document.getElementById("activitySearchInput");

    // Sub-toolbar & Tabs
    els.tabCalendar = document.getElementById("tabCalendar");
    els.tabGantt = document.getElementById("tabGantt");
    els.tabMatrix = document.getElementById("tabMatrix");

    els.calendarToolbarOptions = document.getElementById("calendarToolbarOptions");
    els.btnCalPrevMonth = document.getElementById("btnCalPrevMonth");
    els.btnCalNextMonth = document.getElementById("btnCalNextMonth");
    els.calCurrentMonthLabel = document.getElementById("calCurrentMonthLabel");
    els.chkCalShowAllMonths = document.getElementById("chkCalShowAllMonths");

    els.ganttToolbarOptions = document.getElementById("ganttToolbarOptions");
    els.chkShowCatalogInGantt = document.getElementById("chkShowCatalogInGantt");
    els.chkGroupProceso = document.getElementById("chkGroupProceso");
    els.btnExpandAll = document.getElementById("btnExpandAll");
    els.btnCollapseAll = document.getElementById("btnCollapseAll");
    els.sortSelect = document.getElementById("sortSelect");
    els.zoomSelect = document.getElementById("zoomSelect");
    els.btnCenterGantt = document.getElementById("btnCenterGantt");
    els.chkSelectAllGantt = document.getElementById("chkSelectAllGantt");

    els.kpiActivities = document.getElementById("kpiActivities");
    els.kpiCustomEvents = document.getElementById("kpiCustomEvents");
    els.kpiProcesses = document.getElementById("kpiProcesses");
    els.kpiDateRange = document.getElementById("kpiDateRange");

    // Views
    els.calendarWrapper = document.getElementById("calendarWrapper");
    els.calendarContainer = document.getElementById("calendarContainer");
    els.ganttWrapper = document.getElementById("ganttWrapper");
    els.ganttLeftBody = document.getElementById("ganttLeftBody");
    els.ganttTimelineHeader = document.getElementById("ganttTimelineHeader");
    els.ganttTimelineBody = document.getElementById("ganttTimelineBody");
    els.matrixWrapper = document.getElementById("matrixWrapper");
    els.matrixTableHead = document.getElementById("matrixTableHead");
    els.matrixTableBody = document.getElementById("matrixTableBody");

    // Custom Event Modal
    els.customEventModal = document.getElementById("customEventModal");
    els.customModalTitle = document.getElementById("customModalTitle");
    els.btnCloseCustomModal = document.getElementById("btnCloseCustomModal");
    els.btnCancelCustomModal = document.getElementById("btnCancelCustomModal");
    els.customEventForm = document.getElementById("customEventForm");
    els.evIdInput = document.getElementById("evIdInput");
    els.evTitleInput = document.getElementById("evTitleInput");
    els.evDateInput = document.getElementById("evDateInput");
    els.evDhInput = document.getElementById("evDhInput");
    els.evAreaInput = document.getElementById("evAreaInput");
    els.evOwnerInput = document.getElementById("evOwnerInput");
    els.evMarcaInput = document.getElementById("evMarcaInput");
    els.evCategoryInput = document.getElementById("evCategoryInput");
    els.evNotesInput = document.getElementById("evNotesInput");
    els.btnDeleteCustomEvent = document.getElementById("btnDeleteCustomEvent");

    // Admin PINs Modal
    els.adminPinsModal = document.getElementById("adminPinsModal");
    els.btnCloseAdminPins = document.getElementById("btnCloseAdminPins");
    els.btnCloseAdminPinsFooter = document.getElementById("btnCloseAdminPinsFooter");
    els.adminPinsList = document.getElementById("adminPinsList");
    els.btnSaveAllPins = document.getElementById("btnSaveAllPins");

    els.tooltip = document.getElementById("ganttTooltip");
    els.dropzoneOverlay = document.getElementById("dropzoneOverlay");
  }

  /* ==========================================================================
     3. SUPABASE DATA SYNC (USERS, CUSTOM EVENTS & MASTER SCHEDULE)
     ========================================================================== */
  function setCloudStatus(text, isError) {
    if (!els.cloudStatusBadge) return;
    els.cloudStatusBadge.textContent = text;
    if (isError) {
      els.cloudStatusBadge.style.background = "rgba(244, 63, 94, 0.2)";
      els.cloudStatusBadge.style.color = "#fda4af";
      els.cloudStatusBadge.style.borderColor = "rgba(244, 63, 94, 0.4)";
    } else {
      els.cloudStatusBadge.style.background = "rgba(16, 185, 129, 0.18)";
      els.cloudStatusBadge.style.color = "#6ee7b7";
      els.cloudStatusBadge.style.borderColor = "rgba(16, 185, 129, 0.35)";
    }
  }

  function buildDefaultUserObject(profile) {
    return {
      id: profile.id,
      name: profile.name,
      role: profile.role,
      pin: profile.defaultPin,
      preferences: {
        selectedActivityNos: [], // APAGADAS POR DEFECTO
        selectedCampaignIds: [...DEFAULT_CAMPAIGNS],
        brand: "ALL",
        includeSharedBrand: true,
        include2026: false,
        showCustomEvents: true,
        customFilterTags: [],
      },
    };
  }

  function initLocalUsersMap() {
    usersMap.clear();
    for (const p of TEAM_PROFILES) {
      usersMap.set(p.id, buildDefaultUserObject(p));
    }
    try {
      const cached = localStorage.getItem(LOCAL_USERS_CACHE_KEY);
      if (cached) {
        const arr = JSON.parse(cached);
        if (Array.isArray(arr)) {
          for (const u of arr) {
            if (u && u.id && usersMap.has(u.id)) {
              const base = usersMap.get(u.id);
              usersMap.set(u.id, {
                ...base,
                pin: u.pin || base.pin,
                preferences: { ...base.preferences, ...(u.preferences || {}) },
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn("Cache local users:", e);
    }
  }

  function saveLocalUsersCache() {
    try {
      localStorage.setItem(LOCAL_USERS_CACHE_KEY, JSON.stringify(Array.from(usersMap.values())));
    } catch (e) {
      // ignore
    }
  }

  function saveLocalCustomEventsCache() {
    try {
      localStorage.setItem(LOCAL_CUSTOM_EVENTS_KEY, JSON.stringify(customEvents));
    } catch (e) {
      // ignore
    }
  }

  async function syncFromSupabase() {
    setCloudStatus("☁️ Sincronizando con Supabase...", false);
    try {
      if (!sbClient) throw new Error("Cliente Supabase no inicializado");

      // 1. Fetch app_users
      const { data: usersData, error: usersErr } = await sbClient.from("app_users").select("*");
      if (usersErr) throw usersErr;

      if (usersData && usersData.length > 0) {
        for (const u of usersData) {
          if (usersMap.has(u.id)) {
            const base = usersMap.get(u.id);
            usersMap.set(u.id, {
              ...base,
              name: u.name || base.name,
              role: u.role || base.role,
              pin: u.pin || base.pin,
              preferences: { ...base.preferences, ...(u.preferences || {}) },
            });
          }
        }
        saveLocalUsersCache();
      } else {
        // Seed initial 12 users if table is empty
        const seedRows = Array.from(usersMap.values()).map((u) => ({
          id: u.id,
          name: u.name,
          role: u.role,
          pin: u.pin,
          preferences: u.preferences,
        }));
        await sbClient.from("app_users").upsert(seedRows);
      }

      // 2. Fetch custom_events
      const { data: eventsData, error: eventsErr } = await sbClient
        .from("custom_events")
        .select("*")
        .order("event_date", { ascending: true });
      if (!eventsErr && Array.isArray(eventsData)) {
        customEvents = eventsData;
        saveLocalCustomEventsCache();
      }

      // 3. Check if there is an updated official master_schedule in Supabase
      const { data: masterData, error: masterErr } = await sbClient
        .from("master_schedule")
        .select("*")
        .eq("id", "official_cronograma")
        .maybeSingle();

      if (!masterErr && masterData && masterData.data && masterData.data.activities) {
        rawData = masterData.data;
        els.btnResetData.style.display = "inline-flex";
        els.statusBadge.textContent = `📂 Excel Oficial Nube: ${masterData.file_name || "Actualizado"} (${rawData.activities.length} act.)`;
        els.statusBadge.style.background = "#059669";
        els.statusBadge.style.color = "#ffffff";
      }

      setCloudStatus("☁️ Nube sincronizada en tiempo real", false);

      // Refresh current target user's preferences if already logged in
      if (state.targetUserId) {
        loadUserPreferencesIntoState(state.targetUserId);
        populateFilterControls();
        renderAll();
      }
    } catch (err) {
      console.warn("Supabase sync fallback a caché local:", err);
      setCloudStatus("☁️ Modo local activo (Sin conexión a tabla remota)", true);
    }
  }

  function scheduleSavePreferences() {
    if (!state.targetUserId) return;
    const u = usersMap.get(state.targetUserId);
    if (!u) return;

    u.preferences = {
      selectedActivityNos: Array.from(state.selectedActivityNos),
      selectedCampaignIds: Array.from(state.selectedCampaignIds),
      brand: state.brand,
      includeSharedBrand: state.includeSharedBrand,
      include2026: state.include2026,
      showCustomEvents: state.showCustomEvents,
      customFilterTags: Array.from(state.customFilterTags),
    };
    saveLocalUsersCache();

    if (savePrefsTimeout) clearTimeout(savePrefsTimeout);
    setCloudStatus(`☁️ Guardando cambios de ${state.targetUserId}...`, false);

    savePrefsTimeout = setTimeout(async () => {
      try {
        if (sbClient) {
          const { error } = await sbClient
            .from("app_users")
            .update({
              preferences: u.preferences,
              updated_at: new Date().toISOString(),
            })
            .eq("id", state.targetUserId);
          if (error) throw error;
          setCloudStatus(`☁️ Guardado en la nube (${state.targetUserId})`, false);
        }
      } catch (e) {
        console.warn("Error guardando preferencias en Supabase:", e);
        setCloudStatus(`☁️ Guardado en este equipo (${state.targetUserId})`, true);
      }
    }, 350);
  }

  function loadUserPreferencesIntoState(userId) {
    const u = usersMap.get(userId);
    if (!u) return;
    const prefs = u.preferences || {};

    state.include2026 = Boolean(prefs.include2026);
    els.chkInclude2026.checked = state.include2026;

    const validCamps = getActiveCampaigns();
    const validCampIds = new Set(validCamps.map((c) => c.id));
    const savedCamps = Array.isArray(prefs.selectedCampaignIds) ? prefs.selectedCampaignIds : DEFAULT_CAMPAIGNS;
    const filteredCamps = savedCamps.filter((id) => validCampIds.has(id));
    state.selectedCampaignIds = new Set(filteredCamps.length > 0 ? filteredCamps : DEFAULT_CAMPAIGNS);

    // REGLA DE ORO: Por defecto las actividades/áreas están APAGADAS (array vacío)
    const savedActs = Array.isArray(prefs.selectedActivityNos) ? prefs.selectedActivityNos : [];
    state.selectedActivityNos = new Set(savedActs.map((n) => Number(n)));

    state.brand = prefs.brand || "ALL";
    state.includeSharedBrand = prefs.includeSharedBrand !== undefined ? Boolean(prefs.includeSharedBrand) : true;
    state.showCustomEvents = prefs.showCustomEvents !== undefined ? Boolean(prefs.showCustomEvents) : true;
    state.customFilterTags = new Set(Array.isArray(prefs.customFilterTags) ? prefs.customFilterTags : []);

    // Update Brand UI pills
    els.brandPills.forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-brand") === state.brand);
    });
    els.chkSharedBrand.checked = state.includeSharedBrand;
    els.sharedBrandWrap.style.display =
      state.brand === "Livva" || state.brand === "Azzorti" ? "inline-flex" : "none";
    els.chkShowCustomEvents.checked = state.showCustomEvents;
  }

  /* ==========================================================================
     4. LOGIN & ADMIN USER MANAGEMENT
     ========================================================================== */
  function getProfileMeta(userId) {
    return TEAM_PROFILES.find((p) => p.id === userId) || { id: userId, name: userId, role: "designer", color: "#6366f1" };
  }

  function renderLoginScreen() {
    els.loginUsersGrid.innerHTML = "";
    els.loginPinForm.style.display = "none";
    els.loginUsersGrid.style.display = "grid";
    els.loginErrorMsg.textContent = "";

    for (const p of TEAM_PROFILES) {
      const isAdmin = p.role === "admin";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `login-user-card ${isAdmin ? "admin-card" : ""}`;
      const initials = p.name.slice(0, 2).toUpperCase();
      btn.innerHTML = `
        <span class="user-avatar-sm" style="background:${p.color}">${initials}</span>
        <div>
          <div style="font-weight:800;font-size:13.5px;color:#0f172a">${p.name} ${isAdmin ? "👑" : ""}</div>
          <div style="font-size:11px;color:#64748b">${isAdmin ? "Administrador" : "Diseñador(a)"}</div>
        </div>
      `;
      btn.addEventListener("click", () => {
        state.selectedLoginCandidateId = p.id;
        els.loginUsersGrid.style.display = "none";
        els.loginPinForm.style.display = "flex";
        els.loginSelectedAvatar.textContent = initials;
        els.loginSelectedAvatar.style.background = p.color;
        els.loginSelectedName.textContent = p.name + (isAdmin ? " (Administrador)" : "");
        els.loginSelectedRole.textContent = isAdmin
          ? "Acceso total para configurar cualquier calendario"
          : "Calendario y vista personalizada persistente";
        els.loginPinInput.value = "";
        els.loginErrorMsg.textContent = "";
        setTimeout(() => els.loginPinInput.focus(), 50);
      });
      els.loginUsersGrid.appendChild(btn);
    }
  }

  function completeLogin(userId, remember) {
    const meta = getProfileMeta(userId);
    state.loggedInUserId = userId;
    state.targetUserId = userId;

    if (remember) {
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, userId);
      } catch (e) {
        // ignore
      }
    }

    els.loginOverlay.style.display = "none";
    els.headerUserAvatar.textContent = meta.name.slice(0, 2).toUpperCase();
    els.headerUserAvatar.style.background = meta.color;
    els.headerUserName.textContent = meta.name + (meta.role === "admin" ? " 👑" : "");

    // Setup Admin Bar if DANI
    if (meta.role === "admin") {
      els.adminControlBar.style.display = "flex";
      populateAdminTargetSelect();
    } else {
      els.adminControlBar.style.display = "none";
      els.adminEditingBanner.style.display = "none";
    }

    loadUserPreferencesIntoState(state.targetUserId);
    populateFilterControls();
    renderAll();
  }

  function populateAdminTargetSelect() {
    els.adminTargetUserSelect.innerHTML = "";
    for (const p of TEAM_PROFILES) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.id === "DANI" ? "DANI (Mi propio calendario)" : `Calendario de ${p.name}`;
      if (p.id === state.targetUserId) opt.selected = true;
      els.adminTargetUserSelect.appendChild(opt);
    }
  }

  function switchAdminTargetUser(newTargetId) {
    if (state.loggedInUserId !== "DANI") return;
    state.targetUserId = newTargetId;
    els.adminTargetUserSelect.value = newTargetId;

    if (newTargetId !== "DANI") {
      els.adminEditingBanner.style.display = "flex";
      els.adminEditingTargetName.textContent = newTargetId;
      els.adminEditingTargetName2.textContent = newTargetId;
    } else {
      els.adminEditingBanner.style.display = "none";
    }

    loadUserPreferencesIntoState(newTargetId);
    populateFilterControls();
    renderAll();
  }

  function openAdminPinsModal() {
    if (state.loggedInUserId !== "DANI") return;
    els.adminPinsList.innerHTML = "";
    for (const p of TEAM_PROFILES) {
      const u = usersMap.get(p.id) || buildDefaultUserObject(p);
      const div = document.createElement("div");
      div.className = "admin-pin-item";
      div.innerHTML = `
        <span><strong>${p.name}</strong> ${p.role === "admin" ? "👑" : ""}</span>
        <input type="text" data-userid="${p.id}" value="${u.pin || "1234"}" maxlength="12" />
      `;
      els.adminPinsList.appendChild(div);
    }
    els.adminPinsModal.style.display = "flex";
  }

  async function saveAllAdminPins() {
    const inputs = els.adminPinsList.querySelectorAll("input[data-userid]");
    const updates = [];
    inputs.forEach((inp) => {
      const uid = inp.getAttribute("data-userid");
      const newPin = inp.value.trim() || "1234";
      if (usersMap.has(uid)) {
        const u = usersMap.get(uid);
        u.pin = newPin;
        updates.push({
          id: u.id,
          name: u.name,
          role: u.role,
          pin: u.pin,
          preferences: u.preferences,
        });
      }
    });
    saveLocalUsersCache();
    els.adminPinsModal.style.display = "none";

    if (sbClient && updates.length > 0) {
      setCloudStatus("☁️ Actualizando claves PIN...", false);
      try {
        await sbClient.from("app_users").upsert(updates);
        setCloudStatus("☁️ Claves PIN actualizadas en la nube", false);
      } catch (e) {
        console.warn("Error actualizando PINs:", e);
      }
    }
  }

  /* ==========================================================================
     5. DATE & NORMALIZATION HELPERS
     ========================================================================== */
  function parseYMD(str) {
    if (!str || typeof str !== "string") return null;
    const m = str.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatYMD(date) {
    if (!date) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatHumanDate(str) {
    const d = parseYMD(str);
    if (!d) return "—";
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function subtractBusinessDays(endDateStr, dh) {
    const endDt = parseYMD(endDateStr);
    if (!endDt) return null;
    const days = Math.max(0, parseInt(dh, 10) || 0);
    if (days <= 1) return new Date(endDt.getTime());
    let cur = new Date(endDt.getTime());
    let remaining = days - 1;
    while (remaining > 0) {
      cur.setDate(cur.getDate() - 1);
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) remaining--;
    }
    return cur;
  }

  function daysBetween(d1, d2) {
    return Math.round((d2.getTime() - d1.getTime()) / 86400000);
  }

  function addDays(d, n) {
    const copy = new Date(d.getTime());
    copy.setDate(copy.getDate() + n);
    return copy;
  }

  function normProceso(val) {
    const s = String(val || "").trim().replace(/\s+/g, " ");
    if (s === "DisGRaf") return "DisGraf";
    if (s === "Desarrollos Moda MO ¨Prog 3D y 2D") return "Desarrollos Moda MO Prog 3D y 2D";
    return s || "Sin Proceso";
  }

  function normArea(val) {
    const s = String(val || "").trim().replace(/\s+/g, " ");
    if (s.toLowerCase() === "ingenieria") return "Ingenieria";
    return s || "Sin Área";
  }

  function normMarca(val) {
    return String(val || "").trim().replace(/\s+/g, " ") || "Azz Livv";
  }

  function excelSerialToYMD(serial) {
    const num = Number(serial);
    if (isNaN(num) || num < 30000 || num > 75000) return null;
    const base = new Date(Date.UTC(1899, 11, 30, 12, 0, 0));
    base.setUTCDate(base.getUTCDate() + Math.round(num));
    const y = base.getUTCFullYear();
    const m = String(base.getUTCMonth() + 1).padStart(2, "0");
    const d = String(base.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function normalizeDateCell(val) {
    if (val === null || val === undefined) return null;
    if (val instanceof Date && !isNaN(val.getTime())) return formatYMD(val);
    const s = String(val).trim();
    if (!s || s.toLowerCase() === "nan") return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const parts = s.split("/");
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      const yr = parts[2];
      if (p0 > 12) return `${yr}-${String(p1).padStart(2, "0")}-${String(p0).padStart(2, "0")}`;
      return `${yr}-${String(p0).padStart(2, "0")}-${String(p1).padStart(2, "0")}`;
    }
    const num = Number(s);
    if (!isNaN(num) && num >= 30000 && num <= 75000) return excelSerialToYMD(num);
    return null;
  }

  function formatCampLabel(adv, nal) {
    const advS = String(adv || "").trim();
    const nalS = String(nal || "").trim();
    if (advS.length === 6 && nalS.length === 6 && /^\d+$/.test(advS) && /^\d+$/.test(nalS)) {
      const yrAdv = advS.slice(0, 4);
      const cAdv = parseInt(advS.slice(4), 10);
      const yrNal = nalS.slice(0, 4);
      const cNal = parseInt(nalS.slice(4), 10);
      const short = yrAdv === yrNal ? `C${cAdv}-${cNal} ${yrAdv}` : `C${cAdv} (${yrAdv}) - C${cNal} (${yrNal})`;
      return { shortLabel: short, fullLabel: `ADV ${advS} / NAL ${nalS}` };
    }
    return { shortLabel: `${advS}-${nalS}`, fullLabel: `ADV ${advS} / NAL ${nalS}` };
  }

  function parseGridToCronograma(grid, fileName) {
    if (!grid || grid.length < 4) {
      throw new Error("El archivo no tiene el formato esperado (mínimo 4 filas).");
    }
    const r1 = grid[0] || [];
    const r2 = grid[1] || [];
    const campaigns = [];

    const maxCols = Math.max(r1.length, r2.length, (grid[2] || []).length);
    for (let c = 6; c < maxCols; c += 2) {
      const adv = String(r1[c] ?? "").trim();
      const nal = String(r2[c] ?? "").trim();
      if (!adv && !nal) continue;
      const lbls = formatCampLabel(adv, nal);
      campaigns.push({
        id: `ADV_${adv}_NAL_${nal}`,
        colIndex: c,
        adv,
        nal,
        shortLabel: lbls.shortLabel,
        fullLabel: lbls.fullLabel,
        fromC1_4_2027: /^\d+$/.test(adv) ? parseInt(adv, 10) >= 202701 : true,
      });
    }

    if (campaigns.length === 0) {
      throw new Error("No se detectaron columnas de campañas a partir de la columna G.");
    }

    const activities = [];
    for (let r = 3; r < grid.length; r++) {
      const row = grid[r];
      if (!row || row.length < 2) continue;
      const noRaw = row[0];
      const actName = String(row[1] ?? "").trim().replace(/\s+/g, " ");
      if (!actName) continue;
      const noNum = parseInt(noRaw, 10);
      if (isNaN(noNum)) continue;

      const proceso = normProceso(row[2]);
      const marca = normMarca(row[3]);
      const area = normArea(row[4]);
      const dias = parseInt(row[5], 10) || 0;

      const dhMap = {};
      const fechasMap = {};
      for (const camp of campaigns) {
        const c = camp.colIndex;
        const dhVal = row[c - 1];
        const fVal = row[c];
        dhMap[camp.id] = dhVal !== undefined && dhVal !== null && dhVal !== "" ? parseInt(dhVal, 10) || 0 : dias;
        fechasMap[camp.id] = normalizeDateCell(fVal);
      }

      activities.push({
        no: noNum,
        actividad: actName,
        proceso,
        marca,
        area,
        dias,
        dh: dhMap,
        fechas: fechasMap,
      });
    }

    return {
      sourceFile: fileName || "Archivo cargado",
      generatedAt: formatYMD(new Date()),
      campaigns,
      activities,
    };
  }

  /* ==========================================================================
     6. EXCEL UPLOAD (PRESERVES ALL CUSTOM EVENTS IN SUPABASE!)
     ========================================================================== */
  async function parseXlsxNatively(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    const entries = {};
    let eocdOffset = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) throw new Error("El archivo no es un contenedor .xlsx (ZIP) válido.");

    const cdCount = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    let ptr = cdOffset;
    const dec = new TextDecoder("utf-8");

    for (let i = 0; i < cdCount; i++) {
      if (view.getUint32(ptr, true) !== 0x02014b50) break;
      const compMethod = view.getUint16(ptr + 10, true);
      const compSize = view.getUint32(ptr + 20, true);
      const nameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localHdrOffset = view.getUint32(ptr + 42, true);
      const fileName = dec.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
      entries[fileName] = { compMethod, compSize, localHdrOffset };
      ptr += 46 + nameLen + extraLen + commentLen;
    }

    async function extractEntryText(entryName) {
      const info = entries[entryName];
      if (!info) return null;
      const lPtr = info.localHdrOffset;
      const lNameLen = view.getUint16(lPtr + 26, true);
      const lExtraLen = view.getUint16(lPtr + 28, true);
      const dataStart = lPtr + 30 + lNameLen + lExtraLen;
      const compData = bytes.subarray(dataStart, dataStart + info.compSize);

      if (info.compMethod === 0) return dec.decode(compData);
      if (info.compMethod === 8 && typeof DecompressionStream !== "undefined") {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        writer.write(compData);
        writer.close();
        const resp = new Response(ds.readable);
        const ab = await resp.arrayBuffer();
        return dec.decode(new Uint8Array(ab));
      }
      throw new Error("Compresión no soportada.");
    }

    const sharedStrings = [];
    const ssXml = await extractEntryText("xl/sharedStrings.xml");
    if (ssXml) {
      const doc = new DOMParser().parseFromString(ssXml, "application/xml");
      const siNodes = doc.getElementsByTagName("si");
      for (let i = 0; i < siNodes.length; i++) {
        const tNodes = siNodes[i].getElementsByTagName("t");
        let str = "";
        for (let j = 0; j < tNodes.length; j++) str += tNodes[j].textContent || "";
        sharedStrings.push(str);
      }
    }

    const sheetEntry =
      Object.keys(entries).find((k) => /^xl\/worksheets\/sheet1\.xml$/i.test(k)) ||
      Object.keys(entries).find((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k));
    if (!sheetEntry) throw new Error("No se encontró hoja de cálculo en el archivo .xlsx");

    const sheetXml = await extractEntryText(sheetEntry);
    const sheetDoc = new DOMParser().parseFromString(sheetXml, "application/xml");
    const rowNodes = sheetDoc.getElementsByTagName("row");

    function colRefToIndex(ref) {
      const m = ref.match(/^[A-Z]+/);
      if (!m) return 0;
      let col = 0;
      for (let i = 0; i < m[0].length; i++) {
        col = col * 26 + (m[0].charCodeAt(i) - 64);
      }
      return col - 1;
    }

    const grid = [];
    for (let i = 0; i < rowNodes.length; i++) {
      const rNode = rowNodes[i];
      const rIdx = (parseInt(rNode.getAttribute("r"), 10) || i + 1) - 1;
      const cNodes = rNode.getElementsByTagName("c");
      const rowArr = [];
      for (let j = 0; j < cNodes.length; j++) {
        const cNode = cNodes[j];
        const ref = cNode.getAttribute("r") || "";
        const cIdx = colRefToIndex(ref);
        const type = cNode.getAttribute("t");
        const vNode = cNode.getElementsByTagName("v")[0];
        let val = vNode ? vNode.textContent : null;
        if (type === "s" && val !== null) {
          val = sharedStrings[parseInt(val, 10)] ?? val;
        } else if (type === "inlineStr") {
          const isNode = cNode.getElementsByTagName("t")[0];
          val = isNode ? isNode.textContent : "";
        }
        rowArr[cIdx] = val;
      }
      grid[rIdx] = rowArr;
    }
    return grid;
  }

  function parseCsvToGrid(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const sep = (lines[0] || "").split(";").length > (lines[0] || "").split(",").length ? ";" : ",";
    return lines.map((line) => {
      const res = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === sep && !inQuotes) {
          res.push(cur.trim());
          cur = "";
        } else cur += ch;
      }
      res.push(cur.trim());
      return res;
    });
  }

  async function handleFileUpload(file) {
    if (!file) return;
    try {
      els.statusBadge.textContent = `⏳ Procesando ${file.name}...`;
      let grid = null;

      if (file.name.toLowerCase().endsWith(".csv")) {
        const txt = await file.text();
        grid = parseCsvToGrid(txt);
      } else {
        const ab = await file.arrayBuffer();
        if (window.XLSX && typeof window.XLSX.read === "function") {
          const wb = window.XLSX.read(ab, { type: "array" });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          grid = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: null });
        } else {
          grid = await parseXlsxNatively(ab);
        }
      }

      const parsed = parseGridToCronograma(grid, file.name);
      rawData = parsed;
      try {
        localStorage.setItem(LOCAL_MASTER_CACHE_KEY, JSON.stringify(parsed));
      } catch (storageErr) {
        console.warn("No se pudo guardar en localStorage:", storageErr);
      }

      // Subir la nueva versión oficial a Supabase (master_schedule) para que se actualice a TODOS los usuarios
      // SIN TOCAR NI BORRAR la tabla custom_events
      if (sbClient) {
        setCloudStatus("☁️ Publicando nuevo Excel oficial para todos...", false);
        const { error } = await sbClient.from("master_schedule").upsert({
          id: "official_cronograma",
          file_name: file.name,
          data: parsed,
          updated_by: state.loggedInUserId || "DANI",
          updated_at: new Date().toISOString(),
        });
        if (!error) {
          setCloudStatus("☁️ Excel oficial actualizado para todos (Eventos extra intactos)", false);
        }
      }

      els.btnResetData.style.display = "inline-flex";
      els.statusBadge.textContent = `📂 Excel activo: ${file.name} (${parsed.activities.length} act. | Eventos extra intactos)`;
      els.statusBadge.style.background = "#059669";
      els.statusBadge.style.color = "#ffffff";

      populateFilterControls();
      renderAll();
    } catch (err) {
      alert("Error al leer el archivo: " + err.message);
      console.error(err);
    }
  }

  /* ==========================================================================
     7. CHECKLISTS & FILTER CONTROLS (OFF BY DEFAULT, UNIFIED SYNC)
     ========================================================================== */
  function getActiveCampaigns() {
    if (!rawData || !rawData.campaigns) return [];
    if (state.include2026) return rawData.campaigns;
    return rawData.campaigns.filter((c) => c.fromC1_4_2027);
  }

  function getSelectedCampaigns() {
    const active = getActiveCampaigns();
    if (!active || active.length === 0) return [];
    return active.filter((c) => state.selectedCampaignIds.has(c.id));
  }

  function populateFilterControls() {
    if (!rawData) return;
    updateCampaignButtonLabel();
    renderCampaignSelectList();
    renderAreaChecklist();
    renderProcesoChecklist();
    renderActivityChecklist();
    renderCustomEventFilterList();
    updateChecklistButtonLabels();
  }

  function updateCampaignButtonLabel() {
    const active = getActiveCampaigns();
    const total = active.length;
    const count = state.selectedCampaignIds.size;
    const btnSpan = els.campaignBtn.querySelector(".btn-text");

    if (count === 0) {
      btnSpan.textContent = "Ninguna campaña (0)";
    } else if (count === total) {
      btnSpan.textContent = `Todas las campañas (${total})`;
    } else if (count === 1) {
      const singleId = Array.from(state.selectedCampaignIds)[0];
      const c = active.find((x) => x.id === singleId);
      btnSpan.textContent = c ? c.shortLabel : "1 campaña";
    } else if (count <= 3) {
      const labels = [];
      for (const id of state.selectedCampaignIds) {
        const c = active.find((x) => x.id === id);
        if (c) labels.push(c.shortLabel.replace(/\s*\d{4}/, ""));
      }
      btnSpan.textContent = labels.join(", ");
    } else {
      btnSpan.textContent = `${count} de ${total} campañas`;
    }
  }

  function renderCampaignSelectList() {
    const active = getActiveCampaigns();
    const q = (els.campaignSearch.value || "").trim().toLowerCase();
    els.campaignList.innerHTML = "";

    for (const c of active) {
      const textMatch =
        c.shortLabel.toLowerCase().includes(q) ||
        c.fullLabel.toLowerCase().includes(q) ||
        c.adv.includes(q) ||
        c.nal.includes(q);
      if (q && !textMatch) continue;

      const div = document.createElement("div");
      div.className = "multi-option-item";
      const chkId = `chk-camp-${c.id}`;
      const isChecked = state.selectedCampaignIds.has(c.id);

      div.innerHTML = `
        <label for="${chkId}" style="cursor:pointer;display:flex;align-items:center;gap:8px;flex:1">
          <input type="checkbox" id="${chkId}" data-id="${c.id}" ${isChecked ? "checked" : ""} />
          <span style="font-weight:600;color:var(--text-main)">${c.shortLabel}</span>
          <span style="font-size:11px;color:var(--text-muted)">(${c.fullLabel})</span>
        </label>
      `;

      const input = div.querySelector("input");
      input.addEventListener("change", () => {
        if (input.checked) state.selectedCampaignIds.add(c.id);
        else state.selectedCampaignIds.delete(c.id);
        updateCampaignButtonLabel();
        state.calCurrentMonthIndex = 0;
        scheduleSavePreferences();
        renderAll();
      });

      els.campaignList.appendChild(div);
    }
  }

  // ÁREAS: Marcar un área enciende/apaga todas las actividades de esa área
  function renderAreaChecklist() {
    const areaMap = new Map(); // area -> [act.no, ...]
    for (const act of rawData.activities) {
      if (!areaMap.has(act.area)) areaMap.set(act.area, []);
      areaMap.get(act.area).push(act.no);
    }

    const sortedAreas = Array.from(areaMap.keys()).sort((a, b) => a.localeCompare(b, "es"));
    const q = (els.areaSearch.value || "").trim().toLowerCase();
    els.areaList.innerHTML = "";

    for (const area of sortedAreas) {
      if (q && !area.toLowerCase().includes(q)) continue;
      const nos = areaMap.get(area);
      const activeCount = nos.filter((n) => state.selectedActivityNos.has(n)).length;
      const allActive = activeCount === nos.length && nos.length > 0;
      const someActive = activeCount > 0 && activeCount < nos.length;

      const div = document.createElement("div");
      div.className = "multi-option-item";
      const id = `chk-area-${area.replace(/[^a-zA-Z0-9]/g, "_")}`;
      div.innerHTML = `
        <label for="${id}">
          <input type="checkbox" id="${id}" ${allActive ? "checked" : ""} />
          <span style="${activeCount > 0 ? "font-weight:700;color:var(--primary)" : ""}">${area}</span>
        </label>
        <span class="multi-option-count" style="${activeCount > 0 ? "background:#ede9fe;color:#6d28d9;font-weight:700" : ""}">${activeCount}/${nos.length}</span>
      `;
      const input = div.querySelector("input");
      if (someActive) input.indeterminate = true;

      input.addEventListener("change", () => {
        if (input.checked) {
          nos.forEach((n) => state.selectedActivityNos.add(n));
        } else {
          nos.forEach((n) => state.selectedActivityNos.delete(n));
        }
        populateFilterControls();
        scheduleSavePreferences();
        renderAll();
      });
      els.areaList.appendChild(div);
    }
  }

  // PROCESOS: Marcar un proceso enciende/apaga todas las actividades de ese proceso
  function renderProcesoChecklist() {
    const procMap = new Map(); // proceso -> [act.no, ...]
    for (const act of rawData.activities) {
      if (!procMap.has(act.proceso)) procMap.set(act.proceso, []);
      procMap.get(act.proceso).push(act.no);
    }

    const sortedProcs = Array.from(procMap.keys()).sort((a, b) => a.localeCompare(b, "es"));
    const q = (els.procesoSearch.value || "").trim().toLowerCase();
    els.procesoList.innerHTML = "";

    for (const proc of sortedProcs) {
      if (q && !proc.toLowerCase().includes(q)) continue;
      const nos = procMap.get(proc);
      const activeCount = nos.filter((n) => state.selectedActivityNos.has(n)).length;
      const allActive = activeCount === nos.length && nos.length > 0;
      const someActive = activeCount > 0 && activeCount < nos.length;

      const div = document.createElement("div");
      div.className = "multi-option-item";
      const id = `chk-proc-${proc.replace(/[^a-zA-Z0-9]/g, "_")}`;
      div.innerHTML = `
        <label for="${id}">
          <input type="checkbox" id="${id}" ${allActive ? "checked" : ""} />
          <span style="${activeCount > 0 ? "font-weight:700;color:var(--primary)" : ""}">${proc}</span>
        </label>
        <span class="multi-option-count" style="${activeCount > 0 ? "background:#ede9fe;color:#6d28d9;font-weight:700" : ""}">${activeCount}/${nos.length}</span>
      `;
      const input = div.querySelector("input");
      if (someActive) input.indeterminate = true;

      input.addEventListener("change", () => {
        if (input.checked) {
          nos.forEach((n) => state.selectedActivityNos.add(n));
        } else {
          nos.forEach((n) => state.selectedActivityNos.delete(n));
        }
        populateFilterControls();
        scheduleSavePreferences();
        renderAll();
      });
      els.procesoList.appendChild(div);
    }
  }

  // ACTIVIDADES INDIVIDUALES (#No)
  function renderActivityChecklist() {
    const q = (els.actSearch.value || "").trim().toLowerCase();
    els.actList.innerHTML = "";

    for (const act of rawData.activities) {
      const match =
        !q ||
        String(act.no).includes(q) ||
        `#${act.no}` === q ||
        act.actividad.toLowerCase().includes(q) ||
        act.proceso.toLowerCase().includes(q) ||
        act.area.toLowerCase().includes(q);
      if (!match) continue;

      const isChecked = state.selectedActivityNos.has(act.no);
      const div = document.createElement("div");
      div.className = "multi-option-item";
      const id = `chk-act-dd-${act.no}`;
      div.innerHTML = `
        <label for="${id}" style="align-items:flex-start">
          <input type="checkbox" id="${id}" style="margin-top:2px" ${isChecked ? "checked" : ""} />
          <span>
            <strong style="color:#475569">#${act.no}</strong> [${act.marca}] ${act.actividad}
            <small style="display:block;color:#64748b;font-size:10px">${act.proceso} • ${act.area}</small>
          </span>
        </label>
      `;
      const input = div.querySelector("input");
      input.addEventListener("change", () => {
        if (input.checked) state.selectedActivityNos.add(act.no);
        else state.selectedActivityNos.delete(act.no);
        updateChecklistButtonLabels();
        renderAreaChecklist();
        renderProcesoChecklist();
        scheduleSavePreferences();
        renderAll();
      });
      els.actList.appendChild(div);
    }
  }

  // FILTRO DE EVENTOS EXTRA (POR ÁREA O USUARIO)
  function renderCustomEventFilterList() {
    els.customFilterList.innerHTML = "";

    // Group 1: Áreas
    const areaHeader = document.createElement("div");
    areaHeader.style.cssText = "font-size:10px;font-weight:800;color:#64748b;padding:4px 6px;text-transform:uppercase";
    areaHeader.textContent = "Por Área / Rol";
    els.customFilterList.appendChild(areaHeader);

    const allAreas = Array.from(new Set([...CUSTOM_EVENT_AREAS, ...customEvents.map((e) => e.area || "General / Equipo")]));
    for (const area of allAreas) {
      const tag = `AREA:${area}`;
      const count = customEvents.filter((e) => (e.area || "General / Equipo") === area).length;
      const isChecked = state.customFilterTags.size === 0 || state.customFilterTags.has(tag);

      const div = document.createElement("div");
      div.className = "multi-option-item";
      div.innerHTML = `
        <label style="cursor:pointer">
          <input type="checkbox" data-tag="${tag}" ${isChecked ? "checked" : ""} />
          <span>📌 ${area}</span>
        </label>
        <span class="multi-option-count">${count}</span>
      `;
      const inp = div.querySelector("input");
      inp.addEventListener("change", () => handleCustomFilterToggle(tag, inp.checked, allAreas));
      els.customFilterList.appendChild(div);
    }

    // Group 2: Usuarios
    const userHeader = document.createElement("div");
    userHeader.style.cssText = "font-size:10px;font-weight:800;color:#64748b;padding:8px 6px 4px;text-transform:uppercase;border-top:1px solid #e2e8f0;margin-top:4px";
    userHeader.textContent = "Por Diseñador(a)";
    els.customFilterList.appendChild(userHeader);

    for (const p of TEAM_PROFILES) {
      const tag = `USER:${p.id}`;
      const count = customEvents.filter((e) => e.owner_user === p.id).length;
      const isChecked = state.customFilterTags.size === 0 || state.customFilterTags.has(tag);

      const div = document.createElement("div");
      div.className = "multi-option-item";
      div.innerHTML = `
        <label style="cursor:pointer">
          <input type="checkbox" data-tag="${tag}" ${isChecked ? "checked" : ""} />
          <span>👤 ${p.name}</span>
        </label>
        <span class="multi-option-count">${count}</span>
      `;
      const inp = div.querySelector("input");
      inp.addEventListener("change", () => handleCustomFilterToggle(tag, inp.checked, allAreas));
      els.customFilterList.appendChild(div);
    }
  }

  function handleCustomFilterToggle(tag, checked, allAreas) {
    // If currently empty (which means "All"), populate all tags first then remove the unchecked one
    if (state.customFilterTags.size === 0 && !checked) {
      allAreas.forEach((a) => state.customFilterTags.add(`AREA:${a}`));
      TEAM_PROFILES.forEach((p) => state.customFilterTags.add(`USER:${p.id}`));
      state.customFilterTags.delete(tag);
    } else {
      if (checked) state.customFilterTags.add(tag);
      else state.customFilterTags.delete(tag);
    }
    renderCustomEventFilterList();
    updateChecklistButtonLabels();
    scheduleSavePreferences();
    renderAll();
  }

  function updateChecklistButtonLabels() {
    if (!rawData) return;

    // Areas active count
    const areaMap = new Map();
    const procMap = new Map();
    for (const act of rawData.activities) {
      if (!areaMap.has(act.area)) areaMap.set(act.area, []);
      areaMap.get(act.area).push(act.no);
      if (!procMap.has(act.proceso)) procMap.set(act.proceso, []);
      procMap.get(act.proceso).push(act.no);
    }

    let activeAreas = 0;
    const activeAreaNames = [];
    for (const [area, nos] of areaMap.entries()) {
      if (nos.some((n) => state.selectedActivityNos.has(n))) {
        activeAreas++;
        activeAreaNames.push(area);
      }
    }

    let activeProcs = 0;
    const activeProcNames = [];
    for (const [proc, nos] of procMap.entries()) {
      if (nos.some((n) => state.selectedActivityNos.has(n))) {
        activeProcs++;
        activeProcNames.push(proc);
      }
    }

    const aSpan = els.areaBtn.querySelector(".btn-text");
    if (activeAreas === 0) aSpan.textContent = "0 áreas activas (Apagadas)";
    else if (activeAreas === 1) aSpan.textContent = activeAreaNames[0];
    else if (activeAreas === areaMap.size) aSpan.textContent = `Todas las áreas (${activeAreas})`;
    else aSpan.textContent = `${activeAreas} áreas con actividades`;

    const pSpan = els.procesoBtn.querySelector(".btn-text");
    if (activeProcs === 0) pSpan.textContent = "0 procesos activos (Apagados)";
    else if (activeProcs === 1) pSpan.textContent = activeProcNames[0];
    else if (activeProcs === procMap.size) pSpan.textContent = `Todos los procesos (${activeProcs})`;
    else pSpan.textContent = `${activeProcs} procesos activos`;

    const actSpan = els.actBtn.querySelector(".btn-text");
    const selSize = state.selectedActivityNos.size;
    if (selSize === 0) actSpan.textContent = "0 actividades elegidas";
    else if (selSize === rawData.activities.length) actSpan.textContent = `Todas (${selSize} act.)`;
    else actSpan.textContent = `${selSize} actividad${selSize > 1 ? "es" : ""} activa${selSize > 1 ? "s" : ""}`;

    const custSpan = els.customFilterBtn.querySelector(".btn-text");
    if (!state.showCustomEvents) custSpan.textContent = "Eventos extra ocultos";
    else if (state.customFilterTags.size === 0) custSpan.textContent = `Todos visibles (${customEvents.length})`;
    else custSpan.textContent = `Filtro personalizado (${state.customFilterTags.size})`;
  }

  /* ==========================================================================
     8. FILTERING ACTIVITIES & CUSTOM EVENTS
     ========================================================================== */
  function matchesBrandFilter(marca) {
    if (state.brand === "ALL") return true;
    if (state.brand === "Azz Livv") return marca === "Azz Livv";
    if (marca === state.brand) return true;
    if (state.includeSharedBrand && marca === "Azz Livv") return true;
    return false;
  }

  // Returns ONLY the official activities explicitly checked in state.selectedActivityNos
  function getSelectedOfficialActivities() {
    if (!rawData) return [];
    const q = state.searchQuery.trim().toLowerCase();
    return rawData.activities.filter((act) => {
      if (!state.selectedActivityNos.has(act.no)) return false;
      if (!matchesBrandFilter(act.marca)) return false;
      if (q) {
        const matchNo = String(act.no).includes(q) || `#${act.no}` === q;
        const matchText =
          act.actividad.toLowerCase().includes(q) ||
          act.proceso.toLowerCase().includes(q) ||
          act.area.toLowerCase().includes(q) ||
          act.marca.toLowerCase().includes(q);
        if (!matchNo && !matchText) return false;
      }
      return true;
    });
  }

  // For Gantt/Matrix when user checks "Mostrar catálogo completo (259 act.) para marcar"
  function getCatalogActivitiesForExploration() {
    if (!rawData) return [];
    const q = state.searchQuery.trim().toLowerCase();
    return rawData.activities.filter((act) => {
      if (!matchesBrandFilter(act.marca)) return false;
      if (q) {
        const matchNo = String(act.no).includes(q) || `#${act.no}` === q;
        const matchText =
          act.actividad.toLowerCase().includes(q) ||
          act.proceso.toLowerCase().includes(q) ||
          act.area.toLowerCase().includes(q) ||
          act.marca.toLowerCase().includes(q);
        if (!matchNo && !matchText) return false;
      }
      return true;
    });
  }

  function getVisibleCustomEvents() {
    if (!state.showCustomEvents) return [];
    const q = state.searchQuery.trim().toLowerCase();
    return customEvents.filter((ev) => {
      if (!matchesBrandFilter(ev.marca || "Azz Livv")) return false;

      if (state.customFilterTags.size > 0) {
        const areaTag = `AREA:${ev.area || "General / Equipo"}`;
        const userTag = `USER:${ev.owner_user || "DANI"}`;
        const hasAreaTags = Array.from(state.customFilterTags).some((t) => t.startsWith("AREA:"));
        const hasUserTags = Array.from(state.customFilterTags).some((t) => t.startsWith("USER:"));

        if (hasAreaTags && hasUserTags) {
          if (!state.customFilterTags.has(areaTag) && !state.customFilterTags.has(userTag)) return false;
        } else if (hasAreaTags) {
          if (!state.customFilterTags.has(areaTag)) return false;
        } else if (hasUserTags) {
          if (!state.customFilterTags.has(userTag)) return false;
        }
      }

      if (q) {
        const text = `${ev.title || ""} ${ev.area || ""} ${ev.owner_user || ""} ${ev.notes || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }

  function badgeClassForBrand(marca) {
    if (marca === "Livva") return "Livva";
    if (marca === "Azzorti") return "Azzorti";
    return "AzzLivv";
  }

  /* ==========================================================================
     9. RENDER ORCHESTRATOR
     ========================================================================== */
  function renderAll() {
    if (!rawData) return;
    const activeCamps = getActiveCampaigns();
    const selectedCamps = getSelectedCampaigns();
    const selectedOfficial = getSelectedOfficialActivities();
    const visibleCustom = getVisibleCustomEvents();

    updateChecklistButtonLabels();

    // Update KPIs
    els.kpiActivities.innerHTML = `Cronograma activas: <strong>${selectedOfficial.length}</strong>`;
    els.kpiCustomEvents.innerHTML = `Eventos extra: <strong>${visibleCustom.length}</strong>`;

    if (state.viewMode === "calendar") {
      els.calendarWrapper.style.display = "block";
      els.ganttWrapper.style.display = "none";
      els.matrixWrapper.style.display = "none";
      els.calendarToolbarOptions.style.display = "flex";
      els.ganttToolbarOptions.style.display = "none";
      renderCalendar(selectedOfficial, visibleCustom, selectedCamps);
    } else if (state.viewMode === "gantt") {
      els.calendarWrapper.style.display = "none";
      els.ganttWrapper.style.display = "flex";
      els.matrixWrapper.style.display = "none";
      els.calendarToolbarOptions.style.display = "none";
      els.ganttToolbarOptions.style.display = "flex";
      const ganttActs = state.showCatalogInGantt ? getCatalogActivitiesForExploration() : selectedOfficial;
      renderGantt(ganttActs, visibleCustom, selectedCamps, activeCamps);
    } else {
      els.calendarWrapper.style.display = "none";
      els.ganttWrapper.style.display = "none";
      els.matrixWrapper.style.display = "block";
      els.calendarToolbarOptions.style.display = "none";
      els.ganttToolbarOptions.style.display = "flex";
      const matrixActs = state.showCatalogInGantt ? getCatalogActivitiesForExploration() : selectedOfficial;
      renderMatrix(matrixActs, selectedCamps, activeCamps);
    }
  }

  /* ==========================================================================
     10. MINIMALIST MONTHLY CALENDAR VIEW (MAIN VIEW)
     ========================================================================== */
  function renderCalendar(selectedOfficial, visibleCustom, selectedCamps) {
    const eventsByDate = new Map();
    const monthsMap = new Map(); // "YYYY-MM" -> { year, month, ym, events: [] }

    function addEventToMaps(fStr, evObj) {
      const dt = parseYMD(fStr);
      if (!dt) return;
      const ym = fStr.slice(0, 7);
      if (!eventsByDate.has(fStr)) eventsByDate.set(fStr, []);
      eventsByDate.get(fStr).push(evObj);

      if (!monthsMap.has(ym)) {
        monthsMap.set(ym, {
          year: dt.getFullYear(),
          month: dt.getMonth(),
          ym,
          events: [],
        });
      }
      monthsMap.get(ym).events.push(evObj);
    }

    // 1. Add Official Cronograma Events for Selected Campaigns
    for (const act of selectedOfficial) {
      for (const camp of selectedCamps) {
        const fStr = act.fechas[camp.id];
        if (!fStr) continue;
        addEventToMaps(fStr, {
          type: "official",
          dateStr: fStr,
          act,
          camp,
          dh: act.dh[camp.id] ?? act.dias ?? 0,
        });
      }
    }

    // 2. Add Custom Events
    for (const cev of visibleCustom) {
      if (!cev.event_date) continue;
      addEventToMaps(cev.event_date, {
        type: "custom",
        dateStr: cev.event_date,
        custom: cev,
        dh: cev.dh || 1,
      });
    }

    //Onboarding banner if 0 official activities are selected
    let onboardingBannerHtml = "";
    if (state.selectedActivityNos.size === 0) {
      const targetName = state.targetUserId || "Diseñador(a)";
      onboardingBannerHtml = `
        <div class="onboarding-card">
          <h3>👋 ¡Hola, ${targetName}! Tu lienzo de calendario está listo</h3>
          <p>
            Por defecto <strong>todas las áreas del cronograma oficial están apagadas</strong> para evitar saturarte con procesos que no necesitas.
            Elige con un clic qué área quieres encender o agrega tus propios eventos adicionales:
          </p>
          <div class="onboarding-presets">
            <button type="button" class="btn btn-primary" data-preset="textil">🎨 Encender Diseño Textil (Estampación)</button>
            <button type="button" class="btn btn-outline" data-preset="disgraf">✏️ Encender Diseño Gráfico (DisGraf)</button>
            <button type="button" class="btn btn-outline" data-preset="moda">👗 Encender Desarrollos Moda MO (2D/3D)</button>
            <button type="button" class="btn btn-outline" data-preset="ingenieria">📐 Encender Ingeniería / Patronaje</button>
            <button type="button" class="btn btn-add-event" id="btnOnboardingAddEvent">✨ + Crear Evento Adicional</button>
          </div>
        </div>
      `;
    }

    // If no months have events yet, still render a default month sheet (e.g. June 2027 or current month) so user can click '+' on any day!
    if (monthsMap.size === 0) {
      const fallbackDate = parseYMD("2027-06-01") || new Date();
      const ym = formatYMD(fallbackDate).slice(0, 7);
      monthsMap.set(ym, {
        year: fallbackDate.getFullYear(),
        month: fallbackDate.getMonth(),
        ym,
        events: [],
      });
    }

    const sortedMonthKeys = Array.from(monthsMap.keys()).sort();

    if (state.calCurrentMonthIndex >= sortedMonthKeys.length) {
      state.calCurrentMonthIndex = sortedMonthKeys.length - 1;
    }
    if (state.calCurrentMonthIndex < 0) {
      state.calCurrentMonthIndex = 0;
    }

    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];

    if (state.calShowAllMonths) {
      els.calCurrentMonthLabel.textContent = `Todos los meses (${sortedMonthKeys.length})`;
    } else {
      const activeKey = sortedMonthKeys[state.calCurrentMonthIndex];
      const mObj = monthsMap.get(activeKey);
      els.calCurrentMonthLabel.textContent = `${monthNames[mObj.month]} ${mObj.year} (${state.calCurrentMonthIndex + 1} de ${sortedMonthKeys.length})`;
    }

    let campHeaderBadge = "";
    if (selectedCamps.length === 0) {
      campHeaderBadge = "Sin campañas oficiales seleccionadas";
    } else if (selectedCamps.length === 1) {
      campHeaderBadge = `${selectedCamps[0].shortLabel} (${selectedCamps[0].fullLabel})`;
    } else if (selectedCamps.length <= 4) {
      campHeaderBadge = selectedCamps.map((c) => c.shortLabel).join(" • ");
    } else {
      campHeaderBadge = `${selectedCamps.length} campañas seleccionadas`;
    }

    const keysToRender = state.calShowAllMonths ? sortedMonthKeys : [sortedMonthKeys[state.calCurrentMonthIndex]];
    const sheetsHtml = [onboardingBannerHtml];

    for (const ym of keysToRender) {
      const mInfo = monthsMap.get(ym);
      const yr = mInfo.year;
      const mo = mInfo.month;

      const firstDayOfMonth = new Date(yr, mo, 1, 12, 0, 0);
      let startingDow = firstDayOfMonth.getDay();
      startingDow = startingDow === 0 ? 6 : startingDow - 1;

      const lastDayOfMonth = new Date(yr, mo + 1, 0, 12, 0, 0);
      const totalDaysInMonth = lastDayOfMonth.getDate();
      const prevMonthLastDay = new Date(yr, mo, 0, 12, 0, 0).getDate();

      const weeks = [];
      let currentWeek = [];

      for (let p = startingDow - 1; p >= 0; p--) {
        const dayNum = prevMonthLastDay - p;
        const prevDt = new Date(yr, mo - 1, dayNum, 12, 0, 0);
        currentWeek.push({
          date: prevDt,
          dateStr: formatYMD(prevDt),
          dayNum,
          isOtherMonth: true,
        });
      }

      for (let d = 1; d <= totalDaysInMonth; d++) {
        const curDt = new Date(yr, mo, d, 12, 0, 0);
        currentWeek.push({
          date: curDt,
          dateStr: formatYMD(curDt),
          dayNum: d,
          isOtherMonth: false,
        });
        if (currentWeek.length === 7) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }

      if (currentWeek.length > 0) {
        let nextDay = 1;
        while (currentWeek.length < 7) {
          const nextDt = new Date(yr, mo + 1, nextDay, 12, 0, 0);
          currentWeek.push({
            date: nextDt,
            dateStr: formatYMD(nextDt),
            dayNum: nextDay,
            isOtherMonth: true,
          });
          nextDay++;
        }
        weeks.push(currentWeek);
      }

      const rowsHtml = [];
      for (const w of weeks) {
        const cellsHtml = [];
        for (const cell of w) {
          const isToday = cell.dateStr === TODAY_STR;
          const dayEvents = eventsByDate.get(cell.dateStr) || [];

          const eventsHtml = [];
          for (const ev of dayEvents) {
            if (ev.type === "official") {
              const bClass = badgeClassForBrand(ev.act.marca);
              eventsHtml.push(`
                <div class="calendar-event-card event-${bClass}" data-type="official" data-no="${ev.act.no}" data-camp="${ev.camp.shortLabel}" data-campfull="${ev.camp.fullLabel}" data-start="${formatYMD(subtractBusinessDays(ev.dateStr, ev.dh))}" data-end="${ev.dateStr}" data-dh="${ev.dh}">
                  <div class="event-meta-line">
                    <span class="event-camp-badge">${ev.camp.shortLabel}</span>
                    <span class="event-brand-badge brand-${bClass}">${ev.act.marca}</span>
                    <span class="event-dh-badge">${ev.dh} DH</span>
                  </div>
                  <div class="event-full-title">
                    <span class="event-act-no">#${ev.act.no}</span> ${ev.act.actividad}
                  </div>
                </div>
              `);
            } else {
              const cev = ev.custom;
              const cat = cev.category || "emerald";
              const bClass = badgeClassForBrand(cev.marca || "Azz Livv");
              eventsHtml.push(`
                <div class="calendar-event-card event-custom-${cat}" data-type="custom" data-evid="${cev.id}" title="Clic para ver detalles o editar este evento">
                  <div class="event-meta-line">
                    <span class="event-custom-badge">📌 ${cev.area || "Diseño"}</span>
                    <span class="event-user-badge">👤 ${cev.owner_user || "Equipo"}</span>
                    <span class="event-brand-badge brand-${bClass}">${cev.marca || "Azz Livv"}</span>
                  </div>
                  <div class="event-full-title">${cev.title}</div>
                  ${cev.notes ? `<div class="event-notes-preview">${cev.notes}</div>` : ""}
                </div>
              `);
            }
          }

          cellsHtml.push(`
            <td class="calendar-day-cell ${cell.isOtherMonth ? "day-other-month" : ""} ${isToday ? "day-today" : ""}" data-date="${cell.dateStr}">
              <div class="day-num-wrap">
                <span class="day-num ${cell.isOtherMonth ? "day-num-other" : ""}">${cell.dayNum}</span>
                <div style="display:flex;align-items:center;gap:4px">
                  ${isToday ? `<span class="today-chip">Hoy</span>` : ""}
                  <button type="button" class="day-add-btn" data-adddate="${cell.dateStr}" title="Agregar evento en el ${cell.dateStr}">+</button>
                </div>
              </div>
              <div class="calendar-events-list">
                ${eventsHtml.join("")}
              </div>
            </td>
          `);
        }
        rowsHtml.push(`<tr>${cellsHtml.join("")}</tr>`);
      }

      sheetsHtml.push(`
        <div class="calendar-month-sheet">
          <div class="calendar-month-header">
            <div>
              <div class="calendar-month-title">${monthNames[mo]} ${yr}</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px">
                ${mInfo.events.length} evento${mInfo.events.length === 1 ? "" : "s"} en este mes
                • Perfil: <strong>${state.targetUserId || "Equipo"}</strong>
              </div>
            </div>
            <div class="calendar-campaign-meta">
              <span class="calendar-campaign-badge">${campHeaderBadge}</span>
              <span class="calendar-campaign-sub">Agenda &amp; Cronograma Azzorti • Livva</span>
            </div>
          </div>

          <table class="calendar-grid-table">
            <thead>
              <tr>
                <th>Lunes</th>
                <th>Martes</th>
                <th>Miércoles</th>
                <th>Jueves</th>
                <th>Viernes</th>
                <th>Sábado</th>
                <th>Domingo</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml.join("")}
            </tbody>
          </table>
        </div>
      `);
    }

    els.calendarContainer.innerHTML = sheetsHtml.join("");

    // Bind Onboarding Preset Buttons
    els.calendarContainer.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const preset = btn.getAttribute("data-preset");
        applyQuickPreset(preset);
      });
    });

    const btnOnbAdd = document.getElementById("btnOnboardingAddEvent");
    if (btnOnbAdd) {
      btnOnbAdd.addEventListener("click", () => openCustomEventModal(null, TODAY_STR));
    }

    // Bind '+' Day Add Buttons
    els.calendarContainer.querySelectorAll(".day-add-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const dateStr = btn.getAttribute("data-adddate");
        openCustomEventModal(null, dateStr);
      });
    });

    // Bind Custom Event Click (Edit) & Official Event Hover Tooltip
    const actMap = new Map(rawData.activities.map((a) => [String(a.no), a]));
    els.calendarContainer.querySelectorAll(".calendar-event-card").forEach((card) => {
      const cType = card.getAttribute("data-type");
      if (cType === "custom") {
        card.addEventListener("click", (e) => {
          e.stopPropagation();
          const evId = card.getAttribute("data-evid");
          const found = customEvents.find((x) => String(x.id) === String(evId));
          if (found) openCustomEventModal(found);
        });
      } else {
        card.addEventListener("mouseenter", (e) => {
          const act = actMap.get(card.getAttribute("data-no"));
          if (!act) return;
          els.tooltip.innerHTML = `
            <h4>#${act.no} — ${act.actividad}</h4>
            <div class="tooltip-grid">
              <span class="lbl">Marca:</span><span><strong>${act.marca}</strong></span>
              <span class="lbl">Proceso:</span><span>${act.proceso}</span>
              <span class="lbl">Área:</span><span>${act.area}</span>
              <span class="lbl">Campaña:</span><span><strong>${card.getAttribute("data-camp")} (${card.getAttribute("data-campfull")})</strong></span>
              <span class="lbl">Días Hábiles:</span><span>${card.getAttribute("data-dh")} DH</span>
              <span class="lbl">Fecha Inicio:</span><span>${formatHumanDate(card.getAttribute("data-start"))}</span>
              <span class="lbl">Fecha Entrega:</span><span><strong>${formatHumanDate(card.getAttribute("data-end"))} (${card.getAttribute("data-end")})</strong></span>
            </div>
          `;
          els.tooltip.style.display = "block";
          moveTooltip(e);
        });
        card.addEventListener("mousemove", moveTooltip);
        card.addEventListener("mouseleave", () => {
          els.tooltip.style.display = "none";
        });
      }
    });
  }

  function applyQuickPreset(preset) {
    if (!rawData) return;
    for (const act of rawData.activities) {
      if (preset === "textil" && (act.proceso === "Estampacion Continua" || act.proceso === "Estampacion Local")) {
        state.selectedActivityNos.add(act.no);
      } else if (preset === "disgraf" && (act.area === "DisGraf" || act.proceso === "DisGraf")) {
        state.selectedActivityNos.add(act.no);
      } else if (preset === "moda" && act.proceso.startsWith("Desarrollos Moda")) {
        state.selectedActivityNos.add(act.no);
      } else if (preset === "ingenieria" && (act.area === "Ingenieria" || act.proceso.startsWith("Ingenieria"))) {
        state.selectedActivityNos.add(act.no);
      }
    }
    populateFilterControls();
    scheduleSavePreferences();
    renderAll();
  }

  /* ==========================================================================
     11. CUSTOM EVENT MODAL (ADD / EDIT / DELETE IN SUPABASE)
     ========================================================================== */
  function openCustomEventModal(existingEvent, defaultDateStr) {
    // Populate owner select
    els.evOwnerInput.innerHTML = "";
    for (const p of TEAM_PROFILES) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      els.evOwnerInput.appendChild(opt);
    }

    if (existingEvent) {
      els.customModalTitle.textContent = "✏️ Editar Evento Adicional";
      els.evIdInput.value = existingEvent.id;
      els.evTitleInput.value = existingEvent.title || "";
      els.evDateInput.value = existingEvent.event_date || TODAY_STR;
      els.evDhInput.value = existingEvent.dh || 1;
      els.evAreaInput.value = existingEvent.area || "Diseño Textil (Aglab)";
      els.evOwnerInput.value = existingEvent.owner_user || state.targetUserId || "DANI";
      els.evMarcaInput.value = existingEvent.marca || "Azz Livv";
      els.evCategoryInput.value = existingEvent.category || "emerald";
      els.evNotesInput.value = existingEvent.notes || "";
      els.btnDeleteCustomEvent.style.display = "inline-flex";
    } else {
      els.customModalTitle.textContent = "✨ Agregar Nuevo Evento al Calendario";
      els.evIdInput.value = "";
      els.evTitleInput.value = "";
      els.evDateInput.value = defaultDateStr || "2027-06-15";
      els.evDhInput.value = 1;
      els.evAreaInput.value = "Diseño Textil (Aglab)";
      els.evOwnerInput.value = state.targetUserId || state.loggedInUserId || "DANI";
      els.evMarcaInput.value = "Azz Livv";
      els.evCategoryInput.value = "emerald";
      els.evNotesInput.value = "";
      els.btnDeleteCustomEvent.style.display = "none";
    }

    els.customEventModal.style.display = "flex";
    setTimeout(() => els.evTitleInput.focus(), 50);
  }

  async function handleSaveCustomEvent(e) {
    e.preventDefault();
    const id = els.evIdInput.value.trim();
    const payload = {
      title: els.evTitleInput.value.trim(),
      event_date: els.evDateInput.value,
      dh: Math.max(1, parseInt(els.evDhInput.value, 10) || 1),
      area: els.evAreaInput.value,
      owner_user: els.evOwnerInput.value,
      marca: els.evMarcaInput.value,
      category: els.evCategoryInput.value,
      notes: els.evNotesInput.value.trim(),
      created_by: state.loggedInUserId || "DANI",
    };

    if (!payload.title || !payload.event_date) return;

    els.customEventModal.style.display = "none";
    setCloudStatus("☁️ Guardando evento en la nube...", false);

    try {
      if (id) {
        // Update existing
        const idx = customEvents.findIndex((x) => String(x.id) === String(id));
        if (idx !== -1) customEvents[idx] = { ...customEvents[idx], ...payload };

        if (sbClient) {
          const { data, error } = await sbClient
            .from("custom_events")
            .update(payload)
            .eq("id", id)
            .select()
            .single();
          if (!error && data && idx !== -1) customEvents[idx] = data;
        }
      } else {
        // Insert new
        const tempId = crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}`;
        const newEv = { id: tempId, ...payload, created_at: new Date().toISOString() };
        customEvents.push(newEv);

        if (sbClient) {
          const { data, error } = await sbClient
            .from("custom_events")
            .insert([payload])
            .select()
            .single();
          if (!error && data) {
            const idx = customEvents.findIndex((x) => x.id === tempId);
            if (idx !== -1) customEvents[idx] = data;
          }
        }
      }

      saveLocalCustomEventsCache();
      setCloudStatus("☁️ Evento guardado y sincronizado", false);
      populateFilterControls();
      renderAll();
    } catch (err) {
      console.warn("Error guardando evento en Supabase:", err);
      saveLocalCustomEventsCache();
      setCloudStatus("☁️ Evento guardado localmente", true);
      renderAll();
    }
  }

  async function handleDeleteCustomEvent() {
    const id = els.evIdInput.value.trim();
    if (!id) return;
    if (!confirm("¿Seguro que deseas eliminar este evento adicional del calendario?")) return;

    customEvents = customEvents.filter((x) => String(x.id) !== String(id));
    saveLocalCustomEventsCache();
    els.customEventModal.style.display = "none";
    setCloudStatus("☁️ Eliminando evento...", false);

    try {
      if (sbClient) {
        await sbClient.from("custom_events").delete().eq("id", id);
        setCloudStatus("☁️ Evento eliminado de la nube", false);
      }
    } catch (e) {
      console.warn("Error eliminando evento:", e);
    }

    populateFilterControls();
    renderAll();
  }

  /* ==========================================================================
     12. GANTT VIEW (SECONDARY VIEW)
     ========================================================================== */
  function renderGantt(activitiesToPlot, visibleCustom, selectedCamps, activeCamps) {
    const campsToPlot = selectedCamps.length > 0 ? selectedCamps : activeCamps.slice(0, 1);
    if (campsToPlot.length === 0) return;

    const items = [];
    let minDate = null;
    let maxDate = null;

    // 1. Add Custom Events into Gantt under "📌 EVENTOS EXTRA"
    for (const cev of visibleCustom) {
      const endDt = parseYMD(cev.event_date);
      if (!endDt) continue;
      const dhVal = cev.dh || 1;
      const startDt = subtractBusinessDays(cev.event_date, dhVal) || endDt;
      if (!minDate || startDt < minDate) minDate = new Date(startDt.getTime());
      if (!maxDate || endDt > maxDate) maxDate = new Date(endDt.getTime());

      items.push({
        isCustom: true,
        custom: cev,
        act: {
          no: "📌",
          actividad: cev.title,
          proceso: `📌 Eventos Extra (${cev.area || "Equipo"})`,
          area: cev.owner_user || "Equipo",
          marca: cev.marca || "Azz Livv",
          dias: dhVal,
        },
        bars: [
          {
            camp: { shortLabel: cev.owner_user || "Extra", fullLabel: cev.area || "Evento Adicional" },
            startDt,
            endDt,
            startStr: formatYMD(startDt),
            endStr: cev.event_date,
            dh: dhVal,
          },
        ],
        primaryStart: startDt,
        primaryEnd: endDt,
        primaryDh: dhVal,
      });
    }

    // 2. Add Official Cronograma Activities
    for (const act of activitiesToPlot) {
      const bars = [];
      for (const camp of campsToPlot) {
        const endStr = act.fechas[camp.id];
        if (!endStr) continue;
        const endDt = parseYMD(endStr);
        if (!endDt) continue;
        const dhVal = act.dh[camp.id] ?? act.dias ?? 0;
        const startDt = subtractBusinessDays(endStr, dhVal) || endDt;
        bars.push({
          camp,
          startDt,
          endDt,
          startStr: formatYMD(startDt),
          endStr,
          dh: dhVal,
        });
        if (!minDate || startDt < minDate) minDate = new Date(startDt.getTime());
        if (!maxDate || endDt > maxDate) maxDate = new Date(endDt.getTime());
      }

      const primaryBar = bars[0] || null;
      items.push({
        isCustom: false,
        act,
        bars,
        primaryStart: primaryBar ? primaryBar.startDt : null,
        primaryEnd: primaryBar ? primaryBar.endDt : null,
        primaryDh: primaryBar ? primaryBar.dh : act.dias,
      });
    }

    if (!minDate || !maxDate) {
      minDate = parseYMD("2027-05-01");
      maxDate = parseYMD("2027-09-01");
    } else {
      minDate = addDays(minDate, -10);
      maxDate = addDays(maxDate, 18);
    }

    items.sort((a, b) => {
      if (state.sortBy === "no") return (Number(a.act.no) || 0) - (Number(b.act.no) || 0);
      if (state.sortBy === "proceso") {
        const cmp = a.act.proceso.localeCompare(b.act.proceso, "es");
        if (cmp !== 0) return cmp;
      }
      if (a.primaryStart && b.primaryStart) {
        const diff = a.primaryStart.getTime() - b.primaryStart.getTime();
        if (diff !== 0) return diff;
      } else if (a.primaryStart) return -1;
      else if (b.primaryStart) return 1;
      return 0;
    });

    const displayRows = [];
    if (state.groupByProceso) {
      const groupsMap = new Map();
      for (const it of items) {
        const p = it.act.proceso;
        if (!groupsMap.has(p)) {
          groupsMap.set(p, { proceso: p, children: [], minStart: null, maxEnd: null });
        }
        const g = groupsMap.get(p);
        g.children.push(it);
        for (const b of it.bars) {
          if (!g.minStart || b.startDt < g.minStart) g.minStart = new Date(b.startDt.getTime());
          if (!g.maxEnd || b.endDt > g.maxEnd) g.maxEnd = new Date(b.endDt.getTime());
        }
      }

      const groupList = Array.from(groupsMap.values());
      for (const g of groupList) {
        const isCollapsed = state.collapsedGroups.has(g.proceso);
        displayRows.push({
          type: "group",
          proceso: g.proceso,
          count: g.children.length,
          children: g.children,
          minStart: g.minStart,
          maxEnd: g.maxEnd,
          collapsed: isCollapsed,
        });
        if (!isCollapsed) {
          for (const child of g.children) displayRows.push({ type: "item", item: child });
        }
      }
    } else {
      for (const it of items) displayRows.push({ type: "item", item: it });
    }

    const totalDays = Math.max(30, daysBetween(minDate, maxDate) + 1);
    let pxPerDay = 10;
    if (state.zoom === "day") pxPerDay = 28;
    else if (state.zoom === "week") pxPerDay = 10;
    else if (state.zoom === "month") pxPerDay = 3.8;

    const totalWidth = Math.ceil(totalDays * pxPerDay);
    const monthsHtml = [];
    const ticksHtml = [];
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    let dayIdx = 0;
    while (dayIdx < totalDays) {
      const d = addDays(minDate, dayIdx);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      let spanDays = 0;
      while (dayIdx + spanDays < totalDays) {
        const td = addDays(minDate, dayIdx + spanDays);
        if (td.getMonth() !== mo || td.getFullYear() !== yr) break;
        spanDays++;
      }
      const w = spanDays * pxPerDay;
      monthsHtml.push(`<div class="timeline-month-cell" style="width:${w}px">${monthNames[mo]} ${yr}</div>`);
      dayIdx += spanDays;
    }

    if (state.zoom === "day") {
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(minDate, i);
        const dow = d.getDay();
        const isWknd = dow === 0 || dow === 6;
        ticksHtml.push(
          `<div class="timeline-tick-cell" style="width:${pxPerDay}px;${isWknd ? "background:#e2e8f0" : ""}">${d.getDate()}</div>`
        );
      }
    } else if (state.zoom === "week") {
      let i = 0;
      while (i < totalDays) {
        const d = addDays(minDate, i);
        const step = Math.min(7, totalDays - i);
        ticksHtml.push(
          `<div class="timeline-tick-cell" style="width:${step * pxPerDay}px">${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}</div>`
        );
        i += step;
      }
    } else {
      let i = 0;
      while (i < totalDays) {
        const d = addDays(minDate, i);
        const step = Math.min(15, totalDays - i);
        ticksHtml.push(
          `<div class="timeline-tick-cell" style="width:${step * pxPerDay}px">${d.getDate() === 1 ? "1" : "15"} ${monthNames[d.getMonth()].slice(0, 3)}</div>`
        );
        i += step;
      }
    }

    els.ganttTimelineHeader.innerHTML = `
      <div class="timeline-canvas" style="width:${totalWidth}px">
        <div class="timeline-months-row">${monthsHtml.join("")}</div>
        <div class="timeline-ticks-row">${ticksHtml.join("")}</div>
      </div>
    `;

    const leftHtml = [];
    const rightHtml = [];

    for (let rIdx = 0; rIdx < displayRows.length; rIdx++) {
      const rowObj = displayRows[rIdx];
      if (rowObj.type === "group") {
        const icon = rowObj.collapsed ? "▶" : "▼";
        const rangeTxt =
          rowObj.minStart && rowObj.maxEnd
            ? `${formatHumanDate(formatYMD(rowObj.minStart))} – ${formatHumanDate(formatYMD(rowObj.maxEnd))}`
            : "Sin fechas";
        const officialChildren = rowObj.children.filter((c) => !c.isCustom);
        const allGroupChecked =
          officialChildren.length > 0 && officialChildren.every((c) => state.selectedActivityNos.has(c.act.no));

        leftHtml.push(`
          <div class="gantt-row-left group-row" data-proceso="${rowObj.proceso}">
            <span style="display:flex;align-items:center;justify-content:center" onclick="event.stopPropagation()">
              ${
                officialChildren.length > 0
                  ? `<input type="checkbox" class="group-checkbox" data-proceso="${rowObj.proceso}" ${allGroupChecked ? "checked" : ""} />`
                  : `<span>📌</span>`
              }
            </span>
            <span class="group-title-click">📁 ${rowObj.proceso} <small style="font-weight:500;color:#475569">(${rowObj.count})</small></span>
            <span style="font-size:11px;font-weight:500;color:#475569;display:flex;align-items:center;gap:6px">
              ${rangeTxt} <span style="font-size:10px">${icon}</span>
            </span>
          </div>
        `);

        let summaryBarHtml = "";
        if (rowObj.minStart && rowObj.maxEnd) {
          const startOffset = daysBetween(minDate, rowObj.minStart);
          const durDays = Math.max(1, daysBetween(rowObj.minStart, rowObj.maxEnd) + 1);
          const leftPx = Math.round(startOffset * pxPerDay);
          const widthPx = Math.max(10, Math.round(durDays * pxPerDay));
          summaryBarHtml = `<div class="gantt-bar group-summary-bar" style="left:${leftPx}px;width:${widthPx}px"></div>`;
        }
        rightHtml.push(`<div class="gantt-row-right group-row">${summaryBarHtml}</div>`);
      } else {
        const { isCustom, act, bars, primaryDh } = rowObj.item;
        const bClass = badgeClassForBrand(act.marca);
        const isChecked = isCustom ? true : state.selectedActivityNos.has(act.no);

        leftHtml.push(`
          <div class="gantt-row-left ${isChecked ? "selected-row" : ""}" title="${act.actividad}">
            <span style="display:flex;align-items:center;justify-content:center">
              ${
                isCustom
                  ? `<span>📌</span>`
                  : `<input type="checkbox" class="act-checkbox" data-no="${act.no}" ${isChecked ? "checked" : ""} />`
              }
            </span>
            <span class="cell-no">${isCustom ? "EXTRA" : `#${act.no}`}</span>
            <span class="cell-act">${act.actividad}</span>
            <span class="cell-area">${act.area}</span>
            <span><span class="badge-marca badge-${bClass}">${act.marca}</span></span>
            <span class="cell-dh">${primaryDh}d</span>
          </div>
        `);

        const rowBarsHtml = [];
        const isMulti = campsToPlot.length > 1;
        for (const b of bars) {
          const startOffset = daysBetween(minDate, b.startDt);
          const durDays = Math.max(1, daysBetween(b.startDt, b.endDt) + 1);
          const leftPx = Math.round(startOffset * pxPerDay);
          const widthPx = Math.max(14, Math.round(durDays * pxPerDay));
          const insideText = isMulti ? b.camp.shortLabel : widthPx > 95 ? `${b.endStr}` : "";
          rowBarsHtml.push(
            `<div class="gantt-bar bar-${bClass}" style="left:${leftPx}px;width:${widthPx}px">${insideText}</div>`
          );
        }
        rightHtml.push(`<div class="gantt-row-right">${rowBarsHtml.join("")}</div>`);
      }
    }

    els.ganttLeftBody.innerHTML = leftHtml.join("");
    els.ganttTimelineBody.innerHTML = `<div class="timeline-canvas" style="width:${totalWidth}px;min-height:100%">${rightHtml.join("")}</div>`;

    // Bind checkboxes in Gantt
    els.ganttLeftBody.querySelectorAll(".act-checkbox").forEach((chk) => {
      chk.addEventListener("change", (e) => {
        e.stopPropagation();
        const actNo = parseInt(chk.getAttribute("data-no"), 10);
        if (chk.checked) state.selectedActivityNos.add(actNo);
        else state.selectedActivityNos.delete(actNo);
        populateFilterControls();
        scheduleSavePreferences();
        renderAll();
      });
    });

    els.ganttLeftBody.querySelectorAll(".group-checkbox").forEach((gChk) => {
      gChk.addEventListener("change", (e) => {
        e.stopPropagation();
        const proc = gChk.getAttribute("data-proceso");
        const procActs = rawData.activities.filter((a) => a.proceso === proc);
        if (gChk.checked) procActs.forEach((a) => state.selectedActivityNos.add(a.no));
        else procActs.forEach((a) => state.selectedActivityNos.delete(a.no));
        populateFilterControls();
        scheduleSavePreferences();
        renderAll();
      });
    });

    els.ganttLeftBody.querySelectorAll(".gantt-row-left.group-row").forEach((el) => {
      el.addEventListener("click", () => {
        const p = el.getAttribute("data-proceso");
        if (state.collapsedGroups.has(p)) state.collapsedGroups.delete(p);
        else state.collapsedGroups.add(p);
        renderAll();
      });
    });
  }

  /* ==========================================================================
     13. MATRIX TABLE VIEW (SECONDARY VIEW)
     ========================================================================== */
  function renderMatrix(activitiesToDisplay, selectedCamps, activeCamps) {
    const campsToDisplay = selectedCamps.length > 0 ? selectedCamps : activeCamps;
    const thRow1 = [
      `<th class="sticky-col-1" rowspan="2" style="width:34px;text-align:center">☑️</th>`,
      `<th class="sticky-col-2" rowspan="2">No</th>`,
      `<th class="sticky-col-3" rowspan="2">Actividad</th>`,
      `<th class="sticky-col-4" rowspan="2">Proceso</th>`,
      `<th class="sticky-col-5" rowspan="2">Marca</th>`,
      `<th rowspan="2">Área (DH)</th>`,
    ];
    const thRow2 = [];

    for (const c of campsToDisplay) {
      thRow1.push(`<th style="text-align:center">${c.shortLabel}</th>`);
      thRow2.push(`<th style="text-align:center;color:#475569">${c.fullLabel}</th>`);
    }

    els.matrixTableHead.innerHTML = `<tr>${thRow1.join("")}</tr><tr>${thRow2.join("")}</tr>`;

    const bodyRows = [];
    for (const act of activitiesToDisplay) {
      const bClass = badgeClassForBrand(act.marca);
      const isChecked = state.selectedActivityNos.has(act.no);
      const cells = [
        `<td class="sticky-col-1" style="text-align:center"><input type="checkbox" class="act-checkbox" data-no="${act.no}" ${isChecked ? "checked" : ""} /></td>`,
        `<td class="sticky-col-2 cell-no">#${act.no}</td>`,
        `<td class="sticky-col-3" title="${act.actividad}">${act.actividad}</td>`,
        `<td class="sticky-col-4" title="${act.proceso}">${act.proceso}</td>`,
        `<td class="sticky-col-5"><span class="badge-marca badge-${bClass}">${act.marca}</span></td>`,
        `<td>${act.area} <small style="color:#64748b">(${act.dias}d)</small></td>`,
      ];
      for (const c of campsToDisplay) {
        const f = act.fechas[c.id];
        cells.push(`<td style="text-align:center;font-variant-numeric:tabular-nums">${f || "—"}</td>`);
      }
      bodyRows.push(`<tr class="${isChecked ? "selected-row" : ""}">${cells.join("")}</tr>`);
    }
    els.matrixTableBody.innerHTML = bodyRows.join("");

    els.matrixTableBody.querySelectorAll(".act-checkbox").forEach((chk) => {
      chk.addEventListener("change", () => {
        const actNo = parseInt(chk.getAttribute("data-no"), 10);
        if (chk.checked) state.selectedActivityNos.add(actNo);
        else state.selectedActivityNos.delete(actNo);
        populateFilterControls();
        scheduleSavePreferences();
        renderAll();
      });
    });
  }

  /* ==========================================================================
     14. PDF, ICS & CSV EXPORTS (INCLUDES OFFICIAL + CUSTOM EVENTS)
     ========================================================================== */
  function printPdfCalendar() {
    state.calShowAllMonths = true;
    if (els.chkCalShowAllMonths) els.chkCalShowAllMonths.checked = true;

    state.viewMode = "calendar";
    els.tabCalendar.classList.add("active");
    els.tabGantt.classList.remove("active");
    els.tabMatrix.classList.remove("active");
    renderAll();

    const selectedCamps = getSelectedCampaigns();
    const campNames = selectedCamps.map((c) => c.shortLabel.replace(/\s+/g, "_")).join("-");
    const oldTitle = document.title;
    document.title = `Calendario_${state.targetUserId || "Diseno"}_${campNames || "Azzorti_Livva"}`;

    document.body.classList.add("printing-calendar");
    window.print();
    setTimeout(() => {
      document.body.classList.remove("printing-calendar");
      document.title = oldTitle;
    }, 1000);
  }

  function printPdfGantt() {
    state.viewMode = "gantt";
    els.tabGantt.classList.add("active");
    els.tabCalendar.classList.remove("active");
    els.tabMatrix.classList.remove("active");
    renderAll();

    document.body.classList.add("printing-gantt");
    window.print();
    setTimeout(() => {
      document.body.classList.remove("printing-gantt");
    }, 1000);
  }

  function exportFilteredToICS() {
    const selectedOfficial = getSelectedOfficialActivities();
    const visibleCustom = getVisibleCustomEvents();
    const selectedCamps = getSelectedCampaigns();
    const campsToExport = selectedCamps.length > 0 ? selectedCamps : getActiveCampaigns();

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Azzorti Livva//Agenda Diseno//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:Agenda ${state.targetUserId || "Azzorti Livva"}`,
      "X-WR-TIMEZONE:America/Bogota",
    ];
    const dtstamp = "20261022T120000Z";
    let count = 0;

    // 1. Official events
    for (const act of selectedOfficial) {
      for (const camp of campsToExport) {
        if (!camp) continue;
        const fStr = act.fechas[camp.id];
        const dt = parseYMD(fStr);
        if (!dt) continue;
        const endDt = addDays(dt, 1);
        const sVal = formatYMD(dt).replace(/-/g, "");
        const eVal = formatYMD(endDt).replace(/-/g, "");
        const dh = act.dh[camp.id] ?? act.dias ?? 0;
        const uid = `act-${act.no}-${camp.adv}-${sVal}@azzorti-livva.com`;
        const summary = `[${act.marca.toUpperCase()}] (${camp.shortLabel}) ${act.actividad}`;
        const desc = `Marca: ${act.marca}\\nCampaña: ${camp.shortLabel}\\nProceso: ${act.proceso}\\nÁrea: ${act.area}\\nDH: ${dh}`;
        lines.push(
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART;VALUE=DATE:${sVal}`,
          `DTEND;VALUE=DATE:${eVal}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${desc}`,
          "STATUS:CONFIRMED",
          "END:VEVENT"
        );
        count++;
      }
    }

    // 2. Custom events
    for (const cev of visibleCustom) {
      const dt = parseYMD(cev.event_date);
      if (!dt) continue;
      const endDt = addDays(dt, 1);
      const sVal = formatYMD(dt).replace(/-/g, "");
      const eVal = formatYMD(endDt).replace(/-/g, "");
      const uid = `custom-${cev.id}@azzorti-livva.com`;
      const summary = `[📌 ${cev.area || "EXTRA"} - ${cev.owner_user || "Equipo"}] ${cev.title}`;
      const desc = `Responsable: ${cev.owner_user}\\nÁrea: ${cev.area}\\nMarca: ${cev.marca}\\nNotas: ${cev.notes || ""}`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${sVal}`,
        `DTEND;VALUE=DATE:${eVal}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${desc}`,
        "STATUS:CONFIRMED",
        "END:VEVENT"
      );
      count++;
    }

    lines.push("END:VCALENDAR");
    if (count === 0) {
      alert("No hay actividades o eventos seleccionados para exportar a .ics");
      return;
    }

    const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agenda_${state.targetUserId || "diseno"}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportFilteredToCSV() {
    const selectedOfficial = getSelectedOfficialActivities();
    const selectedCamps = getSelectedCampaigns();
    const campsToExport = selectedCamps.length > 0 ? selectedCamps : getActiveCampaigns();

    const hdr1 = ["No", "ACTIVIDAD", "PROCESO", "Marca", "AREA", "Dias"];
    const hdr2 = ["", "", "", "", "", "NAL"];
    for (const c of campsToExport) {
      hdr1.push(`ADV ${c.adv} (${c.shortLabel})`);
      hdr2.push(`NAL ${c.nal}`);
    }

    const escapeCsv = (v) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows = [hdr1.map(escapeCsv).join(","), hdr2.map(escapeCsv).join(",")];
    for (const act of selectedOfficial) {
      const r = [act.no, act.actividad, act.proceso, act.marca, act.area, act.dias];
      for (const c of campsToExport) r.push(act.fechas[c.id] || "");
      rows.push(r.map(escapeCsv).join(","));
    }

    const blob = new Blob(["\uFEFF" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cronograma_${state.targetUserId || "seleccion"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function moveTooltip(e) {
    const pad = 14;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    const rect = els.tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 10) x = e.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 10) y = e.clientY - rect.height - pad;
    els.tooltip.style.left = `${Math.max(8, x)}px`;
    els.tooltip.style.top = `${Math.max(8, y)}px`;
  }

  /* ==========================================================================
     15. EVENT LISTENERS SETUP
     ========================================================================== */
  function closeAllDropdowns() {
    els.campaignDropdown.classList.remove("open");
    els.areaDropdown.classList.remove("open");
    els.procesoDropdown.classList.remove("open");
    els.actDropdown.classList.remove("open");
    els.customFilterDropdown.classList.remove("open");
  }

  function setupEventListeners() {
    // Login Handlers
    els.btnChangeLoginUser.addEventListener("click", () => {
      renderLoginScreen();
    });

    els.loginPinForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const uid = state.selectedLoginCandidateId;
      if (!uid) return;
      const u = usersMap.get(uid);
      const entered = els.loginPinInput.value.trim();
      const expected = u && u.pin ? String(u.pin) : "1234";

      if (entered === expected) {
        completeLogin(uid, els.chkRememberSession.checked);
      } else {
        els.loginErrorMsg.textContent = "⚠️ Clave / PIN incorrecto. Intenta de nuevo.";
      }
    });

    els.btnSwitchUser.addEventListener("click", () => {
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch (e) {
        // ignore
      }
      renderLoginScreen();
      els.loginOverlay.style.display = "flex";
    });

    // Admin Controls (DANI)
    els.adminTargetUserSelect.addEventListener("change", (e) => {
      switchAdminTargetUser(e.target.value);
    });
    els.btnReturnToDani.addEventListener("click", () => {
      switchAdminTargetUser("DANI");
    });
    els.btnAdminManagePins.addEventListener("click", openAdminPinsModal);
    els.btnCloseAdminPins.addEventListener("click", () => (els.adminPinsModal.style.display = "none"));
    els.btnCloseAdminPinsFooter.addEventListener("click", () => (els.adminPinsModal.style.display = "none"));
    els.btnSaveAllPins.addEventListener("click", saveAllAdminPins);

    // Custom Event Modal
    els.btnOpenAddEvent.addEventListener("click", () => openCustomEventModal(null, "2027-06-15"));
    els.btnCloseCustomModal.addEventListener("click", () => (els.customEventModal.style.display = "none"));
    els.btnCancelCustomModal.addEventListener("click", () => (els.customEventModal.style.display = "none"));
    els.customEventForm.addEventListener("submit", handleSaveCustomEvent);
    els.btnDeleteCustomEvent.addEventListener("click", handleDeleteCustomEvent);

    // Dropdown toggles
    const dropdownPairs = [
      [els.campaignBtn, els.campaignDropdown],
      [els.areaBtn, els.areaDropdown],
      [els.procesoBtn, els.procesoDropdown],
      [els.actBtn, els.actDropdown],
      [els.customFilterBtn, els.customFilterDropdown],
    ];

    dropdownPairs.forEach(([btn, dd]) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = dd.classList.contains("open");
        closeAllDropdowns();
        if (!wasOpen) dd.classList.add("open");
      });
    });

    document.addEventListener("click", (e) => {
      const insideAny = dropdownPairs.some(
        ([btn, dd]) => dd.contains(e.target) || btn.contains(e.target)
      );
      if (!insideAny) closeAllDropdowns();
    });

    // 1. Campaign Filter Actions
    els.campaignSearch.addEventListener("input", renderCampaignSelectList);
    els.campaignSelectAll.addEventListener("click", () => {
      state.selectedCampaignIds = new Set(getActiveCampaigns().map((c) => c.id));
      populateFilterControls();
      scheduleSavePreferences();
      renderAll();
    });
    els.campaignSelect2027.addEventListener("click", () => {
      state.selectedCampaignIds = new Set(
        getActiveCampaigns().filter((c) => c.adv.startsWith("2027")).map((c) => c.id)
      );
      populateFilterControls();
      scheduleSavePreferences();
      renderAll();
    });
    els.campaignSelect2028.addEventListener("click", () => {
      state.selectedCampaignIds = new Set(
        getActiveCampaigns().filter((c) => c.adv.startsWith("2028")).map((c) => c.id)
      );
      populateFilterControls();
      scheduleSavePreferences();
      renderAll();
    });
    els.campaignClearAll.addEventListener("click", () => {
      state.selectedCampaignIds.clear();
      populateFilterControls();
      scheduleSavePreferences();
      renderAll();
    });
    els.chkInclude2026.addEventListener("change", (e) => {
      state.include2026 = e.target.checked;
      populateFilterControls();
      scheduleSavePreferences();
      renderAll();
    });

    // 2. Area Checklist Actions
    els.areaSearch.addEventListener("input", renderAreaChecklist);
    els.areaSelectAll.addEventListener("click", () => {
      rawData.activities.forEach((a) => state.selectedActivityNos.add(a.no));
      populateFilterControls();
      scheduleSavePreferences();
      renderAll();
    });
    els.areaClearAll.addEventListener("click", () => {
      state.selectedActivityNos.clear();
      populateFilterControls();
      scheduleSavePreferences();
      renderAll();
    });

    // 3. Proceso Checklist Actions
    els.procesoSearch.addEventListener("input", renderProcesoChecklist);
    els.procesoSelectAll.addEventListener("click", () => {
      rawData.activities.forEach((a) => state.selectedActivityNos.add(a.no));
      populateFilterControls();
      scheduleSavePreferences();
      renderAll();
    });
    els.procesoClearAll.addEventListener("click", () => {
      state.selectedActivityNos.clear();
      populateFilterControls();
      scheduleSavePreferences();
      renderAll();
    });

    // 4. Individual Activities Checklist Actions
    els.actSearch.addEventListener("input", renderActivityChecklist);
    els.actSelectVisible.addEventListener("click", () => {
      const q = (els.actSearch.value || "").trim().toLowerCase();
      rawData.activities.forEach((act) => {
        if (
          !q ||
          String(act.no).includes(q) ||
          act.actividad.toLowerCase().includes(q) ||
          act.proceso.toLowerCase().includes(q) ||
          act.area.toLowerCase().includes(q)
        ) {
          state.selectedActivityNos.add(act.no);
        }
      });
      populateFilterControls();
      scheduleSavePreferences();
      renderAll();
    });
    els.actQuickTextil.addEventListener("click", () => {
      applyQuickPreset("textil");
    });
    els.actClearAll.addEventListener("click", () => {
      state.selectedActivityNos.clear();
      populateFilterControls();
      scheduleSavePreferences();
      renderAll();
    });

    // 5. Custom Events Filter Actions
    els.chkShowCustomEvents.addEventListener("change", (e) => {
      state.showCustomEvents = e.target.checked;
      updateChecklistButtonLabels();
      scheduleSavePreferences();
      renderAll();
    });
    els.customFilterSelectAll.addEventListener("click", () => {
      state.customFilterTags.clear();
      state.showCustomEvents = true;
      els.chkShowCustomEvents.checked = true;
      populateFilterControls();
      scheduleSavePreferences();
      renderAll();
    });
    els.customFilterOnlyMine.addEventListener("click", () => {
      state.customFilterTags = new Set([`USER:${state.targetUserId || "DANI"}`]);
      state.showCustomEvents = true;
      els.chkShowCustomEvents.checked = true;
      populateFilterControls();
      scheduleSavePreferences();
      renderAll();
    });
    els.customFilterClear.addEventListener("click", () => {
      state.showCustomEvents = false;
      els.chkShowCustomEvents.checked = false;
      populateFilterControls();
      scheduleSavePreferences();
      renderAll();
    });

    // 6. Brand & Search
    els.brandPills.forEach((btn) => {
      btn.addEventListener("click", () => {
        els.brandPills.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.brand = btn.getAttribute("data-brand");
        els.sharedBrandWrap.style.display =
          state.brand === "Livva" || state.brand === "Azzorti" ? "inline-flex" : "none";
        scheduleSavePreferences();
        renderAll();
      });
    });
    els.chkSharedBrand.addEventListener("change", (e) => {
      state.includeSharedBrand = e.target.checked;
      scheduleSavePreferences();
      renderAll();
    });
    els.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      renderAll();
    });

    // 7. View Tabs
    els.tabCalendar.addEventListener("click", () => {
      state.viewMode = "calendar";
      els.tabCalendar.classList.add("active");
      els.tabGantt.classList.remove("active");
      els.tabMatrix.classList.remove("active");
      renderAll();
    });
    els.tabGantt.addEventListener("click", () => {
      state.viewMode = "gantt";
      els.tabGantt.classList.add("active");
      els.tabCalendar.classList.remove("active");
      els.tabMatrix.classList.remove("active");
      renderAll();
    });
    els.tabMatrix.addEventListener("click", () => {
      state.viewMode = "matrix";
      els.tabMatrix.classList.add("active");
      els.tabCalendar.classList.remove("active");
      els.tabGantt.classList.remove("active");
      renderAll();
    });

    // Calendar & Gantt Controls
    els.btnCalPrevMonth.addEventListener("click", () => {
      state.calShowAllMonths = false;
      els.chkCalShowAllMonths.checked = false;
      state.calCurrentMonthIndex = Math.max(0, state.calCurrentMonthIndex - 1);
      renderAll();
    });
    els.btnCalNextMonth.addEventListener("click", () => {
      state.calShowAllMonths = false;
      els.chkCalShowAllMonths.checked = false;
      state.calCurrentMonthIndex++;
      renderAll();
    });
    els.chkCalShowAllMonths.addEventListener("change", (e) => {
      state.calShowAllMonths = e.target.checked;
      renderAll();
    });

    els.chkShowCatalogInGantt.addEventListener("change", (e) => {
      state.showCatalogInGantt = e.target.checked;
      renderAll();
    });
    els.chkGroupProceso.addEventListener("change", (e) => {
      state.groupByProceso = e.target.checked;
      renderAll();
    });
    els.btnExpandAll.addEventListener("click", () => {
      state.collapsedGroups.clear();
      renderAll();
    });
    els.btnCollapseAll.addEventListener("click", () => {
      rawData.activities.forEach((a) => state.collapsedGroups.add(a.proceso));
      renderAll();
    });
    els.sortSelect.addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      renderAll();
    });
    els.zoomSelect.addEventListener("change", (e) => {
      state.zoom = e.target.value;
      renderAll();
    });
    els.btnCenterGantt.addEventListener("click", () => {
      const firstBar = els.ganttTimelineBody.querySelector(".gantt-bar:not(.group-summary-bar)");
      if (firstBar) {
        els.ganttTimelineBody.scrollLeft = Math.max(0, parseInt(firstBar.style.left, 10) - 100);
      }
    });

    els.ganttTimelineBody.addEventListener("scroll", () => {
      els.ganttLeftBody.scrollTop = els.ganttTimelineBody.scrollTop;
      els.ganttTimelineHeader.scrollLeft = els.ganttTimelineBody.scrollLeft;
    });

    // Exports & Excel Upload
    els.btnExportPdfCalendar.addEventListener("click", printPdfCalendar);
    els.btnExportPdfGantt.addEventListener("click", printPdfGantt);
    els.btnExportIcs.addEventListener("click", exportFilteredToICS);
    els.btnExportCsv.addEventListener("click", exportFilteredToCSV);

    els.btnUpload.addEventListener("click", () => els.fileInput.click());
    els.fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileUpload(e.target.files[0]);
        e.target.value = "";
      }
    });

    els.btnResetData.addEventListener("click", async () => {
      localStorage.removeItem(LOCAL_MASTER_CACHE_KEY);
      rawData = window.CRONOGRAMA_INITIAL_DATA;
      els.btnResetData.style.display = "none";
      els.statusBadge.textContent = `Cronograma Oficial (${rawData.activities.length} act.)`;
      populateFilterControls();
      renderAll();
    });

    window.addEventListener("dragover", (e) => {
      e.preventDefault();
      els.dropzoneOverlay.classList.add("active");
    });
    els.dropzoneOverlay.addEventListener("dragleave", (e) => {
      e.preventDefault();
      els.dropzoneOverlay.classList.remove("active");
    });
    window.addEventListener("drop", (e) => {
      e.preventDefault();
      els.dropzoneOverlay.classList.remove("active");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    });
  }

  /* ==========================================================================
     16. INITIALIZATION
     ========================================================================== */
  function init() {
    initDomRefs();
    initLocalUsersMap();

    // Load cached custom events first for instant UI
    try {
      const savedEv = localStorage.getItem(LOCAL_CUSTOM_EVENTS_KEY);
      if (savedEv) {
        const parsedEv = JSON.parse(savedEv);
        if (Array.isArray(parsedEv)) customEvents = parsedEv;
      }
    } catch (e) {
      // ignore
    }

    // Load Master Cronograma
    let loadedCustomMaster = false;
    try {
      const savedMaster = localStorage.getItem(LOCAL_MASTER_CACHE_KEY);
      if (savedMaster) {
        const parsed = JSON.parse(savedMaster);
        if (parsed && parsed.activities && parsed.campaigns) {
          rawData = parsed;
          loadedCustomMaster = true;
          els.btnResetData.style.display = "inline-flex";
          els.statusBadge.textContent = `📂 Excel actualizado (${parsed.activities.length} act.)`;
        }
      }
    } catch (e) {
      // ignore
    }

    if (!loadedCustomMaster) {
      rawData = window.CRONOGRAMA_INITIAL_DATA;
      els.statusBadge.textContent = `Cronograma Oficial (${rawData.activities.length} act.)`;
    }

    setupEventListeners();
    renderLoginScreen();

    // Check if user has a remembered session on this device
    try {
      const rememberedUser = localStorage.getItem(SESSION_STORAGE_KEY);
      if (rememberedUser && usersMap.has(rememberedUser)) {
        completeLogin(rememberedUser, true);
      }
    } catch (e) {
      // ignore
    }

    // Sync with Supabase Cloud in background
    syncFromSupabase();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
