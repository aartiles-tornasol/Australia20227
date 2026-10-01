const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message)); p.on("console", m => m.type()==="error" && errs.push(m.text()));
  await p.goto("http://localhost:8765/", { waitUntil: "networkidle" });
  // filtro
  await p.click('.chip[data-filter="tasmania"]');
  const vis = await p.$$eval(".day:not(.is-hidden)", (els) => els.map((e) => e.dataset.n).join(","));
  console.log("Tasmania ->", vis);
  await p.click('.chip[data-filter="victoria"]');
  console.log("Victoria ->", await p.$$eval(".day:not(.is-hidden)", (els) => els.map((e) => e.dataset.n).join(",")));
  await p.click('.chip[data-filter="all"]');
  // abrir todos
  await p.click("#toggleAll");
  await p.waitForTimeout(800);
  console.log("abiertos:", await p.$$eval(".day.is-open", (e) => e.length), "botón:", await p.textContent("#toggleAll span"));
  // visto + persistencia
  await p.check("#dia-2 .seen input"); await p.check("#dia-7 .seen input");
  await p.reload({ waitUntil: "networkidle" });
  console.log("vistos tras recargar:", await p.$$eval(".day.is-seen", (e) => e.map((x) => x.dataset.n).join(",")), "|", await p.textContent("#progress"));
  // enlaces
  await p.click("#dia-15 .day-head"); await p.waitForTimeout(300);
  const links = await p.$$eval("#dia-15 a", (as) => as.map((a) => a.href).filter((h) => h.includes("google")));
  console.log("día 15 enlaces google:", links.length);
  const bad = links.filter((h) => /-?\d+\.\d+,-?\d+\.\d+/.test(decodeURIComponent(h)));
  console.log("enlaces con coordenadas:", bad.length);
  for (const n of [6, 10, 12, 15]) {
    await p.evaluate((n) => { const c = document.getElementById("dia-" + n); if (!c.classList.contains("is-open")) c.querySelector(".day-head").click(); }, n);
    await p.waitForTimeout(300);
    await p.evaluate((n) => document.getElementById("dia-" + n).scrollIntoView(), n);
    await p.waitForTimeout(600);
    await p.evaluate((n) => document.getElementById("map-day-" + n).scrollIntoView({ block: "center" }), n);
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `shots/820-dia${n}-map.png` });
  }
  // popup con foto
  await p.evaluate(() => document.getElementById("map-day-15").scrollIntoView({ block: "center" }));
  const pins = await p.$$("#map-day-15 .leaflet-marker-icon");
  await pins[3].click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: "shots/820-popup.png" });
  // lightbox
  await p.click("#dia-15 .site-gallery button"); await p.waitForTimeout(1200);
  await p.screenshot({ path: "shots/820-lightbox.png" });
  console.log(errs.length ? errs.join("\n") : "sin errores");
  await b.close();
})();
