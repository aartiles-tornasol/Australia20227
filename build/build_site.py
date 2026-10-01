"""Genera site/data/trip.json con todo lo que necesita la página (sin llamadas a APIs en el cliente)."""
import json, os, urllib.parse
from datetime import date
from places import PLACES
from content_places import INFO
from content_days import DAYS, TRAMOS, INTL_FLIGHTS, DOMESTIC_FLIGHTS, AIRPORTS
C = json.load(open("coords.json"))
R = json.load(open("route_summary.json"))
P = json.load(open("photos.json")) if os.path.exists("photos.json") else {}
REUSE = {"mel-airport-hotel": "mel-airport"}  # sitios que comparten foto
DOW = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

def gmaps_search(q): return "https://www.google.com/maps/search/?api=1&query=" + urllib.parse.quote(q)
def gmaps_dir(dest, origin=None, waypoints=(), mode="driving"):
    p = {"api": "1"}
    if origin: p["origin"] = origin
    p["destination"] = dest
    if waypoints: p["waypoints"] = "|".join(waypoints)
    p["travelmode"] = mode
    return "https://www.google.com/maps/dir/?" + urllib.parse.urlencode(p, quote_via=urllib.parse.quote, safe="|")

def chunk_links(ids, mode):
    """Máximo 3 waypoints por enlace (límite de la app móvil): cada enlace cubre ≤5 puntos y el siguiente empieza donde acaba."""
    out, i = [], 0
    while i < len(ids) - 1:
        seg = ids[i:i + 5]
        q = [PLACES[x][1] for x in seg]
        out.append({"from": seg[0], "to": seg[-1], "stops": seg, "mode": mode,
                    "url": gmaps_dir(q[-1], q[0], q[1:-1], mode)})
        i += len(seg) - 1
    return out

places = {}
for pid, (name, gq, nq, _) in PLACES.items():
    inf = INFO[pid]
    places[pid] = {"name": name, "q": gq, "ll": C[pid], "desc": inf["desc"], "dur": inf.get("dur", ""), "tip": inf.get("tip", ""),
                   "star": bool(inf.get("star")), "maps": gmaps_search(gq), "dir": gmaps_dir(gq),
                   "photos": P.get(REUSE.get(pid, pid), [])}
missing = [p for p in places if not places[p]["photos"]]
if missing: print("SIN FOTO:", missing)

MODE_GM = {"drive": "driving", "transfer": "driving", "walk": "walking", "tram": "transit"}
days = []
for d in DAYS:
    dt = date.fromisoformat(d["date"])
    links = []
    # agrupa tramos consecutivos del mismo modo de Google para enlazarlos
    groups = []
    for mode, ids in d["legs"]:
        gm = MODE_GM.get(mode)
        if not gm or any(i not in PLACES for i in ids): continue
        if groups and groups[-1][0] == gm and groups[-1][1][-1] == ids[0]:
            groups[-1][1].extend(ids[1:])
        else:
            groups.append([gm, list(ids)])
    for gm, ids in groups:
        ids = [x for k, x in enumerate(ids) if k == 0 or x != ids[k - 1]]
        links += chunk_links(ids, gm)
    days.append({**{k: v for k, v in d.items() if k != "legs"},
                 "legs": [{"mode": m, "ids": ids} for m, ids in d["legs"]],
                 "dow": DOW[dt.weekday()], "label": f"{DOW[dt.weekday()]} {dt.day} {MES[dt.month - 1]}",
                 "stats": R[str(d["n"])], "links": links, "warn": d.get("warn", ""), "flights": d.get("flights", [])})

tramos = {}
for t, info in TRAMOS.items():
    tdays = [d for d in days if t in d["tramos"]]
    km = 0
    for d in tdays:
        if len(d["tramos"]) > 1:  # día 10: la conducción es del trópico
            if t == d["tramos"][0]: km += d["stats"]["driveKm"]
        else: km += d["stats"]["driveKm"]
    tramos[t] = {**info, "days": [d["n"] for d in tdays], "km": km}
# noches por tramo según dónde se duerme
SLEEP_TRAMO = {}
for d in days:
    if not d["sleep"]: continue
    s = d["sleep"]
    t = "tasmania" if s in ("hobart", "colesbay", "cosycorner") else "tropico" if s in ("cairns", "portdouglas", "yungaburra") else "victoria"
    SLEEP_TRAMO.setdefault(t, []).append({"day": d["n"], "place": s})
for t in tramos:
    tramos[t]["sleeps"] = SLEEP_TRAMO[t]; tramos[t]["nights"] = len(SLEEP_TRAMO[t])

trip = {"places": places, "days": days, "tramos": tramos, "intl": INTL_FLIGHTS, "domestic": DOMESTIC_FLIGHTS, "airports": AIRPORTS,
        "totals": {"km": sum(d["stats"]["driveKm"] for d in days), "nights": sum(t["nights"] for t in tramos.values()),
                   "days": len(days), "flights": len(INTL_FLIGHTS) + len(DOMESTIC_FLIGHTS),
                   "photos": sum(len(v) for v in P.values())}}
json.dump(trip, open("../site/data/trip.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("trip.json", os.path.getsize("../site/data/trip.json") // 1024, "KB ·", trip["totals"])
for t, v in tramos.items(): print(t, v["km"], "km", v["nights"], "noches")
