"""Búsquedas adicionales directas en la API de Commons (con reintentos) para sitios difíciles."""
import json, os, sys, time, urllib.parse
import fetch_candidates as fc
MORE = {
 "memarch": ["intitle:arch \"Great Ocean Road\"", "\"Eastern View\" arch", "Memorial Arch Great Ocean Road Victoria"],
 "portcampbell": ["\"Port Campbell\" town", "\"Port Campbell\" beach", "\"Port Campbell\" bay"],
 "discovery": ["\"Daintree Discovery Centre\"", "\"Daintree Rainforest Discovery Centre\"", "Daintree canopy tower"],
 "spiky": ["\"Spiky Bridge\"", "Spiky Bridge Swansea Tasmania"],
 "churchill": ["\"Churchill Island\"", "Churchill Island homestead Phillip Island"],
 "nightmarkets": ["\"Night Markets\" Cairns", "Cairns Night Markets"],
 "lillypilly": ["\"Lilly Pilly Gully\"", "Wilsons Promontory rainforest gully", "Wilsons Promontory tree ferns"],
}
MF = "candidates_more.json"
more = json.load(open(MF)) if os.path.exists(MF) else {}
def csearch(q, n=10):
    p = {"action": "query", "format": "json", "list": "search", "srsearch": q + " filetype:bitmap", "srnamespace": 6, "srlimit": n}
    r = fc.get(fc.API + urllib.parse.urlencode(p)); time.sleep(3)
    return [x["title"] for x in r.get("query", {}).get("search", [])]
def info(titles):
    p = {"action": "query", "format": "json", "titles": "|".join(titles), "prop": "imageinfo",
         "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 360, "iiextmetadatafilter": "LicenseShortName|Artist"}
    rr = fc.get("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(p)); time.sleep(1)
    out = []
    for pg in rr.get("query", {}).get("pages", {}).values():
        ii = (pg.get("imageinfo") or [{}])[0]; em = ii.get("extmetadata", {})
        lic = em.get("LicenseShortName", {}).get("value", "")
        if ii.get("mime") not in ("image/jpeg", "image/png") or ii.get("width", 0) < 1000 or not fc.FREE.match(lic.strip()): continue
        out.append({"title": pg["title"], "thumb": ii["thumburl"], "url": ii["url"], "w": ii["width"], "h": ii["height"], "license": lic,
                    "artist": fc.re.sub("<[^>]+>", "", em.get("Artist", {}).get("value", "")).strip(), "page": ii.get("descriptionurl")})
    return out
for pid, qs in MORE.items():
    if sys.argv[1:] and pid not in sys.argv[1:]: continue
    if pid not in more:
        seen = {c["title"] for c in fc.cands.get(pid, [])}; titles = []
        for q in qs:
            for t in csearch(q):
                if t not in seen: seen.add(t); titles.append(t)
        more[pid] = info(titles[:30]) if titles else []
        json.dump(more, open(MF, "w"), indent=0)
    if more[pid]: fc.sheet(f"{pid}-more", more[pid][:16])
    print(pid, len(more[pid]), flush=True)
