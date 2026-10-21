(function () {
  "use strict";

  const STORAGE_KEY = "AZZORTI_LIVVA_CUSTOM_CRONOGRAMA_V1";
  const TODAY_STR = "2026-10-21";

  // State
  let rawData = null;
  let state = {
    include2026: false, // By default starts at C1-4 2027 (ADV 202701 / NAL 202704)
    selectedCampaignId: "ADV_202701_NAL_202704", // Default C1-4 2027
    campaignEndId: "ALL_FROM_START",
    ganttMultiCampaignMode: false, // false = single campaign Gantt, true = multi-campaign range
    brand: "ALL", // ALL, Livva, Azzorti, Azz Livv
    includeSharedBrand: true, // include "Azz Livv" when Livva or Azzorti is selected
    selectedProcesos: new Set(),
    selectedAreas: new Set(),
    searchQuery: "",
    viewMode: "gantt", // "gantt" | "matrix"
    groupByProceso: true,
    collapsedGroups: new Set(),
    sortBy: "date", // "date" | "no" | "proceso"
    zoom: "week", // "day" | "week" | "month"
  };

  // DOM Elements
  const els = {};

  function initDomRefs() {
    els.fileInput = document.getElementById("excelFileInput");
    els.btnUpload = document.getElementById("btnUploadExcel");
    els.btnResetData = document.getElementById("btnResetData");
    els.btnExportIcs = document.getElementById("btnExportIcs");
    els.btnExportCsv = document.getElementById("btnExportCsv");
    els.statusBadge = document.getElementById("dataStatusBadge");
    els.campaignSelect = document.getElementById("campaignSelect");
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
    els.tabMatrix = document.getElementById("tabMatrix");
    els.chkGroupProceso = document.getElementById("chkGroupProceso");
    els.btnExpandAll = document.getElementById("btnExpandAll");
    els.btnCollapseAll = document.getElementById("btnCollapseAll");
    els.sortSelect = document.getElementById("sortSelect");
    els.zoomSelect = document.getElementById("zoomSelect");
    els.btnCenterGantt = document.getElementById("btnCenterGantt");
    els.kpiActivities = document.getElementById("kpiActivities");
    els.kpiProcesses = document.getElementById("kpiProcesses");
    els.kpiDateRange = document.getElementById("kpiDateRange");
    els.ganttWrapper = document.getElementById("ganttWrapper");
    els.ganttLeftBody = document.getElementById("ganttLeftBody");
    els.ganttTimelineHeader = document.getElementById("ganttTimelineHeader");
    els.ganttTimelineBody = document.getElementById("ganttTimelineBody");
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
      // Handle DD/MM/YYYY or MM/DD/YYYY
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

  // Convert 2D array of rows (from Excel or CSV) into structured cronograma object
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

  // Pure JS CSV parser
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

  // Native fallback .xlsx reader using browser's DecompressionStream (works 100% offline without CDN!)
  async function parseXlsxBufferNative(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    // Find End of Central Directory (EOCD)
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
      throw new Error("Método de compresión ZIP no soportado: " + info.compression);
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

    // Find first worksheet
    const sheetKey = Object.keys(files).find((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)) || "xl/worksheets/sheet1.xml";
    const sheetXml = await extractXmlText(sheetKey);
    if (!sheetXml) throw new Error("No se encontró la hoja de cálculo en el archivo .xlsx");

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

      populateFilterControls(true);
      renderAll();
    } catch (err) {
      alert("Error al leer el archivo: " + err.message);
      console.error(err);
    }
  }

  // Active campaigns based on C1-4 2027 toggle
  function getActiveCampaigns() {
    if (!rawData || !rawData.campaigns) return [];
    if (state.include2026) return rawData.campaigns;
    return rawData.campaigns.filter((c) => c.fromC1_4_2027);
  }

  function populateFilterControls(preserveSelection) {
    const camps = getActiveCampaigns();
    if (!camps.some((c) => c.id === state.selectedCampaignId) && camps.length > 0) {
      state.selectedCampaignId = camps[0].id;
    }

    // Populate Campaign Select
    els.campaignSelect.innerHTML = "";
    for (const c of camps) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.shortLabel} (${c.fullLabel})`;
      if (c.id === state.selectedCampaignId) opt.selected = true;
      els.campaignSelect.appendChild(opt);
    }

    // Collect unique Procesos and Areas with counts
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
      // Brand filter
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
      // Proceso filter
      if (!state.selectedProcesos.has(act.proceso)) return false;
      // Area filter
      if (!state.selectedAreas.has(act.area)) return false;
      // Search filter
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

  function badgeClassForBrand(marca) {
    if (marca === "Livva") return "Livva";
    if (marca === "Azzorti") return "Azzorti";
    return "AzzLivv";
  }

  function renderAll() {
    const filtered = getFilteredActivities();
    const activeCamps = getActiveCampaigns();
    const currentCamp = activeCamps.find((c) => c.id === state.selectedCampaignId) || activeCamps[0];

    // Update KPIs
    const uniqueProcs = new Set(filtered.map((a) => a.proceso));
    els.kpiActivities.innerHTML = `Actividades: <strong>${filtered.length}</strong> / ${rawData.activities.length}`;
    els.kpiProcesses.innerHTML = `Procesos: <strong>${uniqueProcs.size}</strong>`;

    if (state.viewMode === "gantt") {
      els.ganttWrapper.style.display = "flex";
      els.matrixWrapper.style.display = "none";
      renderGantt(filtered, currentCamp, activeCamps);
    } else {
      els.ganttWrapper.style.display = "none";
      els.matrixWrapper.style.display = "block";
      renderMatrix(filtered, activeCamps);
    }
  }

  function renderGantt(filtered, currentCamp, activeCamps) {
    if (!currentCamp) return;

    // Prepare items with start/end dates
    const items = [];
    let minDate = null;
    let maxDate = null;

    const campsToPlot = state.ganttMultiCampaignMode ? activeCamps : [currentCamp];

    for (const act of filtered) {
      const bars = [];
      for (const camp of campsToPlot) {
        const endStr = act.fechas[camp.id];
        if (!endStr) continue;
        const endDt = parseYMD(endStr);
        if (!endDt) continue;
        // Skip obvious typo dates from 2026 in 2027/2028 columns when computing min/max if multi-campaign, or still show them
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

    // Sort items
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

    // Build rows (either grouped by Proceso or flat)
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
          minStart: g.minStart,
          maxEnd: g.maxEnd,
          collapsed: isCollapsed,
        });
        if (!isCollapsed) {
          for (const child of g.children) {
            displayRows.push({
              type: "item",
              item: child,
            });
          }
        }
      }
    } else {
      for (const it of items) {
        displayRows.push({ type: "item", item: it });
      }
    }

    // Timeline geometry
    const totalDays = Math.max(30, daysBetween(minDate, maxDate) + 1);
    let pxPerDay = 18;
    if (state.zoom === "day") pxPerDay = 28;
    else if (state.zoom === "week") pxPerDay = 10;
    else if (state.zoom === "month") pxPerDay = 3.8;

    const totalWidth = Math.ceil(totalDays * pxPerDay);

    // Build Header (Months + Ticks)
    const monthsHtml = [];
    const ticksHtml = [];
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    let curMonthStart = new Date(minDate.getTime());
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
      // Month zoom: 15-day ticks
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

    // Render Left & Right Rows
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
        leftHtml.push(`
          <div class="gantt-row-left group-row" data-proceso="${rowObj.proceso}">
            <span>${icon} 📁 ${rowObj.proceso} <small style="font-weight:500;color:#475569">(${rowObj.count} act.)</small></span>
            <span style="font-size:11px;font-weight:500;color:#475569">${rangeTxt}</span>
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
        leftHtml.push(`
          <div class="gantt-row-left" title="#${act.no} - ${act.actividad}">
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

          if (b.dh === 0) {
            rowBarsHtml.push(
              `<div class="gantt-milestone bar-${bClass}" style="left:${leftPx}px" ${dataAttrs}></div>`
            );
            if (!state.ganttMultiCampaignMode) {
              rowBarsHtml.push(
                `<span class="gantt-bar-outside-label" style="left:${leftPx + 22}px">${b.endStr} (${act.marca})</span>`
              );
            }
          } else {
            const insideText = state.ganttMultiCampaignMode
              ? b.camp.shortLabel
              : widthPx > 95
              ? `${b.endStr}`
              : "";
            rowBarsHtml.push(
              `<div class="gantt-bar bar-${bClass}" style="left:${leftPx}px;width:${widthPx}px" ${dataAttrs}>${insideText}</div>`
            );
            if (!state.ganttMultiCampaignMode && widthPx <= 95) {
              rowBarsHtml.push(
                `<span class="gantt-bar-outside-label" style="left:${leftPx + widthPx + 6}px">${b.endStr}</span>`
              );
            }
          }
        }

        rightHtml.push(`<div class="gantt-row-right">${rowBarsHtml.join("")}</div>`);
      }
    }

    // Today line
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

    // Attach group collapse listeners
    els.ganttLeftBody.querySelectorAll(".gantt-row-left.group-row").forEach((el) => {
      el.addEventListener("click", () => {
        const proc = el.getAttribute("data-proceso");
        if (state.collapsedGroups.has(proc)) state.collapsedGroups.delete(proc);
        else state.collapsedGroups.add(proc);
        renderGantt(filtered, currentCamp, activeCamps);
      });
    });

    // Attach tooltip listeners
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

  function renderMatrix(filtered, activeCamps) {
    const thRow1 = [
      `<th class="sticky-col-1" rowspan="2">No</th>`,
      `<th class="sticky-col-2" rowspan="2">Actividad</th>`,
      `<th class="sticky-col-3" rowspan="2">Proceso</th>`,
      `<th class="sticky-col-4" rowspan="2">Marca</th>`,
      `<th class="sticky-col-5" rowspan="2">Área (DH)</th>`,
    ];
    const thRow2 = [];

    for (const c of activeCamps) {
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
      const cells = [
        `<td class="sticky-col-1 cell-no">#${act.no}</td>`,
        `<td class="sticky-col-2" title="${act.actividad}">${act.actividad}</td>`,
        `<td class="sticky-col-3" title="${act.proceso}">${act.proceso}</td>`,
        `<td class="sticky-col-4"><span class="badge-marca badge-${bClass}">${act.marca}</span></td>`,
        `<td class="sticky-col-5">${act.area} <small style="color:#64748b">(${act.dias}d)</small></td>`,
      ];
      for (const c of activeCamps) {
        const f = act.fechas[c.id];
        cells.push(`<td style="text-align:center;font-variant-numeric:tabular-nums">${f || "—"}</td>`);
      }
      bodyRows.push(`<tr>${cells.join("")}</tr>`);
    }
    els.matrixTableBody.innerHTML = bodyRows.join("");
  }

  // Export filtered activities & campaigns to .ICS
  function exportFilteredToICS() {
    const filtered = getFilteredActivities();
    const activeCamps = getActiveCampaigns();
    const campsToExport = state.viewMode === "gantt" && !state.ganttMultiCampaignMode
      ? [activeCamps.find((c) => c.id === state.selectedCampaignId) || activeCamps[0]]
      : activeCamps;

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Azzorti Livva//Dashboard Cronograma//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Cronograma Azzorti Livva (Filtro Activo)",
      "X-WR-TIMEZONE:America/Bogota",
    ];
    const dtstamp = "20261021T140000Z";
    let count = 0;

    for (const act of filtered) {
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
    a.download = `cronograma_${state.brand.replace(/\s+/g, "_")}_${campsToExport.length === 1 ? campsToExport[0].adv : "2027_2029"}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Export filtered activities & campaigns to .CSV
  function exportFilteredToCSV() {
    const filtered = getFilteredActivities();
    const activeCamps = getActiveCampaigns();

    const hdr1 = ["No", "ACTIVIDAD", "PROCESO", "Marca", "AREA", "Dias"];
    const hdr2 = ["", "", "", "", "", "NAL"];
    for (const c of activeCamps) {
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
    for (const act of filtered) {
      const r = [act.no, act.actividad, act.proceso, act.marca, act.area, act.dias];
      for (const c of activeCamps) {
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

  function setupEventListeners() {
    // Sync scroll between Gantt Left Body, Timeline Header, and Timeline Body
    els.ganttTimelineBody.addEventListener("scroll", () => {
      els.ganttLeftBody.scrollTop = els.ganttTimelineBody.scrollTop;
      els.ganttTimelineHeader.scrollLeft = els.ganttTimelineBody.scrollLeft;
    });

    // Upload Excel button
    els.btnUpload.addEventListener("click", () => els.fileInput.click());
    els.fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileUpload(e.target.files[0]);
        e.target.value = "";
      }
    });

    // Global Drag & Drop Excel file
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

    // Restore original data
    els.btnResetData.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      rawData = window.CRONOGRAMA_INITIAL_DATA;
      els.btnResetData.style.display = "none";
      els.statusBadge.textContent = `Base original (${rawData.activities.length} act. | C1-4 2027 → C7-10 2029)`;
      els.statusBadge.style.background = "rgba(255,255,255,0.12)";
      els.statusBadge.style.color = "#e2e8f0";
      populateFilterControls(false);
      renderAll();
    });

    // Exports
    els.btnExportIcs.addEventListener("click", exportFilteredToICS);
    els.btnExportCsv.addEventListener("click", exportFilteredToCSV);

    // Campaign selector & checkboxes
    els.campaignSelect.addEventListener("change", (e) => {
      state.selectedCampaignId = e.target.value;
      renderAll();
    });
    els.chkInclude2026.addEventListener("change", (e) => {
      state.include2026 = e.target.checked;
      populateFilterControls(true);
      renderAll();
    });
    els.chkMultiCampGantt.addEventListener("change", (e) => {
      state.ganttMultiCampaignMode = e.target.checked;
      els.campaignSelect.disabled = state.ganttMultiCampaignMode;
      renderAll();
    });

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

    // Multi-select dropdown toggles
    els.procesoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      els.areaDropdown.classList.remove("open");
      els.procesoDropdown.classList.toggle("open");
    });
    els.areaBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      els.procesoDropdown.classList.remove("open");
      els.areaDropdown.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!els.procesoDropdown.contains(e.target) && e.target !== els.procesoBtn) {
        els.procesoDropdown.classList.remove("open");
      }
      if (!els.areaDropdown.contains(e.target) && e.target !== els.areaBtn) {
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

    // Quick preset: Diseño Textil (Estampación Continua y Localizada)
    els.btnQuickEstampacion.addEventListener("click", () => {
      state.selectedProcesos = new Set(["Estampacion Continua", "Estampacion Local"]);
      state.selectedAreas = new Set(["Aglab"]);
      populateFilterControls(true);
      renderAll();
    });

    // Reset all filters
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
      state.collapsedGroups.clear();
      populateFilterControls(false);
      renderAll();
    });

    // Search input
    els.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      renderAll();
    });

    // View tabs
    els.tabGantt.addEventListener("click", () => {
      state.viewMode = "gantt";
      els.tabGantt.classList.add("active");
      els.tabMatrix.classList.remove("active");
      renderAll();
    });
    els.tabMatrix.addEventListener("click", () => {
      state.viewMode = "matrix";
      els.tabMatrix.classList.add("active");
      els.tabGantt.classList.remove("active");
      renderAll();
    });

    // Gantt options
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
  }

  function init() {
    initDomRefs();

    // Load from localStorage if user previously uploaded a custom Excel version
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
