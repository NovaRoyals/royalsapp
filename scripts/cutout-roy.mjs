/**
 * Turns the delivered Roy artwork (RGB PNGs on a solid white card) into framed,
 * transparent square sprites the UI can place anywhere.
 *
 * - removes the white background by flood-filling from the border only, so white
 *   areas inside the character (eyes, socks, crest) stay opaque
 * - feathers the cut edge so downscaled sprites keep clean antialiasing
 * - crops to the character's bounding box and re-centers it in a square
 * - downscales to 512px with premultiplied area averaging
 *
 * Usage: node scripts/cutout-roy.mjs [--dir assets/mascot/roy]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * The source art sits on white *and* carries a soft white glow. Measured on the
 * delivered files, the glow lives in the 200–236 band while the character's own
 * antialiased edge stays below ~176, so the fill threshold can safely reach 202.
 */
const WHITE_MIN = 202; // min(r,g,b) at or above this is background or glow
const FEATHER_LO = 150; // below this stays fully opaque
const MAX_SIZE = 512;
const PAD = 0.04;

const dirArg = process.argv.indexOf('--dir');
const DIR = path.resolve(dirArg > -1 ? process.argv[dirArg + 1] : 'assets/mascot/roy');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function decode(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let offset = 8;
  let header = null;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (!header) throw new Error('missing IHDR');
  if (header.depth !== 8 || header.interlace !== 0) throw new Error(`unsupported PNG (depth ${header.depth}, interlace ${header.interlace})`);
  if (header.colorType !== 2 && header.colorType !== 6) throw new Error(`unsupported colour type ${header.colorType}`);

  const bpp = header.colorType === 6 ? 4 : 3;
  const stride = header.width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(stride * header.height);

  let pos = 0;
  for (let y = 0; y < header.height; y += 1) {
    const filter = raw[pos];
    pos += 1;
    const row = raw.subarray(pos, pos + stride);
    pos += stride;
    const base = y * stride;
    const prev = base - stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? out[base + x - bpp] : 0;
      const up = y > 0 ? out[prev + x] : 0;
      const upLeft = y > 0 && x >= bpp ? out[prev + x - bpp] : 0;
      let value = row[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else if (filter !== 0) {
        throw new Error(`unsupported filter ${filter}`);
      }
      out[base + x] = value & 0xff;
    }
  }

  return { width: header.width, height: header.height, bpp, pixels: out };
}

function encode(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Border flood fill over near-white pixels, then a soft edge. */
function buildAlpha({ width, height, bpp, pixels }) {
  const count = width * height;
  const alpha = new Uint8Array(count).fill(255);
  const minChannel = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    const p = i * bpp;
    minChannel[i] = Math.min(pixels[p], pixels[p + 1], pixels[p + 2]);
  }

  const stack = new Int32Array(count);
  let top = 0;
  const push = (index) => {
    if (alpha[index] !== 255 || minChannel[index] < WHITE_MIN) return;
    alpha[index] = 0;
    stack[top] = index;
    top += 1;
  };
  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (top > 0) {
    top -= 1;
    const index = stack[top];
    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) push(index - 1);
    if (x < width - 1) push(index + 1);
    if (y > 0) push(index - width);
    if (y < height - 1) push(index + width);
  }

  const span = WHITE_MIN - FEATHER_LO;
  const feathered = Uint8Array.from(alpha);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (alpha[index] === 0) continue;
      const m = minChannel[index];
      if (m <= FEATHER_LO) continue;
      const touchesBackground =
        (x > 0 && alpha[index - 1] === 0) ||
        (x < width - 1 && alpha[index + 1] === 0) ||
        (y > 0 && alpha[index - width] === 0) ||
        (y < height - 1 && alpha[index + width] === 0);
      if (!touchesBackground) continue;
      feathered[index] = Math.max(0, Math.min(255, Math.round((255 * (WHITE_MIN - m)) / span)));
    }
  }
  return feathered;
}

function squareCrop(width, height, alpha) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, size: Math.min(width, height) };
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const size = Math.round(Math.max(w, h) * (1 + PAD * 2));
  return {
    x: Math.round(minX + w / 2 - size / 2),
    y: Math.round(minY + h / 2 - size / 2),
    size,
  };
}

/** Premultiplied area average so the cut edge does not pick up white or dark fringes. */
function resample(source, alpha, crop, outSize) {
  const { width, height, bpp, pixels } = source;
  const out = Buffer.alloc(outSize * outSize * 4);
  const scale = crop.size / outSize;
  for (let oy = 0; oy < outSize; oy += 1) {
    const y0 = Math.floor(crop.y + oy * scale);
    const y1 = Math.max(y0 + 1, Math.floor(crop.y + (oy + 1) * scale));
    for (let ox = 0; ox < outSize; ox += 1) {
      const x0 = Math.floor(crop.x + ox * scale);
      const x1 = Math.max(x0 + 1, Math.floor(crop.x + (ox + 1) * scale));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let samples = 0;
      for (let y = y0; y < y1; y += 1) {
        if (y < 0 || y >= height) {
          samples += Math.max(0, x1 - x0);
          continue;
        }
        for (let x = x0; x < x1; x += 1) {
          samples += 1;
          if (x < 0 || x >= width) continue;
          const index = y * width + x;
          const av = alpha[index];
          if (av === 0) continue;
          const p = index * bpp;
          r += pixels[p] * av;
          g += pixels[p + 1] * av;
          b += pixels[p + 2] * av;
          a += av;
        }
      }
      const o = (oy * outSize + ox) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
        out[o + 3] = Math.round(a / Math.max(1, samples));
      }
    }
  }
  return out;
}

const files = fs
  .readdirSync(DIR)
  .filter((name) => name.toLowerCase().endsWith('.png'))
  .sort();

let done = 0;
for (const name of files) {
  const file = path.join(DIR, name);
  try {
    const source = decode(file);
    const alpha = buildAlpha(source);
    const crop = squareCrop(source.width, source.height, alpha);
    const outSize = Math.min(MAX_SIZE, crop.size);
    const rgba = resample(source, alpha, crop, outSize);
    const before = fs.statSync(file).size;
    fs.writeFileSync(file, encode(outSize, outSize, rgba));
    const after = fs.statSync(file).size;
    done += 1;
    console.log(`${name.padEnd(16)} ${source.width}x${source.height} -> ${outSize}x${outSize}  ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`);
  } catch (error) {
    console.log(`${name.padEnd(16)} skipped: ${error.message}`);
  }
}
console.log(`\n${done}/${files.length} sprites written to ${DIR}`);
