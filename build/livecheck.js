const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const hosts = {}; const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on("request", (r) => { const h = new URL(r.url()).host; hosts[h] = (hosts[h] || 0) + 1; });
  p.on("pageerror", (e) => errs.push(e.message)); p.on("requestfailed", (r) => errs.push("failed " + r.url()));
  await p.goto(process.argv[2], { waitUntil: "networkidle" });
  for (const id of ["mapa", "tramos", "dias"]) { await p.evaluate((id) => document.getElementById(id).scrollIntoView(), id); await p.waitForTimeout(2000); }
  await p.click("#toggleAll"); await p.waitForTimeout(1500);
  for (let i = 0; i < 40; i++) { await p.mouse.wheel(0, 1500); await p.waitForTimeout(150); }
  await p.waitForTimeout(2000);
  console.log(JSON.stringify(hosts, null, 1)); console.log(errs.slice(0, 5).join("\n") || "sin errores");
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(800); await p.screenshot({ path: "shots/live-top.png" });
  await b.close();
})();
