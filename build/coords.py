"""Resuelve coordenadas finales: Nominatim (más cercano a la aproximación) salvo overrides manuales."""
import json, math
from places import PLACES
# Correcciones manuales tras revisar Nominatim (lat, lon)
OVERRIDE = {
    "fourmile": (-16.4905, 145.4665),      # acceso norte de la playa, junto al pueblo
    "peterson": (-17.2668, 145.5838),      # plataforma de ornitorrincos, puente de Gillies Hwy
    "cosycorner": (-41.22109, 148.28168),
    "dovelake": (-41.6505, 145.9622),      # aparcamiento/inicio del circuito
    "oberon": (-39.0328, 146.3436),        # Telegraph Saddle (inicio de la subida)
    "wineglass": (-42.14545, 148.28920),     # aparcamiento de Wineglass Bay
    "amos": (-42.14545, 148.28920),          # mismo aparcamiento
    "lillypilly": (-39.0243, 146.3340),    # aparcamiento Lilly Pilly Gully
    "mel-airport-hotel": (-37.6905, 144.8480),
    "barrine": (-17.2462, 145.6392),       # casa de té
    "eacham": (-17.2859, 145.6296),        # zona de baño
    "memarch": (-38.4718, 144.0447),
    "melbourne": (-37.8136, 144.9631),
}
# Puntos extra sin enlace propio (sólo para dibujar tramos a pie / barco)
EXTRA = {
    "wineglass-lookout": (-42.15479, 148.29305),
    "wineglass-beach": (-42.16584, 148.29680),
    "amos-summit": (-42.15364, 148.29950),
}
def dist(a, b):
    R=6371; la1,lo1,la2,lo2=map(math.radians,(a[0],a[1],b[0],b[1]))
    return 2*R*math.asin(math.sqrt(math.sin((la2-la1)/2)**2+math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2))
def resolve():
    cache = json.load(open("geocode_cache.json"))
    out = {}
    for pid,(name,gq,nq,approx) in PLACES.items():
        if pid in OVERRIDE: out[pid] = OVERRIDE[pid]; continue
        res = cache.get(nq) or []
        if res:
            best = min(res, key=lambda r: dist(approx,(float(r['lat']),float(r['lon']))))
            out[pid] = (round(float(best['lat']),5), round(float(best['lon']),5))
        else:
            out[pid] = approx
    out.update(EXTRA)
    return out
if __name__ == "__main__":
    c = resolve(); json.dump(c, open("coords.json","w"), indent=1); print(len(c), "coords")
