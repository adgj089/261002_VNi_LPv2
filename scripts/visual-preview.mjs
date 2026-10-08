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


{
  const profile = { name: 'reason01-desktop-1030', width: 1030, height: 1012 };
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  } catch {}
  await page.waitForTimeout(1200);

  const reason01Left = page.locator('.reason01-left').first();
  if (await reason01Left.count()) {
    await reason01Left.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }

  const measurements = await page.evaluate(() => {
    const left = document.querySelector('.reason01-left');
    const flow = document.querySelector('.reason01-flow');
    const flowLabel = document.querySelector('.reason01-flow-label');
    const right = document.querySelector('.reason01-right');
    const image = document.querySelector('.reason01-source-image');
    const visualRow = left?.parentElement || null;
    const card = visualRow?.parentElement || null;

    const read = (el) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        rect: {
          left: Math.round(rect.left * 100) / 100,
          top: Math.round(rect.top * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          bottom: Math.round(rect.bottom * 100) / 100,
        },
        width: style.width,
        minWidth: style.minWidth,
        maxWidth: style.maxWidth,
        display: style.display,
        gap: style.gap,
        padding: style.padding,
        overflow: style.overflow,
        whiteSpace: style.whiteSpace,
        objectFit: style.objectFit,
      };
    };

    const cssRulesMatched = [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules]
          .filter((rule) => String(rule.cssText || '').includes('reason01-'))
          .map((rule) => rule.cssText);
      } catch {
        return [];
      }
    });

    const viewportWidth = window.innerWidth;
    return {
      viewport: {
        width: viewportWidth,
        height: window.innerHeight,
      },
      mediaQueries: {
        min1024: matchMedia('(min-width: 1024px)').matches,
        min1280: matchMedia('(min-width: 1280px)').matches,
      },
      card: read(card),
      visualRow: read(visualRow),
      left: read(left),
      flow: read(flow),
      flowLabel: read(flowLabel),
      right: read(right),
      image: read(image),
      widthsPercentOfVisualRow: visualRow
        ? {
            left: left ? Math.round((left.getBoundingClientRect().width / visualRow.getBoundingClientRect().width) * 10000) / 100 : null,
            flow: flow ? Math.round((flow.getBoundingClientRect().width / visualRow.getBoundingClientRect().width) * 10000) / 100 : null,
            right: right ? Math.round((right.getBoundingClientRect().width / visualRow.getBoundingClientRect().width) * 10000) / 100 : null,
          }
        : null,
      cssRulesMatched,
    };
  });

  await page.screenshot({
    path: path.join(outputDir, `${profile.name}-viewport.png`),
    fullPage: false,
    animations: 'disabled',
  });

  await fs.writeFile(
    path.join(outputDir, `${profile.name}-diagnostics.json`),
    JSON.stringify(measurements, null, 2)
  );

  summary.profiles[profile.name] = measurements;
  await context.close();
}


const reason01DiagnosticProfiles = [
  { name: 'reason01-mobile-550', width: 550, height: 633 },
  { name: 'reason01-mobile-390', width: 390, height: 844 },
];

for (const profile of reason01DiagnosticProfiles) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
  await page.waitForTimeout(1200);

  const target = page.locator('.reason01-right').first();
  if (await target.count()) {
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }

  const diagnostics = await page.evaluate(() => {
    const selectors = {
      visualRow: '.reason01-visual-row',
      right: '.reason01-right',
      dataColumn: '.reason01-right > div:last-child',
      barRow: '.reason01-bar-row',
      pieRow: '.reason01-pie-row',
      pie: '.reason01-pie',
    };

    const read = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return { exists: false };
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        exists: true,
        rect: {
          left: Math.round(rect.left * 100) / 100,
          top: Math.round(rect.top * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          bottom: Math.round(rect.bottom * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        },
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        width: style.width,
        height: style.height,
        minHeight: style.minHeight,
        maxHeight: style.maxHeight,
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        position: style.position,
        flex: style.flex,
        flexShrink: style.flexShrink,
        gap: style.gap,
        padding: style.padding,
        backgroundImage: style.backgroundImage,
        zIndex: style.zIndex,
        className: typeof el.className === 'string' ? el.className : '',
      };
    };

    const result = Object.fromEntries(
      Object.entries(selectors).map(([key, selector]) => [key, read(selector)])
    );

    const pie = document.querySelector('.reason01-pie');
    const pieRow = document.querySelector('.reason01-pie-row');

    const findRulesForSelector = (needle) => {
      const matches = [];
      const visit = (rules, context = []) => {
        for (const rule of [...(rules || [])]) {
          if (rule.cssRules) {
            const label = rule.conditionText || rule.media?.mediaText || rule.name || rule.constructor?.name || 'group';
            visit(rule.cssRules, [...context, label]);
            continue;
          }
          const selector = rule.selectorText || '';
          if (selector.includes(needle)) {
            matches.push({
              selector,
              cssText: rule.cssText,
              context,
            });
          }
        }
      };
      for (const sheet of [...document.styleSheets]) {
        try { visit(sheet.cssRules); } catch {}
      }
      return matches;
    };

    const pieClassRuleAudit = {
      w30: findRulesForSelector('w-\\[30px\\]'),
      h30: findRulesForSelector('h-\\[30px\\]'),
      smW34: findRulesForSelector('sm\\:w-\\[34px\\]'),
      smH34: findRulesForSelector('sm\\:h-\\[34px\\]'),
      reason01Pie: findRulesForSelector('.reason01-pie'),
    };
    const dataColumn = document.querySelector('.reason01-right > div:last-child');
    const right = document.querySelector('.reason01-right');

    const clipping = (child, parent) => {
      if (!child || !parent) return null;
      const c = child.getBoundingClientRect();
      const p = parent.getBoundingClientRect();
      return {
        above: c.top < p.top,
        below: c.bottom > p.bottom,
        left: c.left < p.left,
        right: c.right > p.right,
        childBottomMinusParentBottom: Math.round((c.bottom - p.bottom) * 100) / 100,
      };
    };

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      mediaMax575: matchMedia('(max-width: 575px)').matches,
      elements: result,
      pieClassRuleAudit,
      clipping: {
        pieVsPieRow: clipping(pie, pieRow),
        pieRowVsDataColumn: clipping(pieRow, dataColumn),
        pieRowVsRight: clipping(pieRow, right),
        pieVsRight: clipping(pie, right),
      },
    };
  });

  await page.screenshot({
    path: path.join(outputDir, `${profile.name}-viewport.png`),
    fullPage: false,
    animations: 'disabled',
  });

  await fs.writeFile(
    path.join(outputDir, `${profile.name}-diagnostics.json`),
    JSON.stringify(diagnostics, null, 2)
  );

  summary.profiles[profile.name] = diagnostics;
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

const clickForStep6Qa = async (locator) => {
  try {
    await locator.click({ timeout: 2000 });
    return 'pointer';
  } catch {
    await locator.dispatchEvent('click');
    return 'dom-fallback';
  }
};

{
  const profile = { name: 'tablet-actions-1023', width: 1023, height: 947 };
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  } catch {}
  await page.waitForTimeout(1200);

  const hamburger = page.locator('header button[aria-label]:not(.vn-i18n-trigger)').first();
  const hamburgerClickMethod = await clickForStep6Qa(hamburger);
  await page.waitForTimeout(500);

  const actionGroup = page.locator('.vn-mobile-nav-actions:visible').first();
  const cta = actionGroup.locator(':scope > button');
  const languageTrigger = actionGroup.locator('.vn-i18n-trigger');
  const measurements = await page.evaluate(() => {
    const group = document.querySelector('.vn-mobile-nav-actions');
    const cta = group?.querySelector(':scope > button');
    const language = group?.querySelector('.vn-i18n-trigger');
    const read = (el) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        rect: {
          left: Math.round(rect.left * 100) / 100,
          top: Math.round(rect.top * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          bottom: Math.round(rect.bottom * 100) / 100,
        },
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        borderRadius: style.borderRadius,
        padding: style.padding,
        lineHeight: style.lineHeight,
      };
    };
    return {
      cta: read(cta),
      language: read(language),
      sameHeight: !!cta && !!language && Math.abs(cta.getBoundingClientRect().height - language.getBoundingClientRect().height) < 0.5,
      sameTop: !!cta && !!language && Math.abs(cta.getBoundingClientRect().top - language.getBoundingClientRect().top) < 0.5,
      sameWidth: !!cta && !!language && Math.abs(cta.getBoundingClientRect().width - language.getBoundingClientRect().width) < 0.5,
    };
  });

  await page.screenshot({
    path: path.join(outputDir, `${profile.name}-menu-open.png`),
    fullPage: false,
    animations: 'disabled',
  });

  await fs.writeFile(
    path.join(outputDir, `${profile.name}-diagnostics.json`),
    JSON.stringify({ hamburgerClickMethod, ...measurements }, null, 2)
  );

  await context.close();
}

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

  const hamburger = page.locator('header button[aria-label]:not(.vn-i18n-trigger)').first();
  const hamburgerVisible = await hamburger.isVisible().catch(() => false);
  let hamburgerClickMethod = null;
  if (hamburgerVisible) {
    hamburgerClickMethod = await clickForStep6Qa(hamburger);
    await page.waitForTimeout(500);
  }

  const whyLink = page.locator('header a[href="#why-choose-us"]:visible').first();
  const mobileSwitcher = page.locator('.vn-i18n-mobile:visible').first();
  const languageTrigger = mobileSwitcher.locator('.vn-i18n-trigger');
  const languageMenu = mobileSwitcher.locator('.vn-i18n-menu');

  const whyBeforeBox = await whyLink.boundingBox().catch(() => null);
  const mobileSwitcherVisible = await mobileSwitcher.isVisible().catch(() => false);

  await page.screenshot({
    path: path.join(outputDir, `${profile.name}-menu-open.png`),
    fullPage: false,
    animations: 'disabled',
  });

  let languageMenuOpened = false;
  let languageTriggerClickMethod = null;
  if (mobileSwitcherVisible && await languageTrigger.isVisible().catch(() => false)) {
    languageTriggerClickMethod = await clickForStep6Qa(languageTrigger);
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
    path: path.join(outputDir, `${profile.name}-language-open.png`),
    fullPage: false,
    animations: 'disabled',
  });

  const expectedLanguages = ['ja', 'en', 'vi', 'zh', 'ko', 'es', 'fr'];
  const selectionResults = [];

  for (const code of expectedLanguages) {
    if (!await languageMenu.isVisible().catch(() => false)) {
      if (!await mobileSwitcher.isVisible().catch(() => false) && hamburgerVisible) {
        await clickForStep6Qa(hamburger);
        await page.waitForTimeout(200);
      }
      if (await languageTrigger.isVisible().catch(() => false)) {
        await clickForStep6Qa(languageTrigger);
        await page.waitForTimeout(200);
      }
    }

    const option = languageMenu.locator(`[data-language="${code}"]`);
    const optionVisible = await option.isVisible().catch(() => false);
    const optionEnabled = optionVisible && await option.isEnabled().catch(() => false);

    if (optionEnabled) {
      await clickForStep6Qa(option);
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
    hamburgerClickMethod,
    mobileSwitcherVisible,
    languageTriggerClickMethod,
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
    path.join(outputDir, `${profile.name}-diagnostics.json`),
    JSON.stringify(qa, null, 2)
  );

  summary.profiles[profile.name] = qa;
  await context.close();
}


// STEP 5-1-D: independent Sample Report Modal responsive QA.
const modalQaProfiles = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-320', width: 320, height: 844 },
];
const modalQaResults = {};
for (const profile of modalQaProfiles) {
  const result = {
    viewport: { width: profile.width, height: profile.height },
    status: 'NOT TESTED', checks: {}, errors: [],
  };
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: 1,
    locale: 'ja-JP',
    isMobile: profile.width < 768,
    hasTouch: profile.width < 768,
  });
  const page = await context.newPage();
  page.on('pageerror', error => result.errors.push(error.message));
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    const cta = page.getByRole('button', { name: /サンプルレポートを見る|View sample report/i }).first();
    await cta.waitFor({ state: 'visible', timeout: 15000 });
    await cta.click({ timeout: 10000 });
    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(450);
    const metrics = await page.evaluate(() => {
      const root = document.querySelector('[role="dialog"][aria-modal="true"]');
      const panel = root?.children[1];
      const closeButton = root?.querySelector('button[aria-label="閉じる"], button[aria-label="Close"]');
      const rect = panel?.getBoundingClientRect();
      const closeRect = closeButton?.getBoundingClientRect();
      const scrollable = root ? [...root.querySelectorAll('*')].some(el => {
        const style = getComputedStyle(el);
        return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 2;
      }) : false;
      return {
        actualWidth: innerWidth,
        bodyScrollLocked: document.body.classList.contains('overflow-hidden'),
        panelRect: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null,
        closeRect: closeRect ? { left: closeRect.left, right: closeRect.right, top: closeRect.top, bottom: closeRect.bottom } : null,
        internalScrollerFound: scrollable,
      };
    });
    result.metrics = metrics;
    const withinWidth = rect => !!rect && rect.left >= -1 && rect.right <= profile.width + 1;
    result.checks.actualViewport = metrics.actualWidth === profile.width;
    result.checks.panelWithinViewport = withinWidth(metrics.panelRect);
    result.checks.closeWithinViewport = withinWidth(metrics.closeRect) &&
      metrics.closeRect.top >= -1 && metrics.closeRect.bottom <= profile.height + 1;
    result.checks.backgroundLocked = metrics.bodyScrollLocked;
    result.checks.internalScrollAvailable = metrics.internalScrollerFound;
    await page.screenshot({
      path: path.join(outputDir, 'modal-' + profile.name + '.png'),
      fullPage: false, animations: 'disabled',
    });
    await dialog.locator('button[aria-label="閉じる"], button[aria-label="Close"]').first().click({ timeout: 10000 });
    await dialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForTimeout(380);
    result.checks.closeButtonWorks = true;
    result.checks.backgroundRestored = await page.evaluate(() => !document.body.classList.contains('overflow-hidden'));
    result.status = Object.values(result.checks).every(Boolean) && result.errors.length === 0 ? 'PASS' : 'FAIL';
  } catch (error) {
    result.errors.push(String(error));
    result.status = 'FAIL';
  } finally {
    modalQaResults[profile.name] = result;
    await context.close();
  }
}
summary.modalQa = modalQaResults;
await fs.writeFile(path.join(outputDir, 'modal-diagnostics.json'), JSON.stringify(modalQaResults, null, 2));

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
