import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const server = spawn('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], {
  stdio: 'ignore',
});
let browser;

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:4173/');
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(250);
  }
  if (!ready) throw new Error('Локальный сервер не запустился.');

  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  });

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('http://127.0.0.1:4173/?play=wild', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gameDialog[open]', { timeout: 10000 });
    await page.waitForFunction(() => document.documentElement.classList.contains('game-mode'));
    // The forward road is DOM-driven; the environment canvas supplies the 3D scenery.
    await page.waitForSelector('#playerLocationBar', { state: 'attached', timeout: 15000 });
    await page.waitForSelector('#playBoard .road-cell', { state: 'attached', timeout: 15000 });
    await page.waitForSelector('#nastolka3D', { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(250);

    if (viewport.name === 'desktop') {
      // Don't count a green UI smoke test as success if the ready-made environment assets silently fell back.
      await page.waitForFunction(() => {
        const status = window.__nastolkaAssetStatus;
        return status && status.tree !== 'pending' && status.rock !== 'pending';
      }, undefined, { timeout: 60000 });
      const assetStatus = await page.evaluate(() => window.__nastolkaAssetStatus);
      if (assetStatus.tree !== 'loaded' || assetStatus.rock !== 'loaded') {
        throw new Error(`Ready-made 3D assets did not load: ${JSON.stringify(assetStatus)}`);
      }
      console.log('OK external 3D assets: real tree and rock models loaded.');
    }

    const layout = await page.evaluate(() => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      };
      return {
        viewport: { width: innerWidth, height: innerHeight },
        board: rect('#playBoard'),
        locationBar: rect('#playerLocationBar'),
        roadCells: document.querySelectorAll('#playBoard .road-cell').length,
        topbar: rect('.game-world-topbar'),
        navigation: rect('#mapNavigation'),
        navigationDisplay: getComputedStyle(document.querySelector('#mapNavigation')).display,
      };
    });

    if (!layout.board || layout.board.width < viewport.width * 0.85 || layout.board.height < 120 ||
        !layout.locationBar || layout.roadCells < 2) {
      throw new Error(`${viewport.name}: дорожный маршрут или панель игроков не отображаются: ${JSON.stringify(layout)}`);
    }
    if (!layout.topbar || layout.topbar.height < 1 ||
        !layout.navigation || layout.navigationDisplay === 'none') {
      throw new Error(`${viewport.name}: верхняя навигация или панель карты скрыта: ${JSON.stringify(layout)}`);
    }

    await page.locator('#mapHistoryToggle').click({ force: true });
    const historyOpen = await page.evaluate(() =>
      document.documentElement.classList.contains('map-history-open') &&
      document.querySelector('#mapHistoryToggle').getAttribute('aria-pressed') === 'true'
    );
    if (!historyOpen) throw new Error(`${viewport.name}: переключатель истории не сработал.`);

    if (errors.length) throw new Error(`${viewport.name}: ошибки JavaScript: ${errors.join(' | ')}`);
    console.log(`OK ${viewport.name}: полноэкранное поле ${Math.round(layout.board.width)}×${Math.round(layout.board.height)}, навигация доступна, история открывается.`);
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
