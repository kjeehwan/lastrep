const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');
const { PNG } = require('pngjs');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const geometry = JSON.parse(fs.readFileSync(path.join(root, 'src/branding/wordmarkGeometry.json'), 'utf8'));
const b = geometry.bounds;
const width = 1536;
const scale = width / b.width;
const x = (4096 - width) / 2 - b.x * scale;
const y = 800 - b.y * scale;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="2304" viewBox="0 0 4096 2304">
  <title>Lastrep — Build on your last rep.</title>
  <rect width="4096" height="2304" fill="#f5f1e8"/>
  <defs><linearGradient id="brand" gradientUnits="userSpaceOnUse" x1="${b.x}" y1="${b.y}" x2="${b.x + b.width}" y2="${b.y + b.height}"><stop stop-color="#4a90e2"/><stop offset="1" stop-color="#7b61ff"/></linearGradient></defs>
  <path transform="translate(${x} ${y}) scale(${scale})" fill="url(#brand)" d="${geometry.path}"/>
  <text x="2048" y="1488" text-anchor="middle" font-family="Source Serif 4" font-size="112" font-weight="400" letter-spacing="-2.8" fill="#272923">Build on your last rep.</text>
</svg>
`;
fs.writeFileSync(path.join(__dirname, 'header-image.svg'), svg);
const png = new Resvg(svg, { font: {
  fontFiles: [path.join(root, 'assets/fonts/source-serif-4.ttf')],
  loadSystemFonts: false,
  defaultFontFamily: 'Source Serif 4',
} }).render().asPng();
const rgb = PNG.sync.write(PNG.sync.read(png), { colorType: 2, inputColorType: 6, bitDepth: 8, deflateLevel: 9 });
if (rgb.length >= 1000000) throw Error('Header exceeds the 1 MB limit.');
fs.writeFileSync(path.join(__dirname, 'header-image.png'), rgb);
const text = fs.readFileSync(path.join(__dirname, 'promotional-text.txt'), 'utf8').trim();
if (text.length > 140) throw Error('Promotional text exceeds 140 characters.');
const manifest = { file: 'header-image.png', width: 4096, height: 2304, mode: 'RGB',
  bytes: rgb.length, sha256: createHash('sha256').update(rgb).digest('hex'), promotionalTextCharacters: text.length };
fs.writeFileSync(path.join(__dirname, 'asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
