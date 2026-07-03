import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4322";
const OUT = "/tmp/claude-1000/-home-jacob-Documents-Personal-Site/ad9586d9-a005-4c29-a00c-aa0790946773/scratchpad";
const routes = ["/", "/posts", "/posts/sample-writeup", "/projects", "/about", "/404-test-nonexistent"];

const results = [];
const step = (name, ok, detail = "") =>
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);

// contrast helpers
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const browser = await chromium.launch();

// --- 360px overflow sweep (§5 invariant) ---
const narrow = await browser.newPage({ viewport: { width: 360, height: 740 } });
for (const r of routes) {
  await narrow.goto(BASE + r, { waitUntil: "networkidle" });
  const over = await narrow.evaluate(
    () => document.scrollingElement.scrollWidth - document.documentElement.clientWidth,
  );
  step(`360px no h-scroll ${r}`, over <= 0, `overflow=${over}px`);
}
await narrow.goto(BASE + "/");
await narrow.screenshot({ path: `${OUT}/refactor-mobile-home.png`, fullPage: true });
await narrow.close();

// --- desktop screenshots + focus/keyboard sweep ---
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/refactor-home.png` });

// first tab stop = skip link
await page.keyboard.press("Tab");
const first = await page.evaluate(() => ({
  cls: document.activeElement?.className,
  text: document.activeElement?.textContent?.trim(),
}));
step("first tab stop is skip link", (first.cls || "").includes("skip-link"), first.text);
// skip link visible when focused
const skipVisible = await page.evaluate(() => {
  const el = document.activeElement;
  const r = el.getBoundingClientRect();
  return r.width > 20 && r.height > 10;
});
step("skip link visible on focus", skipVisible);
// next stops: ident then modules; focus outline present on module
await page.keyboard.press("Tab");
await page.keyboard.press("Tab");
const outline = await page.evaluate(() => {
  const s = getComputedStyle(document.activeElement);
  return `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`;
});
step("focus outline on nav module", outline.includes("2px") && outline.includes("solid"), outline);

// single h1 per page
for (const r of routes) {
  await page.goto(BASE + r, { waitUntil: "networkidle" });
  const h1s = await page.$$eval("h1", (els) => els.length);
  step(`single h1 ${r}`, h1s === 1, `count=${h1s}`);
}

// aria-hidden on all decorative JP
await page.goto(BASE + "/", { waitUntil: "networkidle" });
const jpUnhidden = await page.$$eval(".jp, .callout-jp", (els) =>
  els.filter((e) => !e.closest('[aria-hidden="true"]') && e.getAttribute("aria-hidden") !== "true").length,
);
step("all JP decor aria-hidden", jpUnhidden === 0, `unhidden=${jpUnhidden}`);

// hero title is bold mono
const heroFont = await page.$eval(".hero-title", (el) => {
  const s = getComputedStyle(el);
  return `${s.fontWeight} ${s.fontFamily.split(",")[0]}`;
});
step("hero title bold mono", /700/.test(heroFont) && /Plex Mono/.test(heroFont), heroFont);

await page.goto(BASE + "/posts", { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/refactor-posts.png` });
await page.goto(BASE + "/posts/sample-writeup", { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/refactor-article.png`, fullPage: false });
await page.goto(BASE + "/404-test-nonexistent", { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/refactor-404.png` });

// --- reduced motion ---
const rm = await browser.newPage({ reducedMotion: "reduce" });
await rm.goto(BASE + "/", { waitUntil: "networkidle" });
const dur = await rm.$eval("a", (el) => getComputedStyle(el).transitionDuration);
step("reduced motion collapses transitions", dur === "0s", dur);
await rm.close();

// --- contrast spot checks (computed) ---
const pairs = [
  ["text on bg", "#e7ecf2", "#080b0f", 4.5],
  ["muted on bg", "#8e9aaa", "#080b0f", 4.5],
  ["muted on surface", "#8e9aaa", "#0f141c", 4.5],
  ["link on bg", "#a48ae8", "#080b0f", 4.5],
  ["warn on bg", "#e0a12e", "#080b0f", 4.5],
  ["ok-text on bg", "#22a06b", "#080b0f", 4.5],
  ["error-text on surface", "#e04b4b", "#0f141c", 4.5],
  ["plate text on accent", "#e7ecf2", "#3d177f", 4.5],
  ["focus outline (border-active) on bg", "#607082", "#080b0f", 3.0],
  ["focus outline (border-active) on surface", "#607082", "#0f141c", 3.0],
];
for (const [name, fg, bg, min] of pairs) {
  const r = ratio(fg, bg);
  step(`contrast ${name}`, r >= min, `${r.toFixed(2)}:1 (min ${min})`);
}

console.log(results.join("\n"));
await browser.close();
