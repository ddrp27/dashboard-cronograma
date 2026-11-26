/* ==========================================================================
   CRONOGRAMA AGLAB — CALENDARIO V2 (LOGICA MODULAR, MULTI-MARCA, TEAMS & PUSH)
   Vanilla JS • Optimistic UI (<16ms) • Delegación Única • Supabase Aditivo
   ========================================================================== */
(function () {
  "use strict";

  /* ==========================================================================
     1. STORAGE KEYS & CONSTANTS
     ========================================================================== */
  const CACHE_CARDS_KEY = "AZZORTI_CARDS_V2";
  const CACHE_NOTES_KEY = "AZZORTI_NOTES_V2";
  const CACHE_NOTIFS_KEY = "AZZORTI_NOTIFS_V2";
  const CACHE_VIEW_PREFS_KEY = "AZZORTI_CAL_VIEW_PREFS_V2";
  const CACHE_BRANDS_KEY = "AZZORTI_BRANDS_V2";
  const CACHE_DISMISSED_ALERTS_KEY = "AZZORTI_DISMISSED_ALERTS_V2";

  const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const WEEKDAY_NAMES = [
    "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo",
  ];

  const STATUS_META = {
    pendiente: { key: "pendiente", label: "Pendiente", short: "Pend.", icon: "⏳", color: "#64748b", bg: "#f1f5f9" },
    en_progreso: { key: "en_progreso", label: "En progreso", short: "Progreso", icon: "🔨", color: "#2563eb", bg: "#dbeafe" },
    revision: { key: "revision", label: "En revisión", short: "Revisión", icon: "👀", color: "#d97706", bg: "#fef3c7" },
    listo: { key: "listo", label: "Listo", short: "✓", icon: "✅", color: "#059669", bg: "#d1fae5" },
  };
  const STATUS_ORDER = ["pendiente", "en_progreso", "revision", "listo"];

  const CARD_PALETTE = [
    { key: "#10b981", name: "Esmeralda", hex: "#10b981" },
    { key: "#4f46e5", name: "Índigo", hex: "#4f46e5" },
    { key: "#e11d48", name: "Rubí", hex: "#e11d48" },
    { key: "#f59e0b", name: "Ámbar", hex: "#f59e0b" },
    { key: "#8b5cf6", name: "Violeta", hex: "#8b5cf6" },
    { key: "#0284c7", name: "Cielo", hex: "#0284c7" },
    { key: "#14b8a6", name: "Turquesa", hex: "#14b8a6" },
    { key: "#ea580c", name: "Naranja", hex: "#ea580c" },
  ];

  const DEFAULT_BRANDS = [
    { id: "AG LAB", name: "AG LAB", color: "#4f46e5", sort_order: 10, is_shared: false, active: true },
    { id: "NATIVA", name: "NATIVA", color: "#059669", sort_order: 20, is_shared: false, active: true },
    { id: "AZZORTI", name: "AZZORTI", color: "#e11d48", sort_order: 30, is_shared: false, active: true },
    { id: "LIVVA", name: "LIVVA", color: "#8b5cf6", sort_order: 40, is_shared: false, active: true },
    { id: "Azz Livv", name: "Azz Livv", color: "#0284c7", sort_order: 50, is_shared: true, active: true },
  ];

  const HARMONIC_COLORS = [
    "#0ea5e9", "#d97706", "#db2777", "#14b8a6", "#6366f1",
    "#ea580c", "#65a30d", "#0891b2", "#9333ea", "#dc2626",
  ];

  /* ==========================================================================
     2. INTERNAL MODULE STATE
     ========================================================================== */
  let initialized = false;
  let hasSyncedCloud = false;
  let lastBrandSig = "";
  let swRegistration = null;
  let realtimeChannel = null;
  let realtimeUserId = null;

  const brandsMap = new Map();
  const cardsMap = new Map();
  const notesMap = new Map();
  let notifsList = [];
  let dismissedAlerts = new Set();
  const missingTables = new Set();

  let viewPrefs = {
    subview: "month",
    onlyMine: false,
    statusFilter: "",
    weekStartDate: "",
  };

  let activeDrawerCardKey = null;
  let lastCalendarArgs = null;
  let pendingCardKeyFromUrl = null;
  let draggedCardKey = null;
  let activeDropCell = null;
  let activeHoverCard = null;
  let activeHoveredEvId = null;
  let mobileSelectedDateStr = "";

  /* ==========================================================================
     3. BRIDGE TO window.CronogramaApp & FALLBACK HELPERS
     ========================================================================== */
  function app() {
    return window.CronogramaApp || {};
  }

  function getSb() {
    return typeof app().getSbClient === "function" ? app().getSbClient() : null;
  }

  function getRaw() {
    return typeof app().getRawData === "function" ? app().getRawData() : (window.CRONOGRAMA_INITIAL_DATA || null);
  }

  function getUsersMapSafe() {
    return typeof app().getUsersMap === "function" ? app().getUsersMap() : new Map();
  }

  function getAllProfilesSafe() {
    return typeof app().getAllKnownProfiles === "function" ? app().getAllKnownProfiles() : [];
  }

  function getProfileMetaSafe(id) {
    if (typeof app().getProfileMeta === "function") return app().getProfileMeta(id);
    return { id, name: id, role: "designer", color: "#6366f1" };
  }

  function getStateSafe() {
    return typeof app().getState === "function" ? app().getState() : {};
  }

  function getCustomEventsSafe() {
    return typeof app().getCustomEvents === "function" ? app().getCustomEvents() : [];
  }

  function getTodayStrSafe() {
    return typeof app().getTodayStr === "function" ? app().getTodayStr() : new Date().toISOString().slice(0, 10);
  }

  function isAdminSafe() {
    if (typeof app().isAdmin === "function") return Boolean(app().isAdmin());
    const st = getStateSafe();
    const uid = st.loggedInUserId;
    if (!uid) return false;
    const meta = getProfileMetaSafe(uid);
    const role = String(meta?.role || "").toLowerCase().trim();
    return role === "admin" || role === "administrador";
  }

  function esc(str) {
    if (typeof app().escapeHtml === "function") return app().escapeHtml(str);
    if (!str && str !== 0) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function parseYMD(str) {
    if (typeof app().parseYMD === "function") return app().parseYMD(str);
    if (!str || typeof str !== "string") return null;
    const m = str.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatYMD(dt) {
    if (typeof app().formatYMD === "function") return app().formatYMD(dt);
    if (!dt) return "";
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  function formatShortDayMonth(str) {
    if (typeof app().formatShortDayMonth === "function") return app().formatShortDayMonth(str);
    const d = parseYMD(str);
    if (!d) return "—";
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]}`;
  }

  function formatHumanDate(str) {
    const d = parseYMD(str);
    if (!d) return "—";
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function addDays(d, n) {
    if (typeof app().addDays === "function") return app().addDays(d, n);
    const copy = new Date(d.getTime());
    copy.setDate(copy.getDate() + n);
    return copy;
  }

  function subtractBusinessDays(endDateStr, dh) {
    if (typeof app().subtractBusinessDays === "function") return app().subtractBusinessDays(endDateStr, dh);
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

  function getMondayOfWeek(dateOrStr) {
    const dt = typeof dateOrStr === "string" ? parseYMD(dateOrStr) : dateOrStr;
    const base = dt || new Date();
    const copy = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
    const dow = copy.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    copy.setDate(copy.getDate() + diff);
    return copy;
  }

  function getCustomEventRangeSafe(cev) {
    if (typeof app().getCustomEventRange === "function") return app().getCustomEventRange(cev);
    const s = String(cev?.event_date || "").slice(0, 10);
    const dt = parseYMD(s);
    return { startStr: s, endStr: s, startDt: dt, endDt: dt, isMultiDay: false, calDays: 1, bizDays: 1 };
  }

  function getCustomEventOwnersSafe(cev) {
    if (typeof app().getCustomEventOwners === "function") return app().getCustomEventOwners(cev);
    if (!cev || !cev.owner_user) return ["DANI"];
    return String(cev.owner_user).split(",").map((s) => s.trim()).filter(Boolean);
  }

  function parseCustomEventMetaSafe(cev) {
    if (typeof app().parseCustomEventMeta === "function") return app().parseCustomEventMeta(cev);
    return { tag: "#General", importance: "medium", cleanNotes: cev?.notes || "" };
  }

  function getEl(id, appElKey) {
    const els = typeof app().getElements === "function" ? (app().getElements() || {}) : {};
    return (appElKey && els[appElKey]) || document.getElementById(id);
  }

  function setCloudStatusSafe(msg, isErr) {
    if (typeof app().setCloudStatus === "function") {
      app().setCloudStatus(msg, isErr);
    }
  }

  function isMissingTableError(err) {
    if (!err) return false;
    const code = String(err.code || "");
    const msg = String(err.message || err.details || "").toLowerCase();
    return (
      code === "42P01" ||
      code === "PGRST205" ||
      code === "PGRST204" ||
      msg.includes("does not exist") ||
      msg.includes("could not find the table") ||
      msg.includes("not found")
    );
  }

  function handleSupabaseError(tableName, err) {
    if (!err) return;
    if (isMissingTableError(err)) {
      missingTables.add(tableName);
      return;
    }
    console.warn(`[CalendarV2] Supabase (${tableName}):`, err.message || err);
  }

  /* ==========================================================================
     4. TOAST FEEDBACK UI (NON-BLOCKING)
     ========================================================================== */
  function showToast(message, type) {
    if (!message) return;
    let container = document.getElementById("calV2ToastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "calV2ToastContainer";
      container.style.cssText = [
        "position:fixed",
        "bottom:20px",
        "right:20px",
        "z-index:99999",
        "display:flex",
        "flex-direction:column",
        "gap:8px",
        "max-width:360px",
        "pointer-events:none",
      ].join(";");
      document.body.appendChild(container);
    }

    const bg = type === "error" ? "#991b1b" : type === "warn" ? "#92400e" : "#0f172a";
    const border = type === "error" ? "#f87171" : type === "warn" ? "#fbbf24" : "#4f46e5";

    const toast = document.createElement("div");
    toast.className = `cal-v2-toast cal-v2-toast-${type || "info"}`;
    toast.style.cssText = [
      `background:${bg}`,
      "color:#ffffff",
      "padding:10px 14px",
      "border-radius:10px",
      `border-left:4px solid ${border}`,
      "box-shadow:0 10px 25px rgba(15,23,42,0.28)",
      "font-size:12px",
      "font-weight:600",
      "line-height:1.4",
      "pointer-events:auto",
      "opacity:0",
      "transform:translateY(8px)",
      "transition:opacity 0.18s ease, transform 0.18s ease",
    ].join(";");
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      setTimeout(() => toast.remove(), 220);
    }, 3600);
  }

  /* ==========================================================================
     5. LOCALSTORAGE CACHE LOAD / SAVE
     ========================================================================== */
  function readJsonStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJsonStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // Ignore quota / private mode issues
    }
  }

  function saveCardsCache() {
    const obj = {};
    cardsMap.forEach((val, key) => {
      obj[key] = val;
    });
    writeJsonStorage(CACHE_CARDS_KEY, obj);
  }

  function saveNotesCache() {
    const obj = {};
    notesMap.forEach((arr, key) => {
      obj[key] = arr;
    });
    writeJsonStorage(CACHE_NOTES_KEY, obj);
  }

  function saveNotifsCache() {
    writeJsonStorage(CACHE_NOTIFS_KEY, notifsList.slice(0, 120));
  }

  function saveViewPrefsCache() {
    writeJsonStorage(CACHE_VIEW_PREFS_KEY, viewPrefs);
  }

  function saveBrandsCache() {
    writeJsonStorage(CACHE_BRANDS_KEY, Array.from(brandsMap.values()));
  }

  function saveDismissedAlertsCache() {
    writeJsonStorage(CACHE_DISMISSED_ALERTS_KEY, Array.from(dismissedAlerts));
  }

  function loadCaches() {
    // Brands (Seed first, then cached overrides)
    brandsMap.clear();
    for (const b of DEFAULT_BRANDS) {
      brandsMap.set(b.name, { ...b });
    }
    const cachedBrands = readJsonStorage(CACHE_BRANDS_KEY, null);
    if (Array.isArray(cachedBrands)) {
      for (const b of cachedBrands) {
        if (b && b.name) {
          const norm = normalizeBrandName(b.name);
          if (norm && norm !== "ALL") {
            brandsMap.set(norm, {
              id: norm,
              name: norm,
              color: b.color || pickHarmonicColor(norm),
              sort_order: Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 100,
              is_shared: Boolean(b.is_shared),
              active: b.active !== false,
            });
          }
        }
      }
    }

    // Cards
    cardsMap.clear();
    const cachedCards = readJsonStorage(CACHE_CARDS_KEY, {});
    if (cachedCards && typeof cachedCards === "object") {
      Object.keys(cachedCards).forEach((k) => {
        if (cachedCards[k]) cardsMap.set(k, cachedCards[k]);
      });
    }

    // Notes
    notesMap.clear();
    const cachedNotes = readJsonStorage(CACHE_NOTES_KEY, {});
    if (cachedNotes && typeof cachedNotes === "object") {
      Object.keys(cachedNotes).forEach((k) => {
        if (Array.isArray(cachedNotes[k])) notesMap.set(k, cachedNotes[k]);
      });
    }

    // Notifications
    const cachedNotifs = readJsonStorage(CACHE_NOTIFS_KEY, []);
    notifsList = Array.isArray(cachedNotifs) ? cachedNotifs : [];

    // Dismissed alerts
    const cachedDismissed = readJsonStorage(CACHE_DISMISSED_ALERTS_KEY, []);
    dismissedAlerts = new Set(Array.isArray(cachedDismissed) ? cachedDismissed : []);

    // View prefs
    const cachedPrefs = readJsonStorage(CACHE_VIEW_PREFS_KEY, {});
    if (cachedPrefs && typeof cachedPrefs === "object") {
      if (cachedPrefs.subview === "month" || cachedPrefs.subview === "week" || cachedPrefs.subview === "agenda") {
        viewPrefs.subview = cachedPrefs.subview;
      }
      viewPrefs.onlyMine = Boolean(cachedPrefs.onlyMine);
      viewPrefs.statusFilter = typeof cachedPrefs.statusFilter === "string" ? cachedPrefs.statusFilter : "";
      viewPrefs.weekStartDate = typeof cachedPrefs.weekStartDate === "string" ? cachedPrefs.weekStartDate : "";
    }
    if (!viewPrefs.weekStartDate) {
      viewPrefs.weekStartDate = formatYMD(getMondayOfWeek(getTodayStrSafe()));
    }
  }

  /* ==========================================================================
     6. DYNAMIC MULTI-BRAND ENGINE (BrandsRegistry)
     ========================================================================== */
  function pickHarmonicColor(seedStr) {
    let hash = 0;
    const s = String(seedStr || "BRAND");
    for (let i = 0; i < s.length; i++) {
      hash = s.charCodeAt(i) + ((hash << 5) - hash);
    }
    return HARMONIC_COLORS[Math.abs(hash) % HARMONIC_COLORS.length];
  }

  function hexToRgb(hex) {
    const clean = String(hex || "#4f46e5").replace("#", "").trim();
    const full = clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean.padEnd(6, "0").slice(0, 6);
    const num = parseInt(full, 16);
    if (isNaN(num)) return { r: 79, g: 70, b: 229 };
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  function darkenHex(hex, factor) {
    const { r, g, b } = hexToRgb(hex);
    const f = Math.max(0, Math.min(1, 1 - (factor || 0.25)));
    const nr = Math.round(r * f);
    const ng = Math.round(g * f);
    const nb = Math.round(b * f);
    return `rgb(${nr}, ${ng}, ${nb})`;
  }

  function normalizeBrandName(raw) {
    if (raw === null || raw === undefined) return "Azz Livv";
    const s = String(raw).trim().replace(/\s+/g, " ");
    if (!s) return "Azz Livv";
    const low = s.toLowerCase();
    if (low === "all" || low === "todas") return "ALL";
    if (low === "aglab" || low === "ag lab" || low === "ag_lab" || low === "ag-lab") return "AG LAB";
    if (low === "nativa") return "NATIVA";
    if (low === "azzorti") return "AZZORTI";
    if (low === "livva") return "LIVVA";
    if (low === "azz livv" || low === "azzlivv" || low === "azz_livv" || low === "azz-livv") return "Azz Livv";

    for (const b of brandsMap.values()) {
      if (b.name.toLowerCase() === low || String(b.id).toLowerCase() === low) {
        return b.name;
      }
    }
    return s;
  }

  function getBrands(includeInactive) {
    const list = Array.from(brandsMap.values()).filter((b) => includeInactive || b.active !== false);
    return list.sort((a, b) => {
      const sDiff = (a.sort_order ?? 100) - (b.sort_order ?? 100);
      if (sDiff !== 0) return sDiff;
      return String(a.name).localeCompare(String(b.name), "es");
    });
  }

  function getBrandMeta(name) {
    const norm = normalizeBrandName(name);
    if (norm === "ALL") {
      return { id: "ALL", name: "Todas", color: "#4f46e5", sort_order: 0, is_shared: false, active: true };
    }
    if (brandsMap.has(norm)) return brandsMap.get(norm);
    return {
      id: norm,
      name: norm,
      color: pickHarmonicColor(norm),
      sort_order: 100,
      is_shared: false,
      active: true,
    };
  }

  function getColombianHolidaySafe(dateStr) {
    if (typeof app().getColombianHoliday === "function") return app().getColombianHoliday(dateStr);
    return null;
  }

  function getShortBrandCode(brandName) {
    const n = String(brandName || "").trim().toLowerCase();
    if (n === "azzorti") return "AZZ";
    if (n === "livva") return "LIV";
    if (n === "nativa") return "NAT";
    if (n === "ag lab" || n === "aglab") return "AGL";
    if (n === "azz livv" || n === "azzlivv") return "A/L";
    return String(brandName || "AGL").replace(/\s+/g, "").slice(0, 3).toUpperCase();
  }

  function getBrandStyleVars(name) {
    const meta = getBrandMeta(name);
    const norm = String(meta.name || name || "").trim().toLowerCase();
    let color = meta.color || "#4f46e5";
    let bg = "";
    let border = "";
    let text = "";

    // Contenedores suaves estilo Stitch manteniendo colores históricos de marca
    if (norm === "azzorti" && color.toLowerCase() === "#e11d48") {
      bg = "#fce8ef";
      border = "#f9a8c9";
      text = "#7a0e35";
    } else if (norm === "livva" && color.toLowerCase() === "#8b5cf6") {
      bg = "#f3e8ff";
      border = "#d8b4fe";
      text = "#4c1d95";
    } else if (norm === "nativa" && color.toLowerCase() === "#059669") {
      bg = "#e2f8ef";
      border = "#6ee7b7";
      text = "#064e3b";
    } else if ((norm === "ag lab" || norm === "aglab") && color.toLowerCase() === "#4f46e5") {
      bg = "#ebf1ff";
      border = "#c7d2fe";
      text = "#1e1b4b";
    } else if ((norm === "azz livv" || norm === "azzlivv") && color.toLowerCase() === "#0284c7") {
      bg = "#e0f2fe";
      border = "#7dd3fc";
      text = "#0c4a6e";
    } else {
      const { r, g, b } = hexToRgb(color);
      bg = `rgba(${r}, ${g}, ${b}, 0.12)`;
      border = `rgba(${r}, ${g}, ${b}, 0.36)`;
      text = darkenHex(color, 0.28);
    }

    const cssText = `--brand-color:${color};--brand-bg:${bg};--brand-border:${border};--brand-text:${text};`;

    const vars = {
      "--brand-color": color,
      "--brand-bg": bg,
      "--brand-border": border,
      "--brand-text": text,
      color,
      bg,
      border,
      text,
      cssText,
    };
    Object.defineProperty(vars, "toString", {
      enumerable: false,
      value() {
        return this.cssText;
      },
    });
    return vars;
  }

  function getSelectedBrandsSetFromArg(filterBrandOrSet, st) {
    if (filterBrandOrSet instanceof Set) {
      const s = new Set();
      filterBrandOrSet.forEach((b) => {
        const n = normalizeBrandName(b);
        if (n && n !== "ALL") s.add(n);
      });
      return s;
    }
    if (Array.isArray(filterBrandOrSet)) {
      const s = new Set();
      filterBrandOrSet.forEach((b) => {
        const n = normalizeBrandName(b);
        if (n && n !== "ALL") s.add(n);
      });
      return s;
    }
    if (typeof filterBrandOrSet === "string") {
      const n = normalizeBrandName(filterBrandOrSet);
      return n && n !== "ALL" ? new Set([n]) : new Set();
    }
    if (st && st.selectedBrands instanceof Set && st.selectedBrands.size > 0) {
      const s = new Set();
      st.selectedBrands.forEach((b) => {
        const n = normalizeBrandName(b);
        if (n && n !== "ALL") s.add(n);
      });
      return s;
    }
    const fallback = normalizeBrandName(st?.brand || "ALL");
    return fallback && fallback !== "ALL" ? new Set([fallback]) : new Set();
  }

  function matchesBrandFilter(cardBrand, filterBrand, includeShared) {
    const st = getStateSafe();
    const selSet = getSelectedBrandsSetFromArg(filterBrand, st);
    if (selSet.size === 0) return true; // Multi-marca (Todas)

    const cNorm = normalizeBrandName(cardBrand || "Azz Livv");
    if (selSet.has(cNorm)) return true;

    const incShared = includeShared !== undefined ? Boolean(includeShared) : (st.includeSharedBrand !== false);
    if (incShared) {
      const cMeta = getBrandMeta(cNorm);
      // Incluir marca compartida ("Azz Livv") solo cuando AZZORTI o LIVVA están dentro de la selección
      if (cMeta && cMeta.is_shared && (selSet.has("AZZORTI") || selSet.has("LIVVA"))) {
        return true;
      }
    }
    return false;
  }

  function registerAutoBrand(rawBrandName, toUpsert) {
    const norm = normalizeBrandName(rawBrandName);
    if (!norm || norm === "ALL" || brandsMap.has(norm)) return false;
    const entry = {
      id: norm,
      name: norm,
      color: HARMONIC_COLORS[brandsMap.size % HARMONIC_COLORS.length] || pickHarmonicColor(norm),
      sort_order: 100 + brandsMap.size * 5,
      is_shared: false,
      active: true,
    };
    brandsMap.set(norm, entry);
    toUpsert.push(entry);
    return true;
  }

  function syncBrandsFromData(rawDataArg, customEventsArg) {
    const data = rawDataArg || getRaw();
    const customs = customEventsArg || getCustomEventsSafe();
    const toUpsert = [];
    let changed = false;

    if (data && Array.isArray(data.activities)) {
      for (const act of data.activities) {
        if (act && act.marca && registerAutoBrand(act.marca, toUpsert)) changed = true;
      }
    }
    if (Array.isArray(customs)) {
      for (const cev of customs) {
        if (cev && cev.marca && registerAutoBrand(cev.marca, toUpsert)) changed = true;
      }
    }
    cardsMap.forEach((c) => {
      if (c && c.brand_override && registerAutoBrand(c.brand_override, toUpsert)) changed = true;
    });

    if (changed) {
      saveBrandsCache();
      renderBrandControls();
      const sb = getSb();
      if (sb && toUpsert.length > 0 && !missingTables.has("app_brands")) {
        sb.from("app_brands")
          .upsert(
            toUpsert.map((b) => ({
              id: b.id,
              name: b.name,
              color: b.color,
              sort_order: b.sort_order,
              is_shared: b.is_shared,
              active: b.active,
            })),
            { onConflict: "id" }
          )
          .then(({ error }) => {
            if (error) handleSupabaseError("app_brands", error);
          })
          .catch((e) => handleSupabaseError("app_brands", e));
      }
    }
    return getBrands();
  }

  function renderBrandControls(force) {
    const st = getStateSafe();
    const activeBrands = getBrands(false);
    const selSet = getSelectedBrandsSetFromArg(undefined, st);
    const isAllActive = selSet.size === 0;
    const adminFlag = isAdminSafe();
    const pillsWrap = getEl("brandPillsContainer");
    const sig = `${Array.from(selSet).sort().join("+") || "ALL"}|${adminFlag}|${activeBrands.map((b) => `${b.name}:${b.color}:${b.is_shared}`).join(",")}`;
    const showSharedToggle = !selSet.has("Azz Livv") && (selSet.has("AZZORTI") || selSet.has("LIVVA"));

    if (!force && pillsWrap && sig === lastBrandSig) {
      const sharedWrapCheck = getEl("sharedBrandWrap", "sharedBrandWrap");
      if (sharedWrapCheck) {
        sharedWrapCheck.style.display = showSharedToggle ? "inline-flex" : "none";
      }
      return;
    }
    if (pillsWrap) lastBrandSig = sig;

    // 1. #brandPillsContainer (Soporta selección múltiple de marcas)
    if (pillsWrap) {
      const pillsHtml = [
        `<button type="button" class="brand-pill ${isAllActive ? "active" : ""}" data-brand="ALL" title="Mostrar todas las marcas"><span>Multi-marca (Todas)</span>${isAllActive ? `<span class="brand-pill-check">✓</span>` : ""}</button>`,
      ];
      for (const b of activeBrands) {
        const isActive = selSet.has(b.name);
        const styleVars = getBrandStyleVars(b.name);
        pillsHtml.push(
          `<button type="button" class="brand-pill ${isActive ? "active" : ""}" data-brand="${esc(b.name)}" style="${styleVars.cssText}" title="Clic para sumar o quitar ${esc(b.name)} del filtro"><span class="brand-pill-dot" style="background:${esc(b.color)}"></span><span>${esc(b.name)}</span>${isActive ? `<span class="brand-pill-check">✓</span>` : ""}</button>`
        );
      }
      if (isAdminSafe() && !document.getElementById("btnOpenBrandsManager")) {
        pillsHtml.push(
          `<button type="button" class="brand-pill brand-pill-manage" data-action="open-brands-manager" title="Administrar marcas y colores (Admin)">⚙️ Marcas</button>`
        );
      }
      pillsWrap.innerHTML = pillsHtml.join("");
    }

    // Update #sharedBrandWrap visibility
    const sharedWrap = getEl("sharedBrandWrap", "sharedBrandWrap");
    if (sharedWrap) {
      sharedWrap.style.display = showSharedToggle ? "inline-flex" : "none";
    }

    // 2. #evMarcaInput (select inside Custom Event Modal)
    const evMarcaSelect = getEl("evMarcaInput", "evMarcaInput");
    if (evMarcaSelect) {
      const prevVal = evMarcaSelect.value;
      const opts = [];
      const sortedForModal = [...activeBrands].sort((a, b) => {
        if (a.is_shared !== b.is_shared) return a.is_shared ? -1 : 1;
        return (a.sort_order ?? 100) - (b.sort_order ?? 100);
      });
      for (const b of sortedForModal) {
        const label = b.is_shared ? `${b.name} (Compartida / Ambas)` : b.name;
        opts.push(`<option value="${esc(b.name)}">${esc(label)}</option>`);
      }
      evMarcaSelect.innerHTML = opts.join("");
      const normPrev = prevVal ? normalizeBrandName(prevVal) : "Azz Livv";
      if (Array.from(evMarcaSelect.options).some((o) => o.value === normPrev)) {
        evMarcaSelect.value = normPrev;
      }
    }

    // 3. #kpiBrandsLegend
    const legendEl = getEl("kpiBrandsLegend");
    if (legendEl) {
      legendEl.innerHTML = activeBrands
        .map(
          (b) =>
            `<span class="kpi-chip"><span class="legend-dot" style="background:${esc(b.color)}"></span>${esc(b.name)}</span>`
        )
        .join("");
    }
  }

  /* ==========================================================================
     7. BRANDS MANAGER MODAL (ADMIN LIVE EDIT / CREATE)
     ========================================================================== */
  function openBrandsManagerModal() {
    if (!isAdminSafe()) {
      showToast("🔒 Solo el Administrador puede crear o editar marcas.", "warn");
      return;
    }
    const modal = getEl("brandsManagerModal");
    if (!modal) return;
    renderBrandsManagerContent(modal);
    modal.style.display = "flex";
  }

  function closeBrandsManagerModal() {
    const modal = getEl("brandsManagerModal");
    if (modal) modal.style.display = "none";
  }

  function renderBrandsManagerContent(modal) {
    const allBrands = getBrands(true);
    const listHtml = allBrands
      .map((b) => {
        const safeId = esc(b.id);
        return `
          <div class="brand-mgr-row" data-brand-id="${safeId}" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;margin-bottom:8px;flex-wrap:wrap">
            <input type="color" class="brand-mgr-color" value="${esc(b.color)}" title="Color de marca" style="width:34px;height:32px;border:none;background:transparent;cursor:pointer;padding:0" />
            <input type="text" class="filter-input brand-mgr-name" value="${esc(b.name)}" style="flex:1;min-width:120px" />
            <input type="number" class="filter-input brand-mgr-order" value="${Number(b.sort_order ?? 100)}" title="Orden" style="width:68px" />
            <label class="inline-check" style="font-size:11px;white-space:nowrap">
              <input type="checkbox" class="brand-mgr-shared" ${b.is_shared ? "checked" : ""} /> Compartida
            </label>
            <label class="inline-check" style="font-size:11px;white-space:nowrap">
              <input type="checkbox" class="brand-mgr-active" ${b.active !== false ? "checked" : ""} /> Activa
            </label>
            <button type="button" class="btn btn-sm btn-primary brand-mgr-save-btn">Guardar</button>
          </div>
        `;
      })
      .join("");

    const innerHtml = `
      <div class="modal-card" style="max-width:640px;width:95%">
        <div class="modal-header">
          <h3>🏷️ Gestión Dinámica de Marcas y Colores</h3>
          <button type="button" class="modal-close-btn" data-action="close-brands-modal">✕</button>
        </div>
        <div class="modal-body" style="max-height:74vh;overflow-y:auto">
          <p style="font-size:12px;color:#64748b;margin-bottom:12px">
            Crea o personaliza marcas en vivo. Los cambios se reflejan al instante en filtros, tarjetas, leyenda y base de datos.
          </p>
          <form id="brandCreateForm" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px;border-radius:10px;background:#f8fafc;border:1px dashed #cbd5e1;margin-bottom:14px">
            <input type="color" id="newBrandColorInput" value="#0ea5e9" style="width:36px;height:34px;border:none;background:transparent;cursor:pointer" />
            <input type="text" id="newBrandNameInput" class="filter-input" placeholder="Nueva marca (ej. STUDIO, KIDS...)" required style="flex:1;min-width:160px" />
            <label class="inline-check" style="font-size:11px">
              <input type="checkbox" id="newBrandSharedInput" /> Compartida
            </label>
            <button type="submit" class="btn btn-primary">+ Crear marca</button>
          </form>
          <div id="brandsManagerList">${listHtml}</div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" data-action="close-brands-modal">Cerrar</button>
        </div>
      </div>
    `;

    const prebuiltBody = modal.querySelector("#brandsManagerBody");
    if (prebuiltBody) {
      prebuiltBody.innerHTML = `
        <form id="brandCreateForm" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px;border-radius:10px;background:#f8fafc;border:1px dashed #cbd5e1;margin-bottom:14px">
          <input type="color" id="newBrandColorInput" value="#0ea5e9" style="width:36px;height:34px;border:none;background:transparent;cursor:pointer" />
          <input type="text" id="newBrandNameInput" class="filter-input" placeholder="Nueva marca (ej. STUDIO, KIDS...)" required style="flex:1;min-width:160px" />
          <label class="inline-check" style="font-size:11px">
            <input type="checkbox" id="newBrandSharedInput" /> Compartida
          </label>
          <button type="submit" class="btn btn-primary">+ Crear marca</button>
        </form>
        <div id="brandsManagerList">${listHtml}</div>
      `;
    } else {
      modal.innerHTML = innerHtml;
    }
  }

  function upsertBrandOptimistic(brandPayload) {
    const cleanName = String(brandPayload.name || "").trim().replace(/\s+/g, " ");
    if (!cleanName) return;
    const id = brandPayload.id || cleanName;
    const existing = brandsMap.get(id);

    const record = {
      id,
      name: cleanName,
      color: brandPayload.color || existing?.color || pickHarmonicColor(cleanName),
      sort_order: Number.isFinite(Number(brandPayload.sort_order)) ? Number(brandPayload.sort_order) : (existing?.sort_order ?? 100),
      is_shared: Boolean(brandPayload.is_shared),
      active: brandPayload.active !== false,
    };

    if (existing && existing.name !== cleanName) {
      brandsMap.delete(existing.name);
    }
    brandsMap.set(record.name, record);
    saveBrandsCache();
    renderBrandControls();

    const modal = getEl("brandsManagerModal");
    if (modal && modal.style.display === "flex") {
      renderBrandsManagerContent(modal);
    }
    if (typeof app().renderAll === "function") app().renderAll();

    const sb = getSb();
    if (sb && !missingTables.has("app_brands")) {
      sb.from("app_brands")
        .upsert(record, { onConflict: "id" })
        .then(({ error }) => {
          if (error) handleSupabaseError("app_brands", error);
        })
        .catch((e) => handleSupabaseError("app_brands", e));
    }
    showToast(`🏷️ Marca "${record.name}" actualizada`, "info");
  }

  /* ==========================================================================
     8. UNIFIED CARD RESOLVER & OPTIMISTIC MUTATIONS (<16ms)
     ========================================================================== */
  function normalizeStatus(raw) {
    const s = String(raw || "").trim().toLowerCase();
    return STATUS_META[s] ? s : "pendiente";
  }

  function parseOfficialCardKey(cardKey) {
    const m = String(cardKey || "").match(/^ACT_(\d+)__(.+)$/);
    if (!m) return null;
    return { actNo: Number(m[1]), campaignId: m[2] };
  }

  function buildOfficialCardKey(actNo, campaignId) {
    return `ACT_${actNo}__${campaignId}`;
  }

  function buildCustomCardKey(evId) {
    return `CUST_${evId}`;
  }

  function findActivityByNo(actNo) {
    const data = getRaw();
    if (!data || !Array.isArray(data.activities)) return null;
    return data.activities.find((a) => Number(a.no) === Number(actNo)) || null;
  }

  function findCampaignById(campId) {
    const data = getRaw();
    if (!data || !Array.isArray(data.campaigns)) return null;
    return data.campaigns.find((c) => c.id === campId) || null;
  }

  function findCustomEventById(evId) {
    const list = getCustomEventsSafe();
    return list.find((x) => String(x.id) === String(evId)) || null;
  }

  function resolveCardDescriptor(cardKey) {
    const key = String(cardKey || "");
    const cardState = cardsMap.get(key) || null;
    const notes = notesMap.get(key) || [];

    if (key.startsWith("ACT_")) {
      const parsed = parseOfficialCardKey(key);
      const act = parsed ? findActivityByNo(parsed.actNo) : null;
      const camp = parsed ? findCampaignById(parsed.campaignId) : null;
      const baseDateStr = (act && camp && act.fechas && act.fechas[camp.id]) || "";
      const overrideDate = cardState?.override_date || "";
      const effectiveDateStr = overrideDate || baseDateStr;
      const dh = act && camp ? (act.dh?.[camp.id] ?? act.dias ?? 0) : (act?.dias ?? 0);
      const startDt = effectiveDateStr ? subtractBusinessDays(effectiveDateStr, dh) : null;
      const startDateStr = startDt ? formatYMD(startDt) : effectiveDateStr;

      const defaultBrand = normalizeBrandName(act?.marca || "Azz Livv");
      const effectiveBrand = normalizeBrandName(cardState?.brand_override || defaultBrand);
      const brandColor = getBrandMeta(effectiveBrand).color;
      const customColor = cardState?.custom_color || "";
      const effectiveColor = customColor || brandColor;

      return {
        cardKey: key,
        kind: "official",
        actNo: parsed?.actNo ?? null,
        campaignId: parsed?.campaignId ?? null,
        act,
        camp,
        title: act ? `#${act.no} — ${act.actividad}` : key,
        rawTitle: act?.actividad || key,
        area: act?.area || "",
        proceso: act?.proceso || "",
        dh,
        calDays: 1,
        baseDateStr,
        effectiveDateStr,
        startDateStr,
        endDateStr: effectiveDateStr,
        isOverriddenDate: Boolean(overrideDate && baseDateStr && overrideDate !== baseDateStr),
        defaultBrand,
        effectiveBrand,
        brandColor,
        customColor,
        effectiveColor,
        owners: Array.isArray(cardState?.owners) ? [...cardState.owners] : [],
        status: normalizeStatus(cardState?.status),
        summaryNote: cardState?.summary_note || "",
        notes,
        cardState,
      };
    }

    if (key.startsWith("CUST_")) {
      const evId = key.slice(5);
      const cev = findCustomEventById(evId);
      const rng = cev ? getCustomEventRangeSafe(cev) : { startStr: "", endStr: "", calDays: 1, bizDays: 1 };
      const meta = cev ? parseCustomEventMetaSafe(cev) : { tag: "#General", importance: "medium", cleanNotes: "" };

      const defaultBrand = normalizeBrandName(cev?.marca || "Azz Livv");
      const effectiveBrand = normalizeBrandName(cardState?.brand_override || defaultBrand);
      const brandColor = getBrandMeta(effectiveBrand).color;
      const customColor = cardState?.custom_color || "";
      const effectiveColor = customColor || brandColor;

      const cevOwners = cev ? getCustomEventOwnersSafe(cev) : [];
      const owners = (cardState && Array.isArray(cardState.owners) && cardState.owners.length > 0)
        ? [...cardState.owners]
        : cevOwners;

      const customCamp = meta.campaignId && meta.campaignId.startsWith("ADV_")
        ? findCampaignById(meta.campaignId)
        : null;

      return {
        cardKey: key,
        kind: "custom",
        evId,
        cev,
        camp: customCamp,
        campaignId: meta.campaignId || "",
        campaignLabel: meta.campaignLabel || "",
        title: cev ? cev.title : key,
        rawTitle: cev ? cev.title : key,
        area: cev?.area || "General / Equipo",
        proceso: meta.tag || "#General",
        tag: meta.tag,
        importance: meta.importance,
        cleanNotes: meta.cleanNotes,
        dh: rng.bizDays,
        calDays: rng.calDays,
        baseDateStr: rng.startStr,
        effectiveDateStr: rng.startStr,
        startDateStr: rng.startStr,
        endDateStr: rng.endStr,
        range: rng,
        isOverriddenDate: false,
        defaultBrand,
        effectiveBrand,
        brandColor,
        customColor,
        effectiveColor,
        owners,
        status: normalizeStatus(cardState?.status),
        summaryNote: cardState?.summary_note || "",
        notes,
        cardState,
      };
    }

    return null;
  }

  function getCardState(cardKey) {
    return resolveCardDescriptor(cardKey);
  }

  function getEffectiveDate(act, camp) {
    if (!act || !camp) return "";
    const key = buildOfficialCardKey(act.no, camp.id);
    const cardState = cardsMap.get(key);
    return cardState?.override_date || (act.fechas && act.fechas[camp.id]) || "";
  }

  function upsertCardRecordOptimistic(cardKey, patch, options) {
    const desc = resolveCardDescriptor(cardKey);
    if (!desc) return null;

    const st = getStateSafe();
    const actor = st.loggedInUserId || st.targetUserId || "DANI";
    const existing = cardsMap.get(cardKey);

    const record = {
      card_key: cardKey,
      act_no: desc.kind === "official" ? desc.actNo : null,
      campaign_id: desc.kind === "official" ? desc.campaignId : null,
      owners: patch.owners !== undefined ? [...patch.owners] : (existing?.owners ? [...existing.owners] : [...desc.owners]),
      status: patch.status !== undefined ? normalizeStatus(patch.status) : (existing?.status || desc.status),
      custom_color: patch.custom_color !== undefined ? patch.custom_color : (existing?.custom_color ?? null),
      brand_override: patch.brand_override !== undefined ? patch.brand_override : (existing?.brand_override ?? null),
      override_date: patch.override_date !== undefined ? patch.override_date : (existing?.override_date ?? null),
      summary_note: patch.summary_note !== undefined ? patch.summary_note : (existing?.summary_note ?? ""),
      updated_by: actor,
      updated_at: new Date().toISOString(),
    };

    cardsMap.set(cardKey, record);
    saveCardsCache();

    // Sync custom_events fields when custom card is modified
    if (desc.kind === "custom" && desc.cev) {
      let customDirty = false;
      const cevUpdate = {};
      if (patch.owners !== undefined) {
        const joined = record.owners.join(", ");
        desc.cev.owner_user = joined;
        cevUpdate.owner_user = joined;
        customDirty = true;
      }
      if (patch.brand_override !== undefined) {
        const newMarca = record.brand_override || desc.defaultBrand;
        desc.cev.marca = newMarca;
        cevUpdate.marca = newMarca;
        customDirty = true;
      }
      if (customDirty) {
        writeJsonStorage("AZZORTI_CUSTOM_EVENTS_CACHE_V2", getCustomEventsSafe());
        const sb = getSb();
        if (sb && Object.keys(cevUpdate).length > 0) {
          sb.from("custom_events")
            .update(cevUpdate)
            .eq("id", desc.cev.id)
            .then(({ error }) => {
              if (error) console.warn("[CalendarV2] Sync custom_events:", error.message || error);
            })
            .catch(() => {});
        }
      }
    }

    // Immediate optimistic UI refresh (<16ms)
    if (!options?.skipRender) {
      if (activeDrawerCardKey === cardKey) {
        renderDrawerContent(cardKey);
      }
      refreshCalendarImmediate();
      renderNotificationCenter();
    }

    // Async Supabase persistence
    const sb = getSb();
    if (sb && !missingTables.has("schedule_cards")) {
      sb.from("schedule_cards")
        .upsert(record, { onConflict: "card_key" })
        .then(({ error }) => {
          if (error) handleSupabaseError("schedule_cards", error);
        })
        .catch((e) => handleSupabaseError("schedule_cards", e));
    }

    return record;
  }

  function updateCardOwners(cardKey, nextOwners) {
    const desc = resolveCardDescriptor(cardKey);
    if (!desc) return;
    const prevSet = new Set(desc.owners);
    const cleaned = Array.from(new Set(nextOwners.map((x) => String(x).trim()).filter(Boolean)));
    upsertCardRecordOptimistic(cardKey, { owners: cleaned });

    const st = getStateSafe();
    const actor = st.loggedInUserId || "Equipo";
    const newlyAdded = cleaned.filter((uid) => !prevSet.has(uid) && uid !== actor);
    if (newlyAdded.length > 0) {
      notifyUsers(newlyAdded, {
        type: "assignment",
        cardKey,
        title: `🙋 ${actor} te asignó una tarea`,
        body: `${desc.rawTitle} (${formatShortDayMonth(desc.effectiveDateStr)})`,
      });
    }
  }

  function toggleAssignMe(cardKey) {
    const st = getStateSafe();
    const me = st.loggedInUserId || st.targetUserId;
    if (!me) {
      showToast("Inicia sesión para asignarte tarjetas.", "warn");
      return;
    }
    const desc = resolveCardDescriptor(cardKey);
    if (!desc) return;

    const current = new Set(desc.owners);
    let added = false;
    if (current.has(me)) {
      current.delete(me);
    } else {
      current.add(me);
      added = true;
    }
    updateCardOwners(cardKey, Array.from(current));
    showToast(added ? `✅ Asignado a ${me}` : `Removido de ${me}`, "info");
  }

  function cycleCardStatus(cardKey) {
    const desc = resolveCardDescriptor(cardKey);
    if (!desc) return;
    const idx = STATUS_ORDER.indexOf(desc.status);
    const nextStatus = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    setCardStatus(cardKey, nextStatus);
  }

  function setCardStatus(cardKey, nextStatus) {
    const desc = resolveCardDescriptor(cardKey);
    if (!desc) return;
    const norm = normalizeStatus(nextStatus);
    if (desc.status === norm) return;
    upsertCardRecordOptimistic(cardKey, { status: norm });

    const st = getStateSafe();
    const actor = st.loggedInUserId || "Equipo";
    const stMeta = STATUS_META[norm];
    if (norm === "revision" || norm === "listo") {
      const recipients = desc.owners.filter((u) => u !== actor);
      if (recipients.length > 0) {
        notifyUsers(recipients, {
          type: "status_change",
          cardKey,
          title: `${stMeta.icon} Estado: ${stMeta.label} (${actor})`,
          body: desc.rawTitle,
        });
      }
    }
  }

  function moveCardToDate(cardKey, targetDateStr) {
    if (!parseYMD(targetDateStr)) return;
    const desc = resolveCardDescriptor(cardKey);
    if (!desc) return;

    if (desc.kind === "official") {
      const nextOverride = targetDateStr === desc.baseDateStr ? null : targetDateStr;
      upsertCardRecordOptimistic(cardKey, { override_date: nextOverride });
      showToast(
        nextOverride
          ? `Reprogramada al ${formatShortDayMonth(targetDateStr)}`
          : `Fecha restaurada al Excel (${formatShortDayMonth(desc.baseDateStr)})`,
        "info"
      );
    } else if (desc.kind === "custom" && desc.cev) {
      const calDays = Math.max(1, desc.calDays || 1);
      const startDt = parseYMD(targetDateStr);
      const endDt = calDays > 1 ? addDays(startDt, calDays - 1) : startDt;
      const newEndStr = formatYMD(endDt);
      const encoded = targetDateStr === newEndStr ? targetDateStr : `${targetDateStr}|${newEndStr}`;
      desc.cev.event_date = encoded;
      if ("end_date" in desc.cev) desc.cev.end_date = newEndStr;
      writeJsonStorage("AZZORTI_CUSTOM_EVENTS_CACHE_V2", getCustomEventsSafe());

      if (activeDrawerCardKey === cardKey) renderDrawerContent(cardKey);
      refreshCalendarImmediate();
      renderNotificationCenter();

      const sb = getSb();
      if (sb) {
        sb.from("custom_events")
          .update({ event_date: encoded })
          .eq("id", desc.cev.id)
          .then(({ error }) => {
            if (error) console.warn("[CalendarV2] Move custom_event:", error.message || error);
          })
          .catch(() => {});
      }
      showToast(`Evento movido al ${formatShortDayMonth(targetDateStr)}`, "info");
    }

    const st = getStateSafe();
    const actor = st.loggedInUserId || st.targetUserId || "Equipo";
    const recipients = desc.owners.filter((u) => u !== actor);
    if (recipients.length > 0) {
      notifyUsers(recipients, {
        type: "date_change",
        cardKey,
        title: `Fecha actualizada por ${actor}`,
        body: `${desc.rawTitle} → ${formatShortDayMonth(targetDateStr)}`,
      });
    }
  }

  function duplicateCard(cardKey) {
    const desc = resolveCardDescriptor(cardKey);
    if (!desc) return;
    closeCardDetail();

    if (typeof app().openDuplicateEventModal === "function") {
      if (desc.kind === "custom") {
        app().openDuplicateEventModal({
          title: desc.rawTitle,
          marca: desc.effectiveBrand,
          campaignId: desc.campaignId || "",
          startStr: desc.startDateStr,
          endStr: desc.endDateStr,
          owners: desc.owners,
          area: desc.area,
          tag: desc.tag || "#Entrega",
          category: desc.cev?.category || "emerald",
          importance: desc.importance || "medium",
          cleanNotes: desc.cleanNotes || "",
        });
      } else {
        app().openDuplicateEventModal({
          title: desc.rawTitle,
          marca: desc.effectiveBrand,
          campaignId: desc.campaignId || "",
          startStr: desc.effectiveDateStr,
          endStr: desc.effectiveDateStr,
          owners: desc.owners,
          area: desc.area || desc.proceso || "General",
          tag: "#Entrega",
          category: "indigo",
          importance: "medium",
          cleanNotes: `Duplicado de actividad oficial #${desc.actNo} (${desc.proceso || desc.area})`,
        });
      }
    }
  }

  function resetQuickViewFilters() {
    viewPrefs.onlyMine = false;
    viewPrefs.statusFilter = "";
    saveViewPrefsCache();
    const mineBtn = getEl("btnCalOnlyMine");
    if (mineBtn) mineBtn.classList.remove("active");
    const stSel = getEl("calStatusFilter");
    if (stSel) stSel.value = "";
  }

  function addNoteToCard(cardKey, rawContent) {
    const content = String(rawContent || "").trim();
    if (!content) return;
    const desc = resolveCardDescriptor(cardKey);
    if (!desc) return;

    const st = getStateSafe();
    const authorId = st.loggedInUserId || st.targetUserId || "DANI";
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const noteObj = {
      id: tempId,
      card_key: cardKey,
      author_id: authorId,
      content,
      created_at: new Date().toISOString(),
    };

    const list = notesMap.get(cardKey) ? [...notesMap.get(cardKey)] : [];
    list.push(noteObj);
    notesMap.set(cardKey, list);
    saveNotesCache();

    if (activeDrawerCardKey === cardKey) renderDrawerContent(cardKey);
    refreshCalendarImmediate();

    const sb = getSb();
    if (sb && !missingTables.has("card_notes")) {
      sb.from("card_notes")
        .insert({
          card_key: cardKey,
          author_id: authorId,
          content,
        })
        .select("*")
        .single()
        .then(({ data, error }) => {
          if (error) {
            handleSupabaseError("card_notes", error);
            return;
          }
          if (data) {
            const cur = notesMap.get(cardKey) || [];
            const idx = cur.findIndex((n) => n.id === tempId);
            if (idx !== -1) cur[idx] = data;
            else if (!cur.some((n) => n.id === data.id)) cur.push(data);
            notesMap.set(cardKey, cur);
            saveNotesCache();
          }
        })
        .catch((e) => handleSupabaseError("card_notes", e));
    }

    const recipients = desc.owners.filter((u) => u !== authorId);
    if (recipients.length > 0) {
      notifyUsers(recipients, {
        type: "note",
        cardKey,
        title: `💬 Nueva nota de ${authorId}`,
        body: `${desc.rawTitle}: "${content.slice(0, 80)}"`,
      });
    }
  }

  /* ==========================================================================
     9. MICROSOFT TEAMS DEEP LINKS & SINGLE-CARD .ICS EXPORT
     ========================================================================== */
  function collectOwnerEmails(owners) {
    const users = getUsersMapSafe();
    const emails = [];
    const missingNames = [];
    for (const uid of owners || []) {
      const u = users.get(uid);
      const meta = getProfileMetaSafe(uid);
      const email = String(u?.email || meta?.email || "").trim();
      if (email && email.includes("@")) {
        if (!emails.includes(email)) emails.push(email);
      } else {
        missingNames.push(meta?.name || uid);
      }
    }
    return { emails, missingNames };
  }

  function getCampDisplayForCard(camp, brandName) {
    if (!camp) return { short: "—", full: "—", valid: false };
    if (typeof app().getCampaignDisplayForBrand === "function") {
      return app().getCampaignDisplayForBrand(camp, brandName);
    }
    const low = String(brandName || "").trim().toLowerCase();
    if (low === "livva" && camp.nalLivva) {
      return {
        short: camp.livvaShortLabel || `Livva ${camp.nalLivva}`,
        full: camp.livvaFullLabel || `NAL Livva ${camp.nalLivva}`,
        valid: true,
      };
    }
    return { short: camp.shortLabel, full: camp.fullLabel, valid: true };
  }

  function buildCardPermalink(cardKey) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("card", cardKey);
      return url.toString();
    } catch (_) {
      return `./index.html?card=${encodeURIComponent(cardKey)}`;
    }
  }

  function openTeamsCitation(cardKey) {
    const desc = resolveCardDescriptor(cardKey);
    if (!desc) return;

    const st = getStateSafe();
    const targetOwners = desc.owners.length > 0
      ? desc.owners
      : (st.loggedInUserId ? [st.loggedInUserId] : []);
    const { emails, missingNames } = collectOwnerEmails(targetOwners);

    if (targetOwners.length === 0) {
      showToast("ℹ️ No hay responsables asignados aún; abriendo citación en Teams.", "info");
    } else if (missingNames.length > 0) {
      showToast(
        `ℹ️ Faltan correos en: ${missingNames.join(", ")}. Se abre Teams con los correos disponibles.`,
        "warn"
      );
    }

    const dateStr = desc.effectiveDateStr || getTodayStrSafe();
    const startTime = `${dateStr}T09:00:00-05:00`;
    const endTime = `${dateStr}T09:30:00-05:00`;
    const campDisp = desc.camp ? getCampDisplayForCard(desc.camp, desc.effectiveBrand) : null;
    const campTxt = campDisp ? ` (${campDisp.short})` : "";
    const subject = `[${desc.effectiveBrand}]${campTxt} ${desc.rawTitle}`;
    const cardUrl = buildCardPermalink(cardKey);
    const content = [
      `Revisión Cronograma AGLAB`,
      `Actividad: ${desc.title}`,
      `Marca: ${desc.effectiveBrand}`,
      desc.area ? `Área: ${desc.area}` : "",
      desc.proceso ? `Proceso: ${desc.proceso}` : "",
      `Fecha: ${formatHumanDate(dateStr)}`,
      `Estado actual: ${STATUS_META[desc.status]?.label || desc.status}`,
      `Abrir tarjeta: ${cardUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    const params = new URLSearchParams({
      subject,
      startTime,
      endTime,
      content,
    });
    if (emails.length > 0) {
      params.set("attendees", emails.join(","));
    }

    const teamsUrl = `https://teams.microsoft.com/l/meeting/new?${params.toString()}`;
    window.open(teamsUrl, "_blank", "noopener,noreferrer");
  }

  function openTeamsChat(cardKey) {
    const desc = resolveCardDescriptor(cardKey);
    if (!desc) return;

    const st = getStateSafe();
    const me = st.loggedInUserId;
    let chatTargets = desc.owners.filter((u) => u !== me);
    if (chatTargets.length === 0) chatTargets = desc.owners;
    const { emails, missingNames } = collectOwnerEmails(chatTargets);

    if (missingNames.length > 0) {
      showToast(
        `ℹ️ Sin correo configurado para: ${missingNames.join(", ")}. Abriendo chat en Teams...`,
        "warn"
      );
    }

    const cardUrl = buildCardPermalink(cardKey);
    const message = `Hola 👋 sobre "${desc.rawTitle}" (${desc.effectiveBrand} • ${formatShortDayMonth(desc.effectiveDateStr)}): ${cardUrl}`;
    const params = new URLSearchParams({ message });
    if (emails.length > 0) {
      params.set("users", emails.join(","));
    }
    const chatUrl = `https://teams.microsoft.com/l/chat/0/0?${params.toString()}`;
    window.open(chatUrl, "_blank", "noopener,noreferrer");
  }

  function downloadSingleCardIcs(cardKey) {
    const desc = resolveCardDescriptor(cardKey);
    if (!desc || !desc.effectiveDateStr) {
      showToast("Esta tarjeta no tiene fecha válida para exportar.", "warn");
      return;
    }
    const startDt = parseYMD(desc.startDateStr || desc.effectiveDateStr) || parseYMD(desc.effectiveDateStr);
    const endDt = parseYMD(desc.endDateStr || desc.effectiveDateStr) || startDt;
    if (!startDt || !endDt) return;

    const endExclusive = addDays(endDt, 1);
    const dtStartVal = formatYMD(startDt).replace(/-/g, "");
    const dtEndVal = formatYMD(endExclusive).replace(/-/g, "");
    const summary = `[${desc.effectiveBrand}] ${desc.title}`;
    const description = [
      `Marca: ${desc.effectiveBrand}`,
      desc.camp ? `Campaña: ${desc.camp.shortLabel}` : "",
      desc.area ? `Área: ${desc.area}` : "",
      desc.proceso ? `Proceso: ${desc.proceso}` : "",
      `Estado: ${STATUS_META[desc.status]?.label || desc.status}`,
      desc.owners.length > 0 ? `Responsables: ${desc.owners.join(", ")}` : "",
      `Enlace: ${buildCardPermalink(cardKey)}`,
    ]
      .filter(Boolean)
      .join("\\n");

    const icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//AG LAB//Cronograma V2//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-TIMEZONE:America/Bogota",
      "BEGIN:VEVENT",
      `UID:${cardKey}@aglab-cronograma.local`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${dtStartVal}`,
      `DTEND;VALUE=DATE:${dtEndVal}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    const blob = new Blob([icsLines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cardKey.replace(/[^a-zA-Z0-9_-]/g, "_")}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ==========================================================================
     10. NOTIFICATIONS, LOCAL DEADLINE ALERTS & PWA WEB PUSH
     ========================================================================== */
  function notifyUsers(recipientIds, payload) {
    const sb = getSb();
    const st = getStateSafe();
    const actorId = st.loggedInUserId || "Equipo";
    const list = Array.isArray(recipientIds) ? recipientIds : [recipientIds];

    for (const rid of list) {
      const recipientId = String(rid || "").trim();
      if (!recipientId) continue;

      const row = {
        recipient_id: recipientId,
        actor_id: actorId,
        card_key: payload.cardKey || null,
        type: payload.type || "update",
        title: payload.title || "Actualización en Cronograma",
        body: payload.body || "",
        read: false,
      };

      // If notifying current user locally, mirror immediately
      if (recipientId === st.loggedInUserId) {
        notifsList.unshift({ ...row, id: `local-${Date.now()}`, created_at: new Date().toISOString() });
        saveNotifsCache();
        renderNotificationCenter();
      }

      if (sb && !missingTables.has("app_notifications")) {
        sb.from("app_notifications")
          .insert(row)
          .then(({ error }) => {
            if (error) handleSupabaseError("app_notifications", error);
          })
          .catch((e) => handleSupabaseError("app_notifications", e));
      }

      // Trigger Edge Function send-push asynchronously
      if (sb && typeof sb.functions?.invoke === "function" && window.AGLAB_PUSH_ENABLED !== false) {
        sb.functions
          .invoke("send-push", {
            body: {
              recipient_id: recipientId,
              title: row.title,
              body: row.body,
              card_key: row.card_key || "",
            },
          })
          .catch(() => {
            // Silent fallback if Edge Function is not yet deployed
          });
      }
    }
  }

  function computeLocalDeadlineAlerts() {
    const st = getStateSafe();
    const uid = st.loggedInUserId || st.targetUserId;
    if (!uid) return [];

    const todayStr = getTodayStrSafe();
    const todayDt = parseYMD(todayStr);
    if (!todayDt) return [];

    const alerts = [];
    const seenKeys = new Set();
    const raw = getRaw();

    // 1. Official cards assigned to user (in selected or active campaigns)
    if (raw && Array.isArray(raw.activities) && Array.isArray(raw.campaigns)) {
      const actMap = new Map(raw.activities.map((a) => [Number(a.no), a]));
      const campMap = new Map(raw.campaigns.map((c) => [c.id, c]));

      cardsMap.forEach((cState, key) => {
        if (!key.startsWith("ACT_")) return;
        if (!Array.isArray(cState.owners) || !cState.owners.includes(uid)) return;
        if (normalizeStatus(cState.status) === "listo") return;

        const parsed = parseOfficialCardKey(key);
        if (!parsed) return;
        const act = actMap.get(parsed.actNo);
        const camp = campMap.get(parsed.campaignId);
        if (!act || !camp) return;

        const dueStr = cState.override_date || (act.fechas && act.fechas[camp.id]);
        const dueDt = parseYMD(dueStr);
        if (!dueDt) return;

        const diff = daysBetween(todayDt, dueDt);
        if (diff >= 0 && diff <= 3) {
          seenKeys.add(key);
          alerts.push(buildDeadlineAlertObject(key, `#${act.no} ${act.actividad}`, dueStr, diff, todayStr));
        }
      });
    }

    // 2. Custom events assigned to user
    const customs = getCustomEventsSafe();
    for (const cev of customs) {
      const key = buildCustomCardKey(cev.id);
      if (seenKeys.has(key)) continue;
      const desc = resolveCardDescriptor(key);
      if (!desc || !desc.owners.includes(uid)) continue;
      if (desc.status === "listo") continue;

      const dueDt = parseYMD(desc.endDateStr || desc.effectiveDateStr);
      if (!dueDt) continue;

      const diff = daysBetween(todayDt, dueDt);
      if (diff >= 0 && diff <= 3) {
        seenKeys.add(key);
        alerts.push(buildDeadlineAlertObject(key, desc.rawTitle, formatYMD(dueDt), diff, todayStr));
      }
    }

    return alerts.sort((a, b) => a.diffDays - b.diffDays);
  }

  function buildDeadlineAlertObject(cardKey, title, dueStr, diffDays, todayStr) {
    let urgencyLabel = `📅 Vence en ${diffDays} días`;
    if (diffDays === 0) urgencyLabel = "⏰ Vence HOY";
    else if (diffDays === 1) urgencyLabel = "⚡ Vence MAÑANA";

    const dismissId = `${cardKey}|${todayStr}`;
    return {
      id: `deadline-${cardKey}`,
      dismissId,
      isLocalAlert: true,
      card_key: cardKey,
      diffDays,
      title: urgencyLabel,
      body: `${title} (${formatShortDayMonth(dueStr)})`,
      read: dismissedAlerts.has(dismissId),
      created_at: `${todayStr}T08:00:00`,
    };
  }

  function formatNotifTime(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("es-CO", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderNotificationCenter() {
    const st = getStateSafe();
    const uid = st.loggedInUserId;
    const badgeEl = getEl("notifUnreadBadge");
    const bodyEl = getEl("notifListBody");

    const localAlerts = computeLocalDeadlineAlerts();
    const userCloudNotifs = uid
      ? notifsList.filter((n) => !n.recipient_id || n.recipient_id === uid)
      : [];

    const combined = [...localAlerts, ...userCloudNotifs];
    const unreadCount = combined.filter((n) => !n.read).length;

    if (badgeEl) {
      if (unreadCount > 0) {
        badgeEl.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
        badgeEl.style.display = "inline-flex";
      } else {
        badgeEl.style.display = "none";
      }
    }
    const mobBadge = document.getElementById("mobileNotifBadge");
    if (mobBadge) {
      if (unreadCount > 0) {
        mobBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
        mobBadge.style.display = "inline-flex";
      } else {
        mobBadge.style.display = "none";
      }
    }

    if (!bodyEl) return;

    if (combined.length === 0) {
      bodyEl.innerHTML = `
        <div style="padding:24px 14px;text-align:center;color:#64748b;font-size:12px">
          <div style="font-size:22px;margin-bottom:6px">🔔</div>
          Sin notificaciones pendientes por ahora.
        </div>
      `;
      return;
    }

    const headerBar = unreadCount > 0
      ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;border-bottom:1px solid #f1f5f9;background:#f8fafc">
           <span style="font-size:11px;font-weight:700;color:#475569">${unreadCount} sin leer</span>
           <button type="button" class="link-btn" data-action="mark-all-notifs-read" style="font-size:11px">✓ Marcar todas leídas</button>
         </div>`
      : "";

    const itemsHtml = combined
      .slice(0, 50)
      .map((n) => {
        const unreadCls = n.read ? "" : "is-unread";
        const kindCls = n.isLocalAlert ? "is-deadline-alert" : "";
        return `
          <div class="cal-notif-item ${unreadCls} ${kindCls}"
               data-notif-id="${esc(n.id)}"
               data-dismiss-id="${esc(n.dismissId || "")}"
               data-card-key="${esc(n.card_key || "")}"
               style="padding:10px 12px;border-bottom:1px solid #f1f5f9;cursor:pointer;display:flex;gap:8px;align-items:flex-start;background:${n.read ? "#ffffff" : "#eef2ff"}">
            <span style="width:8px;height:8px;border-radius:999px;margin-top:5px;flex-shrink:0;background:${n.read ? "transparent" : (n.isLocalAlert ? "#f59e0b" : "#4f46e5")}"></span>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:700;color:#0f172a">${esc(n.title)}</div>
              <div style="font-size:11px;color:#475569;margin-top:2px">${esc(n.body)}</div>
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">${n.isLocalAlert ? "Recordatorio automático" : formatNotifTime(n.created_at)}</div>
            </div>
          </div>
        `;
      })
      .join("");

    bodyEl.innerHTML = headerBar + itemsHtml;
  }

  function markNotificationRead(notifId, dismissId) {
    if (dismissId) {
      dismissedAlerts.add(dismissId);
      saveDismissedAlertsCache();
    } else if (notifId) {
      const target = notifsList.find((n) => String(n.id) === String(notifId));
      if (target && !target.read) {
        target.read = true;
        saveNotifsCache();
        const sb = getSb();
        if (sb && !String(notifId).startsWith("local-") && !missingTables.has("app_notifications")) {
          sb.from("app_notifications")
            .update({ read: true })
            .eq("id", notifId)
            .then(({ error }) => {
              if (error) handleSupabaseError("app_notifications", error);
            })
            .catch(() => {});
        }
      }
    }
    renderNotificationCenter();
  }

  function markAllNotificationsRead() {
    const st = getStateSafe();
    const uid = st.loggedInUserId;
    const localAlerts = computeLocalDeadlineAlerts();
    for (const al of localAlerts) {
      dismissedAlerts.add(al.dismissId);
    }
    saveDismissedAlertsCache();

    const unreadCloudIds = [];
    for (const n of notifsList) {
      if (!n.read && (!n.recipient_id || n.recipient_id === uid)) {
        n.read = true;
        if (n.id && !String(n.id).startsWith("local-")) unreadCloudIds.push(n.id);
      }
    }
    saveNotifsCache();
    renderNotificationCenter();

    const sb = getSb();
    if (sb && uid && unreadCloudIds.length > 0 && !missingTables.has("app_notifications")) {
      sb.from("app_notifications")
        .update({ read: true })
        .eq("recipient_id", uid)
        .eq("read", false)
        .then(({ error }) => {
          if (error) handleSupabaseError("app_notifications", error);
        })
        .catch(() => {});
    }
  }

  function sendSwLocalNotification(title, body, cardKey) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const payload = { type: "SHOW_LOCAL_NOTIFICATION", title, body, card_key: cardKey || "" };
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage(payload);
    } else if (swRegistration && swRegistration.active) {
      swRegistration.active.postMessage(payload);
    } else if (swRegistration && typeof swRegistration.showNotification === "function") {
      swRegistration.showNotification(title || "Cronograma AGLAB", {
        body: body || "",
        icon: "./ag-b.png",
        data: { card_key: cardKey || "" },
      });
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(window.location.protocol)) {
      updatePushUiStatus();
      return;
    }
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        swRegistration = reg;
        updatePushUiStatus();
      })
      .catch((err) => {
        console.warn("[CalendarV2] SW registration warning:", err);
        updatePushUiStatus();
      });

    navigator.serviceWorker.addEventListener("message", (event) => {
      const msg = event && event.data;
      if (msg && msg.type === "OPEN_CARD" && msg.card_key) {
        openCardFromExternalTrigger(msg.card_key);
      }
    });
  }

  function updatePushUiStatus() {
    const statusEl = getEl("notifPushStatus");
    const btnEl = getEl("btnEnablePush");
    if (!statusEl && !btnEl) return;

    const ua = navigator.userAgent || "";
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;

    if (isIos && !isStandalone) {
      if (statusEl) statusEl.textContent = "📱 iOS: usa Compartir → 'Añadir a inicio' para activar Push.";
      return;
    }

    if (!("Notification" in window)) {
      if (statusEl) statusEl.textContent = "Navegador sin soporte de notificaciones.";
      if (btnEl) btnEl.disabled = true;
      return;
    }

    if (Notification.permission === "granted") {
      const hasVapid = Boolean(window.AGLAB_VAPID_PUBLIC_KEY);
      if (statusEl) {
        statusEl.textContent = hasVapid
          ? "✅ Notificaciones Push activas en este dispositivo"
          : "✅ Alertas en tiempo real activas";
      }
      if (btnEl) btnEl.textContent = "🔔 Alertas activas";
    } else if (Notification.permission === "denied") {
      if (statusEl) statusEl.textContent = "⚠️ Permiso bloqueado en el navegador.";
      if (btnEl) btnEl.textContent = "🔕 Bloqueadas";
    } else {
      if (statusEl) statusEl.textContent = "Activa alertas en tu celular o PC.";
      if (btnEl) btnEl.textContent = "🔔 Activar notificaciones";
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const out = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      out[i] = rawData.charCodeAt(i);
    }
    return out;
  }

  function arrayBufferToBase64(buf) {
    if (!buf) return "";
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return window.btoa(bin);
  }

  function detectDeviceLabel() {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
    if (/Android/i.test(ua)) return "Android";
    if (/Mac/i.test(ua)) return "Mac";
    if (/Win/i.test(ua)) return "Windows";
    return "Web";
  }

  async function enablePushNotifications() {
    if (!("Notification" in window)) {
      showToast("Este navegador no soporta notificaciones nativas.", "warn");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      updatePushUiStatus();
      if (permission !== "granted") {
        showToast("Permiso de notificaciones no concedido.", "warn");
        return;
      }

      const vapidPublicKey = String(window.AGLAB_VAPID_PUBLIC_KEY || "").trim();
      const st = getStateSafe();
      const uid = st.loggedInUserId || st.targetUserId;

      if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
        const reg = swRegistration || await navigator.serviceWorker.ready;
        swRegistration = reg;

        if (vapidPublicKey && "PushManager" in window && reg.pushManager) {
          let sub = await reg.pushManager.getSubscription();
          if (!sub) {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            });
          }

          const json = typeof sub.toJSON === "function" ? sub.toJSON() : {};
          const p256dh = json.keys?.p256dh || arrayBufferToBase64(sub.getKey?.("p256dh"));
          const auth = json.keys?.auth || arrayBufferToBase64(sub.getKey?.("auth"));
          const sb = getSb();

          if (sb && uid && sub.endpoint && p256dh && auth && !missingTables.has("push_subscriptions")) {
            const { error } = await sb.from("push_subscriptions").upsert(
              {
                user_id: uid,
                endpoint: sub.endpoint,
                p256dh,
                auth,
                device_label: detectDeviceLabel(),
              },
              { onConflict: "endpoint" }
            );
            if (error) handleSupabaseError("push_subscriptions", error);
          }
          showToast("✅ Web Push activado en este dispositivo.", "info");
        } else {
          sendSwLocalNotification(
            "🔔 Cronograma AGLAB",
            "Notificaciones en tiempo real activadas en este dispositivo.",
            ""
          );
          showToast("✅ Alertas en tiempo real activadas.", "info");
        }
      } else {
        new Notification("🔔 Cronograma AGLAB", {
          body: "Notificaciones activadas en este navegador.",
          icon: "./ag-b.png",
        });
        showToast("✅ Notificaciones del navegador activadas.", "info");
      }
      updatePushUiStatus();
    } catch (err) {
      console.warn("[CalendarV2] Error activando Push:", err);
      showToast("No se pudo suscribir a Web Push en este navegador.", "warn");
    }
  }

  /* ==========================================================================
     11. SUPABASE CLOUD SYNC & REALTIME SUBSCRIPTION
     ========================================================================== */
  async function syncFromSupabase() {
    const sb = getSb();
    if (!sb) return;

    try {
      // 1. Brands
      if (!missingTables.has("app_brands")) {
        const { data: brandsData, error: brandsErr } = await sb
          .from("app_brands")
          .select("*")
          .order("sort_order", { ascending: true });
        if (brandsErr) {
          handleSupabaseError("app_brands", brandsErr);
        } else if (Array.isArray(brandsData) && brandsData.length > 0) {
          for (const b of brandsData) {
            if (!b || !b.name) continue;
            const norm = normalizeBrandName(b.name);
            brandsMap.set(norm, {
              id: b.id || norm,
              name: norm,
              color: b.color || pickHarmonicColor(norm),
              sort_order: b.sort_order ?? 100,
              is_shared: Boolean(b.is_shared),
              active: b.active !== false,
            });
          }
          saveBrandsCache();
          renderBrandControls();
        }
      }

      // 2. Schedule cards
      if (!missingTables.has("schedule_cards")) {
        const { data: cardsData, error: cardsErr } = await sb
          .from("schedule_cards")
          .select("*");
        if (cardsErr) {
          handleSupabaseError("schedule_cards", cardsErr);
        } else if (Array.isArray(cardsData)) {
          cardsMap.clear();
          for (const row of cardsData) {
            if (row && row.card_key) cardsMap.set(row.card_key, row);
          }
          saveCardsCache();
        }
      }

      // 3. Card notes
      if (!missingTables.has("card_notes")) {
        const { data: notesData, error: notesErr } = await sb
          .from("card_notes")
          .select("*")
          .order("created_at", { ascending: true });
        if (notesErr) {
          handleSupabaseError("card_notes", notesErr);
        } else if (Array.isArray(notesData)) {
          const pendingLocalNotes = new Map();
          notesMap.forEach((arr, key) => {
            const locals = arr.filter((n) => String(n.id).startsWith("local-"));
            if (locals.length > 0) pendingLocalNotes.set(key, locals);
          });
          notesMap.clear();
          for (const n of notesData) {
            if (!n || !n.card_key) continue;
            if (!notesMap.has(n.card_key)) notesMap.set(n.card_key, []);
            notesMap.get(n.card_key).push(n);
          }
          pendingLocalNotes.forEach((locals, key) => {
            const arr = notesMap.get(key) || [];
            for (const loc of locals) {
              if (!arr.some((n) => n.author_id === loc.author_id && n.content === loc.content)) {
                arr.push(loc);
              }
            }
            notesMap.set(key, arr);
          });
          saveNotesCache();
        }
      }

      // 4. App notifications for logged-in user
      const uid = getStateSafe().loggedInUserId;
      if (uid && !missingTables.has("app_notifications")) {
        const { data: notifsData, error: notifsErr } = await sb
          .from("app_notifications")
          .select("*")
          .eq("recipient_id", uid)
          .order("created_at", { ascending: false })
          .limit(80);
        if (notifsErr) {
          handleSupabaseError("app_notifications", notifsErr);
        } else if (Array.isArray(notifsData)) {
          notifsList = notifsData;
          saveNotifsCache();
        }
      }

      syncBrandsFromData(getRaw(), getCustomEventsSafe());
      if (activeDrawerCardKey) renderDrawerContent(activeDrawerCardKey);
      refreshCalendarImmediate();
      renderNotificationCenter();
      subscribeRealtime();
    } catch (err) {
      console.warn("[CalendarV2] Sync warning:", err);
    }
  }

  function subscribeRealtime() {
    const sb = getSb();
    const uid = getStateSafe().loggedInUserId || "";
    if (!sb || typeof sb.channel !== "function") return;
    if (realtimeChannel && realtimeUserId === uid) return;

    if (realtimeChannel) {
      try {
        sb.removeChannel(realtimeChannel);
      } catch (_) {}
      realtimeChannel = null;
    }

    realtimeUserId = uid;
    const channel = sb.channel(`aglab-cal-v2-${uid || "anon"}`);

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "schedule_cards" },
      (payload) => {
        const row = payload.new;
        if (!row || !row.card_key) return;
        cardsMap.set(row.card_key, row);
        saveCardsCache();
        if (row.card_key.startsWith("CUST_") && Array.isArray(row.owners)) {
          const cev = findCustomEventById(row.card_key.slice(5));
          if (cev) cev.owner_user = row.owners.join(", ");
        }
        if (activeDrawerCardKey === row.card_key) renderDrawerContent(row.card_key);
        refreshCalendarImmediate();
        renderNotificationCenter();
      }
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "card_notes" },
      (payload) => {
        const note = payload.new;
        if (!note || !note.card_key) return;
        const arr = notesMap.get(note.card_key) ? [...notesMap.get(note.card_key)] : [];
        if (arr.some((n) => n.id === note.id)) return;
        const optimisticIdx = arr.findIndex(
          (n) =>
            String(n.id).startsWith("local-") &&
            n.author_id === note.author_id &&
            n.content === note.content
        );
        if (optimisticIdx !== -1) arr[optimisticIdx] = note;
        else arr.push(note);
        notesMap.set(note.card_key, arr);
        saveNotesCache();
        if (activeDrawerCardKey === note.card_key) renderDrawerContent(note.card_key);
        refreshCalendarImmediate();
      }
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_brands" },
      (payload) => {
        const b = payload.new;
        if (!b || !b.name) return;
        const norm = normalizeBrandName(b.name);
        brandsMap.set(norm, {
          id: b.id || norm,
          name: norm,
          color: b.color || pickHarmonicColor(norm),
          sort_order: b.sort_order ?? 100,
          is_shared: Boolean(b.is_shared),
          active: b.active !== false,
        });
        saveBrandsCache();
        renderBrandControls();
        refreshCalendarImmediate();
      }
    );

    if (uid) {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "app_notifications",
          filter: `recipient_id=eq.${uid}`,
        },
        (payload) => {
          const notif = payload.new;
          if (!notif) return;
          if (!notifsList.some((n) => n.id === notif.id)) {
            notifsList.unshift(notif);
            saveNotifsCache();
            renderNotificationCenter();
            sendSwLocalNotification(notif.title, notif.body, notif.card_key);
          }
        }
      );
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setCloudStatusSafe("☁️ Nube V2 conectada en tiempo real", false);
      }
    });
    realtimeChannel = channel;
  }

  /* ==========================================================================
     12. CALENDAR RENDERING ENGINE (MONTH / WEEK / AGENDA)
     ========================================================================== */
  function getActiveUserForFilter() {
    const st = getStateSafe();
    return st.targetUserId || st.loggedInUserId || "";
  }

  function countOfficialCardsForOwner(userId) {
    if (!userId) return 0;
    let count = 0;
    cardsMap.forEach((row, key) => {
      if (key && key.startsWith("ACT_") && Array.isArray(row.owners) && row.owners.includes(userId)) {
        count++;
      }
    });
    return count;
  }

  function activityMatchesOwners(actNo, campaignIds, selectedUserIds) {
    if (!selectedUserIds || selectedUserIds.length === 0) return true;
    const camps = Array.isArray(campaignIds) && campaignIds.length > 0
      ? campaignIds
      : (getRaw()?.campaigns || []).map((c) => c.id);
    for (const cid of camps) {
      const key = buildOfficialCardKey(actNo, cid);
      const row = cardsMap.get(key);
      if (row && Array.isArray(row.owners) && row.owners.some((u) => selectedUserIds.includes(u))) {
        return true;
      }
    }
    return false;
  }

  function passesV2QuickFilters(cardKey, defaultBrand) {
    const desc = resolveCardDescriptor(cardKey);
    if (!desc) return false;

    const st = getStateSafe();
    const activeBrandFilter = st.selectedBrands instanceof Set && st.selectedBrands.size > 0 ? st.selectedBrands : (st.brand || "ALL");
    if (desc.cardState?.brand_override) {
      if (!matchesBrandFilter(desc.effectiveBrand, activeBrandFilter, st.includeSharedBrand)) {
        return false;
      }
    } else if (defaultBrand && !matchesBrandFilter(defaultBrand, activeBrandFilter, st.includeSharedBrand)) {
      return false;
    }

    // Filtro multi-persona desde el panel lateral ("Persona asignada")
    if (st.customFilterTags instanceof Set && st.customFilterTags.size > 0) {
      const selectedUsers = Array.from(st.customFilterTags)
        .filter((t) => t.startsWith("USER:"))
        .map((t) => t.slice(5));
      if (selectedUsers.length > 0) {
        if (!desc.owners.some((u) => selectedUsers.includes(u))) return false;
      }
    }

    if (viewPrefs.onlyMine) {
      const me = getActiveUserForFilter();
      if (me && !desc.owners.includes(me)) return false;
    }

    if (viewPrefs.statusFilter) {
      if (desc.status !== viewPrefs.statusFilter) return false;
    }

    return true;
  }

  function renderOwnerChipsMini(owners, maxVisible) {
    if (!owners || owners.length === 0) return "";
    const limit = maxVisible || 3;
    const shown = owners.slice(0, limit);
    const extra = owners.length - shown.length;
    const chips = shown.map((uid) => {
      const prof = getProfileMetaSafe(uid);
      const initials = (prof.name || uid).slice(0, 2).toUpperCase();
      return `<span class="cal-owner-avatar-mini" style="background:${esc(prof.color || "#6366f1")}" title="${esc(prof.name || uid)}">${esc(initials)}</span>`;
    });
    if (extra > 0) {
      chips.push(`<span class="cal-owner-avatar-more">+${extra}</span>`);
    }
    return chips.join("");
  }

  function buildCardHoverToolbarHtml(cardKey, stMeta) {
    return `
      <div class="cal-card-hover-toolbar">
        <button type="button" class="cal-hover-icon-btn cal-quick-status-btn" data-card-key="${esc(cardKey)}" title="Cambiar estado (${esc(stMeta.label)})">
          <span class="material-symbols-outlined">${descStatusMaterialIcon(stMeta.key)}</span>
        </button>
        <button type="button" class="cal-hover-icon-btn cal-quick-duplicate-btn" data-card-key="${esc(cardKey)}" title="Duplicar evento">
          <span class="material-symbols-outlined">content_copy</span>
        </button>
        <button type="button" class="cal-hover-icon-btn cal-quick-assign-btn" data-card-key="${esc(cardKey)}" title="Asignarme / Desasignarme">
          <span class="material-symbols-outlined">person_add</span>
        </button>
        <button type="button" class="cal-hover-icon-btn cal-quick-teams-btn" data-card-key="${esc(cardKey)}" title="Citar en Microsoft Teams">
          <span class="material-symbols-outlined">videocam</span>
        </button>
      </div>
    `;
  }

  function descStatusMaterialIcon(stKey) {
    if (stKey === "listo") return "check_circle";
    if (stKey === "en_progreso") return "pending";
    if (stKey === "revision") return "visibility";
    return "schedule";
  }

  function resolveCustomCampaignShortText(desc) {
    if (!desc) return "";
    if (desc.campaignLabel) return desc.campaignLabel;
    if (desc.camp) {
      const d = getCampDisplayForCard(desc.camp, desc.effectiveBrand);
      return d ? d.short : "";
    }
    return "";
  }

  function renderOfficialCardHtml(ev) {
    const desc = resolveCardDescriptor(ev.cardKey);
    if (!desc) return "";
    const stMeta = STATUS_META[desc.status] || STATUS_META.pendiente;
    const brandVars = getBrandStyleVars(desc.effectiveBrand);
    const campDisp = getCampDisplayForCard(ev.camp, desc.effectiveBrand);
    const bCode = getShortBrandCode(desc.effectiveBrand);
    const customAccent = desc.customColor ? `--card-accent:${esc(desc.customColor)};border-left-color:${esc(desc.customColor)};` : "";

    const miniInds = [];
    if (desc.status !== "pendiente") {
      miniInds.push(`<span class="cal-mini-ind" style="color:${stMeta.color}" title="${esc(stMeta.label)}">${stMeta.short}</span>`);
    }
    if (desc.isOverriddenDate) {
      miniInds.push(`<span class="cal-mini-ind" title="Movida (Excel: ${esc(desc.baseDateStr)})">↺</span>`);
    }
    if (desc.notes.length > 0) {
      miniInds.push(`<span class="cal-mini-ind" title="${desc.notes.length} notas">💬${desc.notes.length}</span>`);
    }
    if (desc.owners.length > 0) {
      miniInds.push(`<span class="cal-owners-mini-wrap">${renderOwnerChipsMini(desc.owners, 2)}</span>`);
    }

    return `
      <div class="calendar-event-card cal-v2-card cal-status-${desc.status}"
           data-type="official"
           data-card-key="${esc(desc.cardKey)}"
           data-no="${ev.act.no}"
           data-camp="${esc(campDisp.short)}"
           data-campfull="${esc(campDisp.full)}"
           data-start="${esc(desc.startDateStr)}"
           data-end="${esc(ev.dateStr)}"
           data-dh="${ev.dh}"
           draggable="true"
           style="${brandVars.cssText}${customAccent}">
        ${buildCardHoverToolbarHtml(desc.cardKey, stMeta)}
        <div class="cal-card-top-mono">
          <span class="cal-card-code-line">
            <span class="cal-card-brand-dot"></span>
            <span>${esc(bCode)} · ${esc(campDisp.short)} · ${ev.dh} DH</span>
          </span>
          <span class="cal-card-mini-indicators">${miniInds.join("")}</span>
        </div>
        <div class="cal-card-clean-title">
          <span class="act-num-mono">#${ev.act.no}</span> ${esc(ev.act.actividad)}
        </div>
      </div>
    `;
  }

  function renderCustomCardHtml(ev) {
    const cev = ev.custom;
    const desc = resolveCardDescriptor(ev.cardKey);
    if (!desc) return "";
    const meta = parseCustomEventMetaSafe(cev);
    const cat = cev.category || "emerald";
    const stMeta = STATUS_META[desc.status] || STATUS_META.pendiente;
    const brandVars = getBrandStyleVars(desc.effectiveBrand);
    const bCode = getShortBrandCode(desc.effectiveBrand);
    const campShort = resolveCustomCampaignShortText(desc);
    const customAccent = desc.customColor ? `--card-accent:${esc(desc.customColor)};border-left-color:${esc(desc.customColor)};` : "";

    const miniInds = [];
    if (meta.importance === "high") {
      miniInds.push(`<span class="cal-mini-ind" style="color:#e11d48" title="Prioridad Alta">●</span>`);
    }
    if (desc.status !== "pendiente") {
      miniInds.push(`<span class="cal-mini-ind" style="color:${stMeta.color}" title="${esc(stMeta.label)}">${stMeta.short}</span>`);
    }
    if (desc.notes.length > 0) {
      miniInds.push(`<span class="cal-mini-ind" title="${desc.notes.length} notas">💬${desc.notes.length}</span>`);
    }
    if (desc.owners.length > 0) {
      miniInds.push(`<span class="cal-owners-mini-wrap">${renderOwnerChipsMini(desc.owners, 2)}</span>`);
    }

    const codeParts = [bCode];
    if (campShort) codeParts.push(campShort);
    else if (meta.tag && meta.tag !== "#General") codeParts.push(meta.tag);
    codeParts.push(`${desc.dh} DH`);

    return `
      <div class="calendar-event-card cal-v2-card cal-status-${desc.status} event-custom-${esc(cat)}"
           data-type="custom"
           data-card-key="${esc(desc.cardKey)}"
           data-evid="${esc(cev.id)}"
           draggable="true"
           style="${brandVars.cssText}${customAccent}">
        ${buildCardHoverToolbarHtml(desc.cardKey, stMeta)}
        <div class="cal-card-top-mono">
          <span class="cal-card-code-line">
            <span class="cal-card-brand-dot"></span>
            <span>${esc(codeParts.join(" · "))}</span>
          </span>
          <span class="cal-card-mini-indicators">${miniInds.join("")}</span>
        </div>
        <div class="cal-card-clean-title">${esc(cev.title)}</div>
      </div>
    `;
  }

  function renderMultiDayLaneBarHtml(cev, colStart, colSpan, continuesLeft, continuesRight) {
    const cardKey = buildCustomCardKey(cev.id);
    const desc = resolveCardDescriptor(cardKey);
    if (!desc) return "";
    const stMeta = STATUS_META[desc.status] || STATUS_META.pendiente;
    const brandVars = getBrandStyleVars(desc.effectiveBrand);
    const bCode = getShortBrandCode(desc.effectiveBrand);
    const campShort = resolveCustomCampaignShortText(desc);
    const customAccent = desc.customColor ? `--card-accent:${esc(desc.customColor)};` : "";
    const leftPrefix = continuesLeft ? "← " : "";
    const rightSuffix = continuesRight ? " →" : "";
    const codeTxt = campShort ? `${bCode} · ${campShort}` : bCode;

    return `
      <div class="cal-multiday-bar cal-status-${desc.status}"
           data-type="custom"
           data-card-key="${esc(cardKey)}"
           data-evid="${esc(cev.id)}"
           draggable="true"
           style="grid-column:${colStart} / span ${colSpan};${brandVars.cssText}${customAccent}">
        ${buildCardHoverToolbarHtml(cardKey, stMeta)}
        <div class="cal-multiday-bar-left">
          <span class="cal-card-brand-dot"></span>
          <span class="cal-multiday-bar-code">${leftPrefix}${esc(codeTxt)}</span>
          <span class="cal-multiday-bar-title">${esc(cev.title)}</span>
        </div>
        <span class="cal-multiday-bar-range">${formatShortDayMonth(desc.startDateStr)}–${formatShortDayMonth(desc.endDateStr)} · ${desc.dh} DH${rightSuffix}</span>
      </div>
    `;
  }

  function buildCalendarEventsIndex(selectedOfficial, visibleCustom, selectedCamps) {
    const eventsByDate = new Map();
    const monthsMap = new Map();

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

    for (const act of selectedOfficial || []) {
      for (const camp of selectedCamps || []) {
        const cardKey = buildOfficialCardKey(act.no, camp.id);
        const desc = resolveCardDescriptor(cardKey);
        const fStr = desc ? desc.effectiveDateStr : (act.fechas && act.fechas[camp.id]);
        if (!fStr) continue;
        if (!passesV2QuickFilters(cardKey, act.marca)) continue;

        addEventToMaps(
          fStr,
          {
            type: "official",
            cardKey,
            dateStr: fStr,
            act,
            camp,
            dh: act.dh?.[camp.id] ?? act.dias ?? 0,
          },
          `off-${act.no}-${camp.id}`
        );
      }
    }

    for (const cev of visibleCustom || []) {
      if (!cev || !cev.event_date) continue;
      const cardKey = buildCustomCardKey(cev.id);
      if (!passesV2QuickFilters(cardKey, cev.marca || "Azz Livv")) continue;

      const range = getCustomEventRangeSafe(cev);
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
            cardKey,
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

    return { eventsByDate, monthsMap };
  }

  function sortDayEvents(rawDayEvents) {
    return [...rawDayEvents].sort((a, b) => {
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
  }

  function buildOnboardingBannerHtml(st) {
    if (!st.selectedActivityNos || st.selectedActivityNos.size > 0) return "";
    const targetName = esc(st.targetUserId || "Diseñador(a)");
    return `
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

  function buildCampHeaderBadge(selectedCamps) {
    if (!selectedCamps || selectedCamps.length === 0) return "Sin campañas oficiales seleccionadas";
    if (selectedCamps.length === 1) return `${selectedCamps[0].shortLabel} (${selectedCamps[0].fullLabel})`;
    if (selectedCamps.length <= 4) return selectedCamps.map((c) => c.shortLabel).join(" • ");
    return `${selectedCamps.length} campañas seleccionadas`;
  }

  function updateTopbarMonthDhBadge(year, month0) {
    const dhCount = typeof app().countWeekdaysInMonth === "function"
      ? app().countWeekdaysInMonth(year, month0)
      : 21;
    const dhEl = document.getElementById("kpiMonthDhText");
    if (dhEl) dhEl.textContent = `${dhCount} DH`;
    const mobDhEl = document.getElementById("mobileDhLabel");
    if (mobDhEl) mobDhEl.textContent = `${dhCount} DH`;
  }

  function renderMobileMonthSplitHtml(mInfo, weeks, eventsByDate, todayStr, onboardingBannerHtml) {
    const yr = mInfo.year;
    const mo = mInfo.month;
    const ymPrefix = `${yr}-${String(mo + 1).padStart(2, "0")}`;

    if (mobileSelectedDateStr && !mobileSelectedDateStr.startsWith(ymPrefix)) {
      mobileSelectedDateStr = "";
    }

    const miniCellsHtml = [];
    for (const w of weeks) {
      for (let colIdx = 0; colIdx < w.length; colIdx++) {
        const cell = w[colIdx];
        const isWknd = colIdx >= 5;
        const holidayName = getColombianHolidaySafe(cell.dateStr);
        const isToday = cell.dateStr === todayStr;
        const isSelected = mobileSelectedDateStr === cell.dateStr;
        const dayEvs = cell.isOtherMonth ? [] : (eventsByDate.get(cell.dateStr) || []);
        const dotsHtml = dayEvs.slice(0, 3).map((ev) => {
          const d = resolveCardDescriptor(ev.cardKey);
          const dotColor = d ? d.effectiveColor : "#4f46e5";
          return `<span class="mini-dot" style="background:${esc(dotColor)}"></span>`;
        }).join("");

        miniCellsHtml.push(`
          <button type="button"
                  class="mobile-mini-day ${cell.isOtherMonth ? "day-other-month" : ""} ${isWknd ? "is-weekend" : ""} ${holidayName ? "is-col-holiday" : ""} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}"
                  data-mobile-day="${cell.dateStr}"
                  ${cell.isOtherMonth ? "disabled style='opacity:0.35'" : ""}
                  title="${holidayName ? `🇨🇴 Festivo: ${esc(holidayName)}` : esc(cell.dateStr)}">
            <span class="mini-day-num">${cell.dayNum}</span>
            <span class="mini-day-dots">${dotsHtml}</span>
          </button>
        `);
      }
    }

    const selectedHoliday = mobileSelectedDateStr ? getColombianHolidaySafe(mobileSelectedDateStr) : null;
    const holidayNoticeHtml = selectedHoliday
      ? `<div class="col-holiday-badge" style="padding:5px 10px;font-size:11.5px;margin-bottom:8px;display:flex">🇨🇴 Festivo oficial en Colombia: ${esc(selectedHoliday)}</div>`
      : "";

    // Lista Agenda inferior del mes (o del día tocado en el mini-calendario)
    const monthDates = Array.from(eventsByDate.keys())
      .filter((d) => (mobileSelectedDateStr ? d === mobileSelectedDateStr : d.startsWith(ymPrefix)))
      .sort();

    const listCards = [];
    const seenMultiIds = new Set();
    for (const dStr of monthDates) {
      const evs = sortDayEvents(eventsByDate.get(dStr) || []);
      for (const ev of evs) {
        if (ev.type === "custom" && ev.isMultiDay && !mobileSelectedDateStr) {
          if (seenMultiIds.has(ev.custom.id)) continue;
          seenMultiIds.add(ev.custom.id);
        }
        const desc = resolveCardDescriptor(ev.cardKey);
        if (!desc) continue;
        const brandVars = getBrandStyleVars(desc.effectiveBrand);
        const campShort = desc.kind === "official"
          ? (desc.camp ? getCampDisplayForCard(desc.camp, desc.effectiveBrand).short : "")
          : resolveCustomCampaignShortText(desc);
        const dateBadge = desc.kind === "custom" && desc.calDays > 1
          ? `${formatShortDayMonth(desc.startDateStr)}–${formatShortDayMonth(desc.endDateStr)}`
          : formatShortDayMonth(dStr);
        const hol = getColombianHolidaySafe(dStr);

        listCards.push(`
          <div class="calendar-event-card cal-v2-card cal-status-${desc.status}"
               data-card-key="${esc(desc.cardKey)}"
               draggable="true"
               style="padding:10px 12px !important;border-radius:10px !important;${brandVars.cssText}">
            <div class="cal-card-top-mono" style="font-size:11.5px">
              <span class="cal-card-code-line">
                <span class="cal-card-brand-dot"></span>
                <span>${esc(desc.effectiveBrand)}${campShort ? ` · ${esc(campShort)}` : ""}</span>
              </span>
              <span>${esc(dateBadge)} · ${desc.dh} DH</span>
            </div>
            <div class="cal-card-clean-title" style="font-size:13.5px;font-weight:600;margin-top:2px">
              ${desc.kind === "official" ? `<span class="act-num-mono">#${desc.actNo}</span> ` : ""}${esc(desc.rawTitle)}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;font-size:11.5px;color:var(--ui-text-secondary)">
              <span>${esc(desc.area || desc.proceso || "")}${hol ? ` · <strong style="color:#be123c">🇨🇴 ${esc(hol)}</strong>` : ""}</span>
              <span>${renderOwnerChipsMini(desc.owners, 3)}</span>
            </div>
          </div>
        `);
      }
    }

    return `
      ${onboardingBannerHtml}
      <section class="mobile-mini-cal-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <strong style="font-family:var(--font-display);font-size:15px">${MONTH_NAMES[mo]} ${yr}</strong>
          ${
            mobileSelectedDateStr
              ? `<button type="button" class="link-btn" data-action="clear-mobile-day" style="font-size:11.5px">Ver todo el mes</button>`
              : `<span style="font-size:11px;color:var(--ui-text-muted)">Toca un día para filtrar</span>`
          }
        </div>
        <div class="mobile-mini-weekdays">
          <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
        </div>
        <div class="mobile-mini-grid">${miniCellsHtml.join("")}</div>
      </section>
      ${holidayNoticeHtml}
      <section style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <strong style="font-size:14px">${mobileSelectedDateStr ? `Entregas del ${formatHumanDate(mobileSelectedDateStr)}` : "Entregas del mes"}</strong>
          <span class="font-mono-num" style="font-size:12px;color:var(--ui-primary);font-weight:600">${listCards.length} hitos</span>
        </div>
        ${
          listCards.length > 0
            ? listCards.join("")
            : `<div style="padding:24px 14px;text-align:center;background:#fff;border:1px solid var(--ui-border);border-radius:10px;color:var(--ui-text-secondary);font-size:12.5px">Sin entregas en esta selección.</div>`
        }
      </section>
    `;
  }

  function renderMonthSubview(container, indexData, selectedCamps, onboardingBannerHtml) {
    const st = getStateSafe();
    const todayStr = getTodayStrSafe();
    const todayYm = todayStr.slice(0, 7);
    const { eventsByDate, monthsMap } = indexData;

    if (st.forceIncludeToday) {
      st.calPinnedYm = todayYm;
      if (!monthsMap.has(todayYm)) {
        const todayDt = parseYMD(todayStr) || new Date();
        monthsMap.set(todayYm, {
          year: todayDt.getFullYear(),
          month: todayDt.getMonth(),
          ym: todayYm,
          events: [],
          uniqueKeys: new Set(),
        });
      }
    }

    if (st.calPinnedYm && /^\d{4}-\d{2}$/.test(st.calPinnedYm) && !monthsMap.has(st.calPinnedYm)) {
      const pYr = parseInt(st.calPinnedYm.slice(0, 4), 10);
      const pMo = parseInt(st.calPinnedYm.slice(5, 7), 10) - 1;
      monthsMap.set(st.calPinnedYm, {
        year: pYr,
        month: pMo,
        ym: st.calPinnedYm,
        events: [],
        uniqueKeys: new Set(),
      });
    }

    if (monthsMap.size === 0) {
      const fallbackDate = parseYMD(todayStr) || new Date();
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
    if (st.forceIncludeToday && sortedMonthKeys.includes(todayYm)) {
      st.calCurrentMonthIndex = sortedMonthKeys.indexOf(todayYm);
      st.forceIncludeToday = false;
    } else if (st.calPinnedYm && sortedMonthKeys.includes(st.calPinnedYm)) {
      st.calCurrentMonthIndex = sortedMonthKeys.indexOf(st.calPinnedYm);
    }
    if (st.calCurrentMonthIndex >= sortedMonthKeys.length) {
      st.calCurrentMonthIndex = sortedMonthKeys.length - 1;
    }
    if (st.calCurrentMonthIndex < 0) st.calCurrentMonthIndex = 0;

    const activeMonthKey = sortedMonthKeys[st.calCurrentMonthIndex];
    st.calPinnedYm = activeMonthKey;
    const activeMonthObj = monthsMap.get(activeMonthKey);
    if (activeMonthObj) {
      updateTopbarMonthDhBadge(activeMonthObj.year, activeMonthObj.month);
    }

    const labelEl = getEl("calCurrentMonthLabel", "calCurrentMonthLabel");
    if (labelEl && activeMonthObj) {
      if (st.calShowAllMonths) {
        labelEl.textContent = `Todos (${sortedMonthKeys.length} meses)`;
      } else {
        labelEl.textContent = `${MONTH_NAMES[activeMonthObj.month]} ${activeMonthObj.year}`;
      }
    }

    const isMobilePwaViewport =
      typeof window !== "undefined" &&
      window.innerWidth < 768 &&
      !document.body.classList.contains("printing-calendar");

    const campHeaderBadge = buildCampHeaderBadge(selectedCamps);
    const keysToRender = (st.calShowAllMonths && !isMobilePwaViewport) ? sortedMonthKeys : [activeMonthKey];
    const visibleCustomList = lastCalendarArgs?.visibleCustom || [];
    const multiDayCustoms = visibleCustomList.filter((cev) => {
      const cardKey = buildCustomCardKey(cev.id);
      if (!passesV2QuickFilters(cardKey, cev.marca)) return false;
      const rng = getCustomEventRangeSafe(cev);
      return rng.calDays > 1 && rng.startStr && rng.endStr;
    });

    const sheetsHtml = [onboardingBannerHtml];

    for (const ym of keysToRender) {
      const mInfo = monthsMap.get(ym);
      if (!mInfo) continue;
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
      let monthBizCounter = 0;

      for (let p = startingDow - 1; p >= 0; p--) {
        const dayNum = prevMonthLastDay - p;
        const prevDt = new Date(yr, mo - 1, dayNum, 12, 0, 0);
        currentWeek.push({ date: prevDt, dateStr: formatYMD(prevDt), dayNum, isOtherMonth: true, dhIdx: null });
      }
      for (let d = 1; d <= totalDaysInMonth; d++) {
        const curDt = new Date(yr, mo, d, 12, 0, 0);
        const dow = curDt.getDay();
        const isBiz = dow !== 0 && dow !== 6;
        if (isBiz) monthBizCounter++;
        currentWeek.push({
          date: curDt,
          dateStr: formatYMD(curDt),
          dayNum: d,
          isOtherMonth: false,
          dhIdx: isBiz ? monthBizCounter : null,
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
          currentWeek.push({ date: nextDt, dateStr: formatYMD(nextDt), dayNum: nextDay, isOtherMonth: true, dhIdx: null });
          nextDay++;
        }
        weeks.push(currentWeek);
      }

      if (isMobilePwaViewport) {
        container.innerHTML = renderMobileMonthSplitHtml(mInfo, weeks, eventsByDate, todayStr, onboardingBannerHtml);
        return;
      }

      const weekBlocksHtml = [];
      for (const w of weeks) {
        const wStartStr = w[0].dateStr;
        const wEndStr = w[6].dateStr;

        // Carriles continuos horizontales para eventos extra multi-día que cruzan esta semana
        const weekLaneBars = [];
        for (const cev of multiDayCustoms) {
          const rng = getCustomEventRangeSafe(cev);
          if (rng.endStr < wStartStr || rng.startStr > wEndStr) continue;
          let startCol = 1;
          let endCol = 7;
          for (let idx = 0; idx < 7; idx++) {
            if (w[idx].dateStr === rng.startStr) startCol = idx + 1;
            if (w[idx].dateStr === rng.endStr) endCol = idx + 1;
          }
          if (rng.startStr < wStartStr) startCol = 1;
          if (rng.endStr > wEndStr) endCol = 7;
          const span = Math.max(1, endCol - startCol + 1);
          weekLaneBars.push(
            `<div class="cal-v3-lane-grid">${renderMultiDayLaneBarHtml(
              cev,
              startCol,
              span,
              rng.startStr < wStartStr,
              rng.endStr > wEndStr
            )}</div>`
          );
        }

        const lanesSectionHtml = weekLaneBars.length > 0
          ? `<div class="cal-v3-multiday-lanes">${weekLaneBars.join("")}</div>`
          : "";

        const cellsHtml = [];
        for (let colIdx = 0; colIdx < w.length; colIdx++) {
          const cell = w[colIdx];
          const isToday = cell.dateStr === todayStr;
          const isWeekend = colIdx >= 5;
          const holidayName = getColombianHolidaySafe(cell.dateStr);
          const dayEvents = sortDayEvents(eventsByDate.get(cell.dateStr) || []).filter(
            (ev) => !(ev.type === "custom" && ev.isMultiDay)
          );
          const eventsHtml = dayEvents.map((ev) =>
            ev.type === "official" ? renderOfficialCardHtml(ev) : renderCustomCardHtml(ev)
          );

          cellsHtml.push(`
            <div class="calendar-day-cell cal-v3-day-cell ${cell.isOtherMonth ? "day-other-month" : ""} ${isWeekend ? "is-weekend" : ""} ${holidayName ? "is-col-holiday" : ""} ${isToday ? "day-today" : ""}" data-date="${cell.dateStr}">
              <div class="day-num-wrap">
                <div style="display:flex;align-items:center;gap:5px;min-width:0;overflow:hidden">
                  <span class="day-num ${cell.isOtherMonth ? "day-num-other" : ""}">${cell.dayNum}</span>
                  ${holidayName && !cell.isOtherMonth ? `<span class="col-holiday-badge" title="Festivo oficial Colombia: ${esc(holidayName)}">🇨🇴 ${esc(holidayName)}</span>` : ""}
                </div>
                <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
                  ${cell.dhIdx && !holidayName ? `<span class="day-dh-micro">DH ${cell.dhIdx}</span>` : ""}
                  <button type="button" class="day-add-btn" data-adddate="${cell.dateStr}" title="Agregar evento el ${cell.dateStr}">+</button>
                </div>
              </div>
              <div class="calendar-events-list">${eventsHtml.join("")}</div>
            </div>
          `);
        }

        weekBlocksHtml.push(`
          <div class="cal-v3-week-block">
            ${lanesSectionHtml}
            <div class="cal-v3-days-grid">${cellsHtml.join("")}</div>
          </div>
        `);
      }

      sheetsHtml.push(`
        <div class="calendar-month-sheet">
          <div class="calendar-month-header" style="${st.calShowAllMonths ? "" : "display:none"}">
            <div>
              <div class="calendar-month-title">${MONTH_NAMES[mo]} ${yr}</div>
              <div style="font-size:12px;color:var(--ui-text-secondary);margin-top:2px">
                ${mInfo.events.length} hitos • Perfil: <strong>${esc(st.targetUserId || "Equipo")}</strong>
              </div>
            </div>
            <div class="calendar-campaign-meta">
              <span class="calendar-campaign-badge">${esc(campHeaderBadge)}</span>
            </div>
          </div>

          <div class="cal-v3-weekdays-header">
            <div class="cal-v3-weekday-cell">Lun</div>
            <div class="cal-v3-weekday-cell">Mar</div>
            <div class="cal-v3-weekday-cell">Mié</div>
            <div class="cal-v3-weekday-cell">Jue</div>
            <div class="cal-v3-weekday-cell">Vie</div>
            <div class="cal-v3-weekday-cell is-weekend-head">Sáb</div>
            <div class="cal-v3-weekday-cell is-weekend-head">Dom</div>
          </div>
          <div class="cal-v3-month-body">${weekBlocksHtml.join("")}</div>
        </div>
      `);
    }

    container.innerHTML = sheetsHtml.join("");
  }

  function renderWeekSubview(container, indexData, selectedCamps, onboardingBannerHtml) {
    const st = getStateSafe();
    const todayStr = getTodayStrSafe();
    if (st.forceIncludeToday) {
      viewPrefs.weekStartDate = formatYMD(getMondayOfWeek(todayStr));
      saveViewPrefsCache();
      st.forceIncludeToday = false;
    }
    const { eventsByDate } = indexData;
    const mondayDt = getMondayOfWeek(viewPrefs.weekStartDate || todayStr);
    const sundayDt = addDays(mondayDt, 6);
    const mondayStr = formatYMD(mondayDt);
    const sundayStr = formatYMD(sundayDt);
    viewPrefs.weekStartDate = mondayStr;

    const labelEl = getEl("calCurrentMonthLabel", "calCurrentMonthLabel");
    if (labelEl) {
      labelEl.textContent = `Sem ${formatShortDayMonth(mondayStr)} – ${formatShortDayMonth(sundayStr)} ${sundayDt.getFullYear()}`;
    }

    const colsHtml = [];
    let weekEventsCount = 0;
    for (let i = 0; i < 7; i++) {
      const dt = addDays(mondayDt, i);
      const dateStr = formatYMD(dt);
      const isToday = dateStr === todayStr;
      const isWeekend = i >= 5;
      const dayEvents = sortDayEvents(eventsByDate.get(dateStr) || []);
      weekEventsCount += dayEvents.length;

      const cardsHtml = dayEvents.map((ev) =>
        ev.type === "official" ? renderOfficialCardHtml(ev) : renderCustomCardHtml(ev)
      );

      const holidayName = getColombianHolidaySafe(dateStr);

      colsHtml.push(`
        <div class="cal-week-col calendar-day-cell ${isToday ? "day-today" : ""} ${isWeekend ? "is-weekend" : ""} ${holidayName ? "is-col-holiday" : ""}" data-date="${dateStr}">
          <div class="cal-week-col-header">
            <div style="min-width:0">
              <div class="cal-week-day-name">${WEEKDAY_NAMES[i]}</div>
              <div class="cal-week-day-date font-mono-num">${formatShortDayMonth(dateStr)}</div>
              ${holidayName ? `<div class="col-holiday-badge" style="margin-top:3px" title="Festivo oficial Colombia: ${esc(holidayName)}">🇨🇴 ${esc(holidayName)}</div>` : ""}
            </div>
            <div style="display:flex;align-items:center;gap:4px">
              ${isToday ? `<span class="today-chip">Hoy</span>` : ""}
              <button type="button" class="day-add-btn" style="opacity:1" data-adddate="${dateStr}" title="Agregar evento el ${dateStr}">+</button>
            </div>
          </div>
          <div class="cal-week-col-body calendar-events-list">
            ${cardsHtml.length > 0 ? cardsHtml.join("") : `<div class="cal-week-empty">Arrastra aquí o pulsa +</div>`}
          </div>
        </div>
      `);
    }

    let jumpHint = "";
    if (weekEventsCount === 0 && eventsByDate.size > 0) {
      const sortedDates = Array.from(eventsByDate.keys()).sort();
      const nextDate = sortedDates.find((d) => d >= mondayStr) || sortedDates[0];
      if (nextDate) {
        jumpHint = `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;margin-bottom:10px;border-radius:10px;background:#eef2ff;color:#3730a3;font-size:12px">
            <span>Sin tarjetas en esta semana. Próxima entrega: <strong>${formatHumanDate(nextDate)}</strong></span>
            <button type="button" class="btn btn-sm btn-primary" data-jump-week="${esc(nextDate)}">Ir a esa semana →</button>
          </div>
        `;
      }
    }

    container.innerHTML = `
      ${onboardingBannerHtml}
      <div class="cal-week-sheet">
        <div class="calendar-month-header" style="margin-bottom:10px">
          <div>
            <div class="calendar-month-title">Semana ${formatShortDayMonth(mondayStr)} → ${formatShortDayMonth(sundayStr)}</div>
            <div style="font-size:12px;color:#64748b">${weekEventsCount} tarjeta${weekEventsCount === 1 ? "" : "s"} esta semana • ${esc(buildCampHeaderBadge(selectedCamps))}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button type="button" class="btn btn-sm btn-outline" data-action="prev-week">◀ Semana ant.</button>
            <button type="button" class="btn btn-sm btn-outline" data-action="next-week">Semana sig. ▶</button>
          </div>
        </div>
        ${jumpHint}
        <div class="cal-week-grid">${colsHtml.join("")}</div>
      </div>
    `;
  }

  function renderAgendaSubview(container, indexData, onboardingBannerHtml) {
    const st = getStateSafe();
    if (st.forceIncludeToday) st.forceIncludeToday = false;
    const todayStr = getTodayStrSafe();
    const { eventsByDate } = indexData;
    const sortedDates = Array.from(eventsByDate.keys()).sort();

    const labelEl = getEl("calCurrentMonthLabel", "calCurrentMonthLabel");
    if (labelEl) {
      labelEl.textContent = `Agenda (${sortedDates.length} días con entregas)`;
    }

    if (sortedDates.length === 0) {
      container.innerHTML = `
        ${onboardingBannerHtml}
        <div class="cal-agenda-empty" style="text-align:center;padding:36px 16px;background:#fff;border-radius:14px;border:1px solid #e2e8f0">
          <div style="font-size:28px;margin-bottom:8px">📅</div>
          <div style="font-weight:700;font-size:15px;color:#0f172a">No hay tarjetas con los filtros actuales</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px">Prueba cambiar los filtros de estado, marca o "Mis tareas".</div>
        </div>
      `;
      return;
    }

    // Construir chips rápidos de destino para Drag & Drop hacia días nuevos en Agenda
    const baseDropDt = parseYMD(todayStr) || new Date();
    const quickDropChips = [];
    for (let k = 0; k < 6; k++) {
      const qDt = addDays(baseDropDt, k);
      const qStr = formatYMD(qDt);
      quickDropChips.push(
        `<span class="agenda-drop-chip" data-date="${qStr}" title="Suelta una tarjeta aquí para moverla al ${qStr}">${k === 0 ? "Hoy · " : ""}${formatShortDayMonth(qStr)}</span>`
      );
    }
    const agendaQuickDropBarHtml = `
      <div class="agenda-quick-drop-bar">
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ui-text-secondary)">
          <span class="material-symbols-outlined" style="font-size:17px;color:var(--ui-primary)">drag_indicator</span>
          <span><strong>Drag & Drop activo:</strong> Arrastra cualquier tarjeta a otro día o suéltala en una fecha rápida:</span>
        </div>
        <div class="agenda-drop-chips">
          ${quickDropChips.join("")}
          <label class="agenda-drop-chip" id="agendaCustomDateDropZone" style="display:inline-flex;align-items:center;gap:5px" title="Elige una fecha destino y suelta encima">
            <span>Otra fecha:</span>
            <input type="date" id="agendaDropDateInput" value="${todayStr}" style="border:none;background:transparent;font-family:var(--font-mono);font-size:11.5px;padding:0" />
          </label>
        </div>
      </div>
    `;

    const groupsHtml = [];
    for (const dateStr of sortedDates) {
      const dt = parseYMD(dateStr);
      const dowIdx = dt ? (dt.getDay() === 0 ? 6 : dt.getDay() - 1) : 0;
      const isWeekend = dowIdx >= 5;
      const holidayName = getColombianHolidaySafe(dateStr);
      const isToday = dateStr === todayStr;
      const rawEvents = sortDayEvents(eventsByDate.get(dateStr) || []);
      const agendaEvents = rawEvents.filter((ev) => {
        if (ev.type === "official") return true;
        return !ev.isMultiDay || ev.isRangeStart || dateStr === todayStr;
      });
      if (agendaEvents.length === 0) continue;

      const itemsHtml = agendaEvents
        .map((ev) => {
          const desc = resolveCardDescriptor(ev.cardKey);
          if (!desc) return "";
          const stMeta = STATUS_META[desc.status] || STATUS_META.pendiente;
          const brandVars = getBrandStyleVars(desc.effectiveBrand);
          const accent = desc.customColor || desc.brandColor;
          const campDisp = desc.camp ? getCampDisplayForCard(desc.camp, desc.effectiveBrand) : null;
          const customCampTxt = resolveCustomCampaignShortText(desc);
          const campTxt = campDisp
            ? `<span class="event-camp-badge font-mono-num">${esc(campDisp.short)}</span>`
            : customCampTxt
              ? `<span class="event-camp-badge font-mono-num">${esc(customCampTxt)}</span>`
              : (desc.tag ? `<span class="event-hashtag-badge">${esc(desc.tag)}</span>` : "");
          const showAgendaSubArea = Boolean(desc.area && desc.area.toLowerCase() !== desc.effectiveBrand.toLowerCase());

          return `
            <div class="cal-agenda-item calendar-event-card cal-status-${desc.status}"
                 data-card-key="${esc(desc.cardKey)}"
                 draggable="true"
                 style="${brandVars.cssText}border-left:4px solid ${esc(accent)};cursor:grab">
              <div class="cal-agenda-item-main">
                <div class="event-meta-line cal-card-headline-row">
                  <span class="material-symbols-outlined" style="font-size:15px;color:var(--ui-text-muted)" title="Arrastrar para cambiar fecha">drag_indicator</span>
                  <span class="cal-brand-headline-badge">${esc(desc.effectiveBrand)}</span>
                  ${campTxt}
                  <span class="font-mono-num" style="font-size:11px;font-weight:600;color:var(--ui-text-secondary)">${desc.dh} DH</span>
                  ${desc.kind === "custom" && desc.range?.isMultiDay ? `<span class="event-range-badge font-mono-num">${formatShortDayMonth(desc.startDateStr)} → ${formatShortDayMonth(desc.endDateStr)}</span>` : ""}
                  ${desc.isOverriddenDate ? `<span class="cal-card-moved-badge">Movida</span>` : ""}
                </div>
                <div class="event-full-title" style="font-size:13.5px;margin-top:3px">${esc(desc.title)}</div>
                ${showAgendaSubArea ? `<div class="cal-card-subarea">${esc(desc.area)}</div>` : ""}
                <div class="cal-card-footer" style="margin-top:6px">
                  <div class="cal-card-footer-left">
                    <button type="button" class="cal-quick-status-btn status-${desc.status}" data-card-key="${esc(desc.cardKey)}" style="background:${stMeta.bg};color:${stMeta.color}">${stMeta.icon} ${stMeta.label}</button>
                    ${desc.notes.length > 0 ? `<span class="cal-card-notes-badge">💬 ${desc.notes.length}</span>` : ""}
                    <div class="cal-owners-mini-wrap">${renderOwnerChipsMini(desc.owners, 4)}</div>
                  </div>
                  <div class="cal-card-quick-actions">
                    <button type="button" class="cal-hover-icon-btn cal-quick-duplicate-btn" data-card-key="${esc(desc.cardKey)}" title="Duplicar evento"><span class="material-symbols-outlined">content_copy</span></button>
                    <button type="button" class="cal-hover-icon-btn cal-quick-assign-btn" data-card-key="${esc(desc.cardKey)}" title="Asignarme"><span class="material-symbols-outlined">person_add</span></button>
                    <button type="button" class="cal-hover-icon-btn cal-quick-teams-btn" data-card-key="${esc(desc.cardKey)}" title="Citar en Teams"><span class="material-symbols-outlined">videocam</span></button>
                  </div>
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      groupsHtml.push(`
        <section class="cal-agenda-day-group ${isToday ? "is-today" : ""} ${isWeekend ? "is-weekend" : ""} ${holidayName ? "is-col-holiday" : ""}" data-date="${dateStr}">
          <header class="cal-agenda-day-header">
            <div class="cal-agenda-day-title" style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">
              <strong>${WEEKDAY_NAMES[dowIdx]}</strong> · <span class="font-mono-num">${formatHumanDate(dateStr)}</span>
              ${isToday ? `<span class="today-chip">Hoy</span>` : ""}
              ${isWeekend ? `<span style="font-size:10.5px;padding:1px 6px;border-radius:4px;background:var(--wknd-header-bg);color:var(--wknd-text);font-weight:700">Fin de semana</span>` : ""}
              ${holidayName ? `<span class="col-holiday-badge">🇨🇴 Festivo · ${esc(holidayName)}</span>` : ""}
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="font-mono-num" style="font-size:11px;color:#64748b">${agendaEvents.length} hito${agendaEvents.length === 1 ? "" : "s"}</span>
              <button type="button" class="day-add-btn" style="opacity:1" data-adddate="${dateStr}" title="Agregar evento">+</button>
            </div>
          </header>
          <div class="cal-agenda-day-list">${itemsHtml}</div>
        </section>
      `);
    }

    container.innerHTML = `${onboardingBannerHtml}${agendaQuickDropBarHtml}<div class="cal-agenda-container">${groupsHtml.join("")}</div>`;
  }

  function renderCalendar(selectedOfficial, visibleCustom, selectedCamps) {
    ensureInitialized();
    bindSingleDelegatedEvents();
    lastCalendarArgs = {
      selectedOfficial: selectedOfficial || [],
      visibleCustom: visibleCustom || [],
      selectedCamps: selectedCamps || [],
    };

    const container = getEl("calendarContainer", "calendarContainer");
    if (!container) return;

    const st = getStateSafe();
    if (getSb() && !hasSyncedCloud) {
      hasSyncedCloud = true;
      syncFromSupabase();
    }
    if (pendingCardKeyFromUrl && st.loggedInUserId) {
      const urlKey = pendingCardKeyFromUrl;
      pendingCardKeyFromUrl = null;
      setTimeout(() => openCardFromExternalTrigger(urlKey), 80);
    }

    renderBrandControls(false);
    syncViewFilterControlsUI();
    const indexData = buildCalendarEventsIndex(
      lastCalendarArgs.selectedOfficial,
      lastCalendarArgs.visibleCustom,
      lastCalendarArgs.selectedCamps
    );
    const onboardingHtml = buildOnboardingBannerHtml(st);

    if (viewPrefs.subview === "week") {
      renderWeekSubview(container, indexData, lastCalendarArgs.selectedCamps, onboardingHtml);
    } else if (viewPrefs.subview === "agenda") {
      renderAgendaSubview(container, indexData, onboardingHtml);
    } else {
      renderMonthSubview(container, indexData, lastCalendarArgs.selectedCamps, onboardingHtml);
    }
  }

  function refreshCalendarImmediate() {
    if (!lastCalendarArgs) return;
    renderCalendar(
      lastCalendarArgs.selectedOfficial,
      lastCalendarArgs.visibleCustom,
      lastCalendarArgs.selectedCamps
    );
  }

  function syncViewFilterControlsUI() {
    const seg = getEl("calSubviewSegmented");
    if (seg) {
      seg.querySelectorAll("[data-subview]").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-subview") === viewPrefs.subview);
      });
    }
    const mineBtn = getEl("btnCalOnlyMine");
    if (mineBtn) {
      mineBtn.classList.toggle("active", viewPrefs.onlyMine);
    }
    const statusSelect = getEl("calStatusFilter");
    if (statusSelect && statusSelect.value !== viewPrefs.statusFilter) {
      statusSelect.value = viewPrefs.statusFilter;
    }
  }

  function setSubview(subview) {
    if (subview !== "month" && subview !== "week" && subview !== "agenda") return;
    viewPrefs.subview = subview;
    saveViewPrefsCache();
    syncViewFilterControlsUI();
    refreshCalendarImmediate();
  }

  function prevWeek() {
    const mon = getMondayOfWeek(viewPrefs.weekStartDate || getTodayStrSafe());
    viewPrefs.weekStartDate = formatYMD(addDays(mon, -7));
    saveViewPrefsCache();
    if (viewPrefs.subview !== "week") viewPrefs.subview = "week";
    refreshCalendarImmediate();
  }

  function nextWeek() {
    const mon = getMondayOfWeek(viewPrefs.weekStartDate || getTodayStrSafe());
    viewPrefs.weekStartDate = formatYMD(addDays(mon, 7));
    saveViewPrefsCache();
    if (viewPrefs.subview !== "week") viewPrefs.subview = "week";
    refreshCalendarImmediate();
  }

  function stepPinnedMonth(delta) {
    const st = getStateSafe();
    const curYm = st.calPinnedYm || getTodayStrSafe().slice(0, 7);
    const yr = parseInt(curYm.slice(0, 4), 10);
    const mo = parseInt(curYm.slice(5, 7), 10) - 1;
    const nextDt = new Date(yr, mo + delta, 1, 12, 0, 0);
    st.calPinnedYm = `${nextDt.getFullYear()}-${String(nextDt.getMonth() + 1).padStart(2, "0")}`;
    st.calShowAllMonths = false;
    const chk = document.getElementById("chkCalShowAllMonths");
    if (chk) chk.checked = false;
    refreshCalendarImmediate();
  }

  function onPrevClick() {
    if (viewPrefs.subview === "week") {
      prevWeek();
      return true;
    }
    if (viewPrefs.subview === "month") {
      stepPinnedMonth(-1);
      return true;
    }
    return false;
  }

  function onNextClick() {
    if (viewPrefs.subview === "week") {
      nextWeek();
      return true;
    }
    if (viewPrefs.subview === "month") {
      stepPinnedMonth(1);
      return true;
    }
    return false;
  }

  function goToToday() {
    const todayStr = getTodayStrSafe();
    if (viewPrefs.subview === "week") {
      viewPrefs.weekStartDate = formatYMD(getMondayOfWeek(todayStr));
      saveViewPrefsCache();
      refreshCalendarImmediate();
      setTimeout(() => {
        const el = document.querySelector(`[data-date="${todayStr}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 40);
      return true;
    }
    if (viewPrefs.subview === "agenda") {
      refreshCalendarImmediate();
      setTimeout(() => {
        const el = document.querySelector(`.cal-agenda-day-group[data-date="${todayStr}"]`) ||
          document.querySelector(".cal-agenda-day-group");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 40);
      return true;
    }
    return false;
  }

  /* ==========================================================================
     13. CARD DETAIL DRAWER (#cardDetailBackdrop / #cardDetailDrawer)
     ========================================================================== */
  function openCardDetail(cardKey) {
    ensureInitialized();
    const desc = resolveCardDescriptor(cardKey);
    if (!desc) {
      showToast("No se encontró la tarjeta solicitada.", "warn");
      return;
    }
    activeDrawerCardKey = cardKey;
    const backdrop = getEl("cardDetailBackdrop");
    const drawer = getEl("cardDetailDrawer");
    if (!drawer) {
      if (desc.kind === "custom" && desc.cev && typeof app().openCustomEventModal === "function") {
        app().openCustomEventModal(desc.cev);
      }
      return;
    }

    renderDrawerContent(cardKey);
    if (backdrop) backdrop.style.display = "flex";
    drawer.classList.add("open");
    drawer.style.display = "flex";
  }

  function closeCardDetail() {
    activeDrawerCardKey = null;
    const backdrop = getEl("cardDetailBackdrop");
    const drawer = getEl("cardDetailDrawer");
    if (drawer) {
      drawer.classList.remove("open");
      if (!backdrop) drawer.style.display = "none";
    }
    if (backdrop) backdrop.style.display = "none";
  }

  function openCardFromExternalTrigger(cardKey) {
    if (!cardKey) return;
    const st = getStateSafe();
    if (!st.loggedInUserId) {
      pendingCardKeyFromUrl = cardKey;
      return;
    }
    if (st.viewMode !== "calendar") {
      const tabCal = getEl("tabCalendar", "tabCalendar");
      if (tabCal) tabCal.click();
    }
    openCardDetail(cardKey);
  }

  function renderDrawerContent(cardKey) {
    const drawer = getEl("cardDetailDrawer");
    if (!drawer) return;
    const desc = resolveCardDescriptor(cardKey);
    if (!desc) return;

    const st = getStateSafe();
    const me = st.loggedInUserId || st.targetUserId;
    const isMeAssigned = Boolean(me && desc.owners.includes(me));
    const admin = isAdminSafe();
    const profiles = getAllProfilesSafe();
    const brands = getBrands(false);
    const brandVars = getBrandStyleVars(desc.effectiveBrand);

    const statusBtnsHtml = STATUS_ORDER.map((stKey) => {
      const m = STATUS_META[stKey];
      const active = desc.status === stKey;
      return `
        <button type="button"
                class="cal-drawer-status-btn ${active ? "active" : ""}"
                data-drawer-status="${stKey}"
                style="border-color:${active ? m.color : "#e2e8f0"};background:${active ? m.bg : "#fff"};color:${active ? m.color : "#475569"}">
          ${m.icon} ${m.label}
        </button>
      `;
    }).join("");

    const ownersGridHtml = profiles
      .map((p) => {
        const selected = desc.owners.includes(p.id);
        return `
          <button type="button"
                  class="cal-drawer-owner-chip ${selected ? "selected" : ""}"
                  data-drawer-owner="${esc(p.id)}"
                  style="border-color:${selected ? esc(p.color) : "#e2e8f0"};background:${selected ? "#eef2ff" : "#fff"}">
            <span class="cal-owner-avatar-mini" style="background:${esc(p.color || "#6366f1")}">${esc((p.name || p.id).slice(0, 2).toUpperCase())}</span>
            <span>${esc(p.name || p.id)}</span>
            ${selected ? `<span style="color:#4f46e5;font-weight:800">✓</span>` : ""}
          </button>
        `;
      })
      .join("");

    const brandOptionsHtml = brands
      .map(
        (b) =>
          `<option value="${esc(b.name)}" ${desc.effectiveBrand === b.name ? "selected" : ""}>${esc(b.name)}${b.is_shared ? " (Compartida)" : ""}</option>`
      )
      .join("");

    const paletteHtml = CARD_PALETTE.map((c) => {
      const active = desc.customColor && desc.customColor.toLowerCase() === c.hex.toLowerCase();
      return `
        <button type="button"
                class="cal-drawer-color-dot ${active ? "active" : ""}"
                data-drawer-color="${c.hex}"
                title="${esc(c.name)}"
                style="background:${c.hex};outline:${active ? "2px solid #0f172a" : "none"};outline-offset:2px"></button>
      `;
    }).join("");

    const notesHtml = desc.notes.length > 0
      ? desc.notes
          .map((n) => {
            const p = getProfileMetaSafe(n.author_id);
            return `
              <div class="cal-drawer-note-item">
                <div class="cal-drawer-note-meta">
                  <span class="cal-owner-avatar-mini" style="background:${esc(p.color || "#6366f1")}">${esc((p.name || n.author_id).slice(0, 2).toUpperCase())}</span>
                  <strong>${esc(p.name || n.author_id)}</strong>
                  <span style="color:#94a3b8;font-size:10px;margin-left:auto">${formatNotifTime(n.created_at)}</span>
                </div>
                <div class="cal-drawer-note-text">${esc(n.content)}</div>
              </div>
            `;
          })
          .join("")
      : `<div style="font-size:12px;color:#94a3b8;padding:8px 0">Sin notas aún. Escribe un comentario para el equipo.</div>`;

    const campDisp = desc.camp ? getCampDisplayForCard(desc.camp, desc.effectiveBrand) : null;
    const customCampLabel = resolveCustomCampaignShortText(desc);
    const campChipText = campDisp ? campDisp.short : (customCampLabel || (desc.tag || ""));
    const holidayOnTarget = getColombianHolidaySafe(desc.effectiveDateStr);

    const bodyHtml = `
      <div class="mobile-sheet-handle" style="display:none"><span></span></div>
      <div class="drawer-editorial-head" style="${brandVars.cssText}">
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:4px;font-size:11.5px;font-weight:700;background:${brandVars.bg};color:${brandVars.text};border:1px solid ${brandVars.border}">
              <span style="width:6px;height:6px;border-radius:50%;background:${brandVars.color}"></span>
              ${esc(desc.effectiveBrand)}
            </span>
            ${campChipText ? `<span class="font-mono-num" style="padding:2px 7px;border-radius:4px;background:var(--ui-surface-mid);font-size:11.5px;font-weight:600;color:var(--ui-text)">${esc(campChipText)}</span>` : ""}
            ${desc.kind === "official" ? `<span class="font-mono-num" style="font-size:11.5px;color:var(--ui-text-muted)">#${desc.actNo}</span>` : ""}
          </div>
          <h3 class="drawer-editorial-title">${esc(desc.rawTitle)}</h3>
        </div>
        <button type="button" id="btnDrawerClose" class="btn-icon-square" data-action="close-drawer" title="Cerrar detalle">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="cal-drawer-body" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:16px">
        <!-- Atributos Operativos (Estilo Stitch) -->
        <div class="drawer-meta-grid">
          <div class="drawer-meta-item">
            <span class="lbl">Proceso</span>
            <span class="val">${esc(desc.proceso || "General")}</span>
          </div>
          <div class="drawer-meta-item">
            <span class="lbl">Área</span>
            <span class="val">${esc(desc.area || "Equipo")}</span>
          </div>
          <div class="drawer-meta-item">
            <span class="lbl">${desc.kind === "custom" && desc.calDays > 1 ? "Rango programado" : "Fecha programada"}</span>
            <span class="val font-mono-num">${
              desc.kind === "custom" && desc.calDays > 1
                ? `${formatShortDayMonth(desc.startDateStr)} – ${formatHumanDate(desc.endDateStr)}`
                : formatHumanDate(desc.effectiveDateStr)
            }</span>
            ${holidayOnTarget ? `<span class="col-holiday-badge" style="margin-top:3px">🇨🇴 ${esc(holidayOnTarget)}</span>` : ""}
          </div>
          <div class="drawer-meta-item">
            <span class="lbl">Duración estimada</span>
            <span class="val font-mono-num" style="color:var(--ui-primary)">${desc.dh} Días Hábiles</span>
          </div>
        </div>

        ${
          desc.isOverriddenDate
            ? `<div class="drawer-diff-alert">
                 <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px">
                   <strong style="font-size:12px">Fecha reprogramada por el equipo</strong>
                   <button type="button" class="link-btn" data-action="restore-excel-date" style="font-size:11.5px;color:#9a3412;font-weight:700">↺ Restaurar Excel (${esc(desc.baseDateStr)})</button>
                 </div>
                 <div class="font-mono-num" style="font-size:12px">Excel base: ${formatHumanDate(desc.baseDateStr)} → Actual: ${formatHumanDate(desc.effectiveDateStr)}</div>
               </div>`
            : ""
        }

        <!-- Estado -->
        <section class="cal-drawer-section">
          <label class="cal-drawer-label">Estado de la actividad</label>
          <div class="cal-drawer-status-grid">${statusBtnsHtml}</div>
        </section>

        <!-- Responsables + Asignarme -->
        <section class="cal-drawer-section">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <label class="cal-drawer-label" style="margin:0">Responsables (${desc.owners.length})</label>
            <button type="button" id="btnDrawerAssignMe" class="btn btn-sm ${isMeAssigned ? "btn-outline" : "btn-primary"}" data-action="toggle-assign-me" style="${isMeAssigned ? "" : "background:var(--ui-primary)"}">
              ${isMeAssigned ? "✓ Asignado a mí" : "+ Asignarme"}
            </button>
          </div>
          <div class="cal-drawer-owners-grid">${ownersGridHtml}</div>
        </section>

        <!-- Reprogramar Fecha (Habilitado para todo el equipo) -->
        <section class="cal-drawer-section">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <label class="cal-drawer-label" style="margin:0">
              ${desc.kind === "official" ? "Mover fecha de entrega" : "Mover fecha de inicio"}
            </label>
            ${desc.kind === "custom" && desc.cev ? `<button type="button" class="link-btn" data-action="open-legacy-custom-modal" style="font-size:11.5px">Editar evento completo / recurrencia</button>` : ""}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <input type="date" id="drawerDateInput" class="filter-input font-mono-num" value="${esc(desc.effectiveDateStr)}" style="width:auto" />
            <span class="font-mono-num" style="font-size:11.5px;color:var(--ui-text-secondary)">
              ${desc.kind === "official" ? `Inicio est.: ${formatShortDayMonth(desc.startDateStr)}` : `Fin: ${formatShortDayMonth(desc.endDateStr)}`}
            </span>
          </div>
        </section>

        <!-- Marca & Paleta de Color -->
        <section class="cal-drawer-section">
          <div style="display:grid;grid-template-columns:1fr;gap:10px">
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <label class="cal-drawer-label" for="drawerBrandSelect" style="margin:0">Marca</label>
                ${desc.cardState?.brand_override ? `<button type="button" class="link-btn" data-action="restore-brand" style="font-size:11px">↺ Restaurar (${esc(desc.defaultBrand)})</button>` : ""}
              </div>
              <select id="drawerBrandSelect" class="filter-select">${brandOptionsHtml}</select>
            </div>
            ${desc.kind === "custom" ? `
            <div>
              <label class="cal-drawer-label" for="drawerAreaInput" style="margin-bottom:4px">Área o Rol</label>
              <input type="text" id="drawerAreaInput" class="filter-input" value="${esc(desc.area || "")}" placeholder="Ej. Diseño Textil, Utilería y Modelos..." />
            </div>` : ""}
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <label class="cal-drawer-label" style="margin:0">Color personalizado</label>
                <button type="button" class="link-btn" data-action="use-brand-color" style="font-size:11px">Usar color de marca</button>
              </div>
              <div class="cal-drawer-palette" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${paletteHtml}</div>
            </div>
          </div>
        </section>

        <!-- Notas y Comentarios -->
        <section class="cal-drawer-section">
          <label class="cal-drawer-label">Notas y comentarios del equipo (${desc.notes.length})</label>
          <div id="drawerNotesList" class="cal-drawer-notes-list">${notesHtml}</div>
          <form id="drawerNoteForm" style="display:flex;gap:6px;margin-top:8px">
            <input type="text" id="drawerNoteInput" class="filter-input" placeholder="Escribe una nota operativa..." required style="flex:1" />
            <button type="submit" class="btn btn-sm btn-primary" style="background:var(--ui-primary)">Agregar</button>
          </form>
        </section>
      </div>
    `;

    const footerHtml = `
      <div class="cal-drawer-footer" style="border-top:1px solid var(--ui-border);padding:12px 20px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--ui-surface-low)">
        <button type="button" class="btn-rail-secondary" data-action="duplicate-card" title="Crear una copia de este evento en esta u otras campañas">
          <span class="material-symbols-outlined" style="font-size:16px">content_copy</span>
          <span>Duplicar</span>
        </button>
        <button type="button" id="btnDrawerTeamsCite" class="btn-rail-secondary" title="Citar reunión en Microsoft Teams">
          <span class="material-symbols-outlined" style="font-size:16px">videocam</span>
          <span>Teams</span>
        </button>
        <button type="button" id="btnDrawerCardIcs" class="btn-rail-secondary" title="Exportar este hito a calendario (.ics)">
          <span class="material-symbols-outlined" style="font-size:16px">event</span>
          <span>.ICS</span>
        </button>
        <button type="button" class="btn-rail-primary" data-action="close-drawer" style="width:auto;margin-left:auto;padding:7px 16px">
          Listo
        </button>
      </div>
    `;

    const prebuiltBody = drawer.querySelector("#cardDetailBody") || drawer.querySelector("#cardDrawerBody");
    if (prebuiltBody) {
      prebuiltBody.innerHTML = bodyHtml;
    } else {
      drawer.innerHTML = bodyHtml + footerHtml;
    }
  }

  /* ==========================================================================
     14. SINGLE EVENT DELEGATION SETUP
     ========================================================================== */
  function bindSingleDelegatedEvents() {
    // 1. Calendar container (Click, Hover Tooltip, Drag & Drop)
    const calContainer = getEl("calendarContainer", "calendarContainer");
    if (calContainer && !calContainer.dataset.v2Bound) {
      calContainer.dataset.v2Bound = "1";

      calContainer.addEventListener("click", (e) => {
        const presetBtn = e.target.closest("[data-preset]");
        if (presetBtn) {
          const preset = presetBtn.getAttribute("data-preset");
          if (typeof app().applyQuickPreset === "function") {
            app().applyQuickPreset(preset);
          } else {
            const proxy = document.querySelector(`#unifiedFilterDrawer [data-preset="${preset}"]`);
            if (proxy) proxy.click();
          }
          return;
        }

        if (e.target.closest("#btnOnboardingAddEvent")) {
          if (typeof app().openCustomEventModal === "function") {
            app().openCustomEventModal(null, getTodayStrSafe());
          }
          return;
        }

        if (e.target.closest("#btnOnboardingOpenDrawer")) {
          const bd = getEl("unifiedFilterDrawerBackdrop", "unifiedFilterDrawerBackdrop");
          if (bd) bd.style.display = "flex";
          const btnMain = getEl("btnOpenUnifiedFilters", "btnOpenUnifiedFilters");
          if (btnMain) btnMain.click();
          return;
        }

        const addBtn = e.target.closest(".day-add-btn");
        if (addBtn) {
          e.stopPropagation();
          const dateStr = addBtn.getAttribute("data-adddate");
          if (typeof app().openCustomEventModal === "function") {
            app().openCustomEventModal(null, dateStr);
          }
          return;
        }

        const jumpWeekBtn = e.target.closest("[data-jump-week]");
        if (jumpWeekBtn) {
          const dt = jumpWeekBtn.getAttribute("data-jump-week");
          if (dt) {
            viewPrefs.weekStartDate = formatYMD(getMondayOfWeek(dt));
            saveViewPrefsCache();
            refreshCalendarImmediate();
          }
          return;
        }

        if (e.target.closest("[data-action='prev-week']")) {
          prevWeek();
          return;
        }
        if (e.target.closest("[data-action='next-week']")) {
          nextWeek();
          return;
        }

        const mobDayBtn = e.target.closest("[data-mobile-day]");
        if (mobDayBtn) {
          const dStr = mobDayBtn.getAttribute("data-mobile-day") || "";
          mobileSelectedDateStr = mobileSelectedDateStr === dStr ? "" : dStr;
          refreshCalendarImmediate();
          return;
        }

        if (e.target.closest("[data-action='clear-mobile-day']")) {
          mobileSelectedDateStr = "";
          refreshCalendarImmediate();
          return;
        }

        const dupBtn = e.target.closest(".cal-quick-duplicate-btn");
        if (dupBtn) {
          e.stopPropagation();
          const key = dupBtn.getAttribute("data-card-key");
          if (key) duplicateCard(key);
          return;
        }

        const teamsBtn = e.target.closest(".cal-quick-teams-btn");
        if (teamsBtn) {
          e.stopPropagation();
          const key = teamsBtn.getAttribute("data-card-key");
          if (key) openTeamsCitation(key);
          return;
        }

        const statusBtn = e.target.closest(".cal-quick-status-btn");
        if (statusBtn) {
          e.stopPropagation();
          const key = statusBtn.getAttribute("data-card-key");
          if (key) cycleCardStatus(key);
          return;
        }

        const assignBtn = e.target.closest(".cal-quick-assign-btn");
        if (assignBtn) {
          e.stopPropagation();
          const key = assignBtn.getAttribute("data-card-key");
          if (key) toggleAssignMe(key);
          return;
        }

        const cardEl = e.target.closest("[data-card-key]");
        if (cardEl) {
          e.stopPropagation();
          const tt = getEl("ganttTooltip", "tooltip");
          if (tt) tt.style.display = "none";
          const key = cardEl.getAttribute("data-card-key");
          if (key) openCardDetail(key);
        }
      });

      // Delegated hover & tooltip
      calContainer.addEventListener("mouseover", (e) => {
        const cardEl = e.target.closest("[data-card-key]");
        if (!cardEl || cardEl === activeHoverCard) return;
        activeHoverCard = cardEl;

        const evId = cardEl.getAttribute("data-evid");
        if (evId !== activeHoveredEvId) {
          if (activeHoveredEvId) {
            calContainer
              .querySelectorAll(`.calendar-event-card[data-evid="${activeHoveredEvId}"]`)
              .forEach((seg) => seg.classList.remove("is-range-hovered"));
          }
          activeHoveredEvId = evId;
          if (evId) {
            calContainer
              .querySelectorAll(`.calendar-event-card[data-evid="${evId}"]`)
              .forEach((seg) => seg.classList.add("is-range-hovered"));
          }
        }

        const tt = getEl("ganttTooltip", "tooltip");
        const key = cardEl.getAttribute("data-card-key");
        const desc = key ? resolveCardDescriptor(key) : null;
        if (tt && desc) {
          const stMeta = STATUS_META[desc.status] || STATUS_META.pendiente;
          tt.innerHTML = `
            <h4>${desc.kind === "custom" ? "📌 " : ""}${esc(desc.title)}</h4>
            <div class="tooltip-grid">
              <span class="lbl">Marca:</span><span><strong>${esc(desc.effectiveBrand)}</strong></span>
              <span class="lbl">Estado:</span><span>${stMeta.icon} ${stMeta.label}</span>
              ${desc.camp ? `<span class="lbl">Campaña:</span><span><strong>${esc(desc.camp.shortLabel)}</strong></span>` : ""}
              ${desc.area ? `<span class="lbl">Área:</span><span>${esc(desc.area)}</span>` : ""}
              <span class="lbl">Responsables:</span><span>${desc.owners.length > 0 ? esc(desc.owners.join(", ")) : "Sin asignar"}</span>
              <span class="lbl">Fecha:</span><span><strong>${formatHumanDate(desc.effectiveDateStr)}</strong>${desc.isOverriddenDate ? ` (Excel: ${formatShortDayMonth(desc.baseDateStr)})` : ""}</span>
            </div>
            <div style="margin-top:6px;font-size:10px;color:#93c5fd;font-weight:700">Clic para ver detalle, notas o citar en Teams</div>
          `;
          tt.style.display = "block";
          positionTooltip(tt, e);
        }
      });

      calContainer.addEventListener("mousemove", (e) => {
        if (!activeHoverCard) return;
        const tt = getEl("ganttTooltip", "tooltip");
        if (tt && tt.style.display === "block") positionTooltip(tt, e);
      });

      calContainer.addEventListener("mouseout", (e) => {
        if (!activeHoverCard) return;
        const related = e.relatedTarget;
        if (related && activeHoverCard.contains(related)) return;
        const nextCard = related && related.closest ? related.closest("[data-card-key]") : null;
        if (nextCard === activeHoverCard) return;

        activeHoverCard = null;
        if (!nextCard && activeHoveredEvId) {
          calContainer
            .querySelectorAll(`.calendar-event-card[data-evid="${activeHoveredEvId}"]`)
            .forEach((seg) => seg.classList.remove("is-range-hovered"));
          activeHoveredEvId = null;
        }
        const tt = getEl("ganttTooltip", "tooltip");
        if (tt) tt.style.display = "none";
      });

      // Helper para resolver la celda destino [data-date] en Mes (incluso sobre carriles multi-día), Semana y Agenda
      function resolveDropTargetElement(e) {
        const directDateEl = e.target.closest("[data-date]");
        if (directDateEl) return directDateEl;

        const customAgendaZone = e.target.closest("#agendaCustomDateDropZone");
        if (customAgendaZone) return customAgendaZone;

        const weekBlock = e.target.closest(".cal-v3-week-block");
        if (weekBlock) {
          const cells = weekBlock.querySelectorAll(".cal-v3-day-cell[data-date]");
          if (cells.length === 7) {
            const rect = weekBlock.getBoundingClientRect();
            const relX = Math.max(0, Math.min(rect.width - 1, e.clientX - rect.left));
            const colIdx = Math.min(6, Math.max(0, Math.floor((relX / rect.width) * 7)));
            return cells[colIdx];
          }
        }
        return null;
      }

      // Universal Drag & Drop para TODO el equipo (Mes, Semana y Agenda)
      calContainer.addEventListener("dragstart", (e) => {
        if (e.target.closest("button, input, select, a")) {
          e.preventDefault();
          return;
        }
        const cardEl = e.target.closest("[data-card-key]");
        if (!cardEl) {
          e.preventDefault();
          return;
        }
        const key = cardEl.getAttribute("data-card-key");
        if (!key) {
          e.preventDefault();
          return;
        }
        draggedCardKey = key;
        cardEl.classList.add("is-dragging");
        document.body.classList.add("dragging-active-card");
        const tt = getEl("ganttTooltip", "tooltip");
        if (tt) tt.style.display = "none";
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", key);
        }
      });

      calContainer.addEventListener("dragend", (e) => {
        const cardEl = e.target.closest("[data-card-key]");
        if (cardEl) cardEl.classList.remove("is-dragging");
        document.body.classList.remove("dragging-active-card");
        if (activeDropCell) {
          activeDropCell.classList.remove("is-drop-target");
          activeDropCell = null;
        }
        draggedCardKey = null;
      });

      calContainer.addEventListener("dragover", (e) => {
        if (!draggedCardKey) return;
        const cell = resolveDropTargetElement(e);
        if (!cell) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        if (activeDropCell && activeDropCell !== cell) {
          activeDropCell.classList.remove("is-drop-target");
        }
        activeDropCell = cell;
        cell.classList.add("is-drop-target");
      });

      calContainer.addEventListener("dragleave", (e) => {
        const cell = resolveDropTargetElement(e);
        if (!cell) return;
        if (e.relatedTarget && cell.contains(e.relatedTarget)) return;
        cell.classList.remove("is-drop-target");
        if (activeDropCell === cell) activeDropCell = null;
      });

      calContainer.addEventListener("drop", (e) => {
        const cell = resolveDropTargetElement(e);
        if (!cell) return;
        e.preventDefault();
        cell.classList.remove("is-drop-target");
        document.body.classList.remove("dragging-active-card");
        activeDropCell = null;

        let targetDate = cell.getAttribute("data-date");
        if (!targetDate && cell.id === "agendaCustomDateDropZone") {
          const inp = document.getElementById("agendaDropDateInput");
          targetDate = inp ? inp.value : "";
        }
        const key = draggedCardKey || e.dataTransfer?.getData("text/plain");
        draggedCardKey = null;
        if (key && targetDate) {
          moveCardToDate(key, targetDate);
        }
      });
    }

    // 2. Dynamic Brand Pills Container (delegated)
    const brandPillsWrap = getEl("brandPillsContainer");
    if (brandPillsWrap && !brandPillsWrap.dataset.v2Bound) {
      brandPillsWrap.dataset.v2Bound = "1";
      brandPillsWrap.addEventListener("click", (e) => {
        const mgrBtn = e.target.closest("[data-action='open-brands-manager']");
        if (mgrBtn) {
          openBrandsManagerModal();
          return;
        }
        const pill = e.target.closest(".brand-pill[data-brand]");
        if (!pill) return;
        const chosenRaw = pill.getAttribute("data-brand") || "ALL";
        const chosenNorm = normalizeBrandName(chosenRaw);
        const st = getStateSafe();
        if (!(st.selectedBrands instanceof Set)) {
          st.selectedBrands = new Set(st.brand && st.brand !== "ALL" ? [normalizeBrandName(st.brand)] : []);
        }

        if (chosenNorm === "ALL") {
          st.selectedBrands.clear();
        } else if (st.selectedBrands.has(chosenNorm)) {
          st.selectedBrands.delete(chosenNorm);
        } else {
          st.selectedBrands.add(chosenNorm);
        }
        st.brand = st.selectedBrands.size === 1 ? Array.from(st.selectedBrands)[0] : "ALL";

        renderBrandControls(true);
        if (typeof app().populateFilterControls === "function") app().populateFilterControls();
        if (typeof app().scheduleSavePreferences === "function") app().scheduleSavePreferences();
        if (typeof app().renderAll === "function") app().renderAll();
      });
    }

    // Optional external Open Brands Manager button
    const btnOpenBrands = document.getElementById("btnOpenBrandsManager");
    if (btnOpenBrands && !btnOpenBrands.dataset.v2Bound) {
      btnOpenBrands.dataset.v2Bound = "1";
      btnOpenBrands.addEventListener("click", openBrandsManagerModal);
    }

    // 3. Brands Manager Modal (delegated)
    const brandsModal = getEl("brandsManagerModal");
    if (brandsModal && !brandsModal.dataset.v2Bound) {
      brandsModal.dataset.v2Bound = "1";
      brandsModal.addEventListener("click", (e) => {
        if (e.target === brandsModal || e.target.closest("[data-action='close-brands-modal']")) {
          closeBrandsManagerModal();
          return;
        }
        const saveBtn = e.target.closest(".brand-mgr-save-btn");
        if (saveBtn) {
          const row = saveBtn.closest(".brand-mgr-row");
          if (!row) return;
          const id = row.getAttribute("data-brand-id");
          upsertBrandOptimistic({
            id,
            name: row.querySelector(".brand-mgr-name")?.value,
            color: row.querySelector(".brand-mgr-color")?.value,
            sort_order: row.querySelector(".brand-mgr-order")?.value,
            is_shared: row.querySelector(".brand-mgr-shared")?.checked,
            active: row.querySelector(".brand-mgr-active")?.checked,
          });
        }
      });

      brandsModal.addEventListener("submit", (e) => {
        if (e.target && e.target.id === "brandCreateForm") {
          e.preventDefault();
          const nameInp = brandsModal.querySelector("#newBrandNameInput");
          const colorInp = brandsModal.querySelector("#newBrandColorInput");
          const sharedInp = brandsModal.querySelector("#newBrandSharedInput");
          const nameVal = (nameInp?.value || "").trim();
          if (!nameVal) return;
          upsertBrandOptimistic({
            id: nameVal,
            name: nameVal,
            color: colorInp?.value || pickHarmonicColor(nameVal),
            sort_order: 100 + brandsMap.size * 5,
            is_shared: Boolean(sharedInp?.checked),
            active: true,
          });
        }
      });
    }

    // 4. Calendar Subview & Quick Filters
    const subviewSeg = getEl("calSubviewSegmented");
    if (subviewSeg && !subviewSeg.dataset.v2Bound) {
      subviewSeg.dataset.v2Bound = "1";
      subviewSeg.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-subview]");
        if (!btn) return;
        setSubview(btn.getAttribute("data-subview"));
      });
    }

    const onlyMineBtn = getEl("btnCalOnlyMine");
    if (onlyMineBtn && !onlyMineBtn.dataset.v2Bound) {
      onlyMineBtn.dataset.v2Bound = "1";
      onlyMineBtn.addEventListener("click", () => {
        viewPrefs.onlyMine = !viewPrefs.onlyMine;
        saveViewPrefsCache();
        syncViewFilterControlsUI();
        refreshCalendarImmediate();
      });
    }

    const statusFilter = getEl("calStatusFilter");
    if (statusFilter && !statusFilter.dataset.v2Bound) {
      statusFilter.dataset.v2Bound = "1";
      statusFilter.addEventListener("change", (e) => {
        viewPrefs.statusFilter = e.target.value || "";
        saveViewPrefsCache();
        refreshCalendarImmediate();
      });
    }

    // 5. Card Detail Drawer & Backdrop (delegated)
    const drawerBackdrop = getEl("cardDetailBackdrop");
    if (drawerBackdrop && !drawerBackdrop.dataset.v2Bound) {
      drawerBackdrop.dataset.v2Bound = "1";
      drawerBackdrop.addEventListener("click", (e) => {
        if (e.target === drawerBackdrop) closeCardDetail();
      });
    }

    const drawer = getEl("cardDetailDrawer");
    if (drawer && !drawer.dataset.v2Bound) {
      drawer.dataset.v2Bound = "1";

      drawer.addEventListener("click", (e) => {
        if (!activeDrawerCardKey) return;
        const cardKey = activeDrawerCardKey;

        if (e.target.closest("[data-action='close-drawer']")) {
          closeCardDetail();
          return;
        }
        if (e.target.closest("[data-action='duplicate-card']")) {
          duplicateCard(cardKey);
          return;
        }
        if (e.target.closest("#btnDrawerAssignMe") || e.target.closest("[data-action='toggle-assign-me']")) {
          toggleAssignMe(cardKey);
          return;
        }
        if (e.target.closest("#btnDrawerTeamsCite")) {
          openTeamsCitation(cardKey);
          return;
        }
        if (e.target.closest("#btnDrawerTeamsChat")) {
          openTeamsChat(cardKey);
          return;
        }
        if (e.target.closest("#btnDrawerCardIcs")) {
          downloadSingleCardIcs(cardKey);
          return;
        }
        if (e.target.closest("[data-action='use-brand-color']")) {
          upsertCardRecordOptimistic(cardKey, { custom_color: null });
          return;
        }
        if (e.target.closest("[data-action='restore-brand']")) {
          upsertCardRecordOptimistic(cardKey, { brand_override: null });
          return;
        }
        if (e.target.closest("[data-action='restore-excel-date']")) {
          const desc = resolveCardDescriptor(cardKey);
          if (desc && desc.baseDateStr) moveCardToDate(cardKey, desc.baseDateStr);
          return;
        }
        if (e.target.closest("[data-action='open-legacy-custom-modal']")) {
          const desc = resolveCardDescriptor(cardKey);
          closeCardDetail();
          if (desc && desc.cev && typeof app().openCustomEventModal === "function") {
            app().openCustomEventModal(desc.cev);
          }
          return;
        }

        const statusBtn = e.target.closest("[data-drawer-status]");
        if (statusBtn) {
          setCardStatus(cardKey, statusBtn.getAttribute("data-drawer-status"));
          return;
        }

        const ownerBtn = e.target.closest("[data-drawer-owner]");
        if (ownerBtn) {
          const uid = ownerBtn.getAttribute("data-drawer-owner");
          const desc = resolveCardDescriptor(cardKey);
          if (!desc || !uid) return;
          const next = new Set(desc.owners);
          if (next.has(uid)) next.delete(uid);
          else next.add(uid);
          updateCardOwners(cardKey, Array.from(next));
          return;
        }

        const colorBtn = e.target.closest("[data-drawer-color]");
        if (colorBtn) {
          const hex = colorBtn.getAttribute("data-drawer-color");
          upsertCardRecordOptimistic(cardKey, { custom_color: hex });
        }
      });

      drawer.addEventListener("change", (e) => {
        if (!activeDrawerCardKey) return;
        const cardKey = activeDrawerCardKey;
        if (e.target && e.target.id === "drawerBrandSelect") {
          const chosen = normalizeBrandName(e.target.value);
          const desc = resolveCardDescriptor(cardKey);
          const overrideVal = desc && chosen === desc.defaultBrand && desc.kind === "official" ? null : chosen;
          upsertCardRecordOptimistic(cardKey, { brand_override: overrideVal });
          return;
        }
        if (e.target && e.target.id === "drawerAreaInput") {
          const newArea = (e.target.value || "").trim() || "General";
          const desc = resolveCardDescriptor(cardKey);
          if (desc && desc.kind === "custom" && desc.cev) {
            desc.cev.area = newArea;
            writeJsonStorage("AZZORTI_CUSTOM_EVENTS_CACHE_V2", getCustomEventsSafe());
            if (typeof app().saveAreaForBrand === "function") {
              app().saveAreaForBrand(desc.effectiveBrand, newArea);
            }
            refreshCalendarImmediate();
            const sb = getSb();
            if (sb) {
              sb.from("custom_events")
                .update({ area: newArea })
                .eq("id", desc.cev.id)
                .then(({ error }) => {
                  if (error) console.warn("[CalendarV2] Sync custom_events.area:", error.message || error);
                })
                .catch(() => {});
            }
            showToast(`🏢 Área actualizada: ${newArea}`, "info");
          }
          return;
        }
        if (e.target && e.target.id === "drawerDateInput") {
          const newDate = e.target.value;
          if (newDate) moveCardToDate(cardKey, newDate);
        }
      });

      drawer.addEventListener("submit", (e) => {
        if (!activeDrawerCardKey) return;
        if (e.target && e.target.id === "drawerNoteForm") {
          e.preventDefault();
          const inp = drawer.querySelector("#drawerNoteInput");
          if (!inp) return;
          const val = inp.value.trim();
          if (!val) return;
          inp.value = "";
          addNoteToCard(activeDrawerCardKey, val);
        }
      });
    }

    // 6. Notifications Bell & Dropdown (delegated)
    const bellWrap = getEl("notifBellWrap");
    const btnBell = getEl("btnNotifBell");
    const notifPanel = getEl("notifDropdownPanel");
    if (btnBell && !btnBell.dataset.v2Bound) {
      btnBell.dataset.v2Bound = "1";
      btnBell.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!notifPanel) return;
        const isOpen = notifPanel.style.display === "block" || notifPanel.classList.contains("open");
        if (isOpen) {
          notifPanel.style.display = "none";
          notifPanel.classList.remove("open");
        } else {
          renderNotificationCenter();
          updatePushUiStatus();
          notifPanel.style.display = "block";
          notifPanel.classList.add("open");
        }
      });
    }

    if (notifPanel && !notifPanel.dataset.v2Bound) {
      notifPanel.dataset.v2Bound = "1";
      notifPanel.addEventListener("click", (e) => {
        e.stopPropagation();
        if (e.target.closest("#btnEnablePush")) {
          enablePushNotifications();
          return;
        }
        if (e.target.closest("[data-action='mark-all-notifs-read']")) {
          markAllNotificationsRead();
          return;
        }
        const item = e.target.closest(".cal-notif-item");
        if (item) {
          const nid = item.getAttribute("data-notif-id");
          const did = item.getAttribute("data-dismiss-id");
          const cKey = item.getAttribute("data-card-key");
          markNotificationRead(nid, did);
          notifPanel.style.display = "none";
          notifPanel.classList.remove("open");
          if (cKey) openCardFromExternalTrigger(cKey);
        }
      });
    }

    // 7. Global single document handlers (Outside clicks + Escape)
    if (!document.body.dataset.calV2GlobalBound) {
      document.body.dataset.calV2GlobalBound = "1";
      document.addEventListener("click", (e) => {
        if (notifPanel && bellWrap && !bellWrap.contains(e.target)) {
          notifPanel.style.display = "none";
          notifPanel.classList.remove("open");
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          closeCardDetail();
          closeBrandsManagerModal();
          if (notifPanel) {
            notifPanel.style.display = "none";
            notifPanel.classList.remove("open");
          }
        }
      });
    }
  }

  function positionTooltip(tt, e) {
    const pad = 14;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    const rect = tt.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 10) x = e.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 10) y = e.clientY - rect.height - pad;
    tt.style.left = `${Math.max(8, x)}px`;
    tt.style.top = `${Math.max(8, y)}px`;
  }

  /* ==========================================================================
     15. INITIALIZATION & LIFECYCLE
     ========================================================================== */
  function readCardQueryParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      const card = params.get("card");
      if (card) pendingCardKeyFromUrl = card;
    } catch (_) {}
  }

  function ensureInitialized() {
    if (initialized) return;
    initialized = true;
    loadCaches();
    readCardQueryParam();
    bindSingleDelegatedEvents();
    renderBrandControls();
    syncViewFilterControlsUI();
    renderNotificationCenter();
    registerServiceWorker();
  }

  function init() {
    ensureInitialized();
    bindSingleDelegatedEvents();
    try {
      const mq = window.matchMedia("(max-width: 767px)");
      if (mq && typeof mq.addEventListener === "function") {
        mq.addEventListener("change", () => refreshCalendarImmediate());
      }
    } catch (_) {}
    syncBrandsFromData(getRaw(), getCustomEventsSafe());
    if (getSb()) {
      hasSyncedCloud = true;
      syncFromSupabase();
    }
  }

  function onLogin() {
    ensureInitialized();
    bindSingleDelegatedEvents();
    syncBrandsFromData(getRaw(), getCustomEventsSafe());
    renderBrandControls(true);
    renderNotificationCenter();
    updatePushUiStatus();
    if (getSb()) {
      hasSyncedCloud = true;
      syncFromSupabase();
    }

    if (pendingCardKeyFromUrl) {
      const key = pendingCardKeyFromUrl;
      pendingCardKeyFromUrl = null;
      setTimeout(() => openCardFromExternalTrigger(key), 120);
    }
  }

  /* ==========================================================================
     16. PUBLIC API (window.CalendarV2)
     ========================================================================== */
  window.CalendarV2 = {
    init,
    onLogin,
    syncFromSupabase,
    renderCalendar,
    prevWeek,
    nextWeek,
    onPrevClick,
    onNextClick,
    goToToday,
    setSubview,
    getSubview: () => viewPrefs.subview,
    openCardDetail,
    closeCardDetail,
    duplicateCard,
    resetQuickViewFilters,
    getCardState,
    getEffectiveDate,
    openTeamsCitation,
    openTeamsChat,
    downloadSingleCardIcs,
    refreshNotifications: renderNotificationCenter,
    enablePushNotifications,
    showToast,

    // BrandsRegistry API
    getBrands,
    normalizeBrandName,
    getBrandMeta,
    getBrandStyleVars,
    matchesBrandFilter,
    countOfficialCardsForOwner,
    activityMatchesOwners,
    syncBrandsFromData,
    renderBrandControls,
    openBrandsManagerModal,
    closeBrandsManagerModal,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
