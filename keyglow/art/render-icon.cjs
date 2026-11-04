// Renders art/icon.svg to the launcher PNGs:  node art/render-icon.cjs   (needs Playwright)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, px] of Object.entries(sizes)) {
    await page.setViewportSize({ width: px, height: px });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${px}" height="${px}" `)}</body></html>`);
    const dir = path.join(__dirname, '..', 'app/src/main/res', `drawable-${d}`);
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, 'ic_launcher.png'), omitBackground: true });
  }
  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', '<svg width="512" height="512" ')}</body></html>`);
  await page.screenshot({ path: path.join(__dirname, 'icon-512.png'), omitBackground: true });
  await browser.close();
})();
