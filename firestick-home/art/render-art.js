// Renders each layer of fengwei-ink.html to PNG, then converts them to WebP for the app:
//   node render-art.js && python3 to-webp.py
// Needs Playwright with Chromium (the art is drawn once here so the Fire Stick doesn't
// have to compute the smoke and brush textures live).
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1040, height: 1080 } });
  for (const layer of ["bg", "chars", "stroke", "seal"]) {
    await page.goto("file://" + path.join(__dirname, "fengwei-ink.html") + "?layer=" + layer);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(__dirname, "out", `fengwei-${layer}.png`), omitBackground: layer !== "bg" });
  }
  await browser.close();
})();
