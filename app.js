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
  const LOCAL_SAVED_HASHTAGS_KEY = "AZZORTI_SAVED_HASHTAGS_V1";
  const TODAY_STR = new Date().toISOString().slice(0, 10);

  const DEFAULT_HASHTAGS = [
    "#Entrega",
    "#Muestra",
    "#Revisión",
    "#Fit",
    "#Comité",
    "#HitoCrítico",
    "#Seguimiento",
    "#Aprobación",
    "#Compra",
    "#Taller",
    "#PC_Kids",
    "#Telas",
  ];
  let savedHashtags = new Set(DEFAULT_HASHTAGS);

  const DEFAULT_CAMPAIGNS = [
    "ADV_202708_NAL_202711",
    "ADV_202709_NAL_202712",
    "ADV_202710_NAL_202713",
  ];

  const PALETTE_COLORS = [
    "#ec4899", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
    "#6366f1", "#f43f5e", "#14b8a6", "#a855f7", "#3b82f6",
    "#eab308", "#0284c7", "#ea580c", "#059669", "#db2777",
    "#7c3aed", "#d97706", "#0891b2", "#84cc16", "#475569"
  ];

  function getDeterministicColor(id) {
    if (!id) return "#6366f1";
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % PALETTE_COLORS.length;
    return PALETTE_COLORS[idx];
  }

  function getProfileRoleLabel(role) {
    if (!role) return "Diseñador(a)";
    const r = String(role).toLowerCase().trim();
    if (r === "admin" || r === "administrador") return "Administrador";
    if (r === "administrativo") return "Administrativo";
    return "Diseñador(a)";
  }

  let TEAM_PROFILES = [
    { id: "MARI", name: "MARI", role: "designer", color: "#ec4899", defaultPin: "0000" },
    { id: "BRY", name: "BRY", role: "designer", color: "#8b5cf6", defaultPin: "0000" },
    { id: "JOHA", name: "JOHA", role: "designer", color: "#06b6d4", defaultPin: "4321" },
    { id: "YEYE", name: "YEYE", role: "designer", color: "#10b981", defaultPin: "0000" },
    { id: "CARO", name: "CARO", role: "designer", color: "#f59e0b", defaultPin: "0000" },
    { id: "CATA", name: "CATA", role: "designer", color: "#6366f1", defaultPin: "0000" },
    { id: "LAU A", name: "LAU A", role: "designer", color: "#f43f5e", defaultPin: "0000" },
    { id: "LAU L", name: "LAU L", role: "designer", color: "#14b8a6", defaultPin: "0000" },
    { id: "ELI", name: "ELI", role: "designer", color: "#a855f7", defaultPin: "0000" },
    { id: "LEIDY", name: "LEIDY", role: "designer", color: "#3b82f6", defaultPin: "0000" },
    { id: "JUSTIN", name: "JUSTIN", role: "designer", color: "#0891b2", defaultPin: "0000" },
    { id: "ANDRE", name: "ANDRE", role: "admin", color: "#eab308", defaultPin: "1234" },
    { id: "HENRY", name: "HENRY", role: "Administrativo", color: "#0284c7", defaultPin: "0000" },
    { id: "ANITA", name: "ANITA", role: "Administrativo", color: "#ea580c", defaultPin: "0000" },
    { id: "ANLLY", name: "ANLLY", role: "Administrativo", color: "#059669", defaultPin: "0000" },
    { id: "ASTRID", name: "ASTRID", role: "Administrativo", color: "#db2777", defaultPin: "0000" },
    { id: "PAULA", name: "PAULA", role: "Administrativo", color: "#7c3aed", defaultPin: "0000" },
    { id: "DANI", name: "DANI", role: "admin", color: "#d97706", defaultPin: "9901" },
  ];

  const CUSTOM_EVENT_AREAS = [
    "AG LAB (Diseño Textil y Moda)",
    "Diseño Textil (Aglab)",
    "Desarrollos Moda MO",
    "Diseño Gráfico (DisGraf)",
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
    forceIncludeToday: false,
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
    els.btnSwitchUser = document.getElementById("btnSwitchUser");
    els.headerUserAvatar = document.getElementById("headerUserAvatar");
    els.headerUserName = document.getElementById("headerUserName");

    // Filters & Minimalist Controls (Modelo Híbrido)
    els.chkInclude2026 = document.getElementById("chkInclude2026");
    els.campaignBtn = document.getElementById("campaignDropdownBtn");
    els.campaignDropdown = document.getElementById("campaignDropdown");
    els.campaignSearch = document.getElementById("campaignSearchInput");
    els.campaignList = document.getElementById("campaignOptionsList");
    els.campaignSelectAll = document.getElementById("campaignSelectAll");
    els.campaignSelect2027 = document.getElementById("campaignSelect2027");
    els.campaignSelect2028 = document.getElementById("campaignSelect2028");
    els.campaignClearAll = document.getElementById("campaignClearAll");
    els.activeCampaignsPills = document.getElementById("activeCampaignsPills");
    els.campaignPillBadge = document.getElementById("campaignPillBadge");
    els.campaignSelectedCountLabel = document.getElementById("campaignSelectedCountLabel");
    els.campaignYearTabs = document.getElementById("campaignYearTabs");

    // Brand
    els.brandPills = document.querySelectorAll(".brand-pill");
    els.chkSharedBrand = document.getElementById("chkSharedBrand");
    els.sharedBrandWrap = document.getElementById("sharedBrandWrap");

    // Team Avatars & Extras Filter & Profiles Selector
    els.teamAvatarsBar = document.getElementById("teamAvatarsBar");
    els.teamAvatarsList = document.getElementById("teamAvatarsList");
    els.chkShowCustomEvents = document.getElementById("chkShowCustomEvents");
    els.btnTeamShowAll = document.getElementById("btnTeamShowAll");
    els.btnTeamProfilesDropdown = document.getElementById("btnTeamProfilesDropdown");
    els.teamProfilesDropdownWrap = document.getElementById("teamProfilesDropdownWrap");
    els.teamDropdownLabel = document.getElementById("teamDropdownLabel");
    els.teamProfilesDropdown = document.getElementById("teamProfilesDropdown");
    els.teamProfileSearchInput = document.getElementById("teamProfileSearchInput");
    els.teamProfilesOptionsList = document.getElementById("teamProfilesOptionsList");
    els.btnSelectAllProfiles = document.getElementById("btnSelectAllProfiles");
    els.btnTeamScrollLeft = document.getElementById("btnTeamScrollLeft");
    els.btnTeamScrollRight = document.getElementById("btnTeamScrollRight");

    // Unified Filter Main Button & Drawer
    els.btnOpenUnifiedFilters = document.getElementById("btnOpenUnifiedFilters");
    els.unifiedFilterActiveBadge = document.getElementById("unifiedFilterActiveBadge");
    els.unifiedFilterDrawerBackdrop = document.getElementById("unifiedFilterDrawerBackdrop");
    els.unifiedFilterDrawer = document.getElementById("unifiedFilterDrawer");
    els.btnCloseUnifiedDrawer = document.getElementById("btnCloseUnifiedDrawer");
    els.btnDrawerApplyClose = document.getElementById("btnDrawerApplyClose");
    els.unifiedDrawerSearch = document.getElementById("unifiedDrawerSearch");
    els.btnDrawerExpandAll = document.getElementById("btnDrawerExpandAll");
    els.btnDrawerCollapseAll = document.getElementById("btnDrawerCollapseAll");
    els.unifiedDrawerTree = document.getElementById("unifiedDrawerTree");
    els.btnDrawerSelectAll = document.getElementById("btnDrawerSelectAll");
    els.btnDrawerClearAll = document.getElementById("btnDrawerClearAll");
    els.drawerStatsActive = document.getElementById("drawerStatsActive");
    els.drawerStatsTotal = document.getElementById("drawerStatsTotal");

    // Search Input
    els.searchInput = document.getElementById("activitySearchInput");

    // Sub-toolbar & Tabs
    els.tabCalendar = document.getElementById("tabCalendar");
    els.tabGantt = document.getElementById("tabGantt");
    els.tabMatrix = document.getElementById("tabMatrix");

    els.calendarToolbarOptions = document.getElementById("calendarToolbarOptions");
    els.btnCalToday = document.getElementById("btnCalToday");
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
    els.evEndDateInput = document.getElementById("evEndDateInput");
    els.evRangeSummaryBadge = document.getElementById("evRangeSummaryBadge");
    els.evOwnersGrid = document.getElementById("evOwnersGrid");
    els.evOwnersCountLabel = document.getElementById("evOwnersCountLabel");
    els.btnEvOwnerOnlyMe = document.getElementById("btnEvOwnerOnlyMe");
    els.btnEvOwnerAll = document.getElementById("btnEvOwnerAll");
    els.btnEvOwnerClear = document.getElementById("btnEvOwnerClear");
    els.evAreaInput = document.getElementById("evAreaInput");
    els.evMarcaInput = document.getElementById("evMarcaInput");
    els.evCategoryInput = document.getElementById("evCategoryInput");
    els.evTagInput = document.getElementById("evTagInput");
    els.evTagActivePreview = document.getElementById("evTagActivePreview");
    els.btnClearHashtag = document.getElementById("btnClearHashtag");
    els.savedHashtagsList = document.getElementById("savedHashtagsList");
    els.evColorPicker = document.getElementById("evColorPicker");
    els.evImportanceInput = document.getElementById("evImportanceInput");
    els.evImportanceGroup = document.getElementById("evImportanceGroup");
    els.evNotesInput = document.getElementById("evNotesInput");
    els.btnDeleteCustomEvent = document.getElementById("btnDeleteCustomEvent");

    // Admin PINs Modal
    els.adminPinsModal = document.getElementById("adminPinsModal");
    els.btnCloseAdminPins = document.getElementById("btnCloseAdminPins");
    els.btnCloseAdminPinsFooter = document.getElementById("btnCloseAdminPinsFooter");
    els.adminPinsList = document.getElementById("adminPinsList");
    els.btnSaveAllPins = document.getElementById("btnSaveAllPins");

    els.tooltip = document.getElementById("ganttTooltip");
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
            if (u && u.id) {
              let prof = TEAM_PROFILES.find((p) => p.id === u.id);
              if (!prof) {
                prof = {
                  id: u.id,
                  name: u.name || u.id,
                  role: u.role || "designer",
                  color: getDeterministicColor(u.id),
                  defaultPin: u.pin || "0000",
                };
                TEAM_PROFILES.push(prof);
              }
              if (usersMap.has(u.id)) {
                const base = usersMap.get(u.id);
                usersMap.set(u.id, {
                  ...base,
                  name: u.name || base.name,
                  role: u.role || base.role,
                  pin: u.pin || base.pin,
                  preferences: { ...base.preferences, ...(u.preferences || {}) },
                });
              } else {
                usersMap.set(u.id, {
                  ...buildDefaultUserObject(prof),
                  name: u.name || u.id,
                  role: u.role || "designer",
                  pin: u.pin || "0000",
                  preferences: {
                    ...buildDefaultUserObject(prof).preferences,
                    ...(u.preferences || {}),
                  },
                });
              }
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

      // 1. Fetch app_users (incluyendo nuevos miembros añadidos en Supabase)
      const { data: usersData, error: usersErr } = await sbClient.from("app_users").select("*");
      if (usersErr) throw usersErr;

      if (usersData && usersData.length > 0) {
        for (const u of usersData) {
          let profMeta = TEAM_PROFILES.find((p) => p.id === u.id);
          if (!profMeta) {
            profMeta = {
              id: u.id,
              name: u.name || u.id,
              role: u.role || "designer",
              color: getDeterministicColor(u.id),
              defaultPin: u.pin || "0000",
            };
            TEAM_PROFILES.push(profMeta);
          } else {
            profMeta.name = u.name || profMeta.name;
            profMeta.role = u.role || profMeta.role;
            profMeta.defaultPin = u.pin || profMeta.defaultPin;
          }

          if (usersMap.has(u.id)) {
            const base = usersMap.get(u.id);
            usersMap.set(u.id, {
              ...base,
              name: u.name || base.name,
              role: u.role || base.role,
              pin: u.pin || base.pin,
              preferences: { ...base.preferences, ...(u.preferences || {}) },
            });
          } else {
            usersMap.set(u.id, {
              ...buildDefaultUserObject(profMeta),
              name: u.name || u.id,
              role: u.role || "designer",
              pin: u.pin || "0000",
              preferences: {
                selectedActivityNos: [],
                selectedCampaignIds: [...DEFAULT_CAMPAIGNS],
                brand: "ALL",
                includeSharedBrand: true,
                include2026: false,
                showCustomEvents: true,
                customFilterTags: [],
                ...(u.preferences || {}),
              },
            });
          }
        }
        saveLocalUsersCache();

        // Actualizar vistas dinámicas tras sincronizar todos los perfiles
        renderLoginScreen();
        renderTeamAvatarsBar();
        populateAdminTargetSelect();
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
        loadSavedHashtags();
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
    const fromProfiles = TEAM_PROFILES.find((p) => p.id === userId);
    if (fromProfiles) return fromProfiles;
    const fromMap = usersMap.get(userId);
    if (fromMap) {
      return {
        id: fromMap.id,
        name: fromMap.name || fromMap.id,
        role: fromMap.role || "designer",
        color: getDeterministicColor(fromMap.id),
      };
    }
    return { id: userId, name: userId, role: "designer", color: getDeterministicColor(userId) };
  }

  function renderLoginScreen() {
    els.loginUsersGrid.innerHTML = "";
    els.loginPinForm.style.display = "none";
    els.loginUsersGrid.style.display = "grid";
    els.loginErrorMsg.textContent = "";

    const allProfiles = getAllKnownProfiles();

    for (const p of allProfiles) {
      const isAdmin = p.role === "admin";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `login-user-card ${isAdmin ? "admin-card" : ""}`;
      const initials = p.name.slice(0, 2).toUpperCase();
      btn.innerHTML = `
        <span class="login-user-avatar">${initials}</span>
        <div class="login-user-meta">
          <div class="login-user-name">
            <span>${p.name}</span>
            ${isAdmin ? '<span class="login-admin-crown" title="Administrador">👑</span>' : ""}
          </div>
          <div class="login-user-role">${getProfileRoleLabel(p.role)}</div>
        </div>
      `;
      btn.addEventListener("click", () => {
        state.selectedLoginCandidateId = p.id;
        els.loginUsersGrid.style.display = "none";
        els.loginPinForm.style.display = "flex";
        els.loginSelectedAvatar.textContent = initials;
        els.loginSelectedAvatar.style.background = "#000000";
        els.loginSelectedAvatar.style.color = "#ffffff";
        els.loginSelectedName.textContent = p.name + (isAdmin ? " (Administrador)" : ` (${getProfileRoleLabel(p.role)})`);
        els.loginSelectedRole.textContent = isAdmin
          ? "Acceso total para configurar cualquier calendario"
          : `Perfil ${getProfileRoleLabel(p.role)} • Calendario y vista personalizada persistente`;
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
    els.headerUserAvatar.style.background = "#000000";
    els.headerUserAvatar.style.color = "#ffffff";
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
    const allProfiles = getAllKnownProfiles();
    for (const p of allProfiles) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.id === state.loggedInUserId ? `${p.name} (Mi propio calendario)` : `Calendario de ${p.name} (${getProfileRoleLabel(p.role)})`;
      if (p.id === state.targetUserId) opt.selected = true;
      els.adminTargetUserSelect.appendChild(opt);
    }
  }

  function switchAdminTargetUser(newTargetId) {
    const currentMeta = getProfileMeta(state.loggedInUserId);
    if (!currentMeta || currentMeta.role !== "admin") return;
    state.targetUserId = newTargetId;
    els.adminTargetUserSelect.value = newTargetId;

    if (newTargetId !== state.loggedInUserId) {
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
    const currentMeta = getProfileMeta(state.loggedInUserId);
    if (!currentMeta || currentMeta.role !== "admin") return;
    els.adminPinsList.innerHTML = "";
    const allProfiles = getAllKnownProfiles();
    for (const p of allProfiles) {
      const u = usersMap.get(p.id) || buildDefaultUserObject(p);
      const div = document.createElement("div");
      div.className = "admin-pin-item";
      div.innerHTML = `
        <span><strong>${p.name}</strong> (${getProfileRoleLabel(p.role)}) ${p.role === "admin" ? "👑" : ""}</span>
        <input type="text" data-userid="${p.id}" value="${u.pin || p.defaultPin || "0000"}" maxlength="12" />
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

  function formatShortDayMonth(str) {
    const d = parseYMD(str);
    if (!d) return "—";
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]}`;
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

  function addBusinessDays(startDateStr, dh) {
    const startDt = parseYMD(startDateStr);
    if (!startDt) return null;
    const days = Math.max(1, parseInt(dh, 10) || 1);
    if (days <= 1) return new Date(startDt.getTime());
    let cur = new Date(startDt.getTime());
    let remaining = days - 1;
    while (remaining > 0) {
      cur.setDate(cur.getDate() + 1);
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) remaining--;
    }
    return cur;
  }

  function countBusinessDaysBetween(startDt, endDt) {
    if (!startDt || !endDt) return 1;
    const s = startDt <= endDt ? startDt : endDt;
    const e = startDt <= endDt ? endDt : startDt;
    let count = 0;
    const cur = new Date(s.getTime());
    while (cur <= e) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, count);
  }

  function getCustomEventRange(cev) {
    if (!cev || !cev.event_date) {
      return { startStr: "", endStr: "", startDt: null, endDt: null, isMultiDay: false, calDays: 1, bizDays: 1 };
    }
    const raw = String(cev.event_date).trim();
    let startStr = "";
    let endStr = "";

    if (raw.includes("|")) {
      const parts = raw.split("|");
      startStr = (parts[0] || "").trim().slice(0, 10);
      endStr = (parts[1] || parts[0] || "").trim().slice(0, 10);
    } else if (cev.end_date) {
      startStr = raw.slice(0, 10);
      endStr = String(cev.end_date).trim().slice(0, 10);
    } else if (cev.dh && Number(cev.dh) > 1) {
      startStr = raw.slice(0, 10);
      const computedEnd = addBusinessDays(startStr, Number(cev.dh));
      endStr = computedEnd ? formatYMD(computedEnd) : startStr;
    } else {
      startStr = raw.slice(0, 10);
      endStr = startStr;
    }

    if (endStr < startStr) {
      const tmp = startStr;
      startStr = endStr;
      endStr = tmp;
    }

    const startDt = parseYMD(startStr);
    const endDt = parseYMD(endStr) || startDt;
    const calDays = startDt && endDt ? Math.max(1, daysBetween(startDt, endDt) + 1) : 1;
    const bizDays = startDt && endDt ? countBusinessDaysBetween(startDt, endDt) : 1;

    return {
      startStr,
      endStr,
      startDt,
      endDt,
      isMultiDay: calDays > 1,
      calDays,
      bizDays,
    };
  }

  function getCustomEventOwners(cev) {
    if (!cev || !cev.owner_user) return ["DANI"];
    const arr = String(cev.owner_user)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.length > 0 ? arr : ["DANI"];
  }

  function renderOwnerPillsHtml(owners, compact) {
    if (!owners || owners.length === 0) return "";
    const allKnown = getAllKnownProfiles();
    if (owners.length >= allKnown.length) {
      return `<span class="event-owner-pill"><span class="event-owner-dot" style="background:#6366f1"></span>👥 Todo el equipo (${owners.length})</span>`;
    }
    const maxToShow = compact ? 3 : 12;
    const shown = owners.slice(0, maxToShow);
    const extra = owners.length - shown.length;
    const pills = shown.map((uid) => {
      const prof = getProfileMeta(uid);
      const color = prof ? prof.color : getDeterministicColor(uid);
      return `<span class="event-owner-pill"><span class="event-owner-dot" style="background:${color}"></span>${uid}</span>`;
    });
    if (extra > 0) {
      pills.push(`<span class="event-owner-pill">+${extra}</span>`);
    }
    return pills.join("");
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
    const lower = s.toLowerCase();
    if (lower === "ingenieria" || lower === "ingeniería") return "Ingenieria";
    if (lower === "aglab" || lower === "ag lab" || lower === "ag_lab") return "Aglab";
    return s || "Sin Área";
  }

  function getAreaDisplayName(area) {
    if (area === "Aglab") return "🎨 AG LAB (Diseño Textil y Moda)";
    if (area === "DisGraf") return "📐 DisGraf (Diseño Gráfico)";
    if (area === "Ingenieria") return "⚙️ Patronaje e Ingeniería";
    if (area === "Mercadeo") return "📢 Mercadeo";
    if (area === "Produccion") return "🏭 Producción";
    if (area === "Star Trading") return "🌐 Star Trading";
    if (area === "Planeacion Estrategica") return "📊 Planeación Estratégica";
    if (area === "Ventas") return "💼 Ventas y Facturación";
    if (area === "Compras") return "📦 Compras";
    return area || "Sin Área";
  }

  function getProcesoDisplayName(proceso, area) {
    if (area === "Aglab") {
      if (proceso === "Estampacion Continua") return "Estampación Continua (Diseño Textil)";
      if (proceso === "Estampacion Local") return "Estampación Local (Diseño Textil)";
      if (proceso === "Desarrollos Moda MO") return "Desarrollos Moda MO (Diseño de Modas)";
      if (proceso === "Desarrollos Moda MO 2D") return "Desarrollos Moda MO 2D (Diseño de Modas 2D)";
      if (proceso === "Desarrollos Moda MO 3D") return "Desarrollos Moda MO 3D (Diseño de Modas 3D)";
      if (proceso === "Desarrollos Moda MO Prog") return "Desarrollos Moda MO Prog (Diseño de Modas)";
      if (proceso === "Proyeccion Telas") return "Proyección Telas (Diseño de Modas)";
      if (proceso === "Telas Sublego") return "Telas Sublego (Diseño de Modas)";
      if (proceso === "Telas Especiales") return "Telas Especiales (Diseño de Modas)";
      if (proceso === "Importados") return "Importados (Diseño de Modas)";
      if (proceso === "Toma de Fotos") return "Toma de Fotos (AG LAB)";
    }
    return proceso;
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
        let fVal = null;
        let dhVal = null;
        if (normalizeDateCell(row[c + 1])) {
          fVal = row[c + 1];
          dhVal = row[c];
        } else if (normalizeDateCell(row[c])) {
          fVal = row[c];
          dhVal = row[c - 1];
        } else {
          fVal = row[c + 1] !== undefined ? row[c + 1] : row[c];
          dhVal = row[c] !== undefined ? row[c] : row[c - 1];
        }

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

      if (els.btnResetData) els.btnResetData.style.display = "inline-flex";
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
     7. CHECKLISTS & UNIFIED HIERARCHY FILTER (ÁREA ➔ PROCESO ➔ ACTIVIDADES)
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
    renderActiveCampaignPills();
    renderCampaignSelectList();
    renderTeamAvatarsBar();
    renderUnifiedDrawerHierarchy();
    updateUnifiedFilterBadge();
  }

  let selectedCampaignYear = "ALL";

  function positionDropdownInViewport(dropdownEl, triggerEl) {
    if (!dropdownEl || !triggerEl) return;
    const margin = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const trigRect = triggerEl.getBoundingClientRect();

    dropdownEl.style.position = "fixed";
    dropdownEl.style.maxWidth = `${Math.max(260, vw - margin * 2)}px`;
    dropdownEl.style.left = "0px";
    dropdownEl.style.right = "auto";

    const dropRect = dropdownEl.getBoundingClientRect();
    let left = trigRect.left;
    if (left + dropRect.width > vw - margin) {
      left = vw - dropRect.width - margin;
    }
    if (left < margin) {
      left = margin;
    }
    dropdownEl.style.left = `${Math.round(left)}px`;

    const spaceBelow = vh - trigRect.bottom - margin - 6;
    const spaceAbove = trigRect.top - margin - 6;

    if (spaceBelow >= 260 || spaceBelow >= spaceAbove) {
      dropdownEl.style.top = `${Math.round(trigRect.bottom + 6)}px`;
      dropdownEl.style.bottom = "auto";
      dropdownEl.style.maxHeight = `${Math.max(200, Math.min(520, Math.floor(spaceBelow)))}px`;
    } else {
      dropdownEl.style.bottom = `${Math.round(vh - trigRect.top + 6)}px`;
      dropdownEl.style.top = "auto";
      dropdownEl.style.maxHeight = `${Math.max(200, Math.min(520, Math.floor(spaceAbove)))}px`;
    }
  }

  function repositionOpenDropdowns() {
    if (els.campaignDropdown && els.campaignDropdown.classList.contains("open") && els.campaignBtn) {
      positionDropdownInViewport(els.campaignDropdown, els.campaignBtn);
    }
    if (els.teamProfilesDropdown && els.teamProfilesDropdown.style.display === "flex" && els.btnTeamProfilesDropdown) {
      positionDropdownInViewport(els.teamProfilesDropdown, els.btnTeamProfilesDropdown);
    }
  }

  function toggleCampaignDropdown(forceOpen) {
    if (!els.campaignDropdown) return;
    const isOpen = els.campaignDropdown.classList.contains("open");
    closeAllDropdowns();
    if (forceOpen === true || !isOpen) {
      els.campaignDropdown.classList.add("open");
      renderCampaignSelectList();
      positionDropdownInViewport(els.campaignDropdown, els.campaignBtn);
    }
  }

  // 1. Píldoras de Campañas Activas en la Barra Minimalista (Interactivas y Seleccionables)
  function renderActiveCampaignPills() {
    if (!els.activeCampaignsPills) return;
    const active = getActiveCampaigns();
    const total = active.length;
    const selected = active.filter((c) => state.selectedCampaignIds.has(c.id));
    const count = selected.length;

    if (els.campaignPillBadge) {
      els.campaignPillBadge.textContent = count;
    }
    if (els.campaignSelectedCountLabel) {
      els.campaignSelectedCountLabel.textContent = `${count} seleccionada${count === 1 ? "" : "s"}`;
    }

    els.activeCampaignsPills.innerHTML = "";

    if (count === 0) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "camp-pill camp-pill-empty";
      btn.innerHTML = `<span>⚠️ 0 campañas activas</span> <span style="font-size:10px;color:#6366f1;font-weight:700">+ Seleccionar</span>`;
      btn.title = "Haz clic para abrir el catálogo completo de campañas";
      btn.addEventListener("click", () => toggleCampaignDropdown(true));
      els.activeCampaignsPills.appendChild(btn);
    } else if (count === total) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "camp-pill camp-pill-all";
      btn.innerHTML = `<span>✓ Todas las campañas (${total})</span>`;
      btn.title = "Haz clic para filtrar o seleccionar campañas específicas";
      btn.addEventListener("click", () => toggleCampaignDropdown(true));
      els.activeCampaignsPills.appendChild(btn);
    } else {
      const maxDirect = count <= 4 ? count : 3;
      for (let i = 0; i < maxDirect; i++) {
        const c = selected[i];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "camp-pill camp-pill-active";
        btn.title = `Campaña ${c.shortLabel} (${c.fullLabel})\n• Clic para ver SOLO esta campaña\n• Clic en × para deseleccionar`;
        btn.innerHTML = `
          <span class="camp-pill-name">${escapeHtml(c.shortLabel)}</span>
          <span class="camp-pill-remove" data-id="${c.id}" title="Quitar campaña">×</span>
        `;

        btn.addEventListener("click", (e) => {
          const removeBtn = e.target.closest(".camp-pill-remove");
          if (removeBtn) {
            e.stopPropagation();
            state.selectedCampaignIds.delete(c.id);
            renderActiveCampaignPills();
            renderCampaignSelectList();
            scheduleSavePreferences();
            renderAll();
            return;
          }

          // Clic directo en la píldora: Aislar esta campaña
          state.selectedCampaignIds.clear();
          state.selectedCampaignIds.add(c.id);
          renderActiveCampaignPills();
          renderCampaignSelectList();
          scheduleSavePreferences();
          renderAll();
        });

        els.activeCampaignsPills.appendChild(btn);
      }

      if (count > maxDirect) {
        const moreBtn = document.createElement("button");
        moreBtn.type = "button";
        moreBtn.className = "camp-pill camp-pill-more";
        moreBtn.textContent = `+${count - maxDirect} más`;
        moreBtn.title = selected.slice(maxDirect).map((x) => x.shortLabel).join(", ") + "\nHaz clic para ver todas en el catálogo";
        moreBtn.addEventListener("click", () => toggleCampaignDropdown(true));
        els.activeCampaignsPills.appendChild(moreBtn);
      }
    }
  }

  // Lista desplegable de selección de campañas (Catálogo Completo y Visible)
  function renderCampaignSelectList() {
    if (!els.campaignList) return;
    const active = getActiveCampaigns();
    const q = (els.campaignSearch ? els.campaignSearch.value : "").trim().toLowerCase();
    els.campaignList.innerHTML = "";

    const filtered = active.filter((c) => {
      // Filtro por Año rápido
      if (selectedCampaignYear !== "ALL") {
        const cYear = c.adv ? c.adv.slice(0, 4) : "";
        if (cYear !== selectedCampaignYear && !c.fullLabel.includes(selectedCampaignYear)) {
          return false;
        }
      }
      // Filtro por texto si el usuario escribe
      if (q) {
        const textMatch =
          c.shortLabel.toLowerCase().includes(q) ||
          c.fullLabel.toLowerCase().includes(q) ||
          c.adv.includes(q) ||
          c.nal.includes(q);
        if (!textMatch) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      els.campaignList.innerHTML = `
        <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">
          No se encontraron campañas con el filtro actual
        </div>
      `;
      return;
    }

    for (const c of filtered) {
      const isChecked = state.selectedCampaignIds.has(c.id);
      const year = c.adv ? c.adv.slice(0, 4) : "";

      const card = document.createElement("div");
      card.className = `campaign-card-item ${isChecked ? "selected" : ""}`;
      card.innerHTML = `
        <div class="campaign-card-left">
          <input type="checkbox" id="chk-camp-${c.id}" data-id="${c.id}" ${isChecked ? "checked" : ""} />
          <div>
            <div style="display:flex;align-items:center;gap:6px">
              <span class="campaign-card-code">${escapeHtml(c.shortLabel)}</span>
              ${year ? `<span class="campaign-card-year">${year}</span>` : ""}
            </div>
            <div class="campaign-card-desc">${escapeHtml(c.fullLabel)}</div>
          </div>
        </div>
        <button type="button" class="campaign-btn-only" data-id="${c.id}" title="Seleccionar exclusivamente esta campaña">Solo esta</button>
      `;

      // Checkbox click
      const input = card.querySelector("input");
      input.addEventListener("click", (e) => e.stopPropagation());
      input.addEventListener("change", () => {
        if (input.checked) state.selectedCampaignIds.add(c.id);
        else state.selectedCampaignIds.delete(c.id);
        card.classList.toggle("selected", input.checked);
        renderActiveCampaignPills();
        scheduleSavePreferences();
        renderAll();
      });

      // Card row click
      card.addEventListener("click", (e) => {
        if (e.target.closest(".campaign-btn-only") || e.target === input) return;
        input.checked = !input.checked;
        if (input.checked) state.selectedCampaignIds.add(c.id);
        else state.selectedCampaignIds.delete(c.id);
        card.classList.toggle("selected", input.checked);
        renderActiveCampaignPills();
        scheduleSavePreferences();
        renderAll();
      });

      // Botón "Solo esta"
      const btnOnly = card.querySelector(".campaign-btn-only");
      btnOnly.addEventListener("click", (e) => {
        e.stopPropagation();
        state.selectedCampaignIds.clear();
        state.selectedCampaignIds.add(c.id);
        renderActiveCampaignPills();
        renderCampaignSelectList();
        scheduleSavePreferences();
        renderAll();
        closeAllDropdowns();
      });

      els.campaignList.appendChild(card);
    }
  }

  // 2. Helper de Perfiles Conocidos (Base del equipo + cualquier usuario extra en eventos)
  function getAllKnownProfiles() {
    const list = [...TEAM_PROFILES];
    const existingIds = new Set(list.map((p) => p.id));
    if (Array.isArray(customEvents)) {
      for (const ev of customEvents) {
        const owners = getCustomEventOwners(ev);
        for (const ow of owners) {
          if (!existingIds.has(ow)) {
            existingIds.add(ow);
            list.push({
              id: ow,
              name: ow,
              role: "designer",
              color: "#64748b",
              defaultPin: "1234",
            });
          }
        }
      }
    }
    return list;
  }

  function toggleTeamProfilesDropdown() {
    if (!els.teamProfilesDropdown) return;
    const isOpened = els.teamProfilesDropdown.style.display === "flex";
    if (isOpened) {
      closeAllDropdowns();
    } else {
      closeAllDropdowns();
      els.teamProfilesDropdown.style.display = "flex";
      if (els.teamProfilesDropdownWrap) els.teamProfilesDropdownWrap.classList.add("open");
      renderTeamProfilesDropdownList();
      positionDropdownInViewport(els.teamProfilesDropdown, els.btnTeamProfilesDropdown);
      if (els.teamProfileSearchInput) {
        els.teamProfileSearchInput.value = "";
        setTimeout(() => els.teamProfileSearchInput.focus(), 60);
      }
    }
  }

  function renderTeamProfilesDropdownList() {
    if (!els.teamProfilesOptionsList) return;
    els.teamProfilesOptionsList.innerHTML = "";

    const allProfiles = getAllKnownProfiles();
    const query = els.teamProfileSearchInput
      ? els.teamProfileSearchInput.value.trim().toLowerCase()
      : "";

    const activeUserTag = state.customFilterTags.size > 0
      ? Array.from(state.customFilterTags).find((t) => t.startsWith("USER:"))
      : null;
    const activeUserId = activeUserTag ? activeUserTag.replace("USER:", "") : null;

    const filtered = allProfiles.filter((p) => {
      if (!query) return true;
      return p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      els.teamProfilesOptionsList.innerHTML = `
        <div style="padding:14px;text-align:center;color:var(--text-muted);font-size:11px">
          No se encontró ningún perfil con "<strong>${query}</strong>"
        </div>
      `;
      return;
    }

    for (const p of filtered) {
      const isSelected = activeUserId === p.id;
      const count = customEvents.filter((e) => getCustomEventOwners(e).includes(p.id)).length;
      const initials = p.name.length <= 3 ? p.name : p.name.slice(0, 2);

      const row = document.createElement("div");
      row.className = `team-profile-option-row ${isSelected ? "selected" : ""}`;

      const isAdminLogged = state.loggedInUserId === "DANI";
      const isCurrentTarget = state.targetUserId === p.id;

      row.innerHTML = `
        <div class="team-profile-info">
          <span class="avatar-circle" style="background:${p.color};width:26px;height:26px;font-size:10px">${initials}</span>
          <div class="team-profile-text">
            <span class="team-profile-name">${p.name} ${isSelected ? "✓" : ""}</span>
            <span class="team-profile-role">${p.role === "admin" ? "👑 Administrador" : "Diseñador(a)"}${isCurrentTarget ? " • (Calendario activo)" : ""}</span>
          </div>
        </div>
        <div class="team-profile-actions">
          <span class="team-profile-count-pill">${count} evento${count !== 1 ? "s" : ""}</span>
          ${
            isAdminLogged && p.id !== "DANI"
              ? `<button type="button" class="team-profile-admin-btn" title="Configurar el calendario de ${p.name}">👑 Editar</button>`
              : ""
          }
        </div>
      `;

      const adminBtn = row.querySelector(".team-profile-admin-btn");
      if (adminBtn) {
        adminBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          switchAdminTargetUser(p.id);
          closeAllDropdowns();
        });
      }

      row.addEventListener("click", () => {
        if (!state.showCustomEvents) {
          state.showCustomEvents = true;
          if (els.chkShowCustomEvents) els.chkShowCustomEvents.checked = true;
        }

        if (isSelected) {
          state.customFilterTags.clear();
        } else {
          state.customFilterTags = new Set([`USER:${p.id}`]);
        }
        closeAllDropdowns();
        renderTeamAvatarsBar();
        scheduleSavePreferences();
        renderAll();
      });

      els.teamProfilesOptionsList.appendChild(row);
    }
  }

  // Barra de Avatares del Equipo y Selector Universal de Perfiles
  function renderTeamAvatarsBar() {
    if (!els.teamAvatarsList) return;
    els.teamAvatarsList.innerHTML = "";

    const isExtrasOn = state.showCustomEvents;
    if (els.chkShowCustomEvents) {
      els.chkShowCustomEvents.checked = isExtrasOn;
    }

    const hasFilter = state.customFilterTags.size > 0;
    const activeUserTag = hasFilter
      ? Array.from(state.customFilterTags).find((t) => t.startsWith("USER:"))
      : null;
    const activeUserId = activeUserTag ? activeUserTag.replace("USER:", "") : null;

    const allProfiles = getAllKnownProfiles();
    const activeProfile = activeUserId ? allProfiles.find((p) => p.id === activeUserId) : null;

    // Actualizar botón dropdown con el perfil activo
    if (els.teamDropdownLabel) {
      if (activeProfile) {
        els.teamDropdownLabel.textContent = `👤 ${activeProfile.name}`;
      } else {
        els.teamDropdownLabel.textContent = "Cualquier Perfil";
      }
    }
    if (els.btnTeamProfilesDropdown) {
      els.btnTeamProfilesDropdown.classList.toggle("active", Boolean(activeProfile));
    }

    if (els.btnTeamShowAll) {
      els.btnTeamShowAll.style.display = hasFilter ? "inline-flex" : "none";
      if (activeProfile) {
        els.btnTeamShowAll.textContent = `✕ Ver todos (${activeProfile.name})`;
      } else {
        els.btnTeamShowAll.textContent = "✕ Ver todos";
      }
    }

    let selectedAvatarEl = null;

    for (const p of allProfiles) {
      const isSelected = activeUserId === p.id;
      const count = customEvents.filter((e) => getCustomEventOwners(e).includes(p.id)).length;

      const avatarBtn = document.createElement("button");
      avatarBtn.type = "button";
      avatarBtn.className = `team-avatar-pill ${isSelected ? "selected" : ""} ${
        hasFilter && !isSelected ? "dimmed" : ""
      } ${!isExtrasOn ? "disabled" : ""}`;
      avatarBtn.style.setProperty("--user-color", p.color);
      avatarBtn.title = `${p.name} (${p.role === "admin" ? "Admin" : "Diseñador(a)"}) • ${count} evento${
        count !== 1 ? "s" : ""
      } extra\nHaz clic para filtrar sus eventos en el calendario`;

      const initials = p.name.length <= 3 ? p.name : p.name.slice(0, 2);

      avatarBtn.innerHTML = `
        <span class="avatar-circle" style="background:${p.color}">${initials}</span>
        <span class="avatar-name">${p.name}</span>
        ${count > 0 ? `<span class="avatar-count-badge">${count}</span>` : ""}
      `;

      if (isSelected) {
        selectedAvatarEl = avatarBtn;
      }

      avatarBtn.addEventListener("click", () => {
        if (!state.showCustomEvents) {
          state.showCustomEvents = true;
          if (els.chkShowCustomEvents) els.chkShowCustomEvents.checked = true;
        }

        if (isSelected) {
          // Si ya estaba seleccionado, se deselecciona y se muestran todos los eventos
          state.customFilterTags.clear();
        } else {
          // Filtrar solo los eventos del diseñador seleccionado
          state.customFilterTags = new Set([`USER:${p.id}`]);
        }
        renderTeamAvatarsBar();
        scheduleSavePreferences();
        renderAll();
      });

      els.teamAvatarsList.appendChild(avatarBtn);
    }

    // Centrar suavemente en el avatar seleccionado si está activo
    if (selectedAvatarEl) {
      setTimeout(() => {
        selectedAvatarEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }, 50);
    }

    // Gestionar visibilidad de flechas de scroll si hay desbordamiento horizontal
    setTimeout(() => {
      if (els.teamAvatarsList) {
        const canScroll = els.teamAvatarsList.scrollWidth > els.teamAvatarsList.clientWidth + 5;
        if (els.btnTeamScrollLeft) els.btnTeamScrollLeft.style.display = canScroll ? "flex" : "none";
        if (els.btnTeamScrollRight) els.btnTeamScrollRight.style.display = canScroll ? "flex" : "none";
      }
    }, 60);

    // Actualizar también el contenido del dropdown
    renderTeamProfilesDropdownList();
  }

  // 3. Indicador y Resumen del Botón Principal de Filtros
  function updateUnifiedFilterBadge() {
    if (!rawData) return;
    const count = state.selectedActivityNos.size;
    const total = rawData.activities.length;

    if (els.unifiedFilterActiveBadge) {
      if (count === 0) {
        els.unifiedFilterActiveBadge.textContent = "0 act.";
      } else if (count === total) {
        els.unifiedFilterActiveBadge.textContent = `Todas (${total})`;
      } else {
        els.unifiedFilterActiveBadge.textContent = `${count} act.`;
      }
    }

    if (els.drawerStatsActive) {
      els.drawerStatsActive.innerHTML = `<strong>${count}</strong> activas`;
    }
    if (els.drawerStatsTotal) {
      els.drawerStatsTotal.textContent = `${total} actividades oficiales`;
    }
  }

  // 4. Jerarquía Unificada: Área ➔ Proceso ➔ Actividades (#No)
  let drawerExpandedAreas = new Set(["Aglab", "DisGraf", "Ingenieria"]);
  let drawerExpandedProcs = new Set();

  function renderUnifiedDrawerHierarchy() {
    if (!els.unifiedDrawerTree || !rawData) return;

    const q = (els.unifiedDrawerSearch ? els.unifiedDrawerSearch.value : "").trim().toLowerCase();

    // Agrupar actividades por Área ➔ Proceso
    const areaMap = new Map();
    for (const act of rawData.activities) {
      if (!areaMap.has(act.area)) areaMap.set(act.area, new Map());
      const procMap = areaMap.get(act.area);
      if (!procMap.has(act.proceso)) procMap.set(act.proceso, []);
      procMap.get(act.proceso).push(act);
    }

    // Orden de presentación: AG LAB primero, luego DisGraf, Ingeniería y el resto alfabético
    const sortedAreas = Array.from(areaMap.keys()).sort((a, b) => {
      const order = { Aglab: 1, DisGraf: 2, Ingenieria: 3 };
      const oa = order[a] || 99;
      const ob = order[b] || 99;
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b, "es");
    });

    els.unifiedDrawerTree.innerHTML = "";
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
            String(act.no).includes(q) ||
            `#${act.no}` === q ||
            act.actividad.toLowerCase().includes(q) ||
            act.proceso.toLowerCase().includes(q) ||
            act.area.toLowerCase().includes(q) ||
            act.marca.toLowerCase().includes(q)
          );
        });

        if (filteredActs.length > 0) {
          areaHasMatches = true;
          totalMatches += filteredActs.length;
          matchingProcs.push({ proc, acts: filteredActs, totalCount: acts.length });
        }
      }

      if (q && !areaHasMatches) continue;

      const areaSelectedCount = allAreaActs.filter((a) => state.selectedActivityNos.has(a.no)).length;
      const isAreaAll = areaSelectedCount === allAreaActs.length && allAreaActs.length > 0;
      const isAreaSome = areaSelectedCount > 0 && areaSelectedCount < allAreaActs.length;
      const isAreaOpen = q ? true : drawerExpandedAreas.has(area);

      const areaGroup = document.createElement("div");
      areaGroup.className = `drawer-area-group ${isAreaOpen ? "open" : ""} ${areaSelectedCount > 0 ? "has-selected" : ""}`;
      areaGroup.setAttribute("data-area", area);

      const areaId = `chk-drawer-area-${area.replace(/[^a-zA-Z0-9]/g, "_")}`;

      const areaHeader = document.createElement("div");
      areaHeader.className = "drawer-area-header";
      areaHeader.innerHTML = `
        <span class="drawer-chevron">▶</span>
        <input type="checkbox" id="${areaId}" style="cursor:pointer" ${isAreaAll ? "checked" : ""} />
        <label for="${areaId}" class="drawer-area-title" style="cursor:pointer">
          <span>${getAreaDisplayName(area)}</span>
        </label>
        <span class="drawer-area-count">${areaSelectedCount}/${allAreaActs.length}</span>
        <button type="button" class="drawer-area-only-btn" title="Activar solo esta área y apagar las demás">Solo esta</button>
      `;

      const areaChk = areaHeader.querySelector(`#${areaId}`);
      if (isAreaSome) areaChk.indeterminate = true;

      areaChk.addEventListener("click", (e) => {
        e.stopPropagation();
        const shouldSelect = areaChk.checked;
        for (const act of allAreaActs) {
          if (shouldSelect) state.selectedActivityNos.add(act.no);
          else state.selectedActivityNos.delete(act.no);
        }
        updateUnifiedFilterBadge();
        renderUnifiedDrawerHierarchy();
        scheduleSavePreferences();
        renderAll();
      });

      const soloBtn = areaHeader.querySelector(".drawer-area-only-btn");
      soloBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.selectedActivityNos.clear();
        for (const act of allAreaActs) {
          state.selectedActivityNos.add(act.no);
        }
        updateUnifiedFilterBadge();
        renderUnifiedDrawerHierarchy();
        scheduleSavePreferences();
        renderAll();
      });

      areaHeader.addEventListener("click", (e) => {
        if (e.target === areaChk || e.target === soloBtn) return;
        const isOpen = areaGroup.classList.contains("open");
        if (isOpen) {
          areaGroup.classList.remove("open");
          drawerExpandedAreas.delete(area);
        } else {
          areaGroup.classList.add("open");
          drawerExpandedAreas.add(area);
        }
      });

      const areaBody = document.createElement("div");
      areaBody.className = "drawer-area-body";

      const procsToRender = q
        ? matchingProcs
        : Array.from(procMap.entries()).map(([proc, acts]) => ({ proc, acts, totalCount: acts.length }));

      for (const { proc, acts } of procsToRender) {
        const procKey = `${area}::${proc}`;
        const procSelectedCount = acts.filter((a) => state.selectedActivityNos.has(a.no)).length;
        const isProcAll = procSelectedCount === acts.length && acts.length > 0;
        const isProcSome = procSelectedCount > 0 && procSelectedCount < acts.length;
        const isProcOpen = q ? true : (drawerExpandedProcs.has(procKey) || (area === "Aglab" && acts.length <= 6));

        const procGroup = document.createElement("div");
        procGroup.className = `drawer-proc-group ${isProcOpen ? "open" : ""} ${procSelectedCount > 0 ? "has-selected" : ""}`;
        procGroup.setAttribute("data-proc-key", procKey);

        const procChkId = `chk-proc-${procKey.replace(/[^a-zA-Z0-9]/g, "_")}`;

        const procHeader = document.createElement("div");
        procHeader.className = "drawer-proc-header";
        procHeader.innerHTML = `
          <span class="drawer-proc-chevron">▶</span>
          <input type="checkbox" id="${procChkId}" style="cursor:pointer" ${isProcAll ? "checked" : ""} />
          <label for="${procChkId}" class="drawer-proc-title" style="cursor:pointer">
            <span>${getProcesoDisplayName(proc, area)}</span>
          </label>
          <span class="drawer-proc-count">${procSelectedCount}/${acts.length}</span>
        `;

        const procChk = procHeader.querySelector(`#${procChkId}`);
        if (isProcSome) procChk.indeterminate = true;

        procChk.addEventListener("click", (e) => {
          e.stopPropagation();
          const shouldSelect = procChk.checked;
          for (const act of acts) {
            if (shouldSelect) state.selectedActivityNos.add(act.no);
            else state.selectedActivityNos.delete(act.no);
          }
          updateUnifiedFilterBadge();
          renderUnifiedDrawerHierarchy();
          scheduleSavePreferences();
          renderAll();
        });

        procHeader.addEventListener("click", (e) => {
          if (e.target === procChk) return;
          const isOpen = procGroup.classList.contains("open");
          if (isOpen) {
            procGroup.classList.remove("open");
            drawerExpandedProcs.delete(procKey);
          } else {
            procGroup.classList.add("open");
            drawerExpandedProcs.add(procKey);
          }
        });

        const procBody = document.createElement("div");
        procBody.className = "drawer-proc-body";

        for (const act of acts) {
          const isActChecked = state.selectedActivityNos.has(act.no);
          const actItem = document.createElement("div");
          actItem.className = "drawer-act-item";
          const actId = `chk-act-drawer-${act.no}`;

          const brandClass = act.marca === "Livva" ? "Livva" : act.marca === "Azzorti" ? "Azzorti" : "AzzLivv";

          actItem.innerHTML = `
            <input type="checkbox" id="${actId}" data-no="${act.no}" ${isActChecked ? "checked" : ""} />
            <label for="${actId}" style="display:flex;align-items:flex-start;gap:8px;flex:1;cursor:pointer">
              <span class="drawer-act-no">#${act.no}</span>
              <span class="drawer-act-brand ${brandClass}">${act.marca}</span>
              <span class="drawer-act-title">${act.actividad}</span>
              <span class="drawer-act-dh">${act.dias} DH</span>
            </label>
          `;

          const actChk = actItem.querySelector("input");
          actChk.addEventListener("change", () => {
            if (actChk.checked) state.selectedActivityNos.add(act.no);
            else state.selectedActivityNos.delete(act.no);
            updateUnifiedFilterBadge();
            renderUnifiedDrawerHierarchy();
            scheduleSavePreferences();
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
      els.unifiedDrawerTree.appendChild(areaGroup);
    }

    if (q && totalMatches === 0) {
      els.unifiedDrawerTree.innerHTML = `
        <div style="text-align:center;padding:30px;color:var(--text-muted)">
          <div style="font-size:24px;margin-bottom:8px">🔍</div>
          <p>No se encontraron actividades con <strong>"${q}"</strong></p>
        </div>
      `;
    }
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
        const owners = getCustomEventOwners(ev);
        const matchesAnyUser = owners.some((uid) => state.customFilterTags.has(`USER:${uid}`));
        const hasAreaTags = Array.from(state.customFilterTags).some((t) => t.startsWith("AREA:"));
        const hasUserTags = Array.from(state.customFilterTags).some((t) => t.startsWith("USER:"));

        if (hasAreaTags && hasUserTags) {
          if (!state.customFilterTags.has(areaTag) && !matchesAnyUser) return false;
        } else if (hasAreaTags) {
          if (!state.customFilterTags.has(areaTag)) return false;
        } else if (hasUserTags) {
          if (!matchesAnyUser) return false;
        }
      }

      if (q) {
        const meta = parseCustomEventMeta(ev);
        const text = `${ev.title || ""} ${ev.area || ""} ${ev.owner_user || ""} ${meta.tag || ""} ${meta.cleanNotes || ""}`.toLowerCase();
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

    updateUnifiedFilterBadge();

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
    const monthsMap = new Map(); // "YYYY-MM" -> { year, month, ym, events: [], uniqueKeys: Set }

    function addEventToMaps(fStr, evObj, uniqueEventKey) {
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
          uniqueKeys: new Set(),
        });
      }
      const mEntry = monthsMap.get(ym);
      const uKey = uniqueEventKey || `${evObj.type}-${fStr}`;
      if (!mEntry.uniqueKeys.has(uKey)) {
        mEntry.uniqueKeys.add(uKey);
        mEntry.events.push(evObj);
      }
    }

    // 1. Add Official Cronograma Events for Selected Campaigns
    for (const act of selectedOfficial) {
      for (const camp of selectedCamps) {
        const fStr = act.fechas[camp.id];
        if (!fStr) continue;
        addEventToMaps(
          fStr,
          {
            type: "official",
            dateStr: fStr,
            act,
            camp,
            dh: act.dh[camp.id] ?? act.dias ?? 0,
          },
          `off-${act.no}-${camp.id}`
        );
      }
    }

    // 2. Add Custom Events Across Their Entire Date Range (Subtle Range Extension)
    for (const cev of visibleCustom) {
      if (!cev.event_date) continue;
      const range = getCustomEventRange(cev);
      if (!range.startDt || !range.endDt) continue;

      const spanDays = Math.min(180, range.calDays);
      for (let offset = 0; offset < spanDays; offset++) {
        const curDt = addDays(range.startDt, offset);
        const curStr = formatYMD(curDt);
        const dow = curDt.getDay();
        const isMonday = dow === 1;
        const isSunday = dow === 0;
        const isWeekend = dow === 0 || dow === 6;
        const isRangeStart = offset === 0;
        const isRangeEnd = offset === spanDays - 1;
        const isMultiDay = spanDays > 1;
        const continuesLeft = isMultiDay && !isRangeStart && !isMonday;
        const continuesRight = isMultiDay && !isRangeEnd && !isSunday;

        addEventToMaps(
          curStr,
          {
            type: "custom",
            dateStr: curStr,
            custom: cev,
            range,
            isMultiDay,
            isRangeStart,
            isRangeEnd,
            isMonday,
            isWeekend,
            continuesLeft,
            continuesRight,
            dayOffset: offset,
            totalDays: spanDays,
          },
          `cust-${cev.id}`
        );
      }
    }

    // Onboarding banner if 0 official activities are selected
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
            <button type="button" class="btn btn-primary" data-preset="aglab">🎨 Encender AG LAB (Textil y Moda)</button>
            <button type="button" class="btn btn-outline" data-preset="disgraf">📐 Encender Diseño Gráfico (DisGraf)</button>
            <button type="button" class="btn btn-outline" data-preset="ingenieria">⚙️ Encender Patronaje / Ingeniería</button>
            <button type="button" class="btn btn-outline" id="btnOnboardingOpenDrawer">🎛️ Ver Todas las Actividades</button>
            <button type="button" class="btn btn-add-event" id="btnOnboardingAddEvent">✨ + Crear Evento Adicional</button>
          </div>
        </div>
      `;
    }

    // If state.forceIncludeToday is active, ensure today's month is in monthsMap
    const todayYm = TODAY_STR.slice(0, 7);
    if (state.forceIncludeToday && !monthsMap.has(todayYm)) {
      const todayDt = new Date();
      monthsMap.set(todayYm, {
        year: todayDt.getFullYear(),
        month: todayDt.getMonth(),
        ym: todayYm,
        events: [],
        uniqueKeys: new Set(),
      });
    }

    // If no months have events yet, still render a default month sheet so user can click '+' on any day!
    if (monthsMap.size === 0) {
      const fallbackDate = parseYMD("2027-06-01") || new Date();
      const ym = formatYMD(fallbackDate).slice(0, 7);
      monthsMap.set(ym, {
        year: fallbackDate.getFullYear(),
        month: fallbackDate.getMonth(),
        ym,
        events: [],
        uniqueKeys: new Set(),
      });
    }

    const sortedMonthKeys = Array.from(monthsMap.keys()).sort();

    if (state.forceIncludeToday && sortedMonthKeys.includes(todayYm)) {
      state.calCurrentMonthIndex = sortedMonthKeys.indexOf(todayYm);
      state.forceIncludeToday = false;
    }

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
          const rawDayEvents = eventsByDate.get(cell.dateStr) || [];

          // Keep multi-day range events sorted at the top so they align across consecutive days in a week
          const dayEvents = [...rawDayEvents].sort((a, b) => {
            const aRank = a.type === "custom" ? (a.isMultiDay ? 0 : 1) : 2;
            const bRank = b.type === "custom" ? (b.isMultiDay ? 0 : 1) : 2;
            if (aRank !== bRank) return aRank - bRank;
            if (a.type === "custom" && b.type === "custom") {
              const cmpStart = (a.range.startStr || "").localeCompare(b.range.startStr || "");
              if (cmpStart !== 0) return cmpStart;
              return String(a.custom.id).localeCompare(String(b.custom.id));
            }
            return 0;
          });

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
              const meta = parseCustomEventMeta(cev);
              const cat = cev.category || "emerald";
              const bClass = badgeClassForBrand(cev.marca || "Azz Livv");
              const owners = getCustomEventOwners(cev);
              const rangeClasses = ev.isMultiDay
                ? `is-range-card ${ev.isRangeStart ? "is-range-start" : "is-range-continuation"} ${ev.isRangeEnd ? "is-range-end" : ""} ${ev.isWeekend ? "is-range-weekend" : ""} ${ev.continuesLeft ? "continues-left" : ""} ${ev.continuesRight ? "continues-right" : ""}`
                : "";

              let impBadgeHtml = "";
              if (meta.importance === "high") {
                impBadgeHtml = `<span class="event-importance-badge priority-high" title="Prioridad Alta">🔴 Alta</span>`;
              } else if (meta.importance === "low") {
                impBadgeHtml = `<span class="event-importance-badge priority-low" title="Prioridad Baja">🟢 Baja</span>`;
              }

              const tagBadgeHtml = meta.tag ? `<span class="event-hashtag-badge">${escapeHtml(meta.tag)}</span>` : "";

              if (!ev.isMultiDay || ev.isRangeStart) {
                eventsHtml.push(`
                  <div class="calendar-event-card event-custom-${cat} ${rangeClasses}" data-type="custom" data-evid="${cev.id}">
                    <div class="event-meta-line">
                      <span class="event-custom-badge">📌 ${cev.area || "Diseño"}</span>
                      ${tagBadgeHtml}
                      ${impBadgeHtml}
                      <span class="event-brand-badge brand-${bClass}">${cev.marca || "Azz Livv"}</span>
                      ${
                        ev.isMultiDay
                          ? `<span class="event-range-badge">🗓️ ${formatShortDayMonth(ev.range.startStr)} → ${formatShortDayMonth(ev.range.endStr)}</span>`
                          : ""
                      }
                    </div>
                    <div class="event-full-title">${cev.title}</div>
                    <div class="event-owners-wrap">${renderOwnerPillsHtml(owners, false)}</div>
                    ${meta.cleanNotes ? `<div class="event-notes-preview">${escapeHtml(meta.cleanNotes)}</div>` : ""}
                  </div>
                `);
              } else {
                // Subtle range extension card on continuation days
                const arrowSymbol = ev.isRangeEnd ? "🏁" : ev.isMonday ? "↪" : "→";
                const rightBadge = ev.isRangeEnd
                  ? `<span class="event-range-badge">Fin</span>`
                  : ev.isMonday
                  ? `<span class="event-range-badge">→ ${formatShortDayMonth(ev.range.endStr)}</span>`
                  : "";
                const showOwnersRow = ev.isMonday || ev.isRangeEnd;

                eventsHtml.push(`
                  <div class="calendar-event-card event-custom-${cat} ${rangeClasses}" data-type="custom" data-evid="${cev.id}">
                    <div class="range-cont-header">
                      <div class="range-cont-title">
                        <span class="range-cont-arrow">${arrowSymbol}</span>
                        ${meta.tag ? `<span class="event-hashtag-badge-mini">${escapeHtml(meta.tag)}</span>` : ""}
                        <span>${cev.title}</span>
                      </div>
                      ${rightBadge}
                    </div>
                    ${showOwnersRow ? `<div class="event-owners-wrap">${renderOwnerPillsHtml(owners, true)}</div>` : ""}
                  </div>
                `);
              }
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
              <span class="calendar-campaign-sub">CRONOGRAMA AGLAB — Azzorti &amp; Livva</span>
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
    const btnOnbDrawer = document.getElementById("btnOnboardingOpenDrawer");
    if (btnOnbDrawer) {
      btnOnbDrawer.addEventListener("click", () => {
        if (els.unifiedFilterDrawerBackdrop) {
          els.unifiedFilterDrawerBackdrop.style.display = "flex";
          renderUnifiedDrawerHierarchy();
          updateUnifiedFilterBadge();
          if (els.unifiedDrawerSearch) setTimeout(() => els.unifiedDrawerSearch.focus(), 60);
        }
      });
    }

    // Bind '+' Day Add Buttons
    els.calendarContainer.querySelectorAll(".day-add-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const dateStr = btn.getAttribute("data-adddate");
        openCustomEventModal(null, dateStr);
      });
    });

    // Bind Custom Event Click (Edit), Range Hover Highlight, & Tooltips
    const actMap = new Map(rawData.activities.map((a) => [String(a.no), a]));
    els.calendarContainer.querySelectorAll(".calendar-event-card").forEach((card) => {
      const cType = card.getAttribute("data-type");
      if (cType === "custom") {
        const evId = card.getAttribute("data-evid");
        card.addEventListener("click", (e) => {
          e.stopPropagation();
          els.tooltip.style.display = "none";
          const found = customEvents.find((x) => String(x.id) === String(evId));
          if (found) openCustomEventModal(found);
        });

        card.addEventListener("mouseenter", (e) => {
          els.calendarContainer
            .querySelectorAll(`.calendar-event-card[data-evid="${evId}"]`)
            .forEach((seg) => seg.classList.add("is-range-hovered"));

          const found = customEvents.find((x) => String(x.id) === String(evId));
          if (!found) return;
          const rng = getCustomEventRange(found);
          const owners = getCustomEventOwners(found);
          els.tooltip.innerHTML = `
            <h4>📌 ${found.title}</h4>
            <div class="tooltip-grid">
              <span class="lbl">Área / Rol:</span><span><strong>${found.area || "Diseño"}</strong></span>
              <span class="lbl">Asignado a:</span><span><strong>${owners.join(", ")}</strong></span>
              <span class="lbl">Marca:</span><span>${found.marca || "Azz Livv"}</span>
              <span class="lbl">Fecha Inicio:</span><span><strong>${formatHumanDate(rng.startStr)}</strong></span>
              <span class="lbl">Fecha Fin:</span><span><strong>${formatHumanDate(rng.endStr)}</strong></span>
              <span class="lbl">Duración:</span><span>${rng.calDays} día${rng.calDays === 1 ? "" : "s"} (${rng.bizDays} días hábiles)</span>
              ${found.notes ? `<span class="lbl">Notas:</span><span>${found.notes}</span>` : ""}
            </div>
            <div style="margin-top:6px;font-size:10px;color:#6ee7b7;font-weight:700">✏️ Haz clic para editar este evento</div>
          `;
          els.tooltip.style.display = "block";
          moveTooltip(e);
        });

        card.addEventListener("mousemove", moveTooltip);
        card.addEventListener("mouseleave", () => {
          els.calendarContainer
            .querySelectorAll(`.calendar-event-card[data-evid="${evId}"]`)
            .forEach((seg) => seg.classList.remove("is-range-hovered"));
          els.tooltip.style.display = "none";
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
    if (preset === "clear") {
      state.selectedActivityNos.clear();
    } else if (preset === "all") {
      for (const act of rawData.activities) {
        state.selectedActivityNos.add(act.no);
      }
    } else {
      for (const act of rawData.activities) {
        if (preset === "aglab") {
          // AG LAB involucra TANTO Diseño Textil (Estampación continua y local) como Diseño de Modas (Desarrollos MO 2D/3D, etc.)
          if (
            act.area === "Aglab" ||
            act.proceso === "Estampacion Continua" ||
            act.proceso === "Estampacion Local" ||
            act.proceso.startsWith("Desarrollos Moda") ||
            act.proceso === "Proyeccion Telas" ||
            act.proceso === "Telas Sublego" ||
            act.proceso === "Telas Especiales" ||
            act.proceso === "Importados"
          ) {
            state.selectedActivityNos.add(act.no);
          }
        } else if (preset === "textil" && (act.proceso === "Estampacion Continua" || act.proceso === "Estampacion Local")) {
          state.selectedActivityNos.add(act.no);
        } else if (preset === "disgraf" && (act.area === "DisGraf" || act.proceso === "DisGraf")) {
          state.selectedActivityNos.add(act.no);
        } else if (
          preset === "moda" &&
          (act.proceso.startsWith("Desarrollos Moda") ||
            (act.area === "Aglab" &&
              act.proceso !== "Estampacion Continua" &&
              act.proceso !== "Estampacion Local"))
        ) {
          state.selectedActivityNos.add(act.no);
        } else if (preset === "ingenieria" && (act.area === "Ingenieria" || act.proceso.startsWith("Ingenieria"))) {
          state.selectedActivityNos.add(act.no);
        }
      }
    }
    populateFilterControls();
    scheduleSavePreferences();
    renderAll();
  }

  /* ==========================================================================
     11. CUSTOM EVENT MODAL (ADD / EDIT / DELETE IN SUPABASE)
     ========================================================================== */
  let modalSelectedOwners = new Set();

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeHashtag(tag) {
    if (!tag) return "";
    let t = String(tag).trim();
    if (!t.startsWith("#")) t = "#" + t;
    t = t.replace(/\s+/g, "_");
    return t;
  }

  function parseCustomEventMeta(cev) {
    if (!cev) return { tag: "#Entrega", importance: "medium", cleanNotes: "" };

    let tag = cev.tag || "";
    let importance = cev.importance || "medium";
    let rawNotes = cev.notes || "";
    let cleanNotes = rawNotes;

    const metaMatch = rawNotes.match(/<!--meta:([\s\S]*?)-->/);
    if (metaMatch) {
      try {
        const parsed = JSON.parse(metaMatch[1]);
        if (parsed.tag) tag = parsed.tag;
        if (parsed.importance) importance = parsed.importance;
        cleanNotes = rawNotes.replace(/<!--meta:[\s\S]*?-->/, "").trim();
      } catch (e) {}
    } else {
      const tagMatch = cleanNotes.match(/^(#[A-Za-z0-9_áéíóúÁÉÍÓÚñÑ]+)/);
      if (tagMatch && !tag) {
        tag = tagMatch[1];
      }
      if (!tag && cev.category) {
        const legacyMap = {
          emerald: "#Entrega",
          amber: "#Muestra",
          indigo: "#Fit",
          rose: "#HitoCrítico",
          teal: "#Seguimiento",
          purple: "#Revisión",
          sky: "#Comité",
          orange: "#Taller",
        };
        tag = legacyMap[cev.category] || "#General";
      }
    }

    return {
      tag: normalizeHashtag(tag) || "#General",
      importance: (importance === "high" || importance === "low") ? importance : "medium",
      cleanNotes,
    };
  }

  function serializeCustomEventNotes(cleanNotes, tag, importance) {
    const metaObj = {};
    if (tag) metaObj.tag = normalizeHashtag(tag);
    if (importance) metaObj.importance = importance;

    const hasMeta = Object.keys(metaObj).length > 0;
    const metaComment = hasMeta ? `\n<!--meta:${JSON.stringify(metaObj)}-->` : "";
    return (cleanNotes || "").trim() + metaComment;
  }

  function loadSavedHashtags() {
    try {
      const cached = localStorage.getItem(LOCAL_SAVED_HASHTAGS_KEY);
      if (cached) {
        const arr = JSON.parse(cached);
        if (Array.isArray(arr)) {
          arr.forEach((h) => {
            const clean = normalizeHashtag(h);
            if (clean) savedHashtags.add(clean);
          });
        }
      }
    } catch (e) {
      console.warn("Error leyendo savedHashtags:", e);
    }

    if (Array.isArray(customEvents)) {
      for (const cev of customEvents) {
        const meta = parseCustomEventMeta(cev);
        if (meta.tag) savedHashtags.add(meta.tag);
      }
    }
  }

  function saveSavedHashtags() {
    try {
      localStorage.setItem(LOCAL_SAVED_HASHTAGS_KEY, JSON.stringify(Array.from(savedHashtags)));
    } catch (e) {
      console.warn("Error guardando savedHashtags:", e);
    }
  }

  function saveHashtagToCatalog(tag) {
    const clean = normalizeHashtag(tag);
    if (!clean) return;
    savedHashtags.add(clean);
    saveSavedHashtags();
    renderSavedHashtagsList(clean);
  }

  function removeHashtagFromCatalog(tag) {
    const clean = normalizeHashtag(tag);
    if (!clean) return;
    savedHashtags.delete(clean);
    saveSavedHashtags();
    const currentVal = els.evTagInput ? els.evTagInput.value : "";
    renderSavedHashtagsList(currentVal);
  }

  function renderSavedHashtagsList(activeTag) {
    if (!els.savedHashtagsList) return;
    const normActive = normalizeHashtag(activeTag);
    const html = [];
    for (const tag of savedHashtags) {
      if (!tag) continue;
      const isActive = tag.toLowerCase() === normActive.toLowerCase();
      const isDeletable = !DEFAULT_HASHTAGS.includes(tag);
      html.push(`
        <button type="button" class="saved-hashtag-pill ${isActive ? "active" : ""}" data-tag="${escapeHtml(tag)}">
          <span>${escapeHtml(tag)}</span>
          ${isDeletable ? `<span class="pill-del-btn" data-deltag="${escapeHtml(tag)}" title="Eliminar de guardados">×</span>` : ""}
        </button>
      `);
    }
    els.savedHashtagsList.innerHTML = html.join("");
  }

  function selectModalColor(colorName) {
    const color = colorName || "emerald";
    if (els.evCategoryInput) els.evCategoryInput.value = color;
    if (els.evColorPicker) {
      const items = els.evColorPicker.querySelectorAll(".color-swatch-item");
      items.forEach((item) => {
        item.classList.toggle("active", item.getAttribute("data-color") === color);
      });
    }
  }

  function selectModalImportance(impLevel) {
    const imp = (impLevel === "high" || impLevel === "low") ? impLevel : "medium";
    if (els.evImportanceInput) els.evImportanceInput.value = imp;
    if (els.evImportanceGroup) {
      const choices = els.evImportanceGroup.querySelectorAll(".importance-choice");
      choices.forEach((choice) => {
        choice.classList.toggle("active", choice.getAttribute("data-importance") === imp);
      });
    }
  }

  function updateModalHashtagDisplay(val) {
    const tag = normalizeHashtag(val);
    if (els.evTagActivePreview) {
      els.evTagActivePreview.textContent = tag || "#SinEtiqueta";
    }
    if (els.btnClearHashtag) {
      els.btnClearHashtag.style.display = val && val.trim() ? "block" : "none";
    }
    if (els.savedHashtagsList) {
      const pills = els.savedHashtagsList.querySelectorAll(".saved-hashtag-pill");
      pills.forEach((p) => {
        const pTag = p.getAttribute("data-tag");
        p.classList.toggle("active", Boolean(pTag && tag && pTag.toLowerCase() === tag.toLowerCase()));
      });
    }
  }

  function renderModalOwnersGrid() {
    if (!els.evOwnersGrid) return;
    els.evOwnersGrid.innerHTML = "";
    const allProfiles = getAllKnownProfiles();

    for (const p of allProfiles) {
      const isSelected = modalSelectedOwners.has(p.id);
      const chip = document.createElement("div");
      chip.className = `ev-owner-chip ${isSelected ? "selected" : ""}`;
      chip.innerHTML = `
        <span class="ev-owner-chip-avatar" style="background:${p.color}">${p.name.slice(0, 2)}</span>
        <span>${p.name}</span>
        <span class="ev-owner-chip-check">✓</span>
      `;
      chip.addEventListener("click", () => {
        if (modalSelectedOwners.has(p.id)) {
          modalSelectedOwners.delete(p.id);
        } else {
          modalSelectedOwners.add(p.id);
        }
        renderModalOwnersGrid();
      });
      els.evOwnersGrid.appendChild(chip);
    }

    if (els.evOwnersCountLabel) {
      const cnt = modalSelectedOwners.size;
      if (cnt === 0) {
        els.evOwnersCountLabel.textContent = "(Selecciona al menos 1 persona)";
        els.evOwnersCountLabel.style.color = "#e11d48";
      } else if (cnt === allProfiles.length) {
        els.evOwnersCountLabel.textContent = `(Todo el equipo: ${cnt})`;
        els.evOwnersCountLabel.style.color = "#059669";
      } else {
        els.evOwnersCountLabel.textContent = `(${cnt} seleccionada${cnt === 1 ? "" : "s"}: ${Array.from(modalSelectedOwners).join(", ")})`;
        els.evOwnersCountLabel.style.color = "#6366f1";
      }
    }
  }

  function updateModalRangeSummary() {
    if (!els.evDateInput || !els.evEndDateInput || !els.evRangeSummaryBadge) return;
    const sVal = els.evDateInput.value;
    let eVal = els.evEndDateInput.value;
    if (sVal && eVal && eVal < sVal) {
      eVal = sVal;
      els.evEndDateInput.value = sVal;
    }
    if (sVal) {
      els.evEndDateInput.min = sVal;
    }
    const sDt = parseYMD(sVal);
    const eDt = parseYMD(eVal) || sDt;
    if (!sDt || !eDt) {
      els.evRangeSummaryBadge.textContent = "Selecciona fechas";
      return;
    }
    const calDays = Math.max(1, daysBetween(sDt, eDt) + 1);
    const bizDays = countBusinessDaysBetween(sDt, eDt);
    if (calDays === 1) {
      els.evRangeSummaryBadge.textContent = `📅 1 día (${formatShortDayMonth(sVal)})`;
    } else {
      els.evRangeSummaryBadge.textContent = `🗓️ ${formatShortDayMonth(sVal)} → ${formatShortDayMonth(eVal)} (${calDays} días • ${bizDays} hábiles)`;
    }
  }

  function openCustomEventModal(existingEvent, defaultDateStr) {
    loadSavedHashtags();

    if (existingEvent) {
      els.customModalTitle.textContent = "✏️ Editar Evento Adicional";
      els.evIdInput.value = existingEvent.id;
      els.evTitleInput.value = existingEvent.title || "";
      const rng = getCustomEventRange(existingEvent);
      els.evDateInput.value = rng.startStr || TODAY_STR;
      els.evEndDateInput.value = rng.endStr || rng.startStr || TODAY_STR;
      els.evAreaInput.value = existingEvent.area || "AG LAB (Diseño Textil y Moda)";
      modalSelectedOwners = new Set(getCustomEventOwners(existingEvent));
      els.evMarcaInput.value = existingEvent.marca || "Azz Livv";

      const meta = parseCustomEventMeta(existingEvent);
      if (els.evTagInput) els.evTagInput.value = meta.tag.replace(/^#/, "");
      updateModalHashtagDisplay(meta.tag);
      renderSavedHashtagsList(meta.tag);

      selectModalColor(existingEvent.category || "emerald");
      selectModalImportance(meta.importance || "medium");

      els.evNotesInput.value = meta.cleanNotes || "";
      els.btnDeleteCustomEvent.style.display = "inline-flex";
    } else {
      els.customModalTitle.textContent = "✨ Agregar Nuevo Evento al Calendario";
      els.evIdInput.value = "";
      els.evTitleInput.value = "";
      const defDate = defaultDateStr || "2027-06-15";
      els.evDateInput.value = defDate;
      els.evEndDateInput.value = defDate;
      els.evAreaInput.value = "AG LAB (Diseño Textil y Moda)";
      modalSelectedOwners = new Set([state.targetUserId || state.loggedInUserId || "DANI"]);
      els.evMarcaInput.value = "Azz Livv";

      const defTag = "#Entrega";
      if (els.evTagInput) els.evTagInput.value = defTag.replace(/^#/, "");
      updateModalHashtagDisplay(defTag);
      renderSavedHashtagsList(defTag);

      selectModalColor("emerald");
      selectModalImportance("medium");

      els.evNotesInput.value = "";
      els.btnDeleteCustomEvent.style.display = "none";
    }

    renderModalOwnersGrid();
    updateModalRangeSummary();

    els.customEventModal.style.display = "flex";
    setTimeout(() => {
      if (els.evTitleInput) els.evTitleInput.focus();
    }, 50);
  }

  async function handleSaveCustomEvent(e) {
    e.preventDefault();
    const id = els.evIdInput.value.trim();
    const startStr = els.evDateInput.value;
    let endStr = els.evEndDateInput.value || startStr;
    if (endStr < startStr) endStr = startStr;

    const startDt = parseYMD(startStr);
    const endDt = parseYMD(endStr) || startDt;
    const bizDays = startDt && endDt ? countBusinessDaysBetween(startDt, endDt) : 1;

    if (modalSelectedOwners.size === 0) {
      modalSelectedOwners.add(state.targetUserId || state.loggedInUserId || "DANI");
    }

    const encodedEventDate = startStr === endStr ? startStr : `${startStr}|${endStr}`;
    const encodedOwners = Array.from(modalSelectedOwners).join(", ");

    const selectedColor = els.evCategoryInput ? els.evCategoryInput.value || "emerald" : "emerald";
    const rawTag = els.evTagInput ? els.evTagInput.value.trim() : "";
    const finalTag = normalizeHashtag(rawTag || "General");
    const importance = els.evImportanceInput ? els.evImportanceInput.value || "medium" : "medium";
    const cleanNotes = els.evNotesInput ? els.evNotesInput.value.trim() : "";
    const serializedNotes = serializeCustomEventNotes(cleanNotes, finalTag, importance);

    // Guardar el hashtag para futuros usos
    if (finalTag && finalTag !== "#General") {
      saveHashtagToCatalog(finalTag);
    }

    const payload = {
      title: els.evTitleInput.value.trim(),
      event_date: encodedEventDate,
      dh: bizDays,
      area: els.evAreaInput.value,
      owner_user: encodedOwners,
      marca: els.evMarcaInput.value,
      category: selectedColor,
      notes: serializedNotes,
      created_by: state.loggedInUserId || "DANI",
    };

    if (!payload.title || !startStr) return;

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
      const rng = getCustomEventRange(cev);
      if (!rng.startDt || !rng.endDt) continue;
      const startDt = rng.startDt;
      const endDt = rng.endDt;
      const dhVal = rng.bizDays;
      const owners = getCustomEventOwners(cev);
      const ownersLabel = owners.length >= TEAM_PROFILES.length ? "Todo el equipo" : owners.join(", ");

      if (!minDate || startDt < minDate) minDate = new Date(startDt.getTime());
      if (!maxDate || endDt > maxDate) maxDate = new Date(endDt.getTime());

      const meta = parseCustomEventMeta(cev);
      const tagPrefix = meta.tag ? `[${meta.tag}] ` : "";
      const impIcon = meta.importance === "high" ? "🔴 " : "";

      items.push({
        isCustom: true,
        custom: cev,
        act: {
          no: "📌",
          actividad: `${impIcon}${tagPrefix}${cev.title}`,
          proceso: `📌 Eventos Extra (${cev.area || "Equipo"})`,
          area: ownersLabel,
          marca: cev.marca || "Azz Livv",
          dias: dhVal,
        },
        bars: [
          {
            camp: { shortLabel: ownersLabel, fullLabel: cev.area || "Evento Adicional" },
            startDt,
            endDt,
            startStr: rng.startStr,
            endStr: rng.endStr,
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
      "PRODID:-//AG LAB Azzorti Livva//Cronograma AGLAB//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:CRONOGRAMA AGLAB - ${state.targetUserId || "Equipo"}`,
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
      const rng = getCustomEventRange(cev);
      if (!rng.startDt || !rng.endDt) continue;
      const endDtExclusive = addDays(rng.endDt, 1);
      const sVal = formatYMD(rng.startDt).replace(/-/g, "");
      const eVal = formatYMD(endDtExclusive).replace(/-/g, "");
      const owners = getCustomEventOwners(cev).join(", ");
      const meta = parseCustomEventMeta(cev);
      const tagText = meta.tag ? ` [${meta.tag}]` : "";
      const uid = `custom-${cev.id}@azzorti-livva.com`;
      const summary = `[📌 ${cev.area || "EXTRA"}${tagText} - ${owners || "Equipo"}] ${cev.title}`;
      const desc = `Asignado a: ${owners}\\nÁrea: ${cev.area}\\nEtiqueta: ${meta.tag}\\nImportancia: ${meta.importance.toUpperCase()}\\nMarca: ${cev.marca}\\nRango: ${rng.startStr} al ${rng.endStr}\\nNotas: ${meta.cleanNotes || ""}`;
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
    if (els.campaignDropdown) els.campaignDropdown.classList.remove("open");
    if (els.teamProfilesDropdown) els.teamProfilesDropdown.style.display = "none";
    if (els.teamProfilesDropdownWrap) els.teamProfilesDropdownWrap.classList.remove("open");
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
    els.btnOpenAddEvent.addEventListener("click", () => openCustomEventModal(null, TODAY_STR));
    els.btnCloseCustomModal.addEventListener("click", () => (els.customEventModal.style.display = "none"));
    els.btnCancelCustomModal.addEventListener("click", () => (els.customEventModal.style.display = "none"));
    els.customEventForm.addEventListener("submit", handleSaveCustomEvent);
    els.btnDeleteCustomEvent.addEventListener("click", handleDeleteCustomEvent);

    if (els.evTagInput) {
      els.evTagInput.addEventListener("input", (e) => {
        updateModalHashtagDisplay(e.target.value);
      });
    }

    if (els.btnClearHashtag) {
      els.btnClearHashtag.addEventListener("click", () => {
        if (els.evTagInput) {
          els.evTagInput.value = "";
          updateModalHashtagDisplay("");
          els.evTagInput.focus();
        }
      });
    }

    if (els.savedHashtagsList) {
      els.savedHashtagsList.addEventListener("click", (e) => {
        const delBtn = e.target.closest(".pill-del-btn");
        if (delBtn) {
          e.stopPropagation();
          const tagToDel = delBtn.getAttribute("data-deltag");
          if (tagToDel) removeHashtagFromCatalog(tagToDel);
          return;
        }

        const pill = e.target.closest(".saved-hashtag-pill");
        if (!pill) return;
        const tag = pill.getAttribute("data-tag");
        if (tag && els.evTagInput) {
          els.evTagInput.value = tag.replace(/^#/, "");
          updateModalHashtagDisplay(tag);
        }
      });
    }

    if (els.evColorPicker) {
      els.evColorPicker.addEventListener("click", (e) => {
        const item = e.target.closest(".color-swatch-item");
        if (!item) return;
        const col = item.getAttribute("data-color");
        if (col) selectModalColor(col);
      });
    }

    if (els.evImportanceGroup) {
      els.evImportanceGroup.addEventListener("click", (e) => {
        const choice = e.target.closest(".importance-choice");
        if (!choice) return;
        const imp = choice.getAttribute("data-importance");
        if (imp) selectModalImportance(imp);
      });
    }

    els.evDateInput.addEventListener("change", updateModalRangeSummary);
    els.evEndDateInput.addEventListener("change", updateModalRangeSummary);

    els.btnEvOwnerOnlyMe.addEventListener("click", () => {
      modalSelectedOwners = new Set([state.targetUserId || state.loggedInUserId || "DANI"]);
      renderModalOwnersGrid();
    });
    els.btnEvOwnerAll.addEventListener("click", () => {
      modalSelectedOwners = new Set(getAllKnownProfiles().map((p) => p.id));
      renderModalOwnersGrid();
    });
    els.btnEvOwnerClear.addEventListener("click", () => {
      modalSelectedOwners.clear();
      renderModalOwnersGrid();
    });

    // 1. Campaign Quick Dropdown Toggle & Outside Click
    if (els.campaignBtn && els.campaignDropdown) {
      els.campaignBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleCampaignDropdown();
      });

      document.addEventListener("click", (e) => {
        const inCampaign = els.campaignDropdown && els.campaignDropdown.contains(e.target);
        const inCampaignBtn = els.campaignBtn && els.campaignBtn.contains(e.target);
        const inTeamDropdown = els.teamProfilesDropdown && els.teamProfilesDropdown.contains(e.target);
        const inTeamBtn = els.btnTeamProfilesDropdown && els.btnTeamProfilesDropdown.contains(e.target);

        if (!inCampaign && !inCampaignBtn && !inTeamDropdown && !inTeamBtn) {
          closeAllDropdowns();
        }
      });
    }

    // Campaign Year Tabs (Filtro rápido por año)
    if (els.campaignYearTabs) {
      els.campaignYearTabs.addEventListener("click", (e) => {
        const tab = e.target.closest(".year-tab");
        if (!tab) return;
        selectedCampaignYear = tab.getAttribute("data-year") || "ALL";
        const allTabs = els.campaignYearTabs.querySelectorAll(".year-tab");
        allTabs.forEach((t) => t.classList.toggle("active", t === tab));
        renderCampaignSelectList();
      });
    }

    // Campaign Filter Actions
    if (els.campaignSearch) {
      els.campaignSearch.addEventListener("input", renderCampaignSelectList);
    }
    if (els.campaignSelectAll) {
      els.campaignSelectAll.addEventListener("click", () => {
        state.selectedCampaignIds = new Set(getActiveCampaigns().map((c) => c.id));
        populateFilterControls();
        scheduleSavePreferences();
        renderAll();
      });
    }
    if (els.campaignSelect2027) {
      els.campaignSelect2027.addEventListener("click", () => {
        state.selectedCampaignIds = new Set(
          getActiveCampaigns().filter((c) => c.adv.startsWith("2027")).map((c) => c.id)
        );
        populateFilterControls();
        scheduleSavePreferences();
        renderAll();
      });
    }
    if (els.campaignSelect2028) {
      els.campaignSelect2028.addEventListener("click", () => {
        state.selectedCampaignIds = new Set(
          getActiveCampaigns().filter((c) => c.adv.startsWith("2028")).map((c) => c.id)
        );
        populateFilterControls();
        scheduleSavePreferences();
        renderAll();
      });
    }
    if (els.campaignClearAll) {
      els.campaignClearAll.addEventListener("click", () => {
        state.selectedCampaignIds.clear();
        populateFilterControls();
        scheduleSavePreferences();
        renderAll();
      });
    }
    if (els.chkInclude2026) {
      els.chkInclude2026.addEventListener("change", (e) => {
        state.include2026 = e.target.checked;
        populateFilterControls();
        scheduleSavePreferences();
        renderAll();
      });
    }

    // 2. Team Avatars & Extras Filter & Profiles Selector
    if (els.chkShowCustomEvents) {
      els.chkShowCustomEvents.addEventListener("change", (e) => {
        state.showCustomEvents = e.target.checked;
        renderTeamAvatarsBar();
        scheduleSavePreferences();
        renderAll();
      });
    }
    if (els.btnTeamShowAll) {
      els.btnTeamShowAll.addEventListener("click", () => {
        state.customFilterTags.clear();
        renderTeamAvatarsBar();
        scheduleSavePreferences();
        renderAll();
      });
    }

    if (els.btnTeamProfilesDropdown) {
      els.btnTeamProfilesDropdown.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleTeamProfilesDropdown();
      });
    }

    if (els.teamProfileSearchInput) {
      els.teamProfileSearchInput.addEventListener("input", () => {
        renderTeamProfilesDropdownList();
      });
    }

    if (els.btnSelectAllProfiles) {
      els.btnSelectAllProfiles.addEventListener("click", () => {
        state.customFilterTags.clear();
        closeAllDropdowns();
        renderTeamAvatarsBar();
        scheduleSavePreferences();
        renderAll();
      });
    }

    if (els.btnTeamScrollLeft && els.teamAvatarsList) {
      els.btnTeamScrollLeft.addEventListener("click", () => {
        els.teamAvatarsList.scrollBy({ left: -140, behavior: "smooth" });
      });
    }

    if (els.btnTeamScrollRight && els.teamAvatarsList) {
      els.btnTeamScrollRight.addEventListener("click", () => {
        els.teamAvatarsList.scrollBy({ left: 140, behavior: "smooth" });
      });
    }

    // 3. Panel Unificado de Configuración (Drawer Flotante)
    if (els.btnOpenUnifiedFilters) {
      els.btnOpenUnifiedFilters.addEventListener("click", () => {
        if (els.unifiedFilterDrawerBackdrop) {
          els.unifiedFilterDrawerBackdrop.style.display = "flex";
          renderUnifiedDrawerHierarchy();
          updateUnifiedFilterBadge();
          if (els.unifiedDrawerSearch) setTimeout(() => els.unifiedDrawerSearch.focus(), 60);
        }
      });
    }

    function closeUnifiedDrawer() {
      if (els.unifiedFilterDrawerBackdrop) {
        els.unifiedFilterDrawerBackdrop.style.display = "none";
      }
    }

    if (els.btnCloseUnifiedDrawer) {
      els.btnCloseUnifiedDrawer.addEventListener("click", closeUnifiedDrawer);
    }
    if (els.btnDrawerApplyClose) {
      els.btnDrawerApplyClose.addEventListener("click", closeUnifiedDrawer);
    }
    if (els.unifiedFilterDrawerBackdrop) {
      els.unifiedFilterDrawerBackdrop.addEventListener("click", (e) => {
        if (e.target === els.unifiedFilterDrawerBackdrop) {
          closeUnifiedDrawer();
        }
      });
    }

    // Escape closes modals and drawer
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeUnifiedDrawer();
        closeAllDropdowns();
      }
    });

    window.addEventListener("resize", () => {
      repositionOpenDropdowns();
      if (els.teamAvatarsList) {
        const canScroll = els.teamAvatarsList.scrollWidth > els.teamAvatarsList.clientWidth + 5;
        if (els.btnTeamScrollLeft) els.btnTeamScrollLeft.style.display = canScroll ? "flex" : "none";
        if (els.btnTeamScrollRight) els.btnTeamScrollRight.style.display = canScroll ? "flex" : "none";
      }
    });

    // Drawer Presets Rápidos
    if (els.unifiedFilterDrawer) {
      els.unifiedFilterDrawer.querySelectorAll("[data-preset]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const preset = btn.getAttribute("data-preset");
          applyQuickPreset(preset);
        });
      });
    }
    if (els.btnDrawerSelectAll) {
      els.btnDrawerSelectAll.addEventListener("click", () => applyQuickPreset("all"));
    }
    if (els.btnDrawerClearAll) {
      els.btnDrawerClearAll.addEventListener("click", () => applyQuickPreset("clear"));
    }

    // Drawer Search & Actions
    if (els.unifiedDrawerSearch) {
      els.unifiedDrawerSearch.addEventListener("input", renderUnifiedDrawerHierarchy);
    }
    if (els.btnDrawerExpandAll) {
      els.btnDrawerExpandAll.addEventListener("click", () => {
        if (!rawData) return;
        rawData.activities.forEach((a) => {
          drawerExpandedAreas.add(a.area);
          drawerExpandedProcs.add(`${a.area}::${a.proceso}`);
        });
        renderUnifiedDrawerHierarchy();
      });
    }
    if (els.btnDrawerCollapseAll) {
      els.btnDrawerCollapseAll.addEventListener("click", () => {
        drawerExpandedAreas.clear();
        drawerExpandedProcs.clear();
        renderUnifiedDrawerHierarchy();
      });
    }

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

    function goToToday() {
      if (state.viewMode !== "calendar") {
        state.viewMode = "calendar";
        els.tabCalendar.classList.add("active");
        els.tabGantt.classList.remove("active");
        els.tabMatrix.classList.remove("active");
        els.calendarToolbarOptions.style.display = "flex";
        els.ganttToolbarOptions.style.display = "none";
        if (els.matrixToolbarOptions) els.matrixToolbarOptions.style.display = "none";
        els.calendarWrapper.style.display = "block";
        els.ganttWrapper.style.display = "none";
        els.matrixWrapper.style.display = "none";
      }

      const todayYm = TODAY_STR.slice(0, 7);
      if (todayYm.startsWith("2026") && !state.include2026) {
        state.include2026 = true;
        if (els.chkInclude2026) els.chkInclude2026.checked = true;
        populateFilterControls();
      }

      state.forceIncludeToday = true;
      renderAll();

      setTimeout(() => {
        const todayCell = document.querySelector(`.calendar-day-cell[data-date="${TODAY_STR}"]`);
        if (todayCell) {
          todayCell.scrollIntoView({ behavior: "smooth", block: "center" });
          todayCell.classList.add("highlight-pulse");
          setTimeout(() => todayCell.classList.remove("highlight-pulse"), 3600);
        }
      }, 60);
    }

    // Calendar & Gantt Controls
    if (els.btnCalToday) {
      els.btnCalToday.addEventListener("click", goToToday);
    }
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

    // Exports
    els.btnExportPdfCalendar.addEventListener("click", printPdfCalendar);
    els.btnExportPdfGantt.addEventListener("click", printPdfGantt);
    els.btnExportIcs.addEventListener("click", exportFilteredToICS);
    els.btnExportCsv.addEventListener("click", exportFilteredToCSV);
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
    loadSavedHashtags();

    // Master Cronograma Oficial (Manual - datos_cronograma.js es la fuente única de verdad)
    try {
      localStorage.removeItem(LOCAL_MASTER_CACHE_KEY);
    } catch (e) {
      // ignore
    }
    rawData = window.CRONOGRAMA_INITIAL_DATA;
    if (rawData && rawData.activities) {
      els.statusBadge.textContent = `Cronograma Oficial (${rawData.activities.length} actividades)`;
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
