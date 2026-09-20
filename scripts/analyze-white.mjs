/** One-off diagnostic: lists enclosed near-white regions in a source sprite. */
import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2];
const THRESH = Number(process.argv[3] ?? 236);

const buffer = fs.readFileSync(file);
let offset = 8;
let header = null;
const idat = [];
while (offset < buffer.length) {
  const length = buffer.readUInt32BE(offset);
  const type = buffer.toString('ascii', offset + 4, offset + 8);
  const data = buffer.subarray(offset + 8, offset + 8 + length);
  if (type === 'IHDR') header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), colorType: data[9] };
  else if (type === 'IDAT') idat.push(data);
  else if (type === 'IEND') break;
  offset += 12 + length;
}
const { width, height, colorType } = header;
const bpp = colorType === 6 ? 4 : 3;
const stride = width * bpp;
const raw = zlib.inflateSync(Buffer.concat(idat));
const px = Buffer.alloc(stride * height);
let pos = 0;
for (let y = 0; y < height; y += 1) {
  const filter = raw[pos];
  pos += 1;
  const row = raw.subarray(pos, pos + stride);
  pos += stride;
  const base = y * stride;
  const prev = base - stride;
  for (let x = 0; x < stride; x += 1) {
    const left = x >= bpp ? px[base + x - bpp] : 0;
    const up = y > 0 ? px[prev + x] : 0;
    const ul = y > 0 && x >= bpp ? px[prev + x - bpp] : 0;
    let v = row[x];
    if (filter === 1) v += left;
    else if (filter === 2) v += up;
    else if (filter === 3) v += (left + up) >> 1;
    else if (filter === 4) {
      const p = left + up - ul;
      const pa = Math.abs(p - left);
      const pb = Math.abs(p - up);
      const pc = Math.abs(p - ul);
      v += pa <= pb && pa <= pc ? left : pb <= pc ? up : ul;
    }
    px[base + x] = v & 0xff;
  }
}

const count = width * height;
const white = new Uint8Array(count);
const minC = new Uint8Array(count);
for (let i = 0; i < count; i += 1) {
  const p = i * bpp;
  minC[i] = Math.min(px[p], px[p + 1], px[p + 2]);
  white[i] = minC[i] >= THRESH ? 1 : 0;
}

const label = new Int32Array(count).fill(-1);
const stack = new Int32Array(count);
const groups = [];
for (let seed = 0; seed < count; seed += 1) {
  if (!white[seed] || label[seed] !== -1) continue;
  const id = groups.length;
  let top = 0;
  stack[top++] = seed;
  label[seed] = id;
  let area = 0;
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  let touchesBorder = false;
  let sum = 0;
  let pure = 0;
  while (top > 0) {
    const index = stack[--top];
    const x = index % width;
    const y = (index - x) / width;
    area += 1;
    sum += minC[index];
    if (minC[index] >= 254) pure += 1;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    const neighbours = [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, y > 0 ? index - width : -1, y < height - 1 ? index + width : -1];
    for (const n of neighbours) {
      if (n < 0 || !white[n] || label[n] !== -1) continue;
      label[n] = id;
      stack[top++] = n;
    }
  }
  groups.push({ id, area, minX, maxX, minY, maxY, touchesBorder, mean: sum / area, pureRatio: pure / area });
}

console.log(`${file} ${width}x${height} threshold=${THRESH}`);
groups
  .filter((g) => !g.touchesBorder && g.area > 200)
  .sort((a, b) => b.area - a.area)
  .slice(0, 18)
  .forEach((g) => {
    console.log(
      `area=${String(g.area).padStart(7)} bbox=${g.minX},${g.minY} ${g.maxX - g.minX + 1}x${g.maxY - g.minY + 1}  mean=${g.mean.toFixed(1)} pure255=${(g.pureRatio * 100).toFixed(0)}%`,
    );
  });
const border = groups.filter((g) => g.touchesBorder).reduce((sum, g) => sum + g.area, 0);
console.log(`border-connected white: ${border} px (${((border / count) * 100).toFixed(1)}%)`);
