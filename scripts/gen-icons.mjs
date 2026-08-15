import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const anySvg = path.join(__dirname, 'icon-any.svg');
const maskableSvg = path.join(__dirname, 'icon-maskable.svg');

const jobs = [
  { src: anySvg, size: 192, out: 'icon-192.png' },
  { src: anySvg, size: 512, out: 'icon-512.png' },
  { src: anySvg, size: 180, out: 'icon-180.png' },
  { src: maskableSvg, size: 192, out: 'icon-maskable-192.png' },
  { src: maskableSvg, size: 512, out: 'icon-maskable-512.png' },
];

for (const job of jobs) {
  await sharp(job.src).resize(job.size, job.size).png().toFile(path.join(outDir, job.out));
  console.log('wrote', job.out);
}
