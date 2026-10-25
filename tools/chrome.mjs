// Starts headless Chrome for the build and test scripts.
// Set CHROME_PATH to a Chrome or Chromium binary. Without it, @sparticuz/chromium is used if it happens to be installed.
import puppeteer from 'puppeteer-core';

export async function launch() {
  if (process.env.CHROME_PATH) {
    return puppeteer.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--disable-gpu'], headless: true });
  }
  try {
    const chromium = (await import('@sparticuz/chromium')).default;
    return puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell' });
  } catch {
    throw new Error('No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary, for example CHROME_PATH="/usr/bin/google-chrome".');
  }
}
