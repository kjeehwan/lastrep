const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const { PNG } = require('pngjs');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(path.join(root, '.dev-tools/notebook-browser/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(__dirname, 'feature-graphic.html')).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    const typography = await page.evaluate(() => {
      const title = document.querySelector('h1'), style = getComputedStyle(title), bounds = title.getBoundingClientRect();
      const faces = [...document.fonts];
      if (!faces.some(face => face.family.replace(/["']/g, '') === 'LastrepEditorial' && face.status === 'loaded') || style.fontWeight !== '400') throw Error('Bundled headline font not loaded at the matching weight');
      if (bounds.width > 900 || bounds.height > 43 || bounds.left < 0 || bounds.right > 1024) throw Error('Headline does not fit');
      return { family: 'Source Serif 4', weight: style.fontWeight, size: style.fontSize };
    });
    const png = PNG.sync.read(await page.screenshot());
    if (png.width !== 1024 || png.height !== 500) throw Error('Incorrect dimensions');
    for (let i = 3; i < png.data.length; i += 4) if (png.data[i] !== 255) throw Error('Transparent pixel');
    const rgb = PNG.sync.write(png, { colorType: 2, inputColorType: 6, deflateLevel: 9 });
    if (rgb.length > 15 * 1024 * 1024) throw Error('Image exceeds upload limit');
    fs.writeFileSync(path.join(__dirname, 'feature-graphic.png'), rgb);
    const manifestPath = path.join(__dirname, 'asset-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const asset = manifest.assets.find(asset => asset.file === 'feature-graphic.png');
    if (!asset) throw Error('Missing feature graphic manifest entry');
    Object.assign(asset, { width: 1024, height: 500, bytes: rgb.length, format: 'PNG, RGB, no alpha', sha256: createHash('sha256').update(rgb).digest('hex') });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(JSON.stringify({ ...asset, typography }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
