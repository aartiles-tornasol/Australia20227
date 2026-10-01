# Australia 2027 · guía de viaje

Sitio estático (HTML/CSS/JS + Leaflet) publicado en GitHub Pages. Todo lo que necesita la página se calcula
**en build** y se guarda en `site/`: al abrirla sólo se piden teselas de mapa.

## Estructura

- `site/` — la web publicada (`index.html`, `css/`, `js/`, `data/trip.json`, `data/routes/*.geojson`, `img/`).
- `build/` — scripts y contenido:
  - `places.py` (sitios y consultas de Google Maps), `content_places.py` (descripciones), `content_days.py` (día a día, vuelos, tramos).
  - `geocode.py` + `coords.py` — coordenadas (Nominatim + correcciones manuales).
  - `build_routes.py` — rutas por carretera con OSRM (`router.project-osrm.org`), a pie con OSRM foot y, en Freycinet, sobre un extracto de OSM (`trails.py`). Guarda GeoJSON simplificado.
  - `verify_routes.py` — comprueba que cada ruta pasa por sus paradas y en orden.
  - `fetch_candidates.py` / `fetch_extra.py` — candidatas de Wikimedia Commons (licencias libres) y hojas de contacto para revisarlas.
  - `selections.py` — fotos elegidas tras revisarlas una a una; `build_photos.py` las descarga a 1200 px webp (+ miniatura) con autor y licencia.
  - `build_site.py` — genera `site/data/trip.json` (enlaces de Google Maps por nombre, máx. 3 waypoints por enlace).
  - `shoot.js` — capturas de verificación con Playwright (390/820/1280 px, claro y oscuro).

## Regenerar

```sh
cd build
python3 coords.py && python3 build_routes.py && python3 verify_routes.py
python3 build_photos.py && python3 build_site.py
```

## Mapa base CARTO Voyager

CARTO exige una clave gratuita para uso no comercial (https://carto.com/basemaps/apikey). Pegadla en
`site/js/config.js` (`cartoKey`). Sin clave, la capa «Mapa» usa OpenStreetMap; «Satélite» (Esri) y
«Relieve» (OpenTopoMap) funcionan siempre.
