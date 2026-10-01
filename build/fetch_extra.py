"""Segunda búsqueda para sitios cuyas candidatas no mostraban el lugar correcto."""
import json, os, sys
import fetch_candidates as fc  # reutiliza search() y sheet()
EXTRA_Q = {
 "memarch": ["Memorial Arch Eastern View", "Great Ocean Road Memorial Arch Eastern View", "Great Ocean Road arch sign"],
 "portcampbell": ["Port Campbell township", "Port Campbell jetty", "Port Campbell bay beach"],
 "discovery": ["Daintree Discovery Centre tower", "Daintree canopy tower", "Daintree Rainforest boardwalk Cow Bay"],
 "mareeba": ["Mareeba coffee", "Mareeba Wetlands", "Mareeba Byrnes Street"],
 "spiky": ["Spiky Bridge Swansea Tasmania", "Spiky Bridge Tasmania convict built", "Spiky Bridge Tasman Highway"],
 "churchill": ["Churchill Island homestead", "Churchill Island Victoria bridge", "Churchill Island heritage farm cottage"],
 "lillypilly": ["Lilly Pilly Gully walk", "Wilsons Promontory rainforest", "Lilly Pilly Gully Wilsons Promontory tree fern"],
 "nightmarkets": ["Cairns Night Market", "Cairns night market Esplanade food"],
}
EF = "candidates_extra.json"
extra = json.load(open(EF)) if os.path.exists(EF) else {}
for pid, qs in EXTRA_Q.items():
    if sys.argv[1:] and pid not in sys.argv[1:]: continue
    if pid not in extra:
        base = {c["title"] for c in fc.cands.get(pid, [])}
        seen, items = set(base), []
        for q in qs:
            for it in fc.search(q, 8):
                if it["title"] not in seen: seen.add(it["title"]); items.append(it)
        extra[pid] = items[:12]
        json.dump(extra, open(EF, "w"), indent=0)
    # hoja con índices desplazados (continúan tras las candidatas originales)
    off = len(fc.cands.get(pid, []))
    fc.sheet(f"{pid}-extra", extra[pid]) if extra[pid] else None
    print(pid, "extra", len(extra[pid]), "offset", off, flush=True)
