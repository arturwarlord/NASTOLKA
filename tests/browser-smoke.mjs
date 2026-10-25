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
    await page.locator('#startGameBtn').click();
    // The forward road is DOM-driven; the environment canvas supplies the 3D scenery.
    await page.waitForFunction(() => document.querySelector('#playerLocationBar') && document.querySelectorAll('#playBoard .road-cell').length >= 2, undefined, { timeout: 20000 });
    await page.waitForTimeout(500);
    const startup = await page.evaluate(() => ({ cells: document.querySelectorAll('#playBoard .road-cell').length, status: document.querySelector('#turnStatus')?.textContent, rollDisabled: document.querySelector('#playRollBtn')?.disabled }));
    if (startup.cells < 2) throw new Error(`${viewport.name}: road did not initialize: ${JSON.stringify(startup)}`);
    await page.waitForTimeout(250);

    if (viewport.name === 'desktop') {
      // Don't count a green UI smoke test as success if the ready-made environment assets silently fell back.
      await page.waitForFunction(() => {
        const status = window.__nastolkaAssetStatus;
        return status && status.tree !== 'pending' && status.rock !== 'pending' && status.fern !== 'pending';
      }, undefined, { timeout: 60000 });
      const assetStatus = await page.evaluate(() => window.__nastolkaAssetStatus);
      if (assetStatus.tree !== 'loaded' || assetStatus.rock !== 'loaded' || assetStatus.fern !== 'loaded') {
        throw new Error(`Ready-made 3D assets did not load: ${JSON.stringify(assetStatus)}`);
      }
      console.log('OK external 3D assets: real tree, rock and fern models loaded.');
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
        playerButtons: document.querySelectorAll('#playerLocationBar .player-location').length,
        topbar: rect('.game-world-topbar'),

      };
    });

    if (!layout.board || layout.board.width < viewport.width * 0.85 || layout.board.height < 120 ||
        !layout.locationBar || layout.roadCells < 2 || layout.playerButtons < 2) {
      throw new Error(`${viewport.name}: дорожный маршрут или панель игроков не отображаются: ${JSON.stringify(layout)}`);
    }
    if (!layout.topbar || layout.topbar.height < 1) {
      throw new Error(`${viewport.name}: верхняя панель игры скрыта: ${JSON.stringify(layout)}`);
    }

    if (errors.length) throw new Error(`${viewport.name}: ошибки JavaScript: ${errors.join(' | ')}`);
    console.log(`OK ${viewport.name}: дорога ${Math.round(layout.board.width)}×${Math.round(layout.board.height)}, ${layout.roadCells} шагов и ${layout.playerButtons} местоположений игроков.`);
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
