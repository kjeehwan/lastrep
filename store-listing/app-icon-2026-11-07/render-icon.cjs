const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { PNG } = require('pngjs');

// Keep the uploaded wordmark's geometry and colors. Only replace transparency
// with white so Google Play receives a full, opaque square.
const sourcePath = path.resolve(__dirname, '../../assets/images/logo-splash-512.png');
const sourceBytes = fs.readFileSync(sourcePath);
const image = PNG.sync.read(sourceBytes);
if (image.width !== 512 || image.height !== 512) throw Error('Expected 512 × 512 source.');
for (let i = 0; i < image.data.length; i += 4) {
  const alpha = image.data[i + 3] / 255;
  for (let channel = 0; channel < 3; channel++) {
    image.data[i + channel] = Math.round(image.data[i + channel] * alpha + 255 * (1 - alpha));
  }
  image.data[i + 3] = 255;
}
// Google Play requests a 32-bit PNG. Keep its alpha channel, fully opaque.
const output = PNG.sync.write(image, { colorType: 6, inputColorType: 6, bitDepth: 8, deflateLevel: 9 });
if (output.length > 1024 * 1024) throw Error('Icon exceeds Google Play size limit.');
fs.writeFileSync(path.join(__dirname, 'lastrep-play-icon-opaque-white.png'), output);
const manifest = {
  file: 'lastrep-play-icon-opaque-white.png', source: 'assets/images/logo-splash-512.png',
  sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
  width: 512, height: 512, format: '32-bit RGBA PNG', allPixelsOpaque: true,
  background: '#ffffff', bytes: output.length, sha256: createHash('sha256').update(output).digest('hex'),
};
fs.writeFileSync(path.join(__dirname, 'asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
