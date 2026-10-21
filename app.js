(function () {
  "use strict";

  const STORAGE_KEY = "AZZORTI_LIVVA_CUSTOM_CRONOGRAMA_V1";
  const TODAY_STR = "2026-10-21";

  // State
  let rawData = null;
  let state = {
    include2026: false, // Por defecto inicia en C1-4 2027 (ADV 202701 / NAL 202704)
    selectedCampaignIds: new Set(["ADV_202708_NAL_202711", "ADV_202709_NAL_202712", "ADV_202710_NAL_202713"]), // C8-11, C9-12, C10-13 seleccionadas por defecto
    ganttMultiCampaignMode: false,
    brand: "ALL", // ALL, Livva, Azzorti, Azz Livv
    includeSharedBrand: true,
    selectedProcesos: new Set(),
    selectedAreas: new Set(),
    selectedActivityNos: new Set(), // Checkboxes de actividades seleccionadas manualmente
    searchQuery: "",
    viewMode: "gantt", // "gantt" | "calendar" | "matrix"
    groupByProceso: true,
    collapsedGroups: new Set(),
    sortBy: "date", // "date" | "no" | "proceso"
    zoom: "week", // "day" | "week" | "month"
    calCurrentMonthIndex: 0,
    calShowAllMonths: true,
  };

  // DOM Elements
  const els = {};

  function initDomRefs() {
    els.fileInput = document.getElementById("excelFileInput");
    els.btnUpload = document.getElementById("btnUploadExcel");
    els.btnResetData = document.getElementById("btnResetData");
    els.btnExportPdfGantt = document.getElementById("btnExportPdfGantt");
    els.btnExportPdfCalendar = document.getElementById("btnExportPdfCalendar");
    els.btnExportIcs = document.getElementById("btnExportIcs");
    els.btnExportCsv = document.getElementById("btnExportCsv");
    els.statusBadge = document.getElementById("dataStatusBadge");
    els.campaignBtn = document.getElementById("campaignDropdownBtn");
    els.campaignDropdown = document.getElementById("campaignDropdown");
    els.campaignSearch = document.getElementById("campaignSearchInput");
    els.campaignList = document.getElementById("campaignOptionsList");
    els.campaignSelectAll = document.getElementById("campaignSelectAll");
    els.campaignSelect2027 = document.getElementById("campaignSelect2027");
    els.campaignSelect2028 = document.getElementById("campaignSelect2028");
    els.campaignClearAll = document.getElementById("campaignClearAll");
    els.chkInclude2026 = document.getElementById("chkInclude2026");
    els.chkMultiCampGantt = document.getElementById("chkMultiCampGantt");
    els.brandPills = document.querySelectorAll(".brand-pill");
    els.chkSharedBrand = document.getElementById("chkSharedBrand");
    els.sharedBrandWrap = document.getElementById("sharedBrandWrap");
    els.procesoBtn = document.getElementById("procesoDropdownBtn");
    els.procesoDropdown = document.getElementById("procesoDropdown");
    els.procesoSearch = document.getElementById("procesoSearchInput");
    els.procesoList = document.getElementById("procesoOptionsList");
    els.areaBtn = document.getElementById("areaDropdownBtn");
    els.areaDropdown = document.getElementById("areaDropdown");
    els.areaSearch = document.getElementById("areaSearchInput");
    els.areaList = document.getElementById("areaOptionsList");
    els.searchInput = document.getElementById("activitySearchInput");
    els.btnResetFilters = document.getElementById("btnResetFilters");
    els.btnQuickEstampacion = document.getElementById("btnQuickEstampacion");

    els.tabGantt = document.getElementById("tabGantt");
    els.tabCalendar = document.getElementById("tabCalendar");
    els.tabMatrix = document.getElementById("tabMatrix");

    els.chkGroupProceso = document.getElementById("chkGroupProceso");
    els.btnExpandAll = document.getElementById("btnExpandAll");
    els.btnCollapseAll = document.getElementById("btnCollapseAll");
    els.sortSelect = document.getElementById("sortSelect");
    els.zoomSelect = document.getElementById("zoomSelect");
    els.btnCenterGantt = document.getElementById("btnCenterGantt");

    // Selection toolbar
    els.selectionToolbar = document.getElementById("selectionToolbar");
    els.selectionCountBadge = document.getElementById("selectionCountBadge");
    els.chkMasterSelect = document.getElementById("chkMasterSelect");
    els.selectionText = document.getElementById("selectionText");
    els.btnClearSelection = document.getElementById("btnClearSelection");
    els.chkSelectAllGantt = document.getElementById("chkSelectAllGantt");

    // Calendar toolbar options
    els.ganttToolbarOptions = document.getElementById("ganttToolbarOptions");
    els.calendarToolbarOptions = document.getElementById("calendarToolbarOptions");
    els.btnCalPrevMonth = document.getElementById("btnCalPrevMonth");
    els.btnCalNextMonth = document.getElementById("btnCalNextMonth");
    els.calCurrentMonthLabel = document.getElementById("calCurrentMonthLabel");
    els.chkCalShowAllMonths = document.getElementById("chkCalShowAllMonths");

    els.kpiActivities = document.getElementById("kpiActivities");
    els.kpiProcesses = document.getElementById("kpiProcesses");
    els.kpiDateRange = document.getElementById("kpiDateRange");

    els.ganttWrapper = document.getElementById("ganttWrapper");
    els.ganttLeftBody = document.getElementById("ganttLeftBody");
    els.ganttTimelineHeader = document.getElementById("ganttTimelineHeader");
    els.ganttTimelineBody = document.getElementById("ganttTimelineBody");

    els.calendarWrapper = document.getElementById("calendarWrapper");
    els.calendarContainer = document.getElementById("calendarContainer");

    els.matrixWrapper = document.getElementById("matrixWrapper");
    els.matrixTableHead = document.getElementById("matrixTableHead");
    els.matrixTableBody = document.getElementById("matrixTableBody");

    els.tooltip = document.getElementById("ganttTooltip");
    els.dropzoneOverlay = document.getElementById("dropzoneOverlay");
  }

  // Date helpers
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
    if (days <= 1) {
      return new Date(endDt.getTime());
    }
    let cur = new Date(endDt.getTime());
    let remaining = days - 1;
    while (remaining > 0) {
      cur.setDate(cur.getDate() - 1);
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) {
        remaining--;
      }
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

  // Normalization helpers for uploaded Excel/CSV files
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
    if (val instanceof Date && !isNaN(val.getTime())) {
      return formatYMD(val);
    }
    const s = String(val).trim();
    if (!s || s.toLowerCase() === "nan") return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const parts = s.split("/");
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      const yr = parts[2];
      if (p0 > 12) {
        return `${yr}-${String(p1).padStart(2, "0")}-${String(p0).padStart(2, "0")}`;
      }
      return `${yr}-${String(p0).padStart(2, "0")}-${String(p1).padStart(2, "0")}`;
    }
    const num = Number(s);
    if (!isNaN(num) && num >= 30000 && num <= 75000) {
      return excelSerialToYMD(num);
    }
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
      throw new Error("No se encontraron columnas de campañas (ADV / NAL) a partir de la columna G.");
    }

    const activities = [];
    for (let r = 3; r < grid.length; r++) {
      const row = grid[r];
      if (!row || row.length === 0) continue;
      const rawNo = row[0];
      const rawAct = row[1];
      if ((rawNo === null || rawNo === undefined || String(rawNo).trim() === "") && !rawAct) {
        continue;
      }
      const noVal = parseInt(String(rawNo || r).trim(), 10) || r;
      const actName = String(rawAct || "").trim().replace(/\s+/g, " ");
      if (!actName) continue;
      const proceso = normProceso(row[2]);
      const marca = normMarca(row[3]);
      const area = normArea(row[4]);
      const diasBase = parseInt(String(row[5] ?? "0").trim(), 10) || 0;

      const dhMap = {};
      const fechasMap = {};
      for (const camp of campaigns) {
        const c = camp.colIndex;
        const rawDh = row[c];
        const dhVal = rawDh !== undefined && rawDh !== null && String(rawDh).trim() !== ""
          ? (parseInt(String(rawDh).trim(), 10) || 0)
          : diasBase;
        const fechaVal = normalizeDateCell(row[c + 1]);
        dhMap[camp.id] = dhVal;
        fechasMap[camp.id] = fechaVal;
      }

      activities.push({
        no: noVal,
        actividad: actName,
        proceso,
        marca,
        area,
        dias: diasBase,
        dh: dhMap,
        fechas: fechasMap,
      });
    }

    return {
      title: String(r1[0] || "CRONOGRAMA AZZORTI LIVVA").trim(),
      updatedAt: normalizeDateCell(r1[2]) || formatYMD(new Date()),
      sourceFileName: fileName || "Archivo subido",
      campaigns,
      activities,
    };
  }

  function parseCSVText(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          row.push(cur);
          cur = "";
        } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
          if (ch === "\r") i++;
          row.push(cur);
          rows.push(row);
          row = [];
          cur = "";
        } else if (ch === "\r") {
          row.push(cur);
          rows.push(row);
          row = [];
          cur = "";
        } else {
          cur += ch;
        }
      }
    }
    if (cur.length > 0 || row.length > 0) {
      row.push(cur);
      rows.push(row);
    }
    return rows;
  }

  async function parseXlsxBufferNative(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    let eocdOffset = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) throw new Error("Archivo .xlsx inválido (no es un archivo ZIP).");

    const cdEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    let ptr = cdOffset;
    const files = {};
    const decoder = new TextDecoder("utf-8");

    for (let e = 0; e < cdEntries; e++) {
      if (view.getUint32(ptr, true) !== 0x02014b50) break;
      const compression = view.getUint16(ptr + 10, true);
      const compSize = view.getUint32(ptr + 20, true);
      const nameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localHdrOffset = view.getUint32(ptr + 42, true);
      const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
      files[name] = { compression, compSize, localHdrOffset };
      ptr += 46 + nameLen + extraLen + commentLen;
    }

    async function extractXmlText(entryName) {
      const info = files[entryName];
      if (!info) return null;
      const lPtr = info.localHdrOffset;
      const lNameLen = view.getUint16(lPtr + 26, true);
      const lExtraLen = view.getUint16(lPtr + 28, true);
      const dataStart = lPtr + 30 + lNameLen + lExtraLen;
      const compData = bytes.subarray(dataStart, dataStart + info.compSize);
      if (info.compression === 0) {
        return decoder.decode(compData);
      } else if (info.compression === 8) {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        writer.write(compData);
        writer.close();
        const resp = new Response(ds.readable);
        const ab = await resp.arrayBuffer();
        return decoder.decode(new Uint8Array(ab));
      }
      throw new Error("Compresión ZIP no soportada: " + info.compression);
    }

    const sharedStrings = [];
    const ssXml = await extractXmlText("xl/sharedStrings.xml");
    const domParser = new DOMParser();
    if (ssXml) {
      const doc = domParser.parseFromString(ssXml, "application/xml");
      const siNodes = doc.getElementsByTagName("si");
      for (let i = 0; i < siNodes.length; i++) {
        const tNodes = siNodes[i].getElementsByTagName("t");
        let combined = "";
        for (let j = 0; j < tNodes.length; j++) {
          combined += tNodes[j].textContent || "";
        }
        sharedStrings.push(combined);
      }
    }

    const sheetKey = Object.keys(files).find((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)) || "xl/worksheets/sheet1.xml";
    const sheetXml = await extractXmlText(sheetKey);
    if (!sheetXml) throw new Error("No se encontró la hoja en el archivo .xlsx");

    const sheetDoc = domParser.parseFromString(sheetXml, "application/xml");
    const rowNodes = sheetDoc.getElementsByTagName("row");
    const grid = [];

    function colStrToIdx(colStr) {
      let idx = 0;
      for (let i = 0; i < colStr.length; i++) {
        idx = idx * 26 + (colStr.charCodeAt(i) - 64);
      }
      return idx - 1;
    }

    for (let i = 0; i < rowNodes.length; i++) {
      const rNode = rowNodes[i];
      const rIdx = (parseInt(rNode.getAttribute("r"), 10) || (i + 1)) - 1;
      const cNodes = rNode.getElementsByTagName("c");
      const rowArr = [];
      for (let j = 0; j < cNodes.length; j++) {
        const cNode = cNodes[j];
        const ref = cNode.getAttribute("r") || "";
        const m = ref.match(/^([A-Z]+)/);
        const cIdx = m ? colStrToIdx(m[1]) : j;
        const cType = cNode.getAttribute("t") || "";
        const vNodes = cNode.getElementsByTagName("v");
        let val = null;
        if (vNodes.length > 0 && vNodes[0].textContent !== null) {
          const rawText = vNodes[0].textContent;
          if (cType === "s") {
            val = sharedStrings[parseInt(rawText, 10)] ?? rawText;
          } else if (cType === "e") {
            val = null;
          } else {
            val = rawText;
          }
        } else if (cType === "inlineStr") {
          const tNodes = cNode.getElementsByTagName("t");
          val = tNodes.length > 0 ? tNodes[0].textContent : null;
        }
        rowArr[cIdx] = val;
      }
      grid[rIdx] = rowArr;
    }
    return grid;
  }

  async function handleFileUpload(file) {
    if (!file) return;
    try {
      const name = file.name.toLowerCase();
      let grid = null;
      if (name.endsWith(".csv")) {
        const text = await file.text();
        grid = parseCSVText(text);
      } else {
        const ab = await file.arrayBuffer();
        if (window.XLSX && typeof window.XLSX.read === "function") {
          const wb = window.XLSX.read(ab, { type: "array" });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          grid = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true, defval: null });
        } else {
          grid = await parseXlsxBufferNative(ab);
        }
      }

      const parsed = parseGridToCronograma(grid, file.name);
      rawData = parsed;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch (storageErr) {
        console.warn("No se pudo guardar en localStorage:", storageErr);
      }
      els.btnResetData.style.display = "inline-flex";
      els.statusBadge.textContent = `📂 Archivo activo: ${file.name} (${parsed.activities.length} act.)`;
      els.statusBadge.style.background = "rgba(16, 185, 129, 0.25)";
      els.statusBadge.style.color = "#6ee7b7";

      state.selectedActivityNos.clear();
      populateFilterControls(true);
      renderAll();
    } catch (err) {
      alert("Error al leer el archivo: " + err.message);
      console.error(err);
    }
  }

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
        if (input.checked) {
          state.selectedCampaignIds.add(c.id);
        } else {
          state.selectedCampaignIds.delete(c.id);
        }
        updateCampaignButtonLabel();
        state.calCurrentMonthIndex = 0;
        renderAll();
      });

      els.campaignList.appendChild(div);
    }
  }

  function populateFilterControls(preserveSelection) {
    const camps = getActiveCampaigns();
    const validIds = new Set(camps.map((c) => c.id));
    const matchingCount = Array.from(state.selectedCampaignIds).filter((id) => validIds.has(id)).length;

    if (matchingCount === 0 && camps.length > 0) {
      const defaultIds = ["ADV_202708_NAL_202711", "ADV_202709_NAL_202712", "ADV_202710_NAL_202713"];
      const foundDefaults = defaultIds.filter((id) => validIds.has(id));
      if (foundDefaults.length > 0) {
        state.selectedCampaignIds = new Set(foundDefaults);
      } else {
        state.selectedCampaignIds = new Set(camps.slice(0, 3).map((c) => c.id));
      }
    }

    updateCampaignButtonLabel();
    renderCampaignSelectList();

    const procesoCounts = new Map();
    const areaCounts = new Map();
    for (const act of rawData.activities) {
      procesoCounts.set(act.proceso, (procesoCounts.get(act.proceso) || 0) + 1);
      areaCounts.set(act.area, (areaCounts.get(act.area) || 0) + 1);
    }

    const sortedProcesos = Array.from(procesoCounts.keys()).sort((a, b) => a.localeCompare(b, "es"));
    const sortedAreas = Array.from(areaCounts.keys()).sort((a, b) => a.localeCompare(b, "es"));

    if (!preserveSelection || state.selectedProcesos.size === 0) {
      state.selectedProcesos = new Set(sortedProcesos);
    }
    if (!preserveSelection || state.selectedAreas.size === 0) {
      state.selectedAreas = new Set(sortedAreas);
    }

    renderMultiSelectList(
      els.procesoList,
      sortedProcesos,
      procesoCounts,
      state.selectedProcesos,
      els.procesoSearch.value,
      "proceso"
    );
    renderMultiSelectList(
      els.areaList,
      sortedAreas,
      areaCounts,
      state.selectedAreas,
      els.areaSearch.value,
      "area"
    );
    updateMultiSelectButtonLabels(sortedProcesos.length, sortedAreas.length);
  }

  function renderMultiSelectList(container, items, countsMap, selectedSet, searchText, type) {
    container.innerHTML = "";
    const q = (searchText || "").trim().toLowerCase();
    for (const item of items) {
      if (q && !item.toLowerCase().includes(q)) continue;
      const div = document.createElement("div");
      div.className = "multi-option-item";
      const id = `chk-${type}-${item.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const checked = selectedSet.has(item) ? "checked" : "";
      div.innerHTML = `
        <label for="${id}">
          <input type="checkbox" id="${id}" data-val="${item}" ${checked} />
          <span>${item}</span>
        </label>
        <span class="multi-option-count">${countsMap.get(item) || 0}</span>
      `;
      const input = div.querySelector("input");
      input.addEventListener("change", () => {
        if (input.checked) selectedSet.add(item);
        else selectedSet.delete(item);
        updateMultiSelectButtonLabels();
        renderAll();
      });
      container.appendChild(div);
    }
  }

  function updateMultiSelectButtonLabels() {
    const totalProcesos = new Set(rawData.activities.map((a) => a.proceso)).size;
    const totalAreas = new Set(rawData.activities.map((a) => a.area)).size;

    const pSpan = els.procesoBtn.querySelector(".btn-text");
    if (state.selectedProcesos.size === totalProcesos) {
      pSpan.textContent = `Todos los procesos (${totalProcesos})`;
    } else if (state.selectedProcesos.size === 0) {
      pSpan.textContent = "Ningún proceso (0)";
    } else if (state.selectedProcesos.size === 1) {
      pSpan.textContent = Array.from(state.selectedProcesos)[0];
    } else {
      pSpan.textContent = `${state.selectedProcesos.size} de ${totalProcesos} procesos`;
    }

    const aSpan = els.areaBtn.querySelector(".btn-text");
    if (state.selectedAreas.size === totalAreas) {
      aSpan.textContent = `Todas las áreas (${totalAreas})`;
    } else if (state.selectedAreas.size === 0) {
      aSpan.textContent = "Ninguna área (0)";
    } else if (state.selectedAreas.size === 1) {
      aSpan.textContent = Array.from(state.selectedAreas)[0];
    } else {
      aSpan.textContent = `${state.selectedAreas.size} de ${totalAreas} áreas`;
    }
  }

  function getFilteredActivities() {
    if (!rawData) return [];
    const q = state.searchQuery.trim().toLowerCase();
    return rawData.activities.filter((act) => {
      if (state.brand !== "ALL") {
        if (state.brand === "Azz Livv") {
          if (act.marca !== "Azz Livv") return false;
        } else {
          if (act.marca !== state.brand) {
            if (!(state.includeSharedBrand && act.marca === "Azz Livv")) {
              return false;
            }
          }
        }
      }
      if (!state.selectedProcesos.has(act.proceso)) return false;
      if (!state.selectedAreas.has(act.area)) return false;
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

  // Returns activities respecting explicit checkbox selection (if any selected, otherwise all filtered)
  function getEffectiveSelectedActivities(filtered) {
    if (state.selectedActivityNos.size > 0) {
      return filtered.filter((a) => state.selectedActivityNos.has(a.no));
    }
    return filtered;
  }

  function badgeClassForBrand(marca) {
    if (marca === "Livva") return "Livva";
    if (marca === "Azzorti") return "Azzorti";
    return "AzzLivv";
  }

  function updateSelectionToolbar(filtered) {
    const selCount = state.selectedActivityNos.size;
    if (selCount > 0) {
      els.selectionCountBadge.classList.add("has-selection");
      els.selectionText.textContent = `${selCount} actividad${selCount > 1 ? "es" : ""} seleccionada${selCount > 1 ? "s" : ""}`;
      els.btnClearSelection.style.display = "inline-block";
      const allChecked = filtered.length > 0 && filtered.every((a) => state.selectedActivityNos.has(a.no));
      els.chkMasterSelect.checked = allChecked;
      if (els.chkSelectAllGantt) els.chkSelectAllGantt.checked = allChecked;
    } else {
      els.selectionCountBadge.classList.remove("has-selection");
      els.selectionText.textContent = `Todas visibles (${filtered.length} act.)`;
      els.btnClearSelection.style.display = "none";
      els.chkMasterSelect.checked = false;
      if (els.chkSelectAllGantt) els.chkSelectAllGantt.checked = false;
    }
  }

  function renderAll() {
    const filtered = getFilteredActivities();
    const activeCamps = getActiveCampaigns();
    const selectedCamps = getSelectedCampaigns();

    updateSelectionToolbar(filtered);

    // Update KPIs
    const effective = getEffectiveSelectedActivities(filtered);
    const uniqueProcs = new Set(effective.map((a) => a.proceso));
    els.kpiActivities.innerHTML = `Actividades: <strong>${effective.length}</strong> ${state.selectedActivityNos.size > 0 ? "(seleccionadas)" : `de ${filtered.length}`}`;
    els.kpiProcesses.innerHTML = `Procesos: <strong>${uniqueProcs.size}</strong>`;

    if (state.viewMode === "gantt") {
      els.ganttWrapper.style.display = "flex";
      els.calendarWrapper.style.display = "none";
      els.matrixWrapper.style.display = "none";
      els.ganttToolbarOptions.style.display = "flex";
      els.calendarToolbarOptions.style.display = "none";
      renderGantt(filtered, selectedCamps, activeCamps);
    } else if (state.viewMode === "calendar") {
      els.ganttWrapper.style.display = "none";
      els.calendarWrapper.style.display = "block";
      els.matrixWrapper.style.display = "none";
      els.ganttToolbarOptions.style.display = "none";
      els.calendarToolbarOptions.style.display = "flex";
      renderCalendar(filtered, selectedCamps, activeCamps);
    } else {
      els.ganttWrapper.style.display = "none";
      els.calendarWrapper.style.display = "none";
      els.matrixWrapper.style.display = "block";
      els.ganttToolbarOptions.style.display = "none";
      els.calendarToolbarOptions.style.display = "none";
      renderMatrix(filtered, selectedCamps, activeCamps);
    }
  }

  /* ==========================================================================
     GANTT VIEW
     ========================================================================== */
  function renderGantt(filtered, selectedCamps, activeCamps) {
    const campsToPlot = state.ganttMultiCampaignMode
      ? activeCamps
      : selectedCamps.length > 0
      ? selectedCamps
      : activeCamps.slice(0, 1);
    if (campsToPlot.length === 0) return;

    const items = [];
    let minDate = null;
    let maxDate = null;

    for (const act of filtered) {
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
        act,
        bars,
        primaryStart: primaryBar ? primaryBar.startDt : null,
        primaryEnd: primaryBar ? primaryBar.endDt : null,
        primaryDh: primaryBar ? primaryBar.dh : act.dias,
      });
    }

    if (!minDate || !maxDate) {
      minDate = parseYMD("2026-06-01");
      maxDate = parseYMD("2027-08-01");
    } else {
      minDate = addDays(minDate, -10);
      maxDate = addDays(maxDate, 18);
    }

    els.kpiDateRange.innerHTML = `Rango: <strong>${formatHumanDate(formatYMD(minDate))} → ${formatHumanDate(formatYMD(maxDate))}</strong>`;

    items.sort((a, b) => {
      if (state.sortBy === "no") return a.act.no - b.act.no;
      if (state.sortBy === "proceso") {
        const cmp = a.act.proceso.localeCompare(b.act.proceso, "es");
        if (cmp !== 0) return cmp;
      }
      if (a.primaryStart && b.primaryStart) {
        const diff = a.primaryStart.getTime() - b.primaryStart.getTime();
        if (diff !== 0) return diff;
      } else if (a.primaryStart) return -1;
      else if (b.primaryStart) return 1;
      return a.act.no - b.act.no;
    });

    const displayRows = [];
    if (state.groupByProceso) {
      const groupsMap = new Map();
      for (const it of items) {
        const p = it.act.proceso;
        if (!groupsMap.has(p)) {
          groupsMap.set(p, {
            proceso: p,
            children: [],
            minStart: null,
            maxEnd: null,
          });
        }
        const g = groupsMap.get(p);
        g.children.push(it);
        for (const b of it.bars) {
          if (!g.minStart || b.startDt < g.minStart) g.minStart = new Date(b.startDt.getTime());
          if (!g.maxEnd || b.endDt > g.maxEnd) g.maxEnd = new Date(b.endDt.getTime());
        }
      }

      const groupList = Array.from(groupsMap.values());
      if (state.sortBy === "date") {
        groupList.sort((a, b) => {
          if (a.minStart && b.minStart) return a.minStart - b.minStart;
          if (a.minStart) return -1;
          if (b.minStart) return 1;
          return a.proceso.localeCompare(b.proceso, "es");
        });
      } else if (state.sortBy === "proceso") {
        groupList.sort((a, b) => a.proceso.localeCompare(b.proceso, "es"));
      }

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
          for (const child of g.children) {
            displayRows.push({ type: "item", item: child });
          }
        }
      }
    } else {
      for (const it of items) {
        displayRows.push({ type: "item", item: it });
      }
    }

    const totalDays = Math.max(30, daysBetween(minDate, maxDate) + 1);
    let pxPerDay = 18;
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
        const nextD = addDays(minDate, dayIdx + spanDays);
        if (nextD.getMonth() !== mo || nextD.getFullYear() !== yr) break;
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
          `<div class="timeline-tick-cell ${isWknd ? "weekend" : ""}" style="width:${pxPerDay}px">${d.getDate()}</div>`
        );
      }
    } else if (state.zoom === "week") {
      let i = 0;
      while (i < totalDays) {
        const d = addDays(minDate, i);
        const span = Math.min(7, totalDays - i);
        const w = span * pxPerDay;
        ticksHtml.push(
          `<div class="timeline-tick-cell" style="width:${w}px">${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}</div>`
        );
        i += span;
      }
    } else {
      let i = 0;
      while (i < totalDays) {
        const d = addDays(minDate, i);
        const span = Math.min(15, totalDays - i);
        const w = span * pxPerDay;
        ticksHtml.push(
          `<div class="timeline-tick-cell" style="width:${w}px">${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}</div>`
        );
        i += span;
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
        const allGroupChecked = rowObj.children.every((c) => state.selectedActivityNos.has(c.act.no));

        leftHtml.push(`
          <div class="gantt-row-left group-row" data-proceso="${rowObj.proceso}">
            <span style="display:flex;align-items:center;justify-content:center" onclick="event.stopPropagation()">
              <input type="checkbox" class="group-checkbox" data-proceso="${rowObj.proceso}" ${allGroupChecked ? "checked" : ""} title="Seleccionar/Deseleccionar todas las actividades de este proceso" />
            </span>
            <span class="group-title-click">📁 ${rowObj.proceso} <small style="font-weight:500;color:#475569">(${rowObj.count} act.)</small></span>
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
          summaryBarHtml = `<div class="gantt-bar group-summary-bar" style="left:${leftPx}px;width:${widthPx}px" data-group="${rowObj.proceso}" data-start="${formatYMD(rowObj.minStart)}" data-end="${formatYMD(rowObj.maxEnd)}" data-count="${rowObj.count}"></div>`;
        }
        rightHtml.push(`<div class="gantt-row-right group-row">${summaryBarHtml}</div>`);
      } else {
        const { act, bars, primaryDh } = rowObj.item;
        const bClass = badgeClassForBrand(act.marca);
        const isChecked = state.selectedActivityNos.has(act.no);

        leftHtml.push(`
          <div class="gantt-row-left ${isChecked ? "selected-row" : ""}" title="#${act.no} - ${act.actividad}">
            <span style="display:flex;align-items:center;justify-content:center">
              <input type="checkbox" class="act-checkbox" data-no="${act.no}" ${isChecked ? "checked" : ""} />
            </span>
            <span class="cell-no">#${act.no}</span>
            <span class="cell-act">${act.actividad}</span>
            <span class="cell-area">${act.area}</span>
            <span><span class="badge-marca badge-${bClass}">${act.marca}</span></span>
            <span class="cell-dh">${primaryDh}d</span>
          </div>
        `);

        const rowBarsHtml = [];
        for (const b of bars) {
          const startOffset = daysBetween(minDate, b.startDt);
          const durDays = Math.max(1, daysBetween(b.startDt, b.endDt) + 1);
          const leftPx = Math.round(startOffset * pxPerDay);
          const widthPx = Math.max(14, Math.round(durDays * pxPerDay));
          const dataAttrs = `data-no="${act.no}" data-camp="${b.camp.shortLabel}" data-campfull="${b.camp.fullLabel}" data-start="${b.startStr}" data-end="${b.endStr}" data-dh="${b.dh}"`;

          const isMulti = campsToPlot.length > 1;
          if (b.dh === 0) {
            rowBarsHtml.push(
              `<div class="gantt-milestone bar-${bClass}" style="left:${leftPx}px" ${dataAttrs}></div>`
            );
            if (!isMulti) {
              rowBarsHtml.push(
                `<span class="gantt-bar-outside-label" style="left:${leftPx + 22}px">${b.endStr} (${act.marca})</span>`
              );
            }
          } else {
            const insideText = isMulti
              ? b.camp.shortLabel
              : widthPx > 95
              ? `${b.endStr}`
              : "";
            rowBarsHtml.push(
              `<div class="gantt-bar bar-${bClass}" style="left:${leftPx}px;width:${widthPx}px" ${dataAttrs}>${insideText}</div>`
            );
            if (!isMulti && widthPx <= 95) {
              rowBarsHtml.push(
                `<span class="gantt-bar-outside-label" style="left:${leftPx + widthPx + 6}px">${b.endStr}</span>`
              );
            }
          }
        }

        rightHtml.push(`<div class="gantt-row-right">${rowBarsHtml.join("")}</div>`);
      }
    }

    const todayDt = parseYMD(TODAY_STR);
    let todayHtml = "";
    if (todayDt && todayDt >= minDate && todayDt <= maxDate) {
      const todayLeft = Math.round(daysBetween(minDate, todayDt) * pxPerDay);
      todayHtml = `
        <div class="today-marker" style="left:${todayLeft}px">
          <div class="today-marker-badge">HOY ${TODAY_STR}</div>
        </div>
      `;
    }

    els.ganttLeftBody.innerHTML = leftHtml.join("");
    els.ganttTimelineBody.innerHTML = `
      <div class="timeline-canvas" style="width:${totalWidth}px;min-height:100%">
        ${todayHtml}
        ${rightHtml.join("")}
      </div>
    `;

    // Group collapse and checkbox handlers
    els.ganttLeftBody.querySelectorAll(".gantt-row-left.group-row").forEach((el) => {
      const proc = el.getAttribute("data-proceso");
      el.addEventListener("click", () => {
        if (state.collapsedGroups.has(proc)) state.collapsedGroups.delete(proc);
        else state.collapsedGroups.add(proc);
        renderGantt(filtered, currentCamp, activeCamps);
      });

      const grpChk = el.querySelector(".group-checkbox");
      if (grpChk) {
        grpChk.addEventListener("change", (e) => {
          e.stopPropagation();
          const shouldCheck = grpChk.checked;
          const matchingActs = filtered.filter((a) => a.proceso === proc);
          for (const a of matchingActs) {
            if (shouldCheck) state.selectedActivityNos.add(a.no);
            else state.selectedActivityNos.delete(a.no);
          }
          renderAll();
        });
      }
    });

    // Individual activity checkbox handlers
    els.ganttLeftBody.querySelectorAll(".act-checkbox").forEach((chk) => {
      chk.addEventListener("change", (e) => {
        e.stopPropagation();
        const actNo = parseInt(chk.getAttribute("data-no"), 10);
        if (chk.checked) state.selectedActivityNos.add(actNo);
        else state.selectedActivityNos.delete(actNo);
        renderAll();
      });
    });

    // Tooltip listeners
    const actMap = new Map(rawData.activities.map((a) => [String(a.no), a]));
    els.ganttTimelineBody.querySelectorAll("[data-no], [data-group]").forEach((barEl) => {
      barEl.addEventListener("mouseenter", (e) => {
        const grp = barEl.getAttribute("data-group");
        if (grp) {
          els.tooltip.innerHTML = `
            <h4>📁 Proceso: ${grp}</h4>
            <div class="tooltip-grid">
              <span class="lbl">Actividades:</span><span>${barEl.getAttribute("data-count")}</span>
              <span class="lbl">Inicio Proceso:</span><span>${formatHumanDate(barEl.getAttribute("data-start"))}</span>
              <span class="lbl">Fin Proceso:</span><span>${formatHumanDate(barEl.getAttribute("data-end"))}</span>
            </div>
          `;
        } else {
          const act = actMap.get(barEl.getAttribute("data-no"));
          if (!act) return;
          els.tooltip.innerHTML = `
            <h4>#${act.no} — ${act.actividad}</h4>
            <div class="tooltip-grid">
              <span class="lbl">Marca:</span><span><strong>${act.marca}</strong></span>
              <span class="lbl">Proceso:</span><span>${act.proceso}</span>
              <span class="lbl">Área:</span><span>${act.area}</span>
              <span class="lbl">Campaña:</span><span>${barEl.getAttribute("data-camp")} (${barEl.getAttribute("data-campfull")})</span>
              <span class="lbl">Días Hábiles:</span><span>${barEl.getAttribute("data-dh")} DH</span>
              <span class="lbl">Fecha Inicio:</span><span>${formatHumanDate(barEl.getAttribute("data-start"))} (${barEl.getAttribute("data-start")})</span>
              <span class="lbl">Fecha Entrega:</span><span><strong>${formatHumanDate(barEl.getAttribute("data-end"))} (${barEl.getAttribute("data-end")})</strong></span>
            </div>
          `;
        }
        els.tooltip.style.display = "block";
        moveTooltip(e);
      });
      barEl.addEventListener("mousemove", moveTooltip);
      barEl.addEventListener("mouseleave", () => {
        els.tooltip.style.display = "none";
      });
    });
  }

  function moveTooltip(e) {
    const pad = 14;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    const rect = els.tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 10) {
      x = e.clientX - rect.width - pad;
    }
    if (y + rect.height > window.innerHeight - 10) {
      y = e.clientY - rect.height - pad;
    }
    els.tooltip.style.left = `${Math.max(8, x)}px`;
    els.tooltip.style.top = `${Math.max(8, y)}px`;
  }

  /* ==========================================================================
     MINIMALIST MONTHLY CALENDAR VIEW
     ========================================================================== */
  function renderCalendar(filtered, selectedCamps, activeCamps) {
    const campsToPlot = selectedCamps.length > 0 ? selectedCamps : [];

    if (campsToPlot.length === 0) {
      els.calendarContainer.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#64748b">
          <h3 style="font-size:16px;margin-bottom:8px">Ninguna campaña seleccionada</h3>
          <p>Por favor selecciona al menos una campaña (ej. C8-11, C9-12, C10-13) en el menú superior para ver su calendario.</p>
        </div>
      `;
      els.calCurrentMonthLabel.textContent = "Sin campañas";
      return;
    }

    const effective = getEffectiveSelectedActivities(filtered);

    // Collect all scheduled delivery dates
    const eventsByDate = new Map();
    const monthsMap = new Map(); // "YYYY-MM" -> { year, month, events: [] }

    for (const act of effective) {
      for (const camp of campsToPlot) {
        const fStr = act.fechas[camp.id];
        if (!fStr) continue;
        const dt = parseYMD(fStr);
        if (!dt) continue;

        const ym = fStr.slice(0, 7);
        const ev = {
          dateStr: fStr,
          date: dt,
          act,
          camp,
          dh: act.dh[camp.id] ?? act.dias ?? 0,
        };

        if (!eventsByDate.has(fStr)) eventsByDate.set(fStr, []);
        eventsByDate.get(fStr).push(ev);

        if (!monthsMap.has(ym)) {
          monthsMap.set(ym, {
            year: dt.getFullYear(),
            month: dt.getMonth(),
            ym,
            events: [],
          });
        }
        monthsMap.get(ym).events.push(ev);
      }
    }

    const sortedMonthKeys = Array.from(monthsMap.keys()).sort();
    if (sortedMonthKeys.length === 0) {
      els.calendarContainer.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#64748b">
          <h3 style="font-size:16px;margin-bottom:8px">No hay fechas programadas en la selección actual</h3>
          <p>Ajusta los filtros de proceso/marca/área o selecciona otras campañas para visualizar el calendario.</p>
        </div>
      `;
      els.calCurrentMonthLabel.textContent = "Sin fechas";
      return;
    }

    // Clamp current month index
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

    // Header campaign badge label
    let campHeaderBadge = "";
    if (campsToPlot.length === 1) {
      campHeaderBadge = `${campsToPlot[0].shortLabel} (${campsToPlot[0].fullLabel})`;
    } else if (campsToPlot.length <= 4) {
      campHeaderBadge = campsToPlot.map((c) => c.shortLabel).join(" • ");
    } else {
      campHeaderBadge = `${campsToPlot.length} campañas seleccionadas`;
    }

    const keysToRender = state.calShowAllMonths ? sortedMonthKeys : [sortedMonthKeys[state.calCurrentMonthIndex]];
    const sheetsHtml = [];

    for (const ym of keysToRender) {
      const mInfo = monthsMap.get(ym);
      const yr = mInfo.year;
      const mo = mInfo.month;

      // Determine calendar grid (Monday to Sunday)
      const firstDayOfMonth = new Date(yr, mo, 1, 12, 0, 0);
      let startingDow = firstDayOfMonth.getDay();
      startingDow = startingDow === 0 ? 6 : startingDow - 1;

      const lastDayOfMonth = new Date(yr, mo + 1, 0, 12, 0, 0);
      const totalDaysInMonth = lastDayOfMonth.getDate();
      const prevMonthLastDay = new Date(yr, mo, 0, 12, 0, 0).getDate();

      const weeks = [];
      let currentWeek = [];

      // Preceding days from previous month
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

      // Days of the month
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

      // Trailing days from next month
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

      // Render week rows
      const rowsHtml = [];
      for (const w of weeks) {
        const cellsHtml = [];
        for (const cell of w) {
          const isToday = cell.dateStr === TODAY_STR;
          const dayEvents = eventsByDate.get(cell.dateStr) || [];

          // Sort day events by campaign and activity number
          dayEvents.sort((a, b) => {
            if (a.camp.id !== b.camp.id) return a.camp.id.localeCompare(b.camp.id);
            return a.act.no - b.act.no;
          });

          const eventsHtml = [];
          for (const ev of dayEvents) {
            const bClass = badgeClassForBrand(ev.act.marca);
            eventsHtml.push(`
              <div class="calendar-event-card event-${bClass}" data-no="${ev.act.no}" data-camp="${ev.camp.shortLabel}" data-campfull="${ev.camp.fullLabel}" data-start="${formatYMD(subtractBusinessDays(ev.dateStr, ev.dh))}" data-end="${ev.dateStr}" data-dh="${ev.dh}" title="#${ev.act.no} [${ev.act.marca}] ${ev.act.actividad} (${ev.dh} DH - Campaña: ${ev.camp.shortLabel})">
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
          }

          cellsHtml.push(`
            <td class="calendar-day-cell ${cell.isOtherMonth ? "day-other-month" : ""} ${isToday ? "day-today" : ""}">
              <div class="day-num-wrap">
                <span class="day-num ${cell.isOtherMonth ? "day-num-other" : ""}">${cell.dayNum}</span>
                ${isToday ? `<span class="today-chip">Hoy</span>` : ""}
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
                ${mInfo.events.length} actividad${mInfo.events.length > 1 ? "es" : ""} programada${mInfo.events.length > 1 ? "s" : ""}
                ${state.selectedActivityNos.size > 0 ? `• (${state.selectedActivityNos.size} seleccionadas por checkbox)` : ""}
              </div>
            </div>
            <div class="calendar-campaign-meta">
              <span class="calendar-campaign-badge">${campHeaderBadge}</span>
              <span class="calendar-campaign-sub">Cronograma Maestro Azzorti &amp; Livva</span>
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

    // Attach tooltips to calendar event cards
    const actMap = new Map(rawData.activities.map((a) => [String(a.no), a]));
    els.calendarContainer.querySelectorAll(".calendar-event-card").forEach((card) => {
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
    });
  }

  /* ==========================================================================
     MATRIX TABLE VIEW
     ========================================================================== */
  function renderMatrix(filtered, selectedCamps, activeCamps) {
    const campsToDisplay = selectedCamps.length > 0 ? selectedCamps : activeCamps;
    const thRow1 = [
      `<th class="sticky-col-1" rowspan="2" style="width:34px;text-align:center"><input type="checkbox" id="chkSelectAllMatrix" title="Seleccionar/Deseleccionar todas" /></th>`,
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

    els.matrixTableHead.innerHTML = `
      <tr>${thRow1.join("")}</tr>
      <tr>${thRow2.join("")}</tr>
    `;

    const bodyRows = [];
    for (const act of filtered) {
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

    // Matrix checkbox handlers
    els.matrixTableBody.querySelectorAll(".act-checkbox").forEach((chk) => {
      chk.addEventListener("change", () => {
        const actNo = parseInt(chk.getAttribute("data-no"), 10);
        if (chk.checked) state.selectedActivityNos.add(actNo);
        else state.selectedActivityNos.delete(actNo);
        renderAll();
      });
    });

    const chkAllM = document.getElementById("chkSelectAllMatrix");
    if (chkAllM) {
      chkAllM.checked = filtered.length > 0 && filtered.every((a) => state.selectedActivityNos.has(a.no));
      chkAllM.addEventListener("change", () => {
        if (chkAllM.checked) {
          filtered.forEach((a) => state.selectedActivityNos.add(a.no));
        } else {
          state.selectedActivityNos.clear();
        }
        renderAll();
      });
    }
  }

  /* ==========================================================================
     PDF & EXPORT FUNCTIONS
     ========================================================================== */
  function printPdfGantt() {
    // Switch to Gantt view if not already
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

  function printPdfCalendar() {
    // Ensure all months are visible in calendar before printing
    state.calShowAllMonths = true;
    if (els.chkCalShowAllMonths) els.chkCalShowAllMonths.checked = true;

    // Switch to Calendar view
    state.viewMode = "calendar";
    els.tabCalendar.classList.add("active");
    els.tabGantt.classList.remove("active");
    els.tabMatrix.classList.remove("active");
    renderAll();

    const selectedCamps = getSelectedCampaigns();
    const campNames = selectedCamps.map((c) => c.shortLabel.replace(/\s+/g, "_")).join("-");
    const oldTitle = document.title;
    document.title = `Calendario_Cronograma_${campNames || "Azzorti_Livva"}`;

    document.body.classList.add("printing-calendar");
    window.print();
    setTimeout(() => {
      document.body.classList.remove("printing-calendar");
      document.title = oldTitle;
    }, 1000);
  }

  function exportFilteredToICS() {
    const filtered = getFilteredActivities();
    const effective = getEffectiveSelectedActivities(filtered);
    const selectedCamps = getSelectedCampaigns();
    const campsToExport = selectedCamps.length > 0 ? selectedCamps : getActiveCampaigns();

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Azzorti Livva//Dashboard Cronograma//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Cronograma Azzorti Livva (Selección)",
      "X-WR-TIMEZONE:America/Bogota",
    ];
    const dtstamp = "20261021T140000Z";
    let count = 0;

    for (const act of effective) {
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
        const desc = `Marca: ${act.marca}\\nCampaña: ${camp.shortLabel} (${camp.fullLabel})\\nProceso: ${act.proceso}\\nÁrea: ${act.area}\\nActividad No.: ${act.no}\\nDías Hábiles (DH): ${dh}`;
        lines.push(
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART;VALUE=DATE:${sVal}`,
          `DTEND;VALUE=DATE:${eVal}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${desc}`,
          `CATEGORIES:${act.marca},${act.proceso}`,
          "STATUS:CONFIRMED",
          "TRANSP:TRANSPARENT",
          "END:VEVENT"
        );
        count++;
      }
    }
    lines.push("END:VCALENDAR");

    if (count === 0) {
      alert("No hay fechas válidas en la selección actual para exportar a .ics");
      return;
    }

    const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cronograma_${state.brand.replace(/\s+/g, "_")}_${campsToExport.length === 1 ? campsToExport[0].adv : "seleccion"}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportFilteredToCSV() {
    const filtered = getFilteredActivities();
    const effective = getEffectiveSelectedActivities(filtered);
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
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = [hdr1.map(escapeCsv).join(","), hdr2.map(escapeCsv).join(",")];
    for (const act of effective) {
      const r = [act.no, act.actividad, act.proceso, act.marca, act.area, act.dias];
      for (const c of campsToExport) {
        r.push(act.fechas[c.id] || "");
      }
      rows.push(r.map(escapeCsv).join(","));
    }

    const blob = new Blob(["\uFEFF" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cronograma_filtrado_${state.brand.replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ==========================================================================
     EVENT LISTENERS
     ========================================================================== */
  function setupEventListeners() {
    els.ganttTimelineBody.addEventListener("scroll", () => {
      els.ganttLeftBody.scrollTop = els.ganttTimelineBody.scrollTop;
      els.ganttTimelineHeader.scrollLeft = els.ganttTimelineBody.scrollLeft;
    });

    els.btnUpload.addEventListener("click", () => els.fileInput.click());
    els.fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileUpload(e.target.files[0]);
        e.target.value = "";
      }
    });

    window.addEventListener("dragover", (e) => {
      e.preventDefault();
      els.dropzoneOverlay.classList.add("active");
    });
    els.dropzoneOverlay.addEventListener("dragleave", (e) => {
      if (e.target === els.dropzoneOverlay) {
        els.dropzoneOverlay.classList.remove("active");
      }
    });
    window.addEventListener("drop", (e) => {
      e.preventDefault();
      els.dropzoneOverlay.classList.remove("active");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    });

    els.btnResetData.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      rawData = window.CRONOGRAMA_INITIAL_DATA;
      els.btnResetData.style.display = "none";
      els.statusBadge.textContent = `Base original (${rawData.activities.length} act. | C1-4 2027 → C7-10 2029)`;
      els.statusBadge.style.background = "rgba(255,255,255,0.12)";
      els.statusBadge.style.color = "#e2e8f0";
      state.selectedActivityNos.clear();
      populateFilterControls(false);
      renderAll();
    });

    // PDF Exports
    els.btnExportPdfGantt.addEventListener("click", printPdfGantt);
    els.btnExportPdfCalendar.addEventListener("click", printPdfCalendar);

    // .ICS and .CSV Exports
    els.btnExportIcs.addEventListener("click", exportFilteredToICS);
    els.btnExportCsv.addEventListener("click", exportFilteredToCSV);

    // Master Select / Clear Selection
    els.chkMasterSelect.addEventListener("change", () => {
      const filtered = getFilteredActivities();
      if (els.chkMasterSelect.checked) {
        filtered.forEach((a) => state.selectedActivityNos.add(a.no));
      } else {
        state.selectedActivityNos.clear();
      }
      renderAll();
    });

    if (els.chkSelectAllGantt) {
      els.chkSelectAllGantt.addEventListener("change", () => {
        const filtered = getFilteredActivities();
        if (els.chkSelectAllGantt.checked) {
          filtered.forEach((a) => state.selectedActivityNos.add(a.no));
        } else {
          state.selectedActivityNos.clear();
        }
        renderAll();
      });
    }

    els.btnClearSelection.addEventListener("click", () => {
      state.selectedActivityNos.clear();
      renderAll();
    });

    // Campaign multi-select & actions
    els.campaignBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      els.procesoDropdown.classList.remove("open");
      els.areaDropdown.classList.remove("open");
      els.campaignDropdown.classList.toggle("open");
    });

    els.campaignSearch.addEventListener("input", () => {
      renderCampaignSelectList();
    });

    els.campaignSelectAll.addEventListener("click", () => {
      const active = getActiveCampaigns();
      state.selectedCampaignIds = new Set(active.map((c) => c.id));
      updateCampaignButtonLabel();
      renderCampaignSelectList();
      state.calCurrentMonthIndex = 0;
      renderAll();
    });

    els.campaignSelect2027.addEventListener("click", () => {
      const active = getActiveCampaigns();
      state.selectedCampaignIds = new Set(
        active.filter((c) => c.adv.startsWith("2027")).map((c) => c.id)
      );
      updateCampaignButtonLabel();
      renderCampaignSelectList();
      state.calCurrentMonthIndex = 0;
      renderAll();
    });

    els.campaignSelect2028.addEventListener("click", () => {
      const active = getActiveCampaigns();
      state.selectedCampaignIds = new Set(
        active.filter((c) => c.adv.startsWith("2028")).map((c) => c.id)
      );
      updateCampaignButtonLabel();
      renderCampaignSelectList();
      state.calCurrentMonthIndex = 0;
      renderAll();
    });

    els.campaignClearAll.addEventListener("click", () => {
      state.selectedCampaignIds.clear();
      updateCampaignButtonLabel();
      renderCampaignSelectList();
      state.calCurrentMonthIndex = 0;
      renderAll();
    });

    els.chkInclude2026.addEventListener("change", (e) => {
      state.include2026 = e.target.checked;
      populateFilterControls(true);
      renderAll();
    });

    if (els.chkMultiCampGantt) {
      els.chkMultiCampGantt.addEventListener("change", (e) => {
        state.ganttMultiCampaignMode = e.target.checked;
        renderAll();
      });
    }

    // Brand pills
    els.brandPills.forEach((btn) => {
      btn.addEventListener("click", () => {
        els.brandPills.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.brand = btn.getAttribute("data-brand");
        els.sharedBrandWrap.style.display =
          state.brand === "Livva" || state.brand === "Azzorti" ? "inline-flex" : "none";
        renderAll();
      });
    });

    els.chkSharedBrand.addEventListener("change", (e) => {
      state.includeSharedBrand = e.target.checked;
      renderAll();
    });

    // Dropdowns
    els.procesoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      els.campaignDropdown.classList.remove("open");
      els.areaDropdown.classList.remove("open");
      els.procesoDropdown.classList.toggle("open");
    });
    els.areaBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      els.campaignDropdown.classList.remove("open");
      els.procesoDropdown.classList.remove("open");
      els.areaDropdown.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!els.campaignDropdown.contains(e.target) && e.target !== els.campaignBtn && !els.campaignBtn.contains(e.target)) {
        els.campaignDropdown.classList.remove("open");
      }
      if (!els.procesoDropdown.contains(e.target) && e.target !== els.procesoBtn && !els.procesoBtn.contains(e.target)) {
        els.procesoDropdown.classList.remove("open");
      }
      if (!els.areaDropdown.contains(e.target) && e.target !== els.areaBtn && !els.areaBtn.contains(e.target)) {
        els.areaDropdown.classList.remove("open");
      }
    });

    els.procesoSearch.addEventListener("input", () => populateFilterControls(true));
    els.areaSearch.addEventListener("input", () => populateFilterControls(true));

    document.getElementById("procesoSelectAll").addEventListener("click", () => {
      rawData.activities.forEach((a) => state.selectedProcesos.add(a.proceso));
      populateFilterControls(true);
      renderAll();
    });
    document.getElementById("procesoClearAll").addEventListener("click", () => {
      state.selectedProcesos.clear();
      populateFilterControls(true);
      renderAll();
    });
    document.getElementById("areaSelectAll").addEventListener("click", () => {
      rawData.activities.forEach((a) => state.selectedAreas.add(a.area));
      populateFilterControls(true);
      renderAll();
    });
    document.getElementById("areaClearAll").addEventListener("click", () => {
      state.selectedAreas.clear();
      populateFilterControls(true);
      renderAll();
    });

    els.btnQuickEstampacion.addEventListener("click", () => {
      state.selectedProcesos = new Set(["Estampacion Continua", "Estampacion Local"]);
      state.selectedAreas = new Set(["Aglab"]);
      populateFilterControls(true);
      renderAll();
    });

    els.btnResetFilters.addEventListener("click", () => {
      state.brand = "ALL";
      els.brandPills.forEach((b) => b.classList.toggle("active", b.getAttribute("data-brand") === "ALL"));
      els.sharedBrandWrap.style.display = "none";
      state.searchQuery = "";
      els.searchInput.value = "";
      els.procesoSearch.value = "";
      els.areaSearch.value = "";
      state.selectedProcesos.clear();
      state.selectedAreas.clear();
      state.selectedActivityNos.clear();
      state.collapsedGroups.clear();
      populateFilterControls(false);
      renderAll();
    });

    els.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      renderAll();
    });

    // View tabs
    els.tabGantt.addEventListener("click", () => {
      state.viewMode = "gantt";
      els.tabGantt.classList.add("active");
      els.tabCalendar.classList.remove("active");
      els.tabMatrix.classList.remove("active");
      renderAll();
    });
    els.tabCalendar.addEventListener("click", () => {
      state.viewMode = "calendar";
      els.tabCalendar.classList.add("active");
      els.tabGantt.classList.remove("active");
      els.tabMatrix.classList.remove("active");
      renderAll();
    });
    els.tabMatrix.addEventListener("click", () => {
      state.viewMode = "matrix";
      els.tabMatrix.classList.add("active");
      els.tabGantt.classList.remove("active");
      els.tabCalendar.classList.remove("active");
      renderAll();
    });

    // Gantt toolbar options
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
      const firstBar = els.ganttTimelineBody.querySelector(".gantt-bar, .gantt-milestone");
      if (firstBar) {
        const leftPx = parseInt(firstBar.style.left, 10) || 0;
        els.ganttTimelineBody.scrollLeft = Math.max(0, leftPx - 80);
      }
    });

    // Calendar toolbar options
    els.btnCalPrevMonth.addEventListener("click", () => {
      state.calShowAllMonths = false;
      els.chkCalShowAllMonths.checked = false;
      state.calCurrentMonthIndex--;
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
  }

  function init() {
    initDomRefs();

    let loadedCustom = false;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.activities && parsed.campaigns) {
          rawData = parsed;
          loadedCustom = true;
        }
      }
    } catch (e) {
      console.warn(e);
    }

    if (!rawData) {
      rawData = window.CRONOGRAMA_INITIAL_DATA;
    }

    if (loadedCustom) {
      els.btnResetData.style.display = "inline-flex";
      els.statusBadge.textContent = `📂 Versión personalizada (${rawData.sourceFileName || "Excel subido"})`;
      els.statusBadge.style.background = "rgba(16, 185, 129, 0.25)";
      els.statusBadge.style.color = "#6ee7b7";
    } else {
      els.statusBadge.textContent = `Base activa: ${rawData.activities.length} act. | C1-4 2027 → C7-10 2029`;
    }

    setupEventListeners();
    populateFilterControls(false);
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
