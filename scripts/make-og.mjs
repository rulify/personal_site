// Renders public/og.png (1200×630 share card) in the site's visual language.
// Rerun after identity/palette changes: node scripts/make-og.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const fontsDir = fileURLToPath(new URL("../public/fonts/", import.meta.url));

const html = `<!doctype html>
<html><head><style>
  @font-face {
    font-family: "IBM Plex Mono";
    font-weight: 700;
    src: url("file://${fontsDir}ibm-plex-mono-latin-700.woff2") format("woff2");
  }
  @font-face {
    font-family: "IBM Plex Mono";
    font-weight: 500;
    src: url("file://${fontsDir}ibm-plex-mono-latin-500.woff2") format("woff2");
  }
  @font-face {
    font-family: "IBM Plex Sans";
    font-weight: 400;
    src: url("file://${fontsDir}ibm-plex-sans-latin-400.woff2") format("woff2");
  }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    background-color: #080b0f;
    background-image:
      linear-gradient(rgba(53, 64, 76, 0.16) 2px, transparent 2px),
      linear-gradient(90deg, rgba(53, 64, 76, 0.16) 2px, transparent 2px);
    background-size: 96px 96px;
    color: #e7ecf2;
    font-family: "IBM Plex Mono", monospace;
    position: relative;
    padding: 90px 100px;
  }
  .cross { position: absolute; color: #636c79; font: 500 28px "IBM Plex Mono"; }
  .hello { color: #8e9aaa; font: 500 26px "IBM Plex Mono"; letter-spacing: 0.12em; }
  .hello .chev { color: #a48ae8; }
  h1 {
    font: 700 104px/1.05 "IBM Plex Mono";
    letter-spacing: 0.02em;
    margin: 24px 0 28px;
    display: flex; align-items: center; gap: 36px;
    white-space: nowrap;
  }
  .block { display: inline-block; width: 34px; height: 92px; background: #3d177f; }
  .sub { font: 400 40px "IBM Plex Sans", sans-serif; color: #e7ecf2; margin-bottom: 56px; }
  .roles { display: flex; gap: 20px; }
  .role {
    font: 500 26px "IBM Plex Mono"; letter-spacing: 0.08em;
    color: #e7ecf2; background: #0f141c;
    border: 2px solid #35404c; border-left: 5px solid #3d177f;
    padding: 18px 28px;
  }
  .strip {
    position: absolute; left: 0; right: 0; bottom: 0; height: 14px;
    background:
      repeating-linear-gradient(-45deg, #3d177f 0 14px, transparent 14px 32px) 0 0 / 220px 100% no-repeat,
      repeating-linear-gradient(-45deg, #35404c 0 14px, transparent 14px 32px);
  }
  .serial {
    position: absolute; right: 100px; bottom: 52px;
    color: #636c79; font: 500 24px "IBM Plex Mono"; letter-spacing: 0.1em;
  }
</style></head>
<body>
  <span class="cross" style="top:36px;left:44px">+</span>
  <span class="cross" style="top:36px;right:44px">+</span>
  <p class="hello"><span class="chev">›››</span> HI, I'M</p>
  <h1><span class="block"></span>JACOB THOMAS</h1>
  <p class="sub">Incoming cybersecurity student at Oxford Brookes</p>
  <div class="roles">
    <span class="role">WRITEUPS</span>
    <span class="role">PROJECTS</span>
    <span class="role">EXPERIMENTS</span>
  </div>
  <p class="serial">RLFY-01 // PERSONAL TERMINAL</p>
  <div class="strip"></div>
</body></html>`;

// serve via file:// so the file:// font URLs are fetchable (setContent
// pages live on about:blank and refuse local font requests)
const tmp = fileURLToPath(new URL("../node_modules/.og-card.html", import.meta.url));
const { writeFileSync, unlinkSync } = await import("node:fs");
writeFileSync(tmp, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto("file://" + tmp, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({
  path: fileURLToPath(new URL("../public/og.png", import.meta.url)),
});
await browser.close();
unlinkSync(tmp);
console.log("wrote public/og.png (1200x630)");
