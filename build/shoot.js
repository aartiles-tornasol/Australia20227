// Capturas de verificación: node shoot.js [url] — 390/820/1280 px, claro y oscuro.
const { chromium } = require("playwright");
const url = process.argv[2] || "http://localhost:8765/";
const only = process.argv[3]; // p.ej. "390-light"
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const w of [390, 820, 1280]) for (const scheme of ["light", "dark"]) {
    const tag = `${w}-${scheme}`; if (only && !only.split(",").includes(tag)) continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : w === 820 ? 1180 : 860 }, colorScheme: scheme, deviceScaleFactor: 1, hasTouch: w < 1000, isMobile: w === 390 });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${tag} console: ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`${tag} pageerror: ${e.message}`));
    page.on("requestfailed", (r) => { if (!/tile|basemaps|arcgis|opentopo/.test(r.url())) errors.push(`${tag} failed: ${r.url()}`); });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `shots/${tag}-top.png` });
    // overview + tramos
    for (const id of ["mapa", "tramos"]) {
      await page.locator("#" + id).scrollIntoViewIfNeeded(); await page.evaluate((id) => document.getElementById(id).scrollIntoView(), id);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `shots/${tag}-${id}.png` });
    }
    await page.evaluate(() => document.getElementById("dias").scrollIntoView());
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `shots/${tag}-dias.png` });
    // abrir el día 3 y capturar
    await page.click("#dia-3 .day-head");
    await page.waitForTimeout(400);
    await page.evaluate(() => document.getElementById("dia-3").scrollIntoView());
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `shots/${tag}-dia3a.png` });
    await page.evaluate(() => { const m = document.getElementById("map-day-3"); m.scrollIntoView({ block: "center" }); });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `shots/${tag}-dia3b.png` });
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.9));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `shots/${tag}-dia3c.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) errors.push(`${tag} overflow horizontal ${overflow}px`);
    await ctx.close();
  }
  await browser.close();
  console.log(errors.length ? errors.join("\n") : "sin errores");
})();
