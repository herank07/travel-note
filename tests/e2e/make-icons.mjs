// Renders the app icon (a timeline with the next stop marked) to PNG. Run: node tests/e2e/make-icons.mjs
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#16202A"/>
  <line x1="200" y1="96" x2="200" y2="416" stroke="#3A4856" stroke-width="20" stroke-linecap="round"/>
  <circle cx="200" cy="140" r="30" fill="#16202A" stroke="#9AA8B5" stroke-width="16"/>
  <circle cx="200" cy="256" r="44" fill="#D23F31"/>
  <circle cx="200" cy="372" r="30" fill="#16202A" stroke="#9AA8B5" stroke-width="16"/>
  <rect x="272" y="236" width="140" height="40" rx="20" fill="#F3F5F7"/>
  <rect x="272" y="124" width="96" height="32" rx="16" fill="#5B6875"/>
  <rect x="272" y="356" width="112" height="32" rx="16" fill="#5B6875"/>
</svg>`;

mkdirSync('site/icons', { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
for (const size of [192, 512]) {
  await page.setViewport({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}">`);
  await page.screenshot({ path: `site/icons/icon-${size}.png`, omitBackground: false });
}
await browser.close();
console.log('icons written');
