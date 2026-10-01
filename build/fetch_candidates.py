"""Busca candidatas en Commons y descarga miniaturas para revisarlas visualmente (hojas de contacto)."""
import json, os, sys, time, re, urllib.request, urllib.parse, io
from PIL import Image, ImageDraw, ImageFont
from photo_queries import Q
from content_places import INFO
UA = "AustraliaTripGuide/1.0 (https://github.com/aartiles-tornasol/MyTraining; build-time photo fetch)"
API = "https://commons.wikimedia.org/w/api.php?"
FREE = re.compile(r"^(cc[- ]by|cc[- ]by[- ]sa|cc0|public domain|pd)", re.I)
os.makedirs("cand", exist_ok=True); os.makedirs("sheets", exist_ok=True)
CF = "candidates.json"
cands = json.load(open(CF)) if os.path.exists(CF) else {}

def get(url, binary=False):
    for i in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                data = r.read()
            return data if binary else json.loads(data)
        except Exception as e:
            wait = 5 * (i + 1); print("   retry", str(e)[:60], wait); time.sleep(wait)
    raise RuntimeError(url)

def search(q, n):
    # api.wikimedia.org (búsqueda en Commons) + metadatos vía en.wikipedia (repositorio compartido): menos 429 que commons
    r = get("https://api.wikimedia.org/core/v1/commons/search/page?" + urllib.parse.urlencode({"q": q, "limit": min(n * 2, 40)}))
    titles = [p["title"] for p in r.get("pages", []) if p["title"].startswith("File:") and re.search(r"[.](jpe?g|png|webp)$", p["title"], re.I)]
    time.sleep(1)
    if not titles: return []
    p = {"action": "query", "format": "json", "titles": "|".join(titles[:40]), "prop": "imageinfo",
         "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 360,
         "iiextmetadatafilter": "LicenseShortName|Artist|ImageDescription|DateTimeOriginal"}
    rr = get("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(p)); time.sleep(1)
    pages = {pg["title"]: pg for pg in rr.get("query", {}).get("pages", {}).values()}
    norm = {x["from"]: x["to"] for x in rr.get("query", {}).get("normalized", [])}
    out = []
    for t in titles:
        pg = pages.get(norm.get(t, t))
        if not pg or "imageinfo" not in pg: continue
        ii = pg["imageinfo"][0]; em = ii.get("extmetadata", {})
        lic = em.get("LicenseShortName", {}).get("value", "")
        if ii.get("mime") not in ("image/jpeg", "image/png", "image/webp"): continue
        if ii.get("width", 0) < 1000 or not FREE.match(lic.strip()): continue
        out.append({"title": pg["title"], "thumb": ii["thumburl"], "url": ii["url"], "w": ii["width"], "h": ii["height"], "license": lic,
                    "artist": re.sub("<[^>]+>", "", em.get("Artist", {}).get("value", "")).strip(), "page": ii.get("descriptionurl")})
        if len(out) >= n: break
    return out

def sheet(pid, items):
    cell, cols = 360, 4
    rows = (len(items) + cols - 1) // cols
    img = Image.new("RGB", (cols * cell, rows * (cell * 3 // 4 + 24)), "white")
    d = ImageDraw.Draw(img)
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
    except Exception: font = ImageFont.load_default()
    for k, it in enumerate(items):
        fn = f"cand/{pid}-{k}.jpg"
        if not os.path.exists(fn):
            open(fn, "wb").write(get(it["thumb"], True)); time.sleep(0.5)
        im = Image.open(fn).convert("RGB"); im.thumbnail((cell - 8, cell * 3 // 4 - 4))
        x, y = (k % cols) * cell, (k // cols) * (cell * 3 // 4 + 24)
        img.paste(im, (x + 4, y + 24))
        d.text((x + 6, y + 2), f"{k}  {it['title'][5:40]}", fill="black", font=font)
    img.save(f"sheets/{pid}.jpg", quality=80)

if __name__ == "__main__":
    only = sys.argv[1:]
    for pid, qs in Q.items():
        if only and pid not in only: continue
        if pid not in cands:
            n = 12 if INFO[pid].get("star") else 8
            seen, items = set(), []
            for q in qs:
                for it in search(q, n):
                    if it["title"] not in seen: seen.add(it["title"]); items.append(it)
            cands[pid] = items[:16]
            json.dump(cands, open(CF, "w"), indent=0)
        sheet(pid, cands[pid])
        print(pid, len(cands[pid]), flush=True)
