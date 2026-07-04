// Renders public/favicon.svg to the raster icon set:
//   public/favicon.ico        (32px PNG wrapped in an ICO container)
//   public/apple-touch-icon.png (180px)
// Rerun after editing the SVG: node scripts/make-icons.mjs
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync(new URL("../public/favicon.svg", import.meta.url), "utf8");

async function renderPng(browser, size) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0"><div style="width:${size}px;height:${size}px">${svg.replace(
      "<svg ",
      `<svg width="${size}" height="${size}" `,
    )}</div></body>`,
  );
  const png = await page.screenshot({ omitBackground: true });
  await page.close();
  return png;
}

// Vista+ ICO: plain ICONDIR/ICONDIRENTRY header around a PNG payload
function pngToIco(png, size) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  header.writeUInt8(size === 256 ? 0 : size, 6); // width
  header.writeUInt8(size === 256 ? 0 : size, 7); // height
  header.writeUInt8(0, 8); // palette
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bpp
  header.writeUInt32LE(png.length, 14); // payload bytes
  header.writeUInt32LE(header.length, 18); // payload offset
  return Buffer.concat([header, png]);
}

const browser = await chromium.launch();
const png32 = await renderPng(browser, 32);
const png180 = await renderPng(browser, 180);
await browser.close();

writeFileSync(new URL("../public/favicon.ico", import.meta.url), pngToIco(png32, 32));
writeFileSync(new URL("../public/apple-touch-icon.png", import.meta.url), png180);
console.log("wrote favicon.ico (32) and apple-touch-icon.png (180)");
