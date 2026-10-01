"""Descarga las fotos elegidas (selections.py) a ~1200 px webp + miniatura 480 px, con autor y licencia."""
import json, os, re, time, io, urllib.request, html
from PIL import Image, ImageOps
from selections import SEL, NOTES
UA = "AustraliaTripGuide/1.0 (https://github.com/aartiles-tornasol/MyTraining; build-time photo fetch)"
OUT = "../site/img"; os.makedirs(OUT + "/sm", exist_ok=True)
cands = json.load(open("candidates.json"))
extra = json.load(open("candidates_extra.json")) if os.path.exists("candidates_extra.json") else {}
more = json.load(open("candidates_more.json")) if os.path.exists("candidates_more.json") else {}
def pick(pid, i):
    if not isinstance(i, tuple): return (cands.get(pid, []) + extra.get(pid, []))[i]
    src, j = i
    if src.startswith("more:"): return more[src[5:]][j]
    if src.startswith("extra:"): return extra[src[6:]][j]
    return cands[src][j]
PF = "photos.json"
photos = {}
def get(url):
    for i in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90) as r: return r.read()
        except Exception as e:
            print("   retry", str(e)[:50]); time.sleep(5 * (i + 1))
    raise RuntimeError(url)
def clean(s):
    s = html.unescape(re.sub(r"\s+", " ", s)).strip()
    return s[:80] or "Autor desconocido"
for pid, idxs in SEL.items():
    if not idxs: continue
    pool = cands.get(pid, []) + extra.get(pid, [])
    photos[pid] = []
    for k, i in enumerate(idxs):
        c = pick(pid, i); name = f"{pid}-{k}.webp"
        if not os.path.exists(f"{OUT}/{name}"):
            w = 1280 if c["w"] >= 1280 else 960  # tamaños de miniatura estándar de Wikimedia
            url = re.sub(r"/\d+px-", f"/{w}px-", c["thumb"])
            try:
                im = Image.open(io.BytesIO(get(url))); im = ImageOps.exif_transpose(im).convert("RGB")
            except Exception as e:
                print("  FALLO", pid, k, str(e)[:80], flush=True); continue
            im.thumbnail((1200, 1200)); im.save(f"{OUT}/{name}", "WEBP", quality=78, method=6)
            sm = im.copy(); sm.thumbnail((520, 520)); sm.save(f"{OUT}/sm/{name}", "WEBP", quality=72, method=6)
            time.sleep(0.8)
        im = Image.open(f"{OUT}/{name}")
        photos[pid].append({"src": f"img/{name}", "sm": f"img/sm/{name}", "w": im.width, "h": im.height,
                            "title": c["title"][5:], "artist": clean(c["artist"]), "license": c["license"], "page": c["page"],
                            **({"note": NOTES[pid]} if pid in NOTES and k == 0 else {})})
    print(pid, len(photos[pid]), flush=True)
json.dump(photos, open(PF, "w"), indent=0, ensure_ascii=False)
