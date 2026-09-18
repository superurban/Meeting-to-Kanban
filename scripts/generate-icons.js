import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, r, g, b) {
  // Simple PNG generator in pure Node without external dependencies
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    let c = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ (-1)) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(combined), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 2; // RGB
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdr = chunk('IHDR', ihdrData);

  // IDAT: Scanlines
  const rowLength = 1 + width * 3;
  const rawData = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter none
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      // create a nice blue-purple gradient
      const factor = (x + y) / (width + height);
      rawData[pixelOffset] = Math.floor(r * (1 - factor * 0.4));
      rawData[pixelOffset + 1] = Math.floor(g * (1 - factor * 0.2));
      rawData[pixelOffset + 2] = Math.floor(b);
    }
  }
  const compressed = zlib.deflateSync(rawData);
  const idat = chunk('IDAT', compressed);

  // IEND
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const icon192 = createPNG(192, 192, 59, 130, 246); // Blue
const icon512 = createPNG(512, 512, 59, 130, 246);

fs.writeFileSync('./public/pwa-192x192.png', icon192);
fs.writeFileSync('./public/pwa-512x512.png', icon512);
fs.writeFileSync('./public/apple-touch-icon.png', icon192);
console.log('PNG icons generated successfully!');
