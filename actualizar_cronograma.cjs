/**
 * ACTUALIZADOR MANUAL DEL CRONOGRAMA MAESTRO (Azzorti & Livva)
 * -------------------------------------------------------------
 * Convierte un archivo Excel (.xlsx) o CSV (.csv) directamente
 * al archivo 'datos_cronograma.js' que alimenta el Dashboard.
 *
 * USO:
 *   node actualizar_cronograma.cjs "ruta/a/mi_cronograma.xlsx"
 *   node actualizar_cronograma.cjs "ruta/a/mi_cronograma.csv"
 *
 * Si no pasas argumentos, busca automáticamente en la carpeta:
 *   node actualizar_cronograma.cjs
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function excelSerialToYMD(serial) {
  const num = Number(serial);
  if (isNaN(num) || num < 30000 || num > 75000) return null;
  const base = new Date(Date.UTC(1899, 11, 30, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + Math.round(num));
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, '0');
  const d = String(base.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeDateCell(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'nan') return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const parts = s.split('/');
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const yr = parts[2];
    if (p0 > 12) return `${yr}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
    return `${yr}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
  }
  const num = Number(s);
  if (!isNaN(num) && num >= 30000 && num <= 75000) return excelSerialToYMD(num);
  return null;
}

function formatCampLabel(adv, nal) {
  const advS = String(adv || '').trim();
  const nalS = String(nal || '').trim();
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

function normMarca(val) {
  const m = String(val ?? '').trim().toLowerCase();
  if (m.includes('livva') && m.includes('azzorti')) return 'Azz Livv';
  if (m.includes('azz') && m.includes('livv')) return 'Azz Livv';
  if (m.includes('livva')) return 'Livva';
  if (m.includes('azzorti') || m.includes('dupree')) return 'Azzorti';
  return String(val ?? '').trim() || 'Azz Livv';
}

function normArea(val) {
  const a = String(val ?? '').trim().toLowerCase();
  if (a.includes('aglab') || a.includes('ag lab') || a.includes('textil') || a.includes('moda') || a.includes('diseño')) return 'Aglab';
  if (a.includes('ingeni') || a.includes('ficha') || a.includes('patron')) return 'Ingenieria';
  if (a.includes('mercad') || a.includes('cuadric')) return 'Mercadeo';
  if (a.includes('compra') || a.includes('abastec') || a.includes('tela') || a.includes('mrp')) return 'Compras';
  if (a.includes('disgraf') || a.includes('grafic') || a.includes('color')) return 'Disgraf';
  if (a.includes('costo') || a.includes('preci')) return 'Costos';
  if (a.includes('comunic') || a.includes('look') || a.includes('redes')) return 'Comunicaciones';
  return String(val ?? '').trim() || 'General';
}

function normProceso(val) {
  const p = String(val ?? '').trim();
  return p.replace(/\s+/g, ' ') || 'Sin Proceso';
}

function parseXlsxToGrid(filePath) {
  const buffer = fs.readFileSync(filePath);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error('El archivo no es un Excel .xlsx válido.');

  const count = buffer.readUInt16LE(eocd + 10);
  const offset = buffer.readUInt32LE(eocd + 16);
  let ptr = offset;
  const entries = {};
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(ptr) !== 0x02014b50) break;
    const compMethod = buffer.readUInt16LE(ptr + 10);
    const compSize = buffer.readUInt32LE(ptr + 20);
    const nameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localHdr = buffer.readUInt32LE(ptr + 42);
    const name = buffer.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    entries[name] = { compMethod, compSize, localHdr };
    ptr += 46 + nameLen + extraLen + commentLen;
  }

  function extract(name) {
    const e = entries[name];
    if (!e) return null;
    const lNameLen = buffer.readUInt16LE(e.localHdr + 26);
    const lExtraLen = buffer.readUInt16LE(e.localHdr + 28);
    const start = e.localHdr + 30 + lNameLen + lExtraLen;
    const comp = buffer.subarray(start, start + e.compSize);
    if (e.compMethod === 0) return comp.toString('utf8');
    if (e.compMethod === 8) return zlib.inflateRawSync(comp).toString('utf8');
    throw new Error('Método de compresión ZIP no soportado');
  }

  // Shared strings
  const sharedStrings = [];
  const ssXml = extract('xl/sharedStrings.xml');
  if (ssXml) {
    const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
    let match;
    while ((match = siRegex.exec(ssXml)) !== null) {
      const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
      let tMatch;
      let s = '';
      while ((tMatch = tRegex.exec(match[1])) !== null) {
        s += tMatch[1];
      }
      // Decode basic XML entities
      s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
      sharedStrings.push(s);
    }
  }

  // Worksheets
  const sheetEntry = Object.keys(entries).find(k => /^xl\/worksheets\/sheet1\.xml$/i.test(k)) ||
                     Object.keys(entries).find(k => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k));
  if (!sheetEntry) throw new Error('No se encontró hoja de cálculo dentro del Excel.');

  const sheetXml = extract(sheetEntry);

  function colRefToIndex(ref) {
    const m = ref.match(/^[A-Z]+/);
    if (!m) return 0;
    const letters = m[0];
    let idx = 0;
    for (let i = 0; i < letters.length; i++) {
      idx = idx * 26 + (letters.charCodeAt(i) - 64);
    }
    return idx - 1;
  }

  const grid = [];
  const rowRegex = /<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/gi;
  const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rIdx = parseInt(rowMatch[1], 10) - 1;
    const rowContent = rowMatch[2];
    const row = [];
    cellRegex.lastIndex = 0;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const attrs = cellMatch[1];
      const body = cellMatch[2] || '';
      const cRef = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1];
      if (!cRef) continue;
      const cType = (attrs.match(/\bt="([^"]+)"/) || [])[1];
      const valV = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      const valT = (body.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1];
      const valText = valV !== undefined ? valV : valT;
      const cIdx = colRefToIndex(cRef);

      let val = null;
      if (valText !== undefined && valText !== null) {
        if (cType === 's') {
          const sIdx = parseInt(valText, 10);
          val = sharedStrings[sIdx] ?? null;
        } else if (cType === 'inlineStr' || cType === 'str') {
          val = valText.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        } else {
          val = valText;
        }
      }
      row[cIdx] = val;
    }
    grid[rIdx] = row;
  }

  return grid;
}

function parseCsvToGrid(filePath) {
  let text = fs.readFileSync(filePath, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';

  return lines.map(line => {
    const row = [];
    let insideQuotes = false;
    let curr = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          curr += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (ch === sep && !insideQuotes) {
        row.push(curr.trim());
        curr = '';
      } else {
        curr += ch;
      }
    }
    row.push(curr.trim());
    return row;
  });
}

function buildCronogramaFromGrid(grid, fileName) {
  if (!grid || grid.length < 4) {
    throw new Error('El archivo no contiene suficientes filas (mínimo 4).');
  }

  const r1 = grid[0] || [];
  const r2 = grid[1] || [];
  const campaigns = [];

  const maxCols = Math.max(r1.length, r2.length, (grid[2] || []).length);
  for (let c = 6; c < maxCols; c += 2) {
    const adv = String(r1[c] ?? '').trim();
    const nal = String(r2[c] ?? '').trim();
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
    throw new Error('No se detectaron columnas de campañas a partir de la columna G.');
  }

  const activities = [];
  for (let r = 3; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.length < 2) continue;
    const noRaw = row[0];
    const actName = String(row[1] ?? '').trim().replace(/\s+/g, ' ');
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
      // Auto-detect whether date is at c or c + 1
      let fVal = null;
      let dhVal = null;
      if (normalizeDateCell(row[c + 1])) {
        fVal = row[c + 1];
        dhVal = row[c];
      } else if (normalizeDateCell(row[c])) {
        fVal = row[c];
        dhVal = row[c - 1];
      } else {
        // Fallback
        fVal = row[c + 1] !== undefined ? row[c + 1] : row[c];
        dhVal = row[c] !== undefined ? row[c] : row[c - 1];
      }

      dhMap[camp.id] = dhVal !== undefined && dhVal !== null && dhVal !== '' ? parseInt(dhVal, 10) || 0 : dias;
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
    title: 'CRONOGRAMA AZZORTI LIVVA 2026-2027-2028-2029',
    sourceFile: fileName,
    updatedAt: new Date().toISOString().slice(0, 10),
    campaigns,
    activities,
  };
}

// MAIN EXECUTION
function main() {
  let targetFile = process.argv[2];

  if (!targetFile) {
    // Buscar archivos .xlsx o .csv en la carpeta actual o padre, priorizando el más reciente
    const getCandidates = (dir) => {
      try {
        return fs.readdirSync(dir)
          .filter(f => (f.endsWith('.xlsx') || f.endsWith('.csv')) && !f.startsWith('~$'))
          .map(f => {
            const full = dir === '.' ? f : path.join(dir, f);
            return { file: full, mtime: fs.statSync(full).mtimeMs };
          });
      } catch (e) {
        return [];
      }
    };

    let candidates = getCandidates('.').sort((a, b) => b.mtime - a.mtime);
    if (candidates.length === 0) {
      candidates = getCandidates('..').sort((a, b) => b.mtime - a.mtime);
    }

    if (candidates.length > 0) {
      targetFile = candidates[0].file;
      console.log(`ℹ️ Archivo Excel más reciente detectado automáticamente: "${targetFile}"`);
    } else {
      console.error('❌ Error: No se encontró ningún archivo .xlsx o .csv.');
      console.log('Uso: node actualizar_cronograma.cjs "nombre_del_archivo.xlsx"');
      process.exit(1);
    }
  }

  console.log(`🚀 Leyendo: ${targetFile}...`);
  const ext = path.extname(targetFile).toLowerCase();

  let grid;
  if (ext === '.xlsx') {
    grid = parseXlsxToGrid(targetFile);
  } else if (ext === '.csv') {
    grid = parseCsvToGrid(targetFile);
  } else {
    console.error('❌ Formato no soportado. Debe ser .xlsx o .csv');
    process.exit(1);
  }

  const fileName = path.basename(targetFile);
  const cronogramaData = buildCronogramaFromGrid(grid, fileName);

  console.log(`✅ Campañas detectadas: ${cronogramaData.campaigns.length}`);
  console.log(`✅ Actividades procesadas: ${cronogramaData.activities.length}`);

  // Backup anterior
  const targetOutput = path.join(__dirname, 'datos_cronograma.js');
  if (fs.existsSync(targetOutput)) {
    const backupPath = path.join(__dirname, 'datos_cronograma.backup.js');
    fs.copyFileSync(targetOutput, backupPath);
    console.log(`📦 Copia de seguridad guardada en: datos_cronograma.backup.js`);
  }

  const jsContent = `window.CRONOGRAMA_INITIAL_DATA = ${JSON.stringify(cronogramaData, null, 2)};\n`;
  fs.writeFileSync(targetOutput, jsContent, 'utf8');

  console.log(`🎉 ¡ÉXITO! Se ha actualizado "${targetOutput}" correctamente.`);
  console.log(`💡 Solo abre o recarga el Dashboard en tu navegador (Ctrl + F5) para ver las nuevas fechas.`);
}

main();
