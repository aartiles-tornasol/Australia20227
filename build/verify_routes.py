"""Comprueba que cada ruta sigue carreteras (geometría OSRM densa) y pasa por las paradas correctas y en orden."""
import json, math
from content_days import DAYS
C = json.load(open("coords.json"))
def hav(a, b):
    R = 6371000; la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    return 2 * R * math.asin(math.sqrt(math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))
def seg_dist(p, a, b):
    # distancia aproximada punto-segmento en metros (proyección equirectangular local)
    k = math.cos(math.radians(p[0]))
    ax, ay, bx, by, px, py = a[1] * k, a[0], b[1] * k, b[0], p[1] * k, p[0]
    dx, dy = bx - ax, by - ay
    t = 0 if dx == dy == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return hav(p, (ay + t * dy, (ax + t * dx) / k)), t
bad = 0
for d in DAYS:
    fc = json.load(open(f"../site/data/routes/day-{d['n']:02d}.geojson"))
    for f in fc["features"]:
        pr = f["properties"]; mode = pr["mode"]
        if mode in ("boat", "flight"): continue
        line = [(y, x) for x, y in f["geometry"]["coordinates"]]
        # distancia de cada parada a la línea y posición a lo largo de ella
        # búsqueda monótona: cada parada debe estar cerca de la línea DESPUÉS de la anterior (pasa en orden)
        pos = []; start = 0
        for pid in pr["ids"]:
            best = (1e18, start)
            for i in range(int(start), len(line) - 1):
                dd, t = seg_dist(C[pid], line[i], line[i + 1])
                if dd < best[0]: best = (dd, i + t)
            pos.append(best); start = best[1]
        order_ok = True
        far = [(pid, round(dd)) for pid, (dd, _) in zip(pr["ids"], pos) if dd > 600]
        straight = sum(hav(C[a], C[b]) for a, b in zip(pr["ids"], pr["ids"][1:])) / 1000
        ratio = pr["km"] / straight if straight else 1
        # densidad: puntos por km (una línea recta tendría ~0)
        density = len(line) / max(pr["km"], 0.1)
        flag = []
        if far: flag.append(f"lejos {far}")
        if not order_ok: flag.append("ORDEN")
        if ratio > 2.2 and mode not in ("hike", "walk") and pr["km"] > 6: flag.append(f"rodeo x{ratio:.1f}")
        if density < 0.8 and pr["km"] > 5: flag.append(f"pocos puntos {density:.1f}/km")
        bad += bool(flag)
        print(f"día {d['n']:2d} {mode:8s} {pr['km']:6.1f} km  recta {straight:6.1f}  x{ratio:.2f}  {len(line):4d} pts  {'  '.join(flag) or 'OK'}")
print("\nPROBLEMAS:", bad)
