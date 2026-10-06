import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:3000/';
const outputDir = path.resolve('visual-preview');
const commitSha = process.env.GITHUB_SHA || 'local';

const profiles = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'tablet', width: 768, height: 1024, isMobile: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
];

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const summary = {
  commit: commitSha,
  generatedAt: new Date().toISOString(),
  url: baseUrl,
  profiles: {},
};

for (const profile of profiles) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: 1,
    isMobile: profile.isMobile,
    hasTouch: profile.isMobile,
  });

  const page = await context.newPage();

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText || 'unknown',
    });
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  try {
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  } catch {
    // Some CDN or analytics requests can remain active; continue after a short settle period.
  }

  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch {}
    }

    const pendingImages = [...document.images]
      .filter((img) => !img.complete)
      .map((img) => new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 5000);
      }));

    await Promise.all(pendingImages);
  });

  await page.waitForTimeout(1200);

  await page.screenshot({
    path: path.join(outputDir, `${profile.name}-viewport.png`),
    fullPage: false,
    animations: 'disabled',
  });

  // Trigger scroll-based reveal animations and lazy content before the full-page capture.
  await page.evaluate(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const step = Math.max(Math.floor(window.innerHeight * 0.8), 400);
    const maxScroll = document.documentElement.scrollHeight;

    for (let y = 0; y < maxScroll; y += step) {
      window.scrollTo(0, y);
      await delay(120);
    }

    window.scrollTo(0, document.documentElement.scrollHeight);
    await delay(500);

    const pendingImages = [...document.images]
      .filter((img) => !img.complete)
      .map((img) => new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 5000);
      }));

    await Promise.all(pendingImages);
    window.scrollTo(0, 0);
    await delay(400);
  });

  const diagnostics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;

    const brokenImages = [...document.images]
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => ({
        src: img.currentSrc || img.src,
        alt: img.alt || '',
      }));

    const overflowingElements = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.right > window.innerWidth + 1 || rect.left < -1;
      })
      .slice(0, 30)
      .map((el) => ({
        tag: el.tagName,
        id: el.id || '',
        className: typeof el.className === 'string' ? el.className.slice(0, 180) : '',
        left: Math.round(el.getBoundingClientRect().left),
        right: Math.round(el.getBoundingClientRect().right),
        width: Math.round(el.getBoundingClientRect().width),
      }));

    return {
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      document: {
        scrollWidth: Math.max(root.scrollWidth, body?.scrollWidth || 0),
        scrollHeight: Math.max(root.scrollHeight, body?.scrollHeight || 0),
      },
      horizontalOverflow:
        Math.max(root.scrollWidth, body?.scrollWidth || 0) > window.innerWidth + 1,
      brokenImages,
      overflowingElements,
      imageCount: document.images.length,
      linkCount: document.links.length,
      buttonCount: document.querySelectorAll('button, [role="button"], input[type="submit"]').length,
      h1Count: document.querySelectorAll('h1').length,
    };
  });

  await page.screenshot({
    path: path.join(outputDir, `${profile.name}-full.png`),
    fullPage: true,
    animations: 'disabled',
  });

  const profileDiagnostics = {
    ...diagnostics,
    consoleErrors,
    pageErrors,
    failedRequests,
  };

  summary.profiles[profile.name] = profileDiagnostics;

  await fs.writeFile(
    path.join(outputDir, `${profile.name}-diagnostics.json`),
    JSON.stringify(profileDiagnostics, null, 2)
  );

  await context.close();
}


const step6Profiles = [
  { name: 'mobile-step6-390', width: 390, height: 844 },
  { name: 'mobile-step6-320', width: 320, height: 844 },
];

const isWithinViewport = (rect, width, height) => (
  rect &&
  rect.left >= -1 &&
  rect.right <= width + 1 &&
  rect.top >= -1 &&
  rect.bottom <= height + 1
);

for (const profile of step6Profiles) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText || 'unknown',
    });
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  } catch {}
  await page.waitForTimeout(1200);

  const hamburger = page.locator('header button[aria-label="メニューを開閉"]');
  const hamburgerVisible = await hamburger.isVisible().catch(() => false);
  if (hamburgerVisible) {
    await hamburger.click();
    await page.waitForTimeout(250);
  }

  const whyLink = page.locator('header a[href="#why-choose-us"]:visible').first();
  const mobileSwitcher = page.locator('.vn-i18n-mobile:visible').first();
  const languageTrigger = mobileSwitcher.locator('.vn-i18n-trigger');
  const languageMenu = mobileSwitcher.locator('.vn-i18n-menu');

  const whyBeforeBox = await whyLink.boundingBox().catch(() => null);
  const mobileSwitcherVisible = await mobileSwitcher.isVisible().catch(() => false);

  await page.screenshot({
    path: path.join(outputDir, \`\${profile.name}-menu-open.png\`),
    fullPage: false,
    animations: 'disabled',
  });

  let languageMenuOpened = false;
  if (mobileSwitcherVisible && await languageTrigger.isVisible().catch(() => false)) {
    await languageTrigger.click();
    await page.waitForTimeout(250);
    languageMenuOpened = await languageMenu.isVisible().catch(() => false);
  }

  const whyAfterBox = await whyLink.boundingBox().catch(() => null);
  const menuBox = await languageMenu.boundingBox().catch(() => null);
  const menuComputedPosition = await languageMenu.evaluate((el) => getComputedStyle(el).position).catch(() => null);
  const optionState = await languageMenu.locator('[data-language]').evaluateAll((buttons) =>
    buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        code: button.dataset.language,
        text: button.textContent.trim().replace(/\s+/g, ' '),
        visible: !!(rect.width && rect.height) && getComputedStyle(button).visibility !== 'hidden',
        disabled: button.disabled,
        rect: {
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    })
  ).catch(() => []);

  await page.screenshot({
    path: path.join(outputDir, \`\${profile.name}-language-open.png\`),
    fullPage: false,
    animations: 'disabled',
  });

  const expectedLanguages = ['ja', 'en', 'vi', 'zh', 'ko', 'es', 'fr'];
  const selectionResults = [];

  for (const code of expectedLanguages) {
    if (!await languageMenu.isVisible().catch(() => false)) {
      if (!await mobileSwitcher.isVisible().catch(() => false) && hamburgerVisible) {
        await hamburger.click();
        await page.waitForTimeout(200);
      }
      if (await languageTrigger.isVisible().catch(() => false)) {
        await languageTrigger.click();
        await page.waitForTimeout(200);
      }
    }

    const option = languageMenu.locator(\`[data-language="\${code}"]\`);
    const optionVisible = await option.isVisible().catch(() => false);
    const optionEnabled = optionVisible && await option.isEnabled().catch(() => false);

    if (optionEnabled) {
      await option.click();
      await page.waitForTimeout(250);
    }

    selectionResults.push({
      code,
      visible: optionVisible,
      enabled: optionEnabled,
      selectedLanguage: await page.locator('html').getAttribute('data-language'),
      menuClosedAfterSelection: !(await languageMenu.isVisible().catch(() => false)),
    });
  }

  const rootMetrics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const width = window.innerWidth;
    const scrollWidth = Math.max(root.scrollWidth, body?.scrollWidth || 0);
    return {
      viewport: { width, height: window.innerHeight },
      documentScrollWidth: scrollWidth,
      horizontalOverflow: scrollWidth > width + 1,
    };
  });

  const yBefore = whyBeforeBox?.y ?? null;
  const yAfter = whyAfterBox?.y ?? null;
  const yDelta = yBefore === null || yAfter === null ? null : Math.round((yAfter - yBefore) * 100) / 100;
  const allLanguagesPresent = expectedLanguages.every((code) => optionState.some((item) => item.code === code));
  const allLanguagesVisible = expectedLanguages.every((code) => optionState.some((item) => item.code === code && item.visible));
  const allLanguagesSelectable = expectedLanguages.every((code) =>
    selectionResults.some((item) => item.code === code && item.visible && item.enabled && item.selectedLanguage === code)
  );
  const allSelectionsCloseMenu = expectedLanguages.every((code) =>
    selectionResults.some((item) => item.code === code && item.menuClosedAfterSelection)
  );

  const qa = {
    profile: { width: profile.width, height: profile.height },
    hamburgerVisible,
    mobileSwitcherVisible,
    languageMenuOpened,
    menuComputedPosition,
    overlayByPosition: menuComputedPosition === 'absolute' || menuComputedPosition === 'fixed',
    whyChooseUsY: {
      beforeLanguageMenuOpen: yBefore,
      afterLanguageMenuOpen: yAfter,
      delta: yDelta,
      unchanged: yDelta !== null && Math.abs(yDelta) <= 1,
    },
    languageMenuRect: menuBox
      ? {
          left: Math.round(menuBox.x),
          right: Math.round(menuBox.x + menuBox.width),
          top: Math.round(menuBox.y),
          bottom: Math.round(menuBox.y + menuBox.height),
          width: Math.round(menuBox.width),
          height: Math.round(menuBox.height),
          withinViewport: isWithinViewport(
            {
              left: menuBox.x,
              right: menuBox.x + menuBox.width,
              top: menuBox.y,
              bottom: menuBox.y + menuBox.height,
            },
            profile.width,
            profile.height
          ),
        }
      : null,
    options: optionState,
    allLanguagesPresent,
    allLanguagesVisible,
    allLanguagesSelectable,
    allSelectionsCloseMenu,
    selectionResults,
    ...rootMetrics,
    consoleErrors,
    pageErrors,
    failedRequests,
  };

  await fs.writeFile(
    path.join(outputDir, \`\${profile.name}-diagnostics.json\`),
    JSON.stringify(qa, null, 2)
  );

  summary.profiles[profile.name] = qa;
  await context.close();
}

await browser.close();

await fs.writeFile(
  path.join(outputDir, 'diagnostics.json'),
  JSON.stringify(summary, null, 2)
);

await fs.writeFile(
  path.join(outputDir, 'metadata.json'),
  JSON.stringify(
    {
      commit: commitSha,
      generatedAt: summary.generatedAt,
      url: baseUrl,
      screenshots: profiles.flatMap((profile) => [
        `${profile.name}-viewport.png`,
        `${profile.name}-full.png`,
      ]),
      viewportSizes: Object.fromEntries(
        profiles.map((profile) => [
          profile.name,
          { width: profile.width, height: profile.height },
        ])
      ),
    },
    null,
    2
  )
);

console.log('Visual preview generated successfully.');
