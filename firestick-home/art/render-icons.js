// Renders app-icon.html into the launcher banner (320x180 dp at xhdpi) and icon (48 dp at xxxhdpi):
//   node render-icons.js
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 700, height: 640 } });
  await page.goto("file://" + path.join(__dirname, "app-icon.html"));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const res = path.join(__dirname, "..", "app", "src", "main", "res");
  await (await page.$("#banner")).screenshot({ path: path.join(res, "drawable-xhdpi", "banner.png") });
  await (await page.$("#icon")).screenshot({ path: path.join(res, "drawable-xxxhdpi", "ic_launcher.png") });
  await browser.close();
})();
