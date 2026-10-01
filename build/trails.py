"""Senderos a pie calculados sobre un extracto local de OpenStreetMap (el router a pie público no enlaza bien estos senderos)."""
import heapq, math, os, urllib.request
import xml.etree.ElementTree as ET
UA = "AustraliaTripGuide/1.0 (https://github.com/aartiles-tornasol/MyTraining)"
EXTRACTS = {"freycinet": (148.285, -42.170, 148.305, -42.140)}
WALKABLE = {"path", "footway", "steps", "cycleway", "track", "service", "unclassified", "tertiary", "pedestrian"}
_graphs = {}

def _hav(a, b):
    R = 6371000; la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    return 2 * R * math.asin(math.sqrt(math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))

def _graph(name):
    if name in _graphs: return _graphs[name]
    path = f"osm/{name}.osm"
    if not os.path.exists(path):
        w, s, e, n = EXTRACTS[name]
        url = f"https://api.openstreetmap.org/api/0.6/map?bbox={w},{s},{e},{n}"
        open(path, "wb").write(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA})).read())
    root = ET.parse(path).getroot()
    nodes = {n.get("id"): (float(n.get("lat")), float(n.get("lon"))) for n in root.iter("node")}
    adj = {}
    for w in root.iter("way"):
        tags = {t.get("k"): t.get("v") for t in w.iter("tag")}
        if tags.get("highway") not in WALKABLE: continue
        refs = [r.get("ref") for r in w.iter("nd") if r.get("ref") in nodes]
        for a, b in zip(refs, refs[1:]):
            d = _hav(nodes[a], nodes[b])
            adj.setdefault(a, []).append((b, d)); adj.setdefault(b, []).append((a, d))
    _graphs[name] = (nodes, adj); return _graphs[name]

def route(name, pts):
    """pts: [(lat,lon)] -> (coords [[lon,lat]], metros)"""
    nodes, adj = _graph(name)
    near = lambda p: min(adj, key=lambda k: _hav(nodes[k], p))
    coords, total = [], 0
    for a, b in zip(pts, pts[1:]):
        s, t = near(a), near(b)
        dist, prev, pq = {s: 0}, {}, [(0, s)]
        while pq:
            d, u = heapq.heappop(pq)
            if u == t: break
            if d > dist[u]: continue
            for v, w in adj[u]:
                if d + w < dist.get(v, 1e18): dist[v] = d + w; prev[v] = u; heapq.heappush(pq, (d + w, v))
        seq = [t]
        while seq[-1] != s: seq.append(prev[seq[-1]])
        seq.reverse(); total += dist[t]
        coords += [[nodes[k][1], nodes[k][0]] for k in seq]
    return coords, total
