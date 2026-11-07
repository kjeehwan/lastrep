const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const crypto = require('node:crypto');
const { PNG } = require('pngjs');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(path.join(root, '.dev-tools/notebook-browser/node_modules/playwright'));
require('./catalog.js');
const samples = globalThis.listingScreens;
const devices = globalThis.listingDevices.filter(device => !process.argv[2] || device.key === process.argv[2]);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const assets = [];
  try {
    for (const device of devices) {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: device.scale });
    fs.mkdirSync(path.join(__dirname, device.key), { recursive: true });
    for (const sample of samples) {
      const screen = sample.key, filename = `${device.key}/${device.key}-${sample.stem}.png`;
      const source = `captures/${device.key}/${sample.stem}.png`;
      const url = pathToFileURL(path.join(__dirname, 'sample.html')); url.searchParams.set('screen', screen); url.searchParams.set('device', device.key);
      await page.goto(url.href);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
      const fit = await page.evaluate(expected => {
        const device = document.querySelector('.device').getBoundingClientRect();
        const screen = document.querySelector('.screen').getBoundingClientRect();
        const capture = document.getElementById('capture');
        const headline = document.getElementById('headline').getBoundingClientRect();
        return device.top < 1920 && headline.bottom + 48 <= device.top &&
          Math.abs((headline.left + headline.right) / 2 - 540) < 1 &&
          getComputedStyle(document.getElementById('headline')).textAlign === 'center' &&
          headline.right <= 996 && document.getElementById('headline').scrollWidth <= 912 &&
          Math.abs(screen.height / screen.width - expected.sourceHeight / expected.sourceWidth) < .001 &&
          capture.naturalWidth === expected.sourceWidth && capture.naturalHeight === expected.sourceHeight && document.documentElement.scrollWidth === 1080;
      }, device);
      if (!fit) throw Error(screen + ': layout overflow or insufficient separation.');
      const buffer = await page.screenshot();
      const png = PNG.sync.read(buffer);
      for (let i = 3; i < png.data.length; i += 4) if (png.data[i] !== 255) throw Error('Transparent output');
      const rgb = PNG.sync.write(png, { colorType: 2, inputColorType: 6, deflateLevel: 9 });
      if (png.width !== device.width || png.height !== device.height || rgb.length > 8 * 1024 * 1024) throw Error('Upload specification mismatch');
      fs.writeFileSync(path.join(__dirname, filename), rgb);
      const sourceBytes = fs.readFileSync(path.join(__dirname, source));
      assets.push({ file: filename, width: png.width, height: png.height, bytes: rgb.length, sha256: crypto.createHash('sha256').update(rgb).digest('hex'), source, sourceSha256: crypto.createHash('sha256').update(sourceBytes).digest('hex') });
    }
    await page.close();
    }
    fs.writeFileSync(path.join(__dirname, process.argv[2] ? `asset-manifest-${process.argv[2]}.json` : 'asset-manifest.json'), JSON.stringify({ status: 'For review; not uploaded', assets }, null, 2) + '\n');
    console.log(JSON.stringify({ count: assets.length, groups: devices.map(d => d.key), maxBytes: Math.max(...assets.map(a => a.bytes)), checks: "dimensions, opacity, size, fonts, aspect ratio, headline fit and centering" }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
