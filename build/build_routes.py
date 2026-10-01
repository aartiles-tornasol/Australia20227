"""Calcula EN BUILD las rutas de cada día con OSRM y las guarda como GeoJSON en site/data/routes/."""
import json, math, os, time, urllib.request
import trails
from content_days import DAYS, AIRPORTS
UA = "AustraliaTripGuide/1.0 (https://github.com/aartiles-tornasol/MyTraining)"
C = json.load(open("coords.json"))
OUT = "../site/data/routes"; os.makedirs(OUT, exist_ok=True)
CACHE = "osrm_cache.json"
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
SERVERS = {"car": "https://router.project-osrm.org/route/v1/driving/",
           "foot": "https://routing.openstreetmap.de/routed-foot/route/v1/foot/"}
AIRPORT_OF = {"mel-airport": "MEL", "cns-airport": "CNS", "hba-airport": "HBA", "lst-airport": "LST"}

def osrm(profile, pts):
    key = profile + "|" + ";".join(f"{lon:.5f},{lat:.5f}" for lat, lon in pts)
    if key not in cache:
        url = SERVERS[profile] + ";".join(f"{lon:.5f},{lat:.5f}" for lat, lon in pts) + "?overview=full&geometries=geojson&steps=false"
        for i in range(6):
            try:
                r = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60))
                if r.get("code") == "Ok": break
                raise RuntimeError(r)
            except Exception as e:
                print("  retry", e); time.sleep(3 * (i + 1))
        cache[key] = {"coords": r["routes"][0]["geometry"]["coordinates"],
                      "legs": [(l["distance"], l["duration"]) for l in r["routes"][0]["legs"]],
                      "snap": [(w["location"], w["distance"]) for w in r["waypoints"]]}
        json.dump(cache, open(CACHE, "w")); time.sleep(1.2)
    return cache[key]

def dp(points, tol):
    """Douglas-Peucker sobre [lon,lat]."""
    if len(points) < 3: return points
    def pd(p, a, b):
        (x, y), (x1, y1), (x2, y2) = p, a, b
        dx, dy = x2 - x1, y2 - y1
        if dx == dy == 0: return math.hypot(x - x1, y - y1)
        t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
        return math.hypot(x - x1 - t * dx, y - y1 - t * dy)
    keep = [False] * len(points); keep[0] = keep[-1] = True; stack = [(0, len(points) - 1)]
    while stack:
        s, e = stack.pop(); dmax, idx = 0, 0
        for i in range(s + 1, e):
            d = pd(points[i], points[s], points[e])
            if d > dmax: dmax, idx = d, i
        if dmax > tol: keep[idx] = True; stack += [(s, idx), (idx, e)]
    return [[round(p[0], 5), round(p[1], 5)] for p, k in zip(points, keep) if k]

def gc_arc(a, b, n=64, bulge=0.0):
    """Arco de círculo máximo entre a y b ([lat,lon]); devuelve [[lon,lat]]."""
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    d = 2 * math.asin(math.sqrt(math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))
    out = []
    for i in range(n + 1):
        f = i / n
        A = math.sin((1 - f) * d) / math.sin(d); B = math.sin(f * d) / math.sin(d)
        x = A * math.cos(la1) * math.cos(lo1) + B * math.cos(la2) * math.cos(lo2)
        y = A * math.cos(la1) * math.sin(lo1) + B * math.cos(la2) * math.sin(lo2)
        z = A * math.sin(la1) + B * math.sin(la2)
        out.append([math.degrees(math.atan2(y, x)), math.degrees(math.atan2(z, math.hypot(x, y)))])
    if bulge:  # curva visual para vuelos cortos
        (x0, y0), (x1, y1) = out[0], out[-1]
        nx, ny = -(y1 - y0), (x1 - x0)
        for i, p in enumerate(out):
            s = math.sin(math.pi * i / n) * bulge
            p[0] += nx * s; p[1] += ny * s
    return [[round(x, 4), round(y, 4)] for x, y in out]

def haversine(a, b):
    R = 6371; la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    return 2 * R * math.asin(math.sqrt(math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))

summary = {}
report = []
for day in DAYS:
    feats = []; drive_km = drive_min = walk_km = walk_min = 0
    for mode, ids in day["legs"]:
        pts = [tuple(C[i]) for i in ids]
        if mode in ("drive", "transfer", "tram", "shuttle", "walk"):
            r = osrm("foot" if mode == "walk" else "car", pts)
            km = sum(l[0] for l in r["legs"]) / 1000; mins = sum(l[1] for l in r["legs"]) / 60
            if mode == "walk": mins = km / 4.5 * 60  # paso turista realista
            geom = dp(r["coords"], 0.00008 if mode == "walk" else 0.00025)
            for (loc, dist), pid in zip(r["snap"], ids):
                if dist > 400: report.append(f"día {day['n']}: {pid} snap a {dist:.0f} m del punto")
            legs = [{"from": ids[k], "to": ids[k + 1], "km": round(l[0] / 1000, 1), "min": round(l[1] / 60)} for k, l in enumerate(r["legs"])]
            if mode == "drive": drive_km += km; drive_min += mins
            if mode == "walk": walk_km += km; walk_min += mins
        elif mode == "hike":
            coords, m = trails.route("freycinet", pts)
            km = m / 1000; mins = km / 2 * 60; geom = dp(coords, 0.00004); legs = []
            walk_km += km; walk_min += mins
        elif mode == "boat":
            geom = [[p[1], p[0]] for p in pts]; km = haversine(pts[0], pts[-1]); mins = None; legs = []
        elif mode == "flight":
            geom = gc_arc(pts[0], pts[1], 48, 0.12); km = haversine(pts[0], pts[1]); mins = None; legs = []
        feats.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": geom},
                      "properties": {"mode": mode, "ids": ids, "km": round(km, 1), "min": round(mins) if mins else None, "legs": legs}})
    fc = {"type": "FeatureCollection", "features": feats}
    json.dump(fc, open(f"{OUT}/day-{day['n']:02d}.geojson", "w"), separators=(",", ":"))
    summary[day["n"]] = {"driveKm": round(drive_km), "driveMin": round(drive_min), "walkKm": round(walk_km, 1), "walkMin": round(walk_min)}
    print(f"día {day['n']:2d}: coche {drive_km:6.1f} km {drive_min/60:4.1f} h · a pie {walk_km:4.1f} km")
json.dump(summary, open("route_summary.json", "w"), indent=1)
print("\n".join(report) or "todas las paradas a <400 m de la carretera")
