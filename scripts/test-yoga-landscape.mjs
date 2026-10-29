// Start Vite first. Set PLAYWRIGHT_MODULE/CHROMIUM_PATH if not installed locally.
// An isolated browser profile keeps the user's saved practice untouched.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ viewport: { width: 956, height: 440 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.YOGA_URL || 'http://localhost:5173/yoga');
  await page.locator('#yoga-start-practice').click();
  await page.locator('.yoga-player').waitFor();
  async function fits(label) {
    const problems = await page.evaluate(() => {
      const selectors = ['.yoga-player-header', '.yoga-current-pose .yoga-eyebrow', '.yoga-current-pose > img',
        '.yoga-current-pose h1', '.yoga-sanskrit', '.yoga-pose-cue', '.yoga-breath-orbit', '.yoga-breath-audio',
        '.yoga-breath-count', '.yoga-breath-guide > .yoga-muted', '.yoga-player-controls', '.yoga-player-footer',
        '.yoga-up-next', '.yoga-routine-progress', '.yoga-player-title'];
      const problems = [];
      const root = document.querySelector('.yoga-player');
      if (root.scrollHeight > root.clientHeight + 2 || root.scrollWidth > root.clientWidth + 2) {
        problems.push(`overflow: ${root.scrollWidth}x${root.scrollHeight} in ${root.clientWidth}x${root.clientHeight}`);
      }
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        const r = el?.getBoundingClientRect();
        if (!r || !r.width || !r.height || r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) {
          problems.push(`${selector}: ${JSON.stringify(r?.toJSON())}`);
        }
      }
      const orbit = document.querySelector('.yoga-breath-orbit').getBoundingClientRect();
      const sound = document.querySelector('.yoga-breath-audio').getBoundingClientRect();
      if (orbit.right > sound.left + 1) problems.push('sound controls overlap breathing circle');
      return problems;
    });
    assert.deepEqual(problems, [], label);
  }
  for (const [width, height] of [[956, 440], [915, 412], [800, 360], [740, 360], [1280, 591]]) {
    await page.setViewportSize({ width, height });
    await fits(`${width}x${height}, practice`);
    await page.getByRole('button', { name: 'Enter full screen', exact: true }).click();
    await page.waitForFunction(() => !!document.fullscreenElement);
    await fits(`${width}x${height}, fullscreen`);
    if (width === 956 && process.env.YOGA_SCREENSHOT) {
      await page.screenshot({ path: process.env.YOGA_SCREENSHOT, scale: 'css' });
    }
    await page.getByRole('button', { name: 'Begin practice', exact: true }).click();
    await fits(`${width}x${height}, playing`);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await fits(`${width}x${height}, paused`);
    // Previous/next navigation must also remain usable in the compact layout.
    await page.getByRole('button', { name: 'Next pose', exact: true }).click();
    await fits(`${width}x${height}, next pose`);
    await page.getByRole('button', { name: 'Previous pose', exact: true }).click();
    await page.getByRole('button', { name: 'Exit full screen', exact: true }).click();
  }
  await page.setViewportSize({ width: 440, height: 956 });
  assert.equal(await page.locator('.yoga-player').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true,
    'rotating back to portrait has no horizontal overflow');
  await page.setViewportSize({ width: 956, height: 440 });
  await fits('rotated back to landscape');
  // Check the longest pose names and cues, not just the short starter poses.
  await page.getByRole('button', { name: 'Back to session', exact: true }).click();
  const poseCount = await page.evaluate(async () => {
    const { poses } = await import('/src/features/yoga/poses.ts');
    const { createRoutine, createStep, DRAFT_KEY } = await import('/src/features/yoga/model.ts');
    const routine = createRoutine();
    routine.name = 'Everyday reset';
    routine.steps = poses.map(pose => createStep(pose.id));
    localStorage.setItem(DRAFT_KEY, JSON.stringify(routine));
    return poses.length;
  });
  await page.reload();
  await page.locator('#yoga-start-practice').click();
  await page.setViewportSize({ width: 740, height: 360 });
  await page.getByRole('button', { name: 'Enter full screen', exact: true }).click();
  for (let i = 0; i < poseCount; i++) {
    await fits(`catalog pose ${i + 1}`);
    if (i + 1 < poseCount) await page.getByRole('button', { name: 'Next pose', exact: true }).click();
  }
  assert.deepEqual(errors, []);
  console.log('Yoga landscape: all information fits phone viewports, fullscreen, playback, pause, navigation and rotation.');
} finally { await browser.close(); }
