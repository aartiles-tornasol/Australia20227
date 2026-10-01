/* Australia '27 — guía de viaje. Datos precalculados en data/ (OSRM + Wikimedia en build). */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
  };
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const TRAMO_VAR = { victoria: "--victoria", tropico: "--tropico", tasmania: "--tasmania" };
  const color = (t) => css(TRAMO_VAR[t] || "--ocean");

  const ICON = {
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    go: '<svg viewBox="0 0 24 24"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg>',
    car: '<svg viewBox="0 0 24 24"><path d="M5 16h14M6.5 16l1.4-5.2A2 2 0 0 1 9.8 9.3h4.4a2 2 0 0 1 1.9 1.5L17.5 16M4 16v3h3v-3M17 16v3h3v-3"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    walk: '<svg viewBox="0 0 24 24"><circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6 3 3v3M8 12l2.5-4 3 1.5 2 3.5M12.5 15l-1.5-6"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>',
    plane: '<svg viewBox="0 0 24 24"><path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z"/></svg>',
    map: '<svg viewBox="0 0 24 24"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  };
  const fmtH = (min) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`; };
  const fmtKm = (km) => km.toLocaleString("es-ES");

  let T; // datos del viaje
  const routeCache = {};
  const getRoute = (n) => routeCache[n] || (routeCache[n] = fetch(`data/routes/day-${String(n).padStart(2, "0")}.geojson`).then((r) => r.json()));

  /* ---------- tema ---------- */
  $("#themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("au-theme", next); } catch (e) { /* nada */ }
    restyleMaps();
  });
  const topbar = $("#topbar");
  const onScroll = () => topbar.classList.toggle("is-solid", window.scrollY > window.innerHeight * 0.6);
  addEventListener("scroll", onScroll, { passive: true });

  /* ---------- fotos ---------- */
  const credit = (p) => `${p.note ? `<em>${esc(p.note)}</em> · ` : ""}© ${esc(p.artist)} · <a href="${esc(p.page)}" target="_blank" rel="noopener">${esc(p.license)}</a>`;
  const img = (p, { sm = false, alt = "", eager = false, sizes = "" } = {}) =>
    `<img src="${esc(sm ? p.sm : p.src)}" ${sm ? "" : `srcset="${esc(p.sm)} 520w, ${esc(p.src)} ${p.w}w" sizes="${sizes || "100vw"}"`} width="${p.w}" height="${p.h}" alt="${esc(alt)}" loading="${eager ? "eager" : "lazy"}" decoding="async">`;
  const firstPhoto = (pid) => (T.places[pid]?.photos || [])[0];

  /* ---------- mapas ---------- */
  const maps = [];
  function baseLayers() {
    const key = (window.MAP_CONFIG || {}).cartoKey;
    // CARTO Voyager exige clave (gratuita); sin ella se usa OpenStreetMap para no mostrar la marca de agua.
    const voyager = key
      ? L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`, {
          subdomains: "abcd", maxZoom: 19, className: "tiles-voyager",
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        })
      : L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19, className: "tiles-voyager",
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        });
    const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, attribution: "Imágenes &copy; Esri, Maxar, Earthstar Geographics",
    });
    const topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      subdomains: "abc", maxZoom: 17, className: "tiles-voyager",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM · estilo &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    });
    return { Mapa: voyager, "Satélite": sat, Relieve: topo };
  }
  function makeMap(el, opts = {}) {
    const map = L.map(el, { zoomControl: true, scrollWheelZoom: false, dragging: !isTouch, tap: false, zoomSnap: 0.25, ...opts });
    map.setView([-28, 135], 4);
    const layers = baseLayers();
    layers.Mapa.addTo(map);
    L.control.layers(layers, null, { position: "topright" }).addTo(map);
    map.attributionControl.setPrefix(false);
    // Rueda del ratón / arrastre táctil sólo tras interactuar: el scroll de la página no queda atrapado.
    map.on("click focus", () => { map.scrollWheelZoom.enable(); map.dragging.enable(); el.classList.add("is-active"); });
    map.on("mouseout", () => map.scrollWheelZoom.disable());
    if (isTouch) {
      const hint = L.DomUtil.create("div", "map-hint", el);
      hint.textContent = "Toca el mapa para moverlo";
      map.on("click", () => hint.remove());
    }
    maps.push({ map, el });
    return map;
  }
  const whenVisible = (el, fn) => {
    if (!("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: "300px" });
    io.observe(el);
  };
  const pinIcon = (html, cls = "", size = 28) => L.divIcon({ className: "", html: `<div class="pin ${cls}">${html}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
  const dotIcon = (c) => L.divIcon({ className: "", html: `<div class="pin-dot" style="--c:${c}"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] });

  // Separa en círculo los marcadores que caen a menos de 26 px (p. ej. Gibson Steps / Apóstoles / Loch Ard).
  function declutter(map, markers) {
    const run = () => {
      const pts = markers.map((m) => ({ m, p: map.latLngToLayerPoint(m.getLatLng()) }));
      const groups = [];
      pts.forEach((a) => {
        const g = groups.find((g) => g.some((b) => a.p.distanceTo(b.p) < 26));
        g ? g.push(a) : groups.push([a]);
      });
      groups.forEach((g) => g.forEach((a, i) => {
        const el = a.m.getElement(); if (!el) return;
        const r = g.length > 1 ? 15 : 0, ang = (i / g.length) * 2 * Math.PI - Math.PI / 2;
        el.firstChild.style.translate = r ? `${Math.round(Math.cos(ang) * r)}px ${Math.round(Math.sin(ang) * r)}px` : "";
      }));
    };
    map.on("zoomend viewreset", run); setTimeout(run, 0);
  }
  const LEG_STYLE = {
    drive: (c) => ({ color: c, weight: 5, opacity: 0.95 }),
    transfer: () => ({ color: css("--muted"), weight: 3, opacity: 0.9, dashArray: "2 7", lineCap: "round" }),
    walk: (c) => ({ color: c, weight: 4, opacity: 0.95, dashArray: "1 8", lineCap: "round" }),
    hike: (c) => ({ color: c, weight: 4, opacity: 0.95, dashArray: "1 8", lineCap: "round" }),
    tram: (c) => ({ color: c, weight: 4, opacity: 0.9, dashArray: "10 7" }),
    shuttle: (c) => ({ color: c, weight: 4, opacity: 0.9, dashArray: "10 7" }),
    boat: () => ({ color: "#1b8fb8", weight: 3.5, opacity: 0.95, dashArray: "8 8" }),
    flight: () => ({ color: css("--flight"), weight: 2.5, opacity: 0.9, dashArray: "6 7" }),
  };
  function drawLeg(map, f, c, casing = true) {
    const mode = f.properties.mode;
    const st = LEG_STYLE[mode](c);
    const latlngs = f.geometry.coordinates.map(([x, y]) => [y, x]);
    const line = L.polyline(latlngs, { ...st, interactive: false });
    if (casing && mode === "drive") return L.featureGroup([L.polyline(latlngs, { color: "#fff", weight: st.weight + 4, opacity: 0.85, interactive: false }), line]);
    return line;
  }
  const popupHTML = (pid, extra = "") => {
    const p = T.places[pid]; const ph = p.photos[0];
    return `<div class="pop ${ph ? "" : "pop-nophoto"}">${ph ? img(ph, { sm: true, alt: p.name }) : ""}<div class="pop-body"><h4>${esc(p.name)}</h4>${extra}<p>${esc(p.desc)}</p>
      <div class="links"><a href="${esc(p.maps)}" target="_blank" rel="noopener">${ICON.pin}Ver en Maps</a><a class="go" style="--c:${css("--ocean")}" href="${esc(p.dir)}" target="_blank" rel="noopener">${ICON.go}Cómo llegar</a></div></div></div>`;
  };
  // Separa los tramos de un día con dos regiones (día 10): antes del primer vuelo y después del último.
  function legsForTramo(day, fc, tramo) {
    if (day.tramos.length < 2) return fc.features;
    const fi = fc.features.findIndex((f) => f.properties.mode === "flight");
    let li = -1; fc.features.forEach((f, i) => { if (f.properties.mode === "flight") li = i; });
    return tramo === day.tramos[0] ? fc.features.slice(0, fi) : fc.features.slice(li + 1);
  }
  function restyleMaps() {
    // los colores dependen del tema: se vuelven a dibujar las capas vectoriales
    maps.forEach(({ redraw }) => redraw && redraw());
  }

  /* ---------- portada ---------- */
  function renderHero() {
    const p = firstPhoto("apostles");
    if (p) {
      $("#heroMedia").innerHTML = img(p, { alt: "Los Doce Apóstoles, Great Ocean Road", eager: true });
      $("#heroCredit").innerHTML = "Doce Apóstoles · " + credit(p);
    }
    const t = T.totals;
    $("#heroStats").innerHTML = [["Días", t.days], ["Noches", t.nights], ["Km al volante", "≈" + fmtKm(Math.round(t.km / 10) * 10)], ["Vuelos", t.flights]]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  }

  /* ---------- mapa general ---------- */
  function gcArc(a, b, n = 96) {
    const r = Math.PI / 180, [la1, lo1, la2, lo2] = [a[0] * r, a[1] * r, b[0] * r, b[1] * r];
    const d = 2 * Math.asin(Math.sqrt(Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2));
    const out = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
      const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
      const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
      const z = A * Math.sin(la1) + B * Math.sin(la2);
      out.push([Math.atan2(z, Math.hypot(x, y)) / r, Math.atan2(y, x) / r]);
    }
    return out;
  }
  function renderOverview() {
    const el = $("#mapOverview");
    const legend = [
      ["Victoria", color("victoria")], ["Trópico Norte", color("tropico")], ["Tasmania", color("tasmania")],
    ].map(([n, c]) => `<span><i style="--c:${c}"></i>${n}</span>`).join("") +
      `<span><i class="dash" style="--c:${css("--flight")}"></i>Vuelos</span><span><i class="dash" style="--c:${css("--muted")}"></i>Traslados</span>`;
    $("#overviewLegend").innerHTML = legend;
    whenVisible(el, async () => {
      const map = makeMap(el, { zoomSnap: 0.25 });
      const fit = () => map.fitBounds(el.clientWidth < 600 ? [[-43.8, 139.5], [-15.5, 150.5]] : [[-44.2, 112.5], [-9.5, 154.5]], { padding: [6, 6] });
      fit();
      const fcs = await Promise.all(T.days.map((d) => getRoute(d.n)));
      let group = L.layerGroup().addTo(map);
      const draw = () => {
        group.clearLayers();
        const add = (l) => { group.addLayer(l); return l; };
        // vuelos internacionales hacia/desde Cantón
        const mel = T.airports.MEL, can = T.airports.CAN;
        const arc = gcArc(mel, can);
        add(L.polyline(arc, { color: css("--flight"), weight: 2.5, dashArray: "6 7", opacity: 0.9, interactive: false }));
        const lblPt = arc.find((p) => p[0] > (el.clientWidth < 600 ? -24 : -16)) || arc[10];
        add(L.tooltip({ permanent: true, direction: "right", className: "map-label flight", offset: [6, 0] }).setLatLng(lblPt).setContent("✈ Cantón · Madrid"));
        T.days.forEach((d, i) => {
          const fc = fcs[i];
          d.tramos.forEach((t) => legsForTramo(d, fc, t).forEach((f) => {
            if (f.properties.mode === "flight") return;
            add(drawLeg(map, f, color(t), false));
          }));
          fc.features.filter((f) => f.properties.mode === "flight").forEach((f) => { add(drawLeg(map, f, null)); });
        });
        Object.entries(T.airports).forEach(([code, ll]) => {
          if (code === "MAD" || code === "CAN") return;
          add(L.marker(ll, { icon: pinIcon(ICON.plane, "pin-air pin-sm", 20), keyboard: false, zIndexOffset: -100 }).bindTooltip(code, { direction: "right", className: "map-label flight", offset: [8, 0] }));
        });
        // dormir
        const seen = new Set();
        T.days.forEach((d) => {
          if (!d.sleep || seen.has(d.sleep)) return; seen.add(d.sleep);
          const t = Object.keys(T.tramos).find((k) => T.tramos[k].sleeps.some((s) => s.place === d.sleep));
          add(L.marker(T.places[d.sleep].ll, { icon: dotIcon(color(t)) }).bindPopup(popupHTML(d.sleep, `<div class="dur">Noche${T.tramos[t].sleeps.filter((s) => s.place === d.sleep).length > 1 ? "s" : ""} aquí</div>`)));
        });
        const lbl = { victoria: [[-38.2, 142.6], "left"], tropico: [[-16.6, 145.2], "left"], tasmania: [[-42.6, 145.4], "left"] };
        Object.entries(lbl).forEach(([t, [ll, dir]]) => add(L.tooltip({ permanent: true, direction: dir, className: "map-label big", offset: [-10, 0] }).setLatLng(ll).setContent(`<span style="color:${color(t)}">${T.tramos[t].name}</span>`)));
      };
      draw();
      maps[maps.length - 1].redraw = draw;
      addEventListener("resize", () => fit());
    });
  }

  function renderFlights() {
    const arrow = '<svg viewBox="0 0 24 24"><path d="M4 11h13l-5-5 1.4-1.4L21 12l-7.6 7.4L12 18l5-5H4z"/></svg>';
    const fl = (f) => `<div class="fl"><span class="fl-code">${f.code}</span><span class="fl-route">${f.frm} ${arrow} ${f.to}</span><span></span>
      <div class="fl-times"><span>${esc(f.fromName)} · ${esc(f.dep)}</span><span>${esc(f.toName)} · ${esc(f.arr)}</span></div></div>`;
    const dom = T.domestic.map((f) => { const d = T.days[f.day]; return `<li><b>Día ${d.n} · ${d.label}</b> — ${esc(f.label)}</li>`; }).join("");
    $("#flights").innerHTML =
      `<article class="flight-card"><h3>Ida <small>China Southern</small></h3>${T.intl.slice(0, 2).map(fl).join("")}</article>` +
      `<article class="flight-card"><h3>Vuelta <small>China Southern</small></h3>${T.intl.slice(2).map(fl).join("")}</article>` +
      `<article class="flight-card" style="grid-column:1/-1"><h3>Vuelos internos <small>por reservar</small></h3><ul class="fl-dom">${dom}</ul></article>`;
  }

  /* ---------- tramos ---------- */
  function sleepGroups(t) {
    const out = [];
    t.sleeps.forEach((s) => {
      const last = out[out.length - 1];
      if (last && last.place === s.place && last.to === s.day - 1) { last.to = s.day; last.count++; }
      else out.push({ place: s.place, from: s.day, to: s.day, count: 1 });
    });
    return out;
  }
  function renderTramos() {
    const order = ["victoria", "tropico", "tasmania"];
    $("#tramoList").innerHTML = order.map((k, i) => {
      const t = T.tramos[k]; const p = firstPhoto(t.hero);
      const days = t.days; const range = days.length > 6 && k === "victoria" ? "Días 0–4 y 16–19" : `Días ${days[0]}–${days[days.length - 1]}`;
      const sleeps = sleepGroups(t).map((g) => {
        const a = T.days[g.from], b = T.days[g.to];
        const when = g.count > 1 ? `${a.label.split(" ").slice(1).join(" ")} – ${b.label.split(" ").slice(1).join(" ")}` : a.label;
        return `<li><span class="n">${when}</span><span><b>${esc(T.places[g.place].name)}</b>${g.count > 1 ? ` · ${g.count} noches` : ""}</span></li>`;
      }).join("");
      return `<article class="tramo" style="--c:${color(k)}" data-tramo="${k}">
        <div class="tramo-photo">${p ? img(p, { alt: t.name, sizes: "(min-width: 820px) 50vw, 100vw" }) : ""}
          <div class="tramo-title"><span class="num">Tramo ${i + 1} · ${range}</span><h3>${esc(t.name)}</h3><p>${esc(t.sub)}</p></div>
          ${p ? `<span class="credit">${credit(p)}</span>` : ""}</div>
        <div class="tramo-body">
          <p>${esc(t.summary)}</p>
          <div class="tramo-stats"><div><b>${fmtKm(t.km)}</b><span>km en coche</span></div><div><b>${t.nights}</b><span>noches</span></div><div><b>${days.length}</b><span>días</span></div></div>
          <div class="map" id="map-tramo-${k}" role="region" aria-label="Mapa del tramo ${esc(t.name)}"></div>
          <ul class="sleeps">${sleeps}</ul>
        </div></article>`;
    }).join("");
    order.forEach((k) => {
      const el = $(`#map-tramo-${k}`);
      whenVisible(el, async () => {
        const t = T.tramos[k]; const map = makeMap(el);
        const fcs = await Promise.all(t.days.map((n) => getRoute(n)));
        const group = L.layerGroup().addTo(map); let bounds;
        const draw = () => {
          group.clearLayers(); bounds = L.latLngBounds([]);
          t.days.forEach((n, i) => legsForTramo(T.days[n], fcs[i], k).forEach((f) => {
            if (f.properties.mode === "flight") return;
            const l = drawLeg(map, f, color(k)); group.addLayer(l);
            if (f.properties.mode !== "transfer") bounds.extend(l.getBounds());
          }));
          sleepGroups(t).forEach((g) => {
            const pl = T.places[g.place]; bounds.extend(pl.ll);
            const m = L.marker(pl.ll, { icon: pinIcon(ICON.moon, "pin-sleep", 26) })
              .bindPopup(popupHTML(g.place, `<div class="dur">☾ ${g.count} noche${g.count > 1 ? "s" : ""} · día ${g.from}${g.to !== g.from ? "–" + g.to : ""}</div>`));
            group.addLayer(m);
          });
        };
        draw(); map.fitBounds(bounds, { padding: [24, 24] });
        maps[maps.length - 1].redraw = draw;
      });
    });
  }

  /* ---------- días ---------- */
  const seen = new Set(store.get("au-seen") || []);
  function dayCard(d) {
    const t = d.tramos[0]; const hero = firstPhoto(d.hero) || firstPhoto(d.sites[0]);
    const s = d.stats;
    const facts = [];
    if (s.driveKm) facts.push(`<span>${ICON.car}${fmtKm(s.driveKm)} km · ${fmtH(s.driveMin)}</span>`);
    if (s.walkKm >= 1) facts.push(`<span>${ICON.walk}${String(s.walkKm).replace(".", ",")} km a pie</span>`);
    if (d.legs.some((l) => l.mode === "flight") || d.flights.length) facts.push(`<span>${ICON.plane}vuelo</span>`);
    if (d.sleep) facts.push(`<span>${ICON.moon}${esc(T.places[d.sleep].name)}</span>`);
    return `<article class="day ${seen.has(d.n) ? "is-seen" : ""}" id="dia-${d.n}" data-n="${d.n}" data-tramo="${t}" data-tramos="${d.tramos.join(" ")}">
      <div class="day-head" role="button" tabindex="0" aria-expanded="false" aria-controls="body-${d.n}">
        <div class="day-thumb">${hero ? img(hero, { sm: true, alt: "" }) : ""}<span>Día ${d.n}</span></div>
        <div class="day-meta">
          <div class="day-date">${esc(d.label)}${d.warn ? '<span class="warn-tag">Aviso</span>' : ""}</div>
          <h3 class="day-title">${esc(d.title)}</h3>
          <div class="day-facts">${facts.join("")}</div>
        </div>
        <div class="day-ctrl">
          <label class="seen" title="Marcar como visto"><input type="checkbox" ${seen.has(d.n) ? "checked" : ""} aria-label="Día ${d.n} visto"><span class="seen-label">Visto</span></label>
          <span class="chev" aria-hidden="true">${ICON.chev}</span>
        </div>
      </div>
      <div class="day-body" id="body-${d.n}"></div>
    </article>`;
  }
  function dayBody(d) {
    const t = d.tramos[0]; const hero = firstPhoto(d.hero) || firstPhoto(d.sites[0]); const s = d.stats;
    const stats = [];
    if (s.driveKm) { stats.push(`<div class="stat"><b>${fmtKm(s.driveKm)} km</b><span>en coche</span></div>`); stats.push(`<div class="stat"><b>${fmtH(s.driveMin)}</b><span>al volante</span></div>`); }
    if (s.walkKm >= 1) stats.push(`<div class="stat"><b>${String(s.walkKm).replace(".", ",")} km</b><span>a pie · ~${fmtH(s.walkMin)}</span></div>`);
    stats.push(`<div class="stat"><b>${d.sites.length}</b><span>sitios</span></div>`);
    if (d.sleep) stats.push(`<div class="stat"><b style="font-size:18px">${esc(T.places[d.sleep].name)}</b><span>noche</span></div>`);
    const MODE_TXT = { driving: "En coche", walking: "A pie", transit: "Transporte público" };
    const links = d.links.map((l, i) => `<a class="route-link" href="${esc(l.url)}" target="_blank" rel="noopener">${ICON.map}<span>${d.links.length > 1 ? `${i + 1}/${d.links.length} · ` : ""}${l.from === l.to ? `Bucle: ${l.stops.slice(1, -1).map((s) => esc(T.places[s].name)).join(" · ")}` : `${esc(T.places[l.from].name)} → ${esc(T.places[l.to].name)}`}${l.mode !== "driving" ? ` (${MODE_TXT[l.mode].toLowerCase()})` : ""}</span></a>`).join("");
    const flights = d.flights.map((c) => T.intl.find((f) => f.code === c)).map((f) => `<span><b>${f.code}</b> ${f.fromName} ${f.dep.split("·")[1]} → ${f.toName} ${f.arr.split("·")[1]}</span>`).join("");
    const domestic = T.domestic.filter((f) => f.day === d.n).map((f) => `<span><b>✈</b> ${esc(f.label)}</span>`).join("");
    const sites = d.sites.map((pid, i) => {
      const p = T.places[pid]; const ph = p.photos;
      const gal = ph.length ? `<div class="site-gallery ${ph.length > 1 ? "multi" : ""}" data-pid="${pid}">${ph.map((x, k) => `<button type="button" data-k="${k}" aria-label="Ampliar foto ${k + 1} de ${esc(p.name)}">${img(x, { alt: p.name, sizes: "(min-width: 1024px) 560px, (min-width: 640px) 45vw, 90vw" })}${k === 0 && ph.length > 1 ? `<span class="count">${ph.length} fotos</span>` : ""}</button>`).join("")}</div>
        <div class="site-photo-credit">${credit(ph[0])}</div>` : "";
      return `<li class="site" id="d${d.n}-${pid}">${gal}<div class="site-body">
        <div class="site-head"><span class="site-num">${i + 1}</span><div><h3>${esc(p.name)}${p.star ? '<span class="star" title="Sitio estrella">★</span>' : ""}</h3>${p.dur ? `<div class="dur">${ICON.clock.replace("<svg", '<svg style="width:12px;height:12px;vertical-align:-1px;fill:none;stroke:currentColor;stroke-width:2"')} ${esc(p.dur)}</div>` : ""}</div></div>
        <p>${esc(p.desc)}</p>${p.tip ? `<p class="tip">${esc(p.tip)}</p>` : ""}
        <div class="links"><a href="${esc(p.maps)}" target="_blank" rel="noopener">${ICON.pin}Ver en Maps</a><a class="go" href="${esc(p.dir)}" target="_blank" rel="noopener">${ICON.go}Cómo llegar</a></div>
      </div></li>`;
    }).join("");
    return `${hero ? `<figure class="day-hero" style="margin:0">${img(hero, { alt: d.title, sizes: "(min-width: 1180px) 1180px, 100vw" })}<figcaption>${credit(hero)}</figcaption></figure>` : ""}
      <div class="day-content">
        <p class="day-summary">${esc(d.summary)}</p>
        ${d.warn ? `<div class="warn"><b>Aviso</b>${esc(d.warn)}</div>` : ""}
        ${flights || domestic ? `<div class="day-flights">${flights}${domestic}</div>` : ""}
        <div class="stats">${stats.join("")}</div>
        <div class="day-layout">
          <div class="map-col">
            <div class="map" id="map-day-${d.n}" role="region" aria-label="Mapa del día ${d.n}"></div>
            ${links ? `<div class="routes" style="margin-top:14px"><h4>Ruta en Google Maps</h4><div class="route-links">${links}</div></div>` : ""}
          </div>
          <ol class="sites">${sites}</ol>
        </div>
        <div class="blocks">
          <div class="block"><h4>Consejos</h4><ul>${d.tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
          <div class="block book"><h4>Qué reservar</h4><ul>${d.book.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        </div>
      </div>`;
  }
  async function dayMap(d) {
    const el = $(`#map-day-${d.n}`); if (!el || el._done) return; el._done = true;
    const map = makeMap(el); const t = d.tramos[0];
    const fc = await getRoute(d.n);
    const group = L.layerGroup().addTo(map);
    let bounds;
    const draw = () => {
      group.clearLayers(); bounds = L.latLngBounds([]);
      fc.features.forEach((f) => {
        const tr = d.tramos.length > 1 && legsForTramo(d, fc, d.tramos[1]).includes(f) ? d.tramos[1] : t;
        const l = drawLeg(map, f, color(tr)); group.addLayer(l);
        if (!["flight", "transfer"].includes(f.properties.mode)) bounds.extend(l.getBounds());
        if (f.properties.mode === "flight") {
          const c = f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)];
          group.addLayer(L.marker([c[1], c[0]], { icon: pinIcon(ICON.plane, "pin-air", 24), interactive: false }));
        }
      });
      const sleepIn = d.sleep && d.sites.includes(d.sleep); const pins = [];
      d.sites.forEach((pid, i) => {
        const p = T.places[pid]; bounds.extend(p.ll);
        const isSleep = pid === d.sleep;
        const m = L.marker(p.ll, { icon: pinIcon(isSleep ? ICON.moon : String(i + 1), isSleep ? "pin-sleep" : "", 30), title: p.name, riseOnHover: true })
          .bindPopup(popupHTML(pid, `<div class="dur">${isSleep ? "☾ Noche aquí · " : ""}Parada ${i + 1}${p.dur ? " · " + esc(p.dur) : ""}</div>`), { maxWidth: 260 });
        group.addLayer(m); pins.push(m);
      });
      if (d.sleep && !sleepIn) {
        const p = T.places[d.sleep];
        const m = L.marker(p.ll, { icon: pinIcon(ICON.moon, "pin-sleep", 28), title: p.name }).bindPopup(popupHTML(d.sleep, '<div class="dur">☾ Noche aquí</div>'));
        group.addLayer(m); pins.push(m);
      }
      declutter(map, pins);
      const start = d.legs[0].ids[0];
      if (!d.sites.includes(start) && start !== d.sleep && T.places[start]) {
        group.addLayer(L.marker(T.places[start].ll, { icon: dotIcon(color(t)) }).bindTooltip("Salida: " + T.places[start].name, { direction: "top", offset: [0, -6] }));
      }
    };
    draw();
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    maps[maps.length - 1].redraw = draw;
  }
  function renderDays() {
    const list = $("#dayList");
    list.innerHTML = T.days.map(dayCard).join("");
    const open = (card, on) => {
      const d = T.days[+card.dataset.n];
      const body = $(".day-body", card);
      if (on && !body.innerHTML) { body.innerHTML = dayBody(d); bindGalleries(body); }
      card.classList.toggle("is-open", on);
      $(".day-head", card).setAttribute("aria-expanded", on);
      if (on) requestAnimationFrame(() => {
        const mEl = $(`#map-day-${d.n}`);
        if (mEl._done) maps.find((m) => m.el === mEl)?.map.invalidateSize(); else whenVisible(mEl, () => dayMap(d));
      });
    };
    list.addEventListener("click", (e) => {
      if (e.target.closest(".seen")) return;
      const head = e.target.closest(".day-head"); if (!head) return;
      const card = head.parentElement; open(card, !card.classList.contains("is-open"));
      if (card.classList.contains("is-open")) {
        const top = card.getBoundingClientRect().top;
        if (top < 60) scrollTo({ top: scrollY + top - 124, behavior: "smooth" });
      }
    });
    list.addEventListener("keydown", (e) => {
      const head = e.target.closest(".day-head");
      if (head && (e.key === "Enter" || e.key === " ") && e.target === head) { e.preventDefault(); head.click(); }
    });
    list.addEventListener("change", (e) => {
      const cb = e.target.closest(".seen input"); if (!cb) return;
      const card = cb.closest(".day"); const n = +card.dataset.n;
      cb.checked ? seen.add(n) : seen.delete(n);
      card.classList.toggle("is-seen", cb.checked);
      store.set("au-seen", [...seen]); progress();
    });
    // filtro y abrir todos
    let filter = "all";
    $$(".chip").forEach((c) => c.addEventListener("click", () => {
      filter = c.dataset.filter;
      $$(".chip").forEach((x) => x.classList.toggle("is-on", x === c));
      $$(".day").forEach((card) => card.classList.toggle("is-hidden", filter !== "all" && !card.dataset.tramos.split(" ").includes(filter)));
      progress();
    }));
    const btn = $("#toggleAll");
    btn.addEventListener("click", () => {
      const vis = $$(".day:not(.is-hidden)");
      const allOpen = vis.every((c) => c.classList.contains("is-open"));
      vis.forEach((c) => open(c, !allOpen));
      $("span", btn).textContent = allOpen ? "Abrir todos" : "Cerrar todos";
    });
    const progress = () => {
      const vis = $$(".day:not(.is-hidden)");
      const n = vis.filter((c) => seen.has(+c.dataset.n)).length;
      $("#progress").textContent = `${n} de ${vis.length} vistos`;
    };
    progress();
    // enlace directo a un día (#dia-7)
    const m = location.hash.match(/^#dia-(\d+)$/);
    if (m && $(`#dia-${m[1]}`)) { open($(`#dia-${m[1]}`), true); setTimeout(() => $(`#dia-${m[1]}`).scrollIntoView(), 50); }
  }

  /* ---------- visor ---------- */
  const lb = $("#lightbox"); let lbList = [], lbI = 0;
  const lbShow = () => {
    const p = lbList[lbI];
    $("img", lb).src = p.src; $("img", lb).alt = p.title;
    $("figcaption", lb).innerHTML = `${esc(p.title)} · ${credit(p)}`;
    $$(".lb-nav", lb).forEach((b) => (b.hidden = lbList.length < 2));
  };
  function bindGalleries(root) {
    $$(".site-gallery button", root).forEach((b) => b.addEventListener("click", () => {
      lbList = T.places[b.parentElement.dataset.pid].photos; lbI = +b.dataset.k; lbShow(); lb.hidden = false; $(".lb-close", lb).focus();
    }));
  }
  const lbClose = () => { lb.hidden = true; };
  $(".lb-close", lb).addEventListener("click", lbClose);
  $(".lb-prev", lb).addEventListener("click", () => { lbI = (lbI - 1 + lbList.length) % lbList.length; lbShow(); });
  $(".lb-next", lb).addEventListener("click", () => { lbI = (lbI + 1) % lbList.length; lbShow(); });
  lb.addEventListener("click", (e) => { if (e.target === lb) lbClose(); });
  addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") lbClose();
    if (e.key === "ArrowRight") $(".lb-next", lb).click();
    if (e.key === "ArrowLeft") $(".lb-prev", lb).click();
  });

  function renderCredits() {
    const all = [];
    Object.entries(T.places).forEach(([pid, p]) => p.photos.forEach((ph) => { if (!all.some((x) => x.src === ph.src)) all.push({ ...ph, place: p.name }); }));
    $("#credits").innerHTML = all.map((p) => `<li>${esc(p.place)}: <a href="${esc(p.page)}" target="_blank" rel="noopener">${esc(p.title)}</a> — ${esc(p.artist)} (${esc(p.license)})</li>`).join("");
  }

  fetch("data/trip.json").then((r) => r.json()).then((data) => {
    T = data;
    renderHero(); renderOverview(); renderFlights(); renderTramos(); renderDays(); renderCredits(); onScroll();
  });
})();
