# -*- coding: utf-8 -*-
"""
Generador de datos comparativos para la vista independiente de Livva:
Compara:
  - Base Octubre: CRONOGRAMA ROPA V1 (2026-2027-2028) 19oct ABS.xlsx (Hoja1)
  - Nuevo Noviembre: CRONOGRAMA V1  2026 2027 FORMULAS_ 18nov 2026.xlsx (Hoja 'Cronograma')

Genera 'datos_comparativo_livva.js' con las actividades de Livva (y compartidas Azz Livv)
emparejadas por nombre exacto + marca + proceso, y con ambos cruces:
  1. Por Campaña NAL Livva (202701..202818) -> refleja el nuevo modelo Solo NAL de Livva
  2. Por Columna ADV (202610..202907) -> refleja variaciones dentro de la misma columna ADV
"""

import os
import json
import datetime
import openpyxl

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FILE_OCT = os.path.join(BASE_DIR, "CRONOGRAMA ROPA V1 (2026-2027-2028) 19oct ABS.xlsx")
FILE_NOV = os.path.join(os.path.dirname(BASE_DIR), "CRONOGRAMA V1  2026 2027 FORMULAS_ 18nov 2026.xlsx")
OUT_FILE = os.path.join(BASE_DIR, "datos_comparativo_livva.js")


def to_ymd(val):
    if isinstance(val, datetime.datetime):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, datetime.date):
        return val.strftime("%Y-%m-%d")
    return None


def norm_txt(s):
    return " ".join(str(s or "").strip().lower().split())


def norm_area(val):
    s = " ".join(str(val or "").strip().split())
    low = s.lower()
    if low in ("aglab", "ag lab", "ag_lab"):
        return "Aglab"
    if low in ("disgraf", "dis graf", "dis_graf"):
        return "DisGraf"
    if low in ("ingenieria", "ingeniería"):
        return "Ingenieria"
    return s or "General"


def norm_proceso(val):
    s = " ".join(str(val or "").strip().split())
    if s == "DisGRaf":
        return "DisGraf"
    if s == "Desarrollos Moda MO ¨Prog 3D y 2D":
        return "Desarrollos Moda MO Prog 3D y 2D"
    return s or "Sin Proceso"


def norm_marca(val):
    s = " ".join(str(val or "").strip().split())
    low = s.lower()
    if low == "livva":
        return "Livva"
    if low == "azzorti":
        return "Azzorti"
    if low in ("azz livv", "azzorti livva", "azzorti_livva"):
        return "Azz Livv"
    return s or "Azz Livv"


def format_nal_label(code_int):
    s = str(code_int)
    if len(s) == 6 and s.isdigit():
        yr = s[:4]
        num = int(s[4:])
        return f"C{num} {yr}"
    return s


def format_adv_nal_label(adv, nal):
    adv_s, nal_s = str(adv), str(nal)
    if len(adv_s) == 6 and len(nal_s) == 6:
        y1, c1 = adv_s[:4], int(adv_s[4:])
        y2, c2 = nal_s[:4], int(nal_s[4:])
        if y1 == y2:
            return f"C{c1}-{c2} {y1}"
        return f"C{c1} ({y1}) - C{c2} ({y2})"
    return f"{adv_s}-{nal_s}"


def calc_start_date(end_ymd, dh):
    if not end_ymd:
        return None
    try:
        d = datetime.date.fromisoformat(end_ymd)
        n = int(round(float(dh))) if dh is not None else 1
        if n <= 1:
            return end_ymd
        rem = n - 1
        while rem > 0:
            d -= datetime.timedelta(days=1)
            if d.weekday() < 5:
                rem -= 1
        return d.strftime("%Y-%m-%d")
    except Exception:
        return end_ymd


def days_diff(ymd_oct, ymd_nov):
    if not ymd_oct or not ymd_nov:
        return None
    d1 = datetime.date.fromisoformat(ymd_oct)
    d2 = datetime.date.fromisoformat(ymd_nov)
    return (d2 - d1).days


def main():
    print("Leyendo archivo Octubre:", FILE_OCT)
    wb_oct = openpyxl.load_workbook(FILE_OCT, data_only=True)
    ws_oct = wb_oct["Hoja1"]

    print("Leyendo archivo Noviembre (Hoja 'Cronograma'):", FILE_NOV)
    wb_nov = openpyxl.load_workbook(FILE_NOV, data_only=True)
    ws_nov = wb_nov["Cronograma"]

    # 1. Mapear campañas de Octubre (Fila 1 ADV, Fila 2 NAL, desde col 7)
    oct_by_nal = {}
    oct_by_adv = {}
    for c in range(7, ws_oct.max_column + 1, 2):
        adv = ws_oct.cell(1, c).value
        nal = ws_oct.cell(2, c).value
        if adv is None or nal is None:
            continue
        adv_i, nal_i = int(adv), int(nal)
        info = {"dh_col": c, "dt_col": c + 1, "adv": adv_i, "nal": nal_i}
        oct_by_nal[nal_i] = info
        oct_by_adv[adv_i] = info

    # 2. Mapear campañas de Noviembre (Fila 6 ADV, Fila 7 Nal Livva, Fila 8 NAL AZZ, Fila 9 DH/FECHA)
    nov_by_nal_livva = {}
    nov_by_adv = {}
    for c in range(9, ws_nov.max_column + 1):
        h = str(ws_nov.cell(9, c).value or "").strip().upper()
        if h != "DH":
            continue
        adv = ws_nov.cell(6, c).value
        nal_livva = ws_nov.cell(7, c).value
        nal_azz = ws_nov.cell(8, c).value
        if adv is None:
            continue
        try:
            adv_i = int(adv)
        except Exception:
            continue
        nal_livva_i = int(nal_livva) if nal_livva is not None else None
        nal_azz_i = int(nal_azz) if nal_azz is not None else None
        info = {
            "dh_col": c,
            "dt_col": c + 1,
            "adv": adv_i,
            "nal_livva": nal_livva_i,
            "nal_azz": nal_azz_i,
        }
        nov_by_adv[adv_i] = info
        if nal_livva_i is not None and nal_livva_i <= 202818:
            nov_by_nal_livva[nal_livva_i] = info

    # 3. Construir listas de campañas comparables
    # A) Por NAL Livva (202701..202818)
    campaigns_nal = []
    for nal_i in sorted(nov_by_nal_livva.keys()):
        if nal_i not in oct_by_nal:
            continue
        o_info = oct_by_nal[nal_i]
        n_info = nov_by_nal_livva[nal_i]
        campaigns_nal.append({
            "id": f"NAL_{nal_i}",
            "nal": nal_i,
            "year": int(str(nal_i)[:4]),
            "shortLabel": f"Livva {format_nal_label(nal_i)}",
            "fullLabel": f"NAL Livva {nal_i} (Oct: ADV {o_info['adv']} / NAL {nal_i} → Nov: col. ADV {n_info['adv']} / NAL AZZ {n_info['nal_azz']})",
            "octAdv": o_info["adv"],
            "novAdv": n_info["adv"],
            "novNalAzz": n_info["nal_azz"],
        })

    # B) Por columna ADV común (202610..202907)
    campaigns_adv = []
    for adv_i in sorted(oct_by_adv.keys()):
        if adv_i not in nov_by_adv:
            continue
        o_info = oct_by_adv[adv_i]
        n_info = nov_by_adv[adv_i]
        campaigns_adv.append({
            "id": f"ADV_{adv_i}",
            "adv": adv_i,
            "nalOct": o_info["nal"],
            "nalLivvaNov": n_info["nal_livva"],
            "nalAzzNov": n_info["nal_azz"],
            "year": int(str(adv_i)[:4]),
            "shortLabel": format_adv_nal_label(adv_i, o_info["nal"]),
            "fullLabel": f"ADV {adv_i} (Oct NAL {o_info['nal']} | Nov NAL Livva {n_info['nal_livva'] or 'N/A'})",
        })

    # 4. Leer actividades de Octubre y Noviembre
    acts_oct = []
    for r in range(4, ws_oct.max_row + 1):
        no = ws_oct.cell(r, 1).value
        if no is None or not str(no).strip().isdigit():
            continue
        marca = norm_marca(ws_oct.cell(r, 4).value)
        if marca not in ("Livva", "Azz Livv"):
            continue
        acts_oct.append({
            "no": int(no),
            "row": r,
            "actividad": str(ws_oct.cell(r, 2).value or "").strip(),
            "proceso": norm_proceso(ws_oct.cell(r, 3).value),
            "marca": marca,
            "area": norm_area(ws_oct.cell(r, 5).value),
            "dias": ws_oct.cell(r, 6).value or 1,
        })

    acts_nov = []
    for r in range(10, ws_nov.max_row + 1):
        no = ws_nov.cell(r, 1).value
        if no is None or not str(no).strip().isdigit():
            continue
        marca = norm_marca(ws_nov.cell(r, 6).value)
        if marca not in ("Livva", "Azz Livv"):
            continue
        acts_nov.append({
            "no": int(no),
            "row": r,
            "actividad": str(ws_nov.cell(r, 2).value or "").strip(),
            "proceso": norm_proceso(ws_nov.cell(r, 5).value),
            "marca": marca,
            "area": norm_area(ws_nov.cell(r, 7).value),
            "dias": ws_nov.cell(r, 8).value or 1,
        })

    # Emparejar por (norm_txt(actividad), marca, proceso)
    nov_map = {}
    for a in acts_nov:
        key = (norm_txt(a["actividad"]), a["marca"], norm_txt(a["proceso"]))
        nov_map.setdefault(key, []).append(a)

    used_nov_rows = set()
    merged_activities = []

    def extract_dates(ws_o, row_o, ws_n, row_n):
        dates_nal = {}
        for cobj in campaigns_nal:
            nal_i = cobj["nal"]
            o_inf = oct_by_nal[nal_i]
            n_inf = nov_by_nal_livva[nal_i]

            o_end = to_ymd(ws_o.cell(row_o, o_inf["dt_col"]).value) if row_o else None
            o_dh = ws_o.cell(row_o, o_inf["dh_col"]).value if row_o else None
            o_dh_num = int(round(float(o_dh))) if isinstance(o_dh, (int, float)) else 1

            n_end = to_ymd(ws_n.cell(row_n, n_inf["dt_col"]).value) if row_n else None
            n_dh = ws_n.cell(row_n, n_inf["dh_col"]).value if row_n else None
            n_dh_num = int(round(float(n_dh))) if isinstance(n_dh, (int, float)) else 1

            if o_end or n_end:
                dates_nal[cobj["id"]] = {
                    "oct": {"end": o_end, "start": calc_start_date(o_end, o_dh_num), "dh": o_dh_num} if o_end else None,
                    "nov": {"end": n_end, "start": calc_start_date(n_end, n_dh_num), "dh": n_dh_num} if n_end else None,
                    "delta": days_diff(o_end, n_end),
                }

        dates_adv = {}
        for cobj in campaigns_adv:
            adv_i = cobj["adv"]
            o_inf = oct_by_adv[adv_i]
            n_inf = nov_by_adv[adv_i]

            o_end = to_ymd(ws_o.cell(row_o, o_inf["dt_col"]).value) if row_o else None
            o_dh = ws_o.cell(row_o, o_inf["dh_col"]).value if row_o else None
            o_dh_num = int(round(float(o_dh))) if isinstance(o_dh, (int, float)) else 1

            n_end = to_ymd(ws_n.cell(row_n, n_inf["dt_col"]).value) if row_n else None
            n_dh = ws_n.cell(row_n, n_inf["dh_col"]).value if row_n else None
            n_dh_num = int(round(float(n_dh))) if isinstance(n_dh, (int, float)) else 1

            if o_end or n_end:
                dates_adv[cobj["id"]] = {
                    "oct": {"end": o_end, "start": calc_start_date(o_end, o_dh_num), "dh": o_dh_num} if o_end else None,
                    "nov": {"end": n_end, "start": calc_start_date(n_end, n_dh_num), "dh": n_dh_num} if n_end else None,
                    "delta": days_diff(o_end, n_end),
                }
        return dates_nal, dates_adv

    uid_counter = 1
    for ao in acts_oct:
        key = (norm_txt(ao["actividad"]), ao["marca"], norm_txt(ao["proceso"]))
        cands = [x for x in nov_map.get(key, []) if x["row"] not in used_nov_rows]
        an = cands[0] if cands else None
        if an:
            used_nov_rows.add(an["row"])

        d_nal, d_adv = extract_dates(ws_oct, ao["row"], ws_nov, an["row"] if an else None)
        merged_activities.append({
            "uid": uid_counter,
            "noOct": ao["no"],
            "noNov": an["no"] if an else None,
            "actividad": ao["actividad"],
            "proceso": ao["proceso"],
            "marca": ao["marca"],
            "area": ao["area"],
            "dias": int(round(float(ao["dias"]))) if isinstance(ao["dias"], (int, float)) else 1,
            "status": "matched" if an else "only_oct",
            "datesNal": d_nal,
            "datesAdv": d_adv,
        })
        uid_counter += 1

    # Actividades nuevas solo en Noviembre (ej. #177 DisGraf Per ABS)
    for an in acts_nov:
        if an["row"] in used_nov_rows:
            continue
        d_nal, d_adv = extract_dates(ws_oct, None, ws_nov, an["row"])
        merged_activities.append({
            "uid": uid_counter,
            "noOct": None,
            "noNov": an["no"],
            "actividad": an["actividad"],
            "proceso": an["proceso"],
            "marca": an["marca"],
            "area": an["area"],
            "dias": int(round(float(an["dias"]))) if isinstance(an["dias"], (int, float)) else 1,
            "status": "only_nov",
            "datesNal": d_nal,
            "datesAdv": d_adv,
        })
        uid_counter += 1

    # Ordenar por número de Noviembre (o Octubre)
    merged_activities.sort(key=lambda a: (a["noNov"] if a["noNov"] is not None else a["noOct"]))

    # Estadísticas rápidas
    livva_only_count = sum(1 for a in merged_activities if a["marca"] == "Livva")
    shared_count = sum(1 for a in merged_activities if a["marca"] == "Azz Livv")

    nal_deltas = []
    for a in merged_activities:
        if a["marca"] == "Livva":
            for v in a["datesNal"].values():
                if v["delta"] is not None:
                    nal_deltas.append(v["delta"])

    avg_shift_nal = round(sum(nal_deltas) / len(nal_deltas), 1) if nal_deltas else 0

    payload = {
        "generatedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "sourceOct": os.path.basename(FILE_OCT),
        "sourceNov": os.path.basename(FILE_NOV),
        "sheetOct": "Hoja1",
        "sheetNov": "Cronograma",
        "stats": {
            "livvaExclusive": livva_only_count,
            "azzLivvShared": shared_count,
            "totalActivities": len(merged_activities),
            "campaignsNalCount": len(campaigns_nal),
            "campaignsAdvCount": len(campaigns_adv),
            "avgShiftNalDays": avg_shift_nal,
        },
        "campaignsNal": campaigns_nal,
        "campaignsAdv": campaigns_adv,
        "activities": merged_activities,
    }

    js_content = (
        "// Generado automaticamente por generar_comparativo_livva.py\n"
        "window.LIVVA_COMPARE_DATA = "
        + json.dumps(payload, ensure_ascii=False)
        + ";\n"
    )
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"OK! Generado {OUT_FILE}")
    print(f"  Actividades Livva exclusivas: {livva_only_count}")
    print(f"  Actividades Azz Livv compartidas: {shared_count}")
    print(f"  Campanas NAL Livva: {len(campaigns_nal)} ({campaigns_nal[0]['shortLabel']} .. {campaigns_nal[-1]['shortLabel']})")
    print(f"  Campanas ADV comunes: {len(campaigns_adv)}")
    print(f"  Corrimiento promedio NAL Livva (Nov - Oct): {avg_shift_nal:+.1f} dias calendario")


if __name__ == "__main__":
    main()
