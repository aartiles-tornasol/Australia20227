import json, math, time, os, urllib.request, urllib.parse
from places import PLACES
UA = "AustraliaTripGuide/1.0 (https://github.com/aartiles-tornasol/MyTraining)"
CACHE = "geocode_cache.json"
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
def dist(a, b):
    R=6371; la1,lo1,la2,lo2=map(math.radians,(a[0],a[1],b[0],b[1]))
    return 2*R*math.asin(math.sqrt(math.sin((la2-la1)/2)**2+math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2))
for pid,(name,gq,nq,approx) in PLACES.items():
    if nq not in cache:
        url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": nq, "format":"json","limit":3,"countrycodes":"au"})
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        for attempt in range(8):
            try:
                cache[nq] = json.load(urllib.request.urlopen(req)); break
            except Exception as e:
                time.sleep(5*(attempt+1))
        else:
            cache[nq] = []
        json.dump(cache, open(CACHE,"w"), indent=0)
        time.sleep(2.5)
    res = cache[nq]
    if not res: print(f"{pid:18s} NO RESULT"); continue
    best = min(res, key=lambda r: dist(approx,(float(r['lat']),float(r['lon']))))
    d = dist(approx,(float(best['lat']),float(best['lon'])))
    flag = "  <<<" if d > 2 else ""
    print(f"{pid:18s} {d:6.2f}km {best['lat'][:9]},{best['lon'][:9]} {best['display_name'][:70]}{flag}")
json.dump(cache, open(CACHE,"w"), indent=0)
