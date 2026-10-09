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
    const cta = page.locator('.hero-fv-wrapper button').filter({ hasText: /サンプルレポートを見る|View sample report/i }).first();
    await cta.waitFor({ state: 'visible', timeout: 15000 });
    await cta.scrollIntoViewIfNeeded({ timeout: 10000 });
    result.clickDiagnostics = await cta.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2));
      const atPoint = document.elementFromPoint(x, y);
      return {
        selector: '.hero-fv-wrapper button',
        label: el.textContent?.trim(),
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        viewport: { width: innerWidth, height: innerHeight },
        hitTag: atPoint?.tagName || null,
        hitClass: typeof atPoint?.className === 'string' ? atPoint.className.slice(0, 240) : null,
        targetReceivesPointer: atPoint === el || el.contains(atPoint),
      };
    });
    try {
      await cta.click({ timeout: 10000 });
    } catch (clickError) {
      result.clickDiagnostics.clickError = String(clickError);
      throw clickError;
    }
    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(450);
    const metrics = await page.evaluate(() => {
      const root = document.querySelector('[role="dialog"][aria-modal="true"]');
      const panel = root?.children[1];
      const closeButton = root?.querySelector('button[aria-label="閉じる"], button[aria-label="Close"]');
      const rect = panel?.getBoundingClientRect();
      const closeRect = closeButton?.getBoundingClientRect();
      const scrollCandidates = root ? [...root.querySelectorAll('*')].filter(el => {
        const style = getComputedStyle(el);
        return /(auto|scroll)/.test(style.overflowY);
      }) : [];
      const scrollRequired = scrollCandidates.some(el => el.scrollHeight > el.clientHeight + 2);
      const scrollAvailable = scrollCandidates.some(el =>
        el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0
      );
      return {
        actualWidth: innerWidth,
        bodyScrollLocked: document.body.classList.contains('overflow-hidden'),
        panelRect: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null,
        closeRect: closeRect ? { left: closeRect.left, right: closeRect.right, top: closeRect.top, bottom: closeRect.bottom } : null,
        internalScrollRequired: scrollRequired,
        internalScrollerFound: scrollAvailable,
      };
    });
    result.metrics = metrics;
    const withinWidth = rect => !!rect && rect.left >= -1 && rect.right <= profile.width + 1;
    result.checks.actualViewport = metrics.actualWidth === profile.width;
    result.checks.panelWithinViewport = withinWidth(metrics.panelRect);
    result.checks.closeWithinViewport = withinWidth(metrics.closeRect) &&
      metrics.closeRect.top >= -1 && metrics.closeRect.bottom <= profile.height + 1;
    result.checks.backgroundLocked = metrics.bodyScrollLocked;
    result.checks.internalScrollAvailable = !metrics.internalScrollRequired || metrics.internalScrollerFound;
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


// STEP 5-2-A: Navigation functional QA. Isolated from existing modal QA.
const navigationQaProfiles = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-320', width: 320, height: 844 },
];
const navigationTargets = ['#why-choose-us', '#features', '#flow', '#comparison', '#faq'];
const navigationQaResults = {};
for (const profile of navigationQaProfiles) {
  const result = { viewport: { width: profile.width, height: profile.height }, status: 'NOT TESTED', checks: {}, links: [], errors: [] };
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: 1, locale: 'ja-JP',
    isMobile: profile.width < 768, hasTouch: profile.width < 768,
  });
  const page = await context.newPage();
  page.on('pageerror', error => result.errors.push('pageerror: ' + error.message));
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    const mobile = profile.width < 1024;
    const header = page.locator('header').first();
    const hamburger = header.locator('button[aria-label="メニューを開閉"]');
    const menu = header.locator('.vn-mobile-nav-list');
    const desktopNav = header.locator('nav').first();
    result.checks.actualViewport = await page.evaluate(width => innerWidth === width, profile.width);
    result.checks.expectedNavigationMode = mobile
      ? await hamburger.isVisible() && !(await desktopNav.isVisible())
      : await desktopNav.isVisible() && !(await hamburger.isVisible());
    if (mobile) {
      await hamburger.click({ timeout: 10000 });
      await page.waitForTimeout(380);
      result.checks.mobileMenuOpens = await menu.isVisible() && await menu.locator('a[href="#faq"]').isVisible();
      await page.screenshot({ path: path.join(outputDir, 'navigation-' + profile.name + '-menu-open.png'), fullPage: false, animations: 'disabled' });
      await hamburger.click({ timeout: 10000 });
      await page.waitForTimeout(380);
      result.checks.mobileMenuCloses = await menu.locator('a[href="#faq"]').evaluate(el => getComputedStyle(el.parentElement.parentElement).pointerEvents === 'none').catch(() => false);
      // Verify backdrop click closes an open mobile menu.
      await hamburger.click({ timeout: 10000 });
      await page.waitForTimeout(380);
      await header.evaluate(el => {
        const overlay = el.previousElementSibling;
        if (overlay && overlay.getBoundingClientRect().width) overlay.click();
      });
      await page.waitForTimeout(380);
      result.checks.backdropClosesMenu = await menu.locator('a[href="#faq"]').evaluate(el => getComputedStyle(el.parentElement.parentElement).pointerEvents === 'none').catch(() => false);
    }
    for (const href of navigationTargets) {
      const entry = { href, status: 'NOT TESTED' };
      try {
        const target = page.locator(href);
        entry.targetExists = await target.count() === 1;
        if (!entry.targetExists) throw Error('Missing or nonunique anchor: ' + href);
        if (mobile) {
          await hamburger.click({ timeout: 10000 });
          await page.waitForTimeout(380);
        }
        const link = mobile ? menu.locator('a[href="' + href + '"]') : desktopNav.locator('a[href="' + href + '"]');
        entry.linkVisible = await link.isVisible();
        await link.click({ timeout: 10000 });
        await page.waitForTimeout(1050);
        entry.metrics = await page.evaluate(selector => {
          const node = document.querySelector(selector);
          const header = document.querySelector('header.fixed.top-0') || document.querySelector('header');
          if (!node || !header) return null;
          const heading = node.querySelector('h2, h1, h3');
          const headingRect = heading?.getBoundingClientRect();
          const targetRect = node.getBoundingClientRect();
          const headerRect = header.getBoundingClientRect();
          return { targetTop: Math.round(targetRect.top), headerBottom: Math.round(headerRect.bottom),
            scrollY: Math.round(scrollY), targetVisible: targetRect.bottom > headerRect.bottom && targetRect.top < innerHeight,
            headingFound: !!headingRect, headingTop: headingRect ? Math.round(headingRect.top) : null,
            headingBottom: headingRect ? Math.round(headingRect.bottom) : null,
            headingVisible: !!headingRect && headingRect.top >= headerRect.bottom - 2 && headingRect.bottom <= innerHeight,
            headerOverlapsTargetTop: targetRect.top < headerRect.bottom - 2 };
        }, href);
        entry.scrollMoved = entry.metrics?.scrollY > 0;
        entry.visibleBelowHeader = !!entry.metrics?.targetVisible && !!entry.metrics?.headingVisible;
        if (mobile) {
          entry.menuClosedAfterSelection = await menu.locator('a[href="#faq"]').evaluate(el =>
            getComputedStyle(el.parentElement.parentElement).pointerEvents === 'none').catch(() => false);
        }
        entry.status = entry.linkVisible && entry.scrollMoved && entry.visibleBelowHeader &&
          (!mobile || entry.menuClosedAfterSelection) ? 'PASS' : 'FAIL';
      } catch (error) {
        entry.errors = [String(error)];
        entry.status = 'FAIL';
      }
      result.links.push(entry);
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(450);
    }
    result.status = Object.values(result.checks).every(Boolean) &&
      result.links.every(link => link.status === 'PASS') && result.errors.length === 0 ? 'PASS' : 'FAIL';
  } catch (error) {
    result.errors.push(String(error)); result.status = 'FAIL';
  } finally {
    navigationQaResults[profile.name] = result;
    await context.close();
  }
}
summary.navigationQa = navigationQaResults;
await fs.writeFile(path.join(outputDir, 'navigation-diagnostics.json'), JSON.stringify(navigationQaResults, null, 2));


// STEP 5-2-B: isolated FAQ interaction and responsive QA.
const faqQaProfiles = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-320', width: 320, height: 844 },
];
const faqQaResults = {};
for (const profile of faqQaProfiles) {
  const result = { viewport: { width: profile.width, height: profile.height }, status: 'NOT TESTED', checks: {}, items: [], errors: [] };
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: 1, locale: 'ja-JP',
    isMobile: profile.width < 768, hasTouch: profile.width < 768,
  });
  const page = await context.newPage();
  page.on('pageerror', error => result.errors.push('pageerror: ' + error.message));
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    const section = page.locator('#faq');
    await section.waitFor({ state: 'visible', timeout: 15000 });
    await section.scrollIntoViewIfNeeded();
    const items = section.locator('.faq-item');
    const count = await items.count();
    result.checks.fiveItemsPresent = count === 5;
    const readState = async (index) => items.nth(index).evaluate(el => {
      const button = el.querySelector('button');
      const panel = el.children[1];
      const style = panel ? getComputedStyle(panel) : null;
      const rect = panel?.getBoundingClientRect();
      const heading = button?.innerText.trim().replace(/\s+/g, ' ') ?? '';
      const expanded = !!style && style.gridTemplateRows !== '0px' &&
        parseFloat(style.opacity) > 0.95 && !!rect && rect.height > 3;
      return { heading, expanded, panelHeight: rect ? Math.round(rect.height) : null,
        gridRows: style?.gridTemplateRows ?? null, opacity: style?.opacity ?? null,
        horizontalOverflow: el.getBoundingClientRect().right > innerWidth + 1 ||
          el.getBoundingClientRect().left < -1 };
    });
    const waitAnimation = () => page.waitForTimeout(450);
    result.checks.initiallyClosed = true;
    for (let i = 0; i < count; i++) {
      const state = await readState(i);
      if (state.expanded) result.checks.initiallyClosed = false;
    }
    for (let i = 0; i < count; i++) {
      const itemResult = { index: i + 1, status: 'NOT TESTED' };
      try {
        await items.nth(i).locator('button').first().click({ timeout: 12000 });
        await waitAnimation();
        itemResult.open = await readState(i);
        await items.nth(i).locator('button').first().click({ timeout: 12000 });
        await waitAnimation();
        itemResult.closed = await readState(i);
        itemResult.status = itemResult.open.expanded && !itemResult.closed.expanded &&
          !itemResult.open.horizontalOverflow && !itemResult.closed.horizontalOverflow ? 'PASS' : 'FAIL';
      } catch (error) {
        itemResult.errors = [String(error)];
        itemResult.status = 'FAIL';
      }
      result.items.push(itemResult);
    }
    if (count >= 2) {
      await items.nth(0).locator('button').first().click({ timeout: 12000 });
      await items.nth(1).locator('button').first().click({ timeout: 12000 });
      await waitAnimation();
      const first = await readState(0), second = await readState(1);
      result.checks.multipleCanRemainOpen = first.expanded && second.expanded;
      await section.screenshot({ path: path.join(outputDir, 'faq-' + profile.name + '-two-open.png'), animations: 'disabled' });
      await items.nth(0).locator('button').first().click({ timeout: 12000 });
      await items.nth(1).locator('button').first().click({ timeout: 12000 });
      await waitAnimation();
      result.checks.multipleCanClose = !(await readState(0)).expanded && !(await readState(1)).expanded;
    } else {
      result.checks.multipleCanRemainOpen = false;
      result.checks.multipleCanClose = false;
    }
    result.checks.noHorizontalPageOverflow = await page.evaluate(() =>
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1);
    result.status = Object.values(result.checks).every(Boolean) &&
      result.items.length === 5 && result.items.every(item => item.status === 'PASS') &&
      result.errors.length === 0 ? 'PASS' : 'FAIL';
  } catch (error) {
    result.errors.push(String(error));
    result.status = 'FAIL';
  } finally {
    faqQaResults[profile.name] = result;
    await context.close();
  }
}
summary.faqQa = faqQaResults;
await fs.writeFile(path.join(outputDir, 'faq-diagnostics.json'), JSON.stringify(faqQaResults, null, 2));


// STEP 5-2-C-1: isolated Dashboard menu-switching functional QA.
// This block only exercises the demo UI; report-export/settings functions are out of scope.
const dashboardQaProfiles = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-320', width: 320, height: 844 },
];
const dashboardQaMenus = [
  { name: 'ダッシュボード', heading: 'ベトナム市場サマリー・ダッシュボード' },
  { name: '業界レポート', heading: 'ベトナム主要業界レポート・市場動向' },
  { name: '調査テーマ', heading: '進行中の市場調査プロジェクト・プラン管理' },
  { name: '照合データ', heading: '現地情報と照合した 財務・市場データライブラリ' },
  { name: 'レポート出力', heading: 'カスタムレポート生成・エクスポート' },
  { name: '設定', heading: 'アカウント・システム設定' },
];
const dashboardQaResults = {};
for (const profile of dashboardQaProfiles) {
  const result = {
    viewport: { width: profile.width, height: profile.height },
    status: 'NOT TESTED', checks: {}, menus: [], errors: [],
  };
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: 1, locale: 'ja-JP',
    isMobile: profile.width < 768, hasTouch: profile.width < 768,
  });
  const page = await context.newPage();
  page.on('pageerror', error => result.errors.push('pageerror: ' + error.message));
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    const mockup = page.locator('.mockup-window').first();
    await mockup.waitFor({ state: 'visible', timeout: 15000 });
    await mockup.scrollIntoViewIfNeeded();
    const useMobileMenu = profile.width < 640;
    const menuContainer = mockup.locator(useMobileMenu ? '.mobile-menu-scroll' : '.mockup-sidebar');
    const content = mockup.locator('.mockup-main .tab-content-anim');
    result.checks.viewportMatches = await page.evaluate(width => innerWidth === width, profile.width);
    result.checks.menuModeMatches = await menuContainer.isVisible();
    result.checks.initialDashboard = await content.locator('h2')
      .filter({ hasText: dashboardQaMenus[0].heading }).isVisible();
    for (const menu of dashboardQaMenus) {
      const entry = { name: menu.name, status: 'NOT TESTED', checks: {}, errors: [] };
      try {
        const target = menuContainer.locator(useMobileMenu ? 'button' : 'div.cursor-pointer')
          .filter({ hasText: menu.name }).first();
        entry.checks.uniqueMenu = (await menuContainer.locator(useMobileMenu ? 'button' : 'div.cursor-pointer')
          .filter({ hasText: menu.name }).count()) === 1;
        if (!entry.checks.uniqueMenu) {
          entry.status = 'FAIL';
          entry.errors.push('Menu locator is not unique');
          result.menus.push(entry);
          continue;
        }
        await target.scrollIntoViewIfNeeded();
        await target.click({ timeout: 12000 });
        await page.waitForTimeout(420);
        entry.checks.correctHeading = await content.locator('h2')
          .filter({ hasText: menu.heading }).isVisible();
        entry.checks.activeMenu = await target.evaluate((el, mobile) =>
          mobile ? el.classList.contains('bg-blue-600') :
            el.classList.contains('border-l-2'), useMobileMenu);
        entry.checks.noViewportClipping = await mockup.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.left >= -1 && rect.right <= innerWidth + 1;
        });
        entry.checks.noPageHorizontalOverflow = await page.evaluate(() =>
          Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1);
        entry.status = Object.values(entry.checks).every(Boolean) ? 'PASS' : 'FAIL';
      } catch (error) {
        entry.errors.push(String(error));
        entry.status = 'FAIL';
      }
      result.menus.push(entry);
    }
    const original = dashboardQaMenus[0];
    const first = menuContainer.locator(useMobileMenu ? 'button' : 'div.cursor-pointer')
      .filter({ hasText: original.name }).first();
    try {
      await first.scrollIntoViewIfNeeded();
      await first.click({ timeout: 12000 });
      await page.waitForTimeout(420);
      result.checks.returnedToDashboard = await content.locator('h2')
        .filter({ hasText: original.heading }).isVisible();
    } catch (error) {
      result.errors.push('Return to dashboard: ' + String(error));
      result.checks.returnedToDashboard = false;
    }
    result.status = Object.values(result.checks).every(Boolean) &&
      result.menus.length === 6 && result.menus.every(menu => menu.status === 'PASS') &&
      result.errors.length === 0 ? 'PASS' : 'FAIL';
    await mockup.screenshot({
      path: path.join(outputDir, 'dashboard-' + profile.name + '-returned.png'),
      animations: 'disabled',
    });
  } catch (error) {
    result.errors.push(String(error));
    result.status = 'FAIL';
  } finally {
    dashboardQaResults[profile.name] = result;
    await context.close();
  }
}
summary.dashboardQa = dashboardQaResults;
await fs.writeFile(path.join(outputDir, 'dashboard-diagnostics.json'), JSON.stringify(dashboardQaResults, null, 2));


// STEP 5-2-C-2: Dashboard detail QA (demo interactions, isolated from prior QA).
const dashboardDetailProfiles = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-320', width: 320, height: 844 },
];
const dashboardDetailResults = {};
for (const profile of dashboardDetailProfiles) {
  const result = { viewport: profile.width, status: 'NOT TESTED', groups: {}, errors: [], nonFileDemoActions: [] };
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: 1, locale: 'ja-JP',
    isMobile: profile.width < 768, hasTouch: profile.width < 768,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  page.on('pageerror', error => result.errors.push(error.message));
  const mockup = page.locator('.mockup-window').first();
  const mainArea = mockup.locator('.mockup-main');
  const content = mainArea.locator('.tab-content-anim');
  const menu = mockup.locator(profile.width < 640 ? '.mobile-menu-scroll' : '.mockup-sidebar');
  const activate = async name => {
    const locator = menu.locator(profile.width < 640 ? 'button' : 'div.cursor-pointer').filter({ hasText: name }).first();
    await locator.scrollIntoViewIfNeeded();
    await locator.click({ timeout: 12000 });
    await page.waitForTimeout(350);
  };
  const executeGroup = async (key, fn) => {
    const group = { status: 'NOT TESTED', checks: {}, errors: [] };
    result.groups[key] = group;
    try {
      await fn(group.checks);
      group.status = Object.values(group.checks).every(Boolean) ? 'PASS' : 'FAIL';
    } catch (error) {
      group.errors.push(String(error));
      group.status = 'FAIL';
    }
  };
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await mockup.waitFor({ state: 'visible', timeout: 15000 });
    await executeGroup('industryReports', async checks => {
      await activate('業界レポート');
      const search = content.locator('input[placeholder="業界・キーワードでレポートを検索..."]');
      checks.searchExists = await search.isVisible();
      await search.fill('___qa_no_such_report___');
      checks.searchUpdates = await search.inputValue() === '___qa_no_such_report___';
      await search.fill('');
      const categoryButtons = content.locator('button').filter({ hasText: /^(すべて|全て|製造業|IT|不動産|小売|物流|金融|観光)$/ });
      checks.categoryAvailable = await categoryButtons.count() > 0;
      if (checks.categoryAvailable) {
        const button = categoryButtons.last();
        await button.click();
        checks.categorySelected = await button.evaluate(el => el.classList.contains('bg-blue-600'));
      } else checks.categorySelected = false;
      const pdf = content.locator('button.btn-pdf-download').first();
      checks.pdfButtonExists = await pdf.count() > 0;
      if (checks.pdfButtonExists) {
        await pdf.click();
        checks.pdfToast = await page.locator('.toast').isVisible();
      } else checks.pdfToast = false;
      result.nonFileDemoActions.push('Industry PDF button: Toast only; physical download NOT TESTED');
    });
    await executeGroup('researchPlans', async checks => {
      await activate('調査テーマ');
      const task = content.locator('div.cursor-pointer').filter({ hasText: 'マクロ経済指標の検証（GDP / 為替 / インフレ率）' }).first();
      checks.taskFound = await task.count() > 0;
      if (checks.taskFound) {
        const indicator = task.locator('div.rounded.border').first();
        const before = await indicator.getAttribute('class') || '';
        await task.click();
        const after = await indicator.getAttribute('class') || '';
        checks.taskToggles = before !== after;
        await task.click();
        checks.taskRestores = (await indicator.getAttribute('class')) === before;
      } else { checks.taskToggles = false; checks.taskRestores = false; }
    });
    await executeGroup('auditedData', async checks => {
      await activate('照合データ');
      const search = content.locator('input[placeholder="企業名・指標名・情報ソースで検索..."]');
      checks.searchFound = await search.isVisible();
      await search.fill('___qa_no_such_data___');
      checks.searchUpdates = await search.inputValue() === '___qa_no_such_data___';
      await search.fill('');
      const categories = content.locator('button').filter({ hasText: /^(すべて|全て|財務|市場|企業|競合|経済|マクロ)$/ });
      checks.categoryFound = await categories.count() > 0;
      if (checks.categoryFound) {
        const selected = categories.last();
        await selected.click();
        checks.categorySelect = await selected.evaluate(el => el.classList.contains('bg-blue-600'));
      } else checks.categorySelect = false;
      const csv = content.getByRole('button', { name: 'CSVエクスポート' });
      checks.csvPresent = await csv.count() > 0;
      if (checks.csvPresent) {
        await csv.click();
        checks.csvToast = await page.locator('.toast').isVisible();
      } else checks.csvToast = false;
      result.nonFileDemoActions.push('Audited CSV button: Toast only; physical download NOT TESTED');
    });
    await executeGroup('reportExport', async checks => {
      await activate('レポート出力');
      const period = content.getByRole('button', { name: '直近3ヶ月', exact: true });
      await period.click();
      checks.periodSelect = await period.evaluate(el => el.classList.contains('border-blue-500'));
      const format = content.getByRole('button', { name: 'CSV', exact: true });
      await format.click();
      checks.formatSelect = await format.evaluate(el => el.classList.contains('border-blue-500'));
      const boxes = content.locator('input[type="checkbox"]');
      checks.checkboxesPresent = await boxes.count() === 4;
      if (checks.checkboxesPresent) {
        const previous = await boxes.first().isChecked();
        await boxes.first().click();
        checks.checkboxToggles = await boxes.first().isChecked() !== previous;
      } else checks.checkboxToggles = false;
      const history = content.getByText(/出力履歴: \d+件/).first();
      const before = await history.innerText();
      await content.getByRole('button', { name: /レポートを生成・出力/ }).click();
      await page.waitForTimeout(1100);
      const after = await history.innerText();
      checks.historyIncreases = (Number(after.match(/\d+/)?.[0]) === Number(before.match(/\d+/)?.[0]) + 1);
      const redownload = content.getByRole('button', { name: '再ダウンロード' }).first();
      checks.redownloadExists = await redownload.count() > 0;
      if (checks.redownloadExists) {
        await redownload.click();
        checks.redownloadToast = await page.locator('.toast').isVisible();
      } else checks.redownloadToast = false;
      result.nonFileDemoActions.push('Generated report history and re-download Toast: actual file NOT TESTED');
    });
    await executeGroup('settings', async checks => {
      await activate('設定');
      const toggles = content.locator('button[style*="width: 36px"]');
      checks.threeToggles = await toggles.count() === 3;
      if (checks.threeToggles) {
        const before = await toggles.first().getAttribute('style');
        await toggles.first().click();
        checks.notificationChanges = before !== await toggles.first().getAttribute('style');
      } else checks.notificationChanges = false;
      const reveal = content.getByRole('button', { name: '表示', exact: true });
      checks.apiTogglePresent = await reveal.count() > 0;
      if (checks.apiTogglePresent) {
        await reveal.click();
        checks.apiCanHide = await content.getByRole('button', { name: '隠す', exact: true }).isVisible();
        await content.getByRole('button', { name: '隠す', exact: true }).click();
      } else checks.apiCanHide = false;
      const language = content.locator('select');
      await language.selectOption('en');
      checks.languageState = await language.inputValue() === 'en';
      await content.getByRole('button', { name: '設定を保存' }).click();
      checks.saveToast = await page.locator('.toast').isVisible();
      checks.copyButtonExists = await content.getByRole('button', { name: 'キーをコピー' }).count() > 0;
      checks.regenerateExists = await content.getByRole('button', { name: '再生成' }).count() > 0;
      result.nonFileDemoActions.push('Settings save persistence and API key regeneration: NOT TESTED');
    });
    result.status = Object.keys(result.groups).length === 5 &&
      Object.values(result.groups).every(group => group.status === 'PASS') &&
      result.errors.length === 0 ? 'PASS' : 'FAIL';
  } catch (error) {
    result.errors.push(String(error));
    result.status = 'FAIL';
  } finally {
    dashboardDetailResults[profile.name] = result;
    await context.close();
  }
}
summary.dashboardDetailQa = dashboardDetailResults;
await fs.writeFile(path.join(outputDir, 'dashboard-detail-diagnostics.json'), JSON.stringify(dashboardDetailResults, null, 2));


const aiChatQaProfiles = [
  { name: 'ai-chat-desktop-1440', width: 1440, height: 900, isMobile: false },
  { name: 'ai-chat-tablet-768', width: 768, height: 1024, isMobile: false },
  { name: 'ai-chat-mobile-390', width: 390, height: 844, isMobile: true },
  { name: 'ai-chat-mobile-320', width: 320, height: 844, isMobile: true },
];

const aiChatQaResults = {};

for (const profile of aiChatQaProfiles) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: 1,
    isMobile: profile.isMobile,
    hasTouch: profile.isMobile,
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

  const result = {
    viewport: { width: profile.width, height: profile.height },
    checks: {},
    errors: [],
    status: 'NOT TESTED',
  };

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
    await page.waitForTimeout(1200);

    const root = page.locator('.vn-ai-chat-root');
    const launcher = root.locator('.vn-ai-chat-launcher');
    const panel = root.locator('.vn-ai-chat-panel');
    const closeButton = root.locator('.vn-ai-chat-close');
    const input = root.locator('.vn-ai-chat-input');
    const form = root.locator('.vn-ai-chat-form');
    const suggestion = root.locator('.vn-ai-chat-suggestion').first();

    result.checks.rootExists = await root.count() === 1;
    result.checks.launcherVisible = await launcher.isVisible();
    result.checks.initiallyClosed =
      await launcher.getAttribute('aria-expanded') === 'false' &&
      await panel.getAttribute('aria-hidden') === 'true';

    const readPanelState = () => panel.evaluate((element) => {
      const style = getComputedStyle(element);
      const active = document.activeElement;
      const close = element.querySelector('.vn-ai-chat-close');
      return {
        openClass: element.classList.contains('vn-ai-chat-panel-open'),
        hidden: element.hidden,
        inert: element.inert,
        rootInert: element.closest('.vn-ai-chat-root')?.inert ?? null,
        visibility: style.visibility,
        opacity: style.opacity,
        display: style.display,
        transitionProperty: style.transitionProperty,
        transitionDuration: style.transitionDuration,
        activeTag: active?.tagName ?? null,
        activeClass: typeof active?.className === 'string' ? active.className : null,
        closeFocused: active === close,
      };
    });
    result.stateTimeline = { beforeOpen: await readPanelState() };
    await launcher.click();
    result.stateTimeline.afterClick = await readPanelState();
    await page.waitForTimeout(250);
    result.stateTimeline.after250ms = await readPanelState();
    result.openDetails = {
      launcherExpanded: await launcher.getAttribute('aria-expanded') === 'true',
      panelAriaVisible: await panel.getAttribute('aria-hidden') === 'false',
      panelVisible: await panel.isVisible(),
      panelHidden: await panel.evaluate((element) => element.hidden),
      panelInert: await panel.evaluate((element) => element.inert),
    };
    result.checks.openState =
      result.openDetails.launcherExpanded &&
      result.openDetails.panelAriaVisible &&
      result.openDetails.panelVisible;
    result.checks.closeButtonFocused = await closeButton.evaluate((element) => element === document.activeElement);
    result.focusDetails = await closeButton.evaluate((element) => {
      const active = document.activeElement;
      const chatPanel = element.closest('.vn-ai-chat-panel');
      const style = chatPanel ? getComputedStyle(chatPanel) : null;
      return {
        activeTag: active?.tagName ?? null,
        activeClass: active?.getAttribute('class') ?? null,
        closeButtonFocused: active === element,
        panelVisibility: style?.visibility ?? null,
        panelOpacity: style?.opacity ?? null,
      };
    });

    await closeButton.click();
    await page.waitForTimeout(250);
    result.checks.closeState =
      await launcher.getAttribute('aria-expanded') === 'false' &&
      await panel.getAttribute('aria-hidden') === 'true';
    result.checks.focusRestored = await launcher.evaluate((element) => element === document.activeElement);

    await launcher.click();
    await page.waitForTimeout(250);
    const messages = root.locator('.vn-ai-chat-message');
    const initialMessageCount = await messages.count();
    await suggestion.click();
    await page.waitForTimeout(1200);
    result.checks.suggestionAnswer =
      await messages.count() >= initialMessageCount + 2 &&
      await root.locator('.vn-ai-chat-message-assistant').count() >= 2;

    const beforeEmptySubmit = await messages.count();
    await form.evaluate((element) => element.requestSubmit());
    await page.waitForTimeout(100);
    result.checks.emptySubmitIgnored = await messages.count() === beforeEmptySubmit;

    await input.fill('QA自由入力テスト');
    await form.evaluate((element) => element.requestSubmit());
    result.checks.busyState =
      await input.getAttribute('disabled') !== null &&
      await root.locator('.vn-ai-chat-form').getAttribute('aria-busy') === 'true';
    await page.waitForTimeout(1200);
    result.checks.freeInputAnswer =
      await root.locator('.vn-ai-chat-message-user').filter({ hasText: 'QA自由入力テスト' }).count() === 1 &&
      await root.locator('.vn-ai-chat-message-assistant').count() >= 3;

    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    result.checks.escapeCloses = await panel.getAttribute('aria-hidden') === 'true';

    const overflow = await page.evaluate(() => ({
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
      viewportWidth: window.innerWidth,
    }));
    result.checks.noHorizontalOverflow = overflow.scrollWidth <= overflow.viewportWidth + 1;
    result.overflow = overflow;
    result.consoleErrors = consoleErrors;
    result.pageErrors = pageErrors;
    result.failedRequests = failedRequests;
    result.qaSummary = {
      interactionPass: Object.values(result.checks).every(Boolean),
      consoleErrorCount: consoleErrors.length,
      pageErrorCount: pageErrors.length,
    };
    result.status =
      Object.values(result.checks).every(Boolean) &&
      consoleErrors.length === 0 &&
      pageErrors.length === 0
        ? 'PASS'
        : 'FAIL';
  } catch (error) {
    result.errors.push(String(error));
    result.consoleErrors = consoleErrors;
    result.pageErrors = pageErrors;
    result.failedRequests = failedRequests;
    result.status = 'FAIL';
  } finally {
    aiChatQaResults[profile.name] = result;
    await context.close();
  }
}

summary.aiChatQa = aiChatQaResults;
await fs.writeFile(
  path.join(outputDir, 'ai-chat-diagnostics.json'),
  JSON.stringify(aiChatQaResults, null, 2)
);

// STEP 6: isolated, read-only KPI clipping and AI Chat obstruction diagnostics.
const step6KpiChatProfiles = [
  { name: 'mobile-320', width: 320, height: 844 },
  { name: 'mobile-390', width: 390, height: 844 },
];
const step6KpiChatResults = {};
for (const profile of step6KpiChatProfiles) {
  const result = { viewport: { width: profile.width, height: profile.height }, status: 'NOT TESTED', checks: {}, kpi: [], chat: {}, errors: [] };
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: 1, locale: 'ja-JP', isMobile: true, hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
    await page.waitForTimeout(1000);
    const mockup = page.locator('.mockup-main .tab-content-anim').first();
    await mockup.waitFor({ state: 'visible', timeout: 15000 });
    result.checks.viewportMatches = await page.evaluate(width => innerWidth === width, profile.width);
    const measured = await mockup.evaluate(el => {
      const names = ['GDP成長率', '総人口', '消費者物価指数', 'FDI認可額'];
      const grid = [...el.querySelectorAll('div.grid.grid-cols-4')]
        .find(node => node.children.length === 4 && names.every(name => node.textContent.includes(name)));
      if (!grid) return { found: false, items: [] };
      const items = [...grid.children].map((card, index) => {
        const label = card.querySelector('span');
        const row = card.querySelector('div.whitespace-nowrap.overflow-hidden');
        const parts = row ? [...row.querySelectorAll('span')] : [];
        const bounds = row?.getBoundingClientRect();
        const partRects = parts.map(part => part.getBoundingClientRect());
        const clippedPart = !!bounds && partRects.some(rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
        return {
          index, label: label?.textContent?.trim() || null,
          value: parts.map(part => part.textContent.trim()).join(' '),
          cardWidth: card.getBoundingClientRect().width,
          rowClientWidth: row?.clientWidth ?? null,
          rowScrollWidth: row?.scrollWidth ?? null,
          clippedValue: row ? row.scrollWidth > row.clientWidth + 1 || clippedPart : null,
          clippedLabel: label ? label.scrollWidth > label.clientWidth + 1 : null,
        };
      });
      return { found: true, items };
    });
    result.kpi = measured.items;
    result.checks.kpiFound = measured.found && measured.items.length === 4;
    result.checks.kpiNoClipping = result.checks.kpiFound &&
      measured.items.every(item => item.clippedValue === false && item.clippedLabel === false);

    // Inspect the launcher against visible interactive elements at several scroll positions.
    result.chat.samples = [];
    const heights = await page.evaluate(() => ({
      documentHeight: document.documentElement.scrollHeight, viewportHeight: innerHeight,
    }));
    const maxScroll = Math.max(0, heights.documentHeight - heights.viewportHeight);
    const positions = [0, Math.round(maxScroll / 2), maxScroll];
    for (const scrollY of [...new Set(positions)]) {
      await page.evaluate(y => scrollTo(0, y), scrollY);
      await page.waitForTimeout(180);
      const sample = await page.evaluate(() => {
        const launcher = document.querySelector('.vn-ai-chat-root .vn-ai-chat-launcher');
        if (!launcher) return { found: false, overlaps: [] };
        const lr = launcher.getBoundingClientRect();
        const active = getComputedStyle(launcher).pointerEvents !== 'none' && lr.width > 0 && lr.height > 0;
        const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const targets = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')]
          .filter(el => !el.closest('.vn-ai-chat-root') && el.getBoundingClientRect().width > 0 &&
            el.getBoundingClientRect().height > 0 && overlap(el.getBoundingClientRect(), lr));
        return {
          found: true, active, launcherRect: { x: lr.x, y: lr.y, width: lr.width, height: lr.height },
          overlaps: targets.map(el => {
            const r = el.getBoundingClientRect();
            const left = Math.max(r.left, lr.left), right = Math.min(r.right, lr.right);
            const top = Math.max(r.top, lr.top), bottom = Math.min(r.bottom, lr.bottom);
            const x = (left + right) / 2, y = (top + bottom) / 2;
            const hit = document.elementFromPoint(x, y);
            const centerHit = document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2)),
              Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2)));
            return {
              label: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 90),
              tag: el.tagName, overlapArea: Math.round((right - left) * (bottom - top)),
              launcherOnTopAtOverlap: !!hit?.closest?.('.vn-ai-chat-root'),
              centerTargetReachable: centerHit === el || el.contains(centerHit),
            };
          }),
        };
      });
      result.chat.samples.push({ scrollY, ...sample });
    }
    result.checks.chatLauncherFound = result.chat.samples.every(sample => sample.found);
    result.chat.potentialObstructions = result.chat.samples.flatMap(sample =>
      sample.overlaps.filter(o => o.launcherOnTopAtOverlap && !o.centerTargetReachable)
        .map(o => ({ scrollY: sample.scrollY, ...o })));
    // This is a geometric risk check, not a proof of successful/failed clicking.
    result.checks.noCenterPointObstruction = result.chat.potentialObstructions.length === 0;
    result.status = Object.values(result.checks).every(Boolean) ? 'PASS' : 'FAIL';
  } catch (error) {
    result.errors.push(String(error));
    result.status = 'NOT TESTED';
  } finally {
    step6KpiChatResults[profile.name] = result;
    await context.close();
  }
}
summary.step6KpiChatQa = step6KpiChatResults;
await fs.writeFile(
  path.join(outputDir, 'step6-kpi-chat-diagnostics.json'),
  JSON.stringify(step6KpiChatResults, null, 2)
);

// STEP 7-1: isolated JP / EN / ES critical-content and interaction QA.
const step71Profiles = [
  { name: 'desktop-1440', width: 1440, height: 900, isMobile: false },
  { name: 'mobile-390', width: 390, height: 844, isMobile: true },
];
const step71Languages = {
  ja: {
    label: 'JP',
    nav: '選ばれる理由',
    heroTagline: 'ベトナム市場特化型・次世代海外リサーチプラットフォーム',
    cta: 'サンプルレポートを見る',
    dashboard: 'ベトナム市場サマリー・ダッシュボード',
    modalTitle: '【デモ】ベトナム市場分析レポート サンプル',
    modalAction: 'サンプルデータを確認する',
    toast: 'サンプルデータを表示しました',
    footerDisclaimer: '架空サービスのデモページです。',
  },
  en: {
    label: 'EN',
    nav: 'Why us',
    heroTagline: 'Next-generation research platform built for the Vietnamese market',
    cta: 'View sample report',
    dashboard: 'Vietnam Market Summary Dashboard',
    modalTitle: '[Demo] Vietnam Market Analysis — Sample Report',
    modalAction: 'View all data with a free trial',
    toast: 'Opening free trial registration',
    footerDisclaimer: 'fictional service.',
  },
  es: {
    label: 'ES',
    nav: 'Por qué elegirnos',
    heroTagline: 'Plataforma de investigación de nueva generación especializada en Vietnam',
    cta: 'Ver informe de muestra',
    dashboard: 'Panel resumen del mercado vietnamita',
    modalTitle: '[Demo] Informe de muestra del mercado vietnamita',
    modalAction: 'Ver todos los datos con una prueba gratis',
    toast: 'Abriendo el registro de prueba gratuita',
    footerDisclaimer: 'servicio ficticio.',
  },
};
const step71Results = {};

for (const profile of step71Profiles) {
  for (const [language, expected] of Object.entries(step71Languages)) {
    const key = `${profile.name}-${language}`;
    const result = {
      profile: { width: profile.width, height: profile.height },
      language,
      status: 'NOT TESTED',
      checks: {},
      importantText: {},
      japaneseResiduals: [],
      clippedText: [],
      consoleErrors: [],
      pageErrors: [],
      failedRequests: [],
      errors: [],
    };
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      screen: { width: profile.width, height: profile.height },
      deviceScaleFactor: 1,
      locale: language === 'ja' ? 'ja-JP' : language === 'es' ? 'es-ES' : 'en-US',
      isMobile: profile.isMobile,
      hasTouch: profile.isMobile,
    });

    try {
      const page = await context.newPage();
      page.on('console', message => {
        if (message.type() === 'error') result.consoleErrors.push(message.text());
      });
      page.on('pageerror', error => result.pageErrors.push(error.message));
      page.on('requestfailed', request => result.failedRequests.push({
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText || 'unknown',
      }));

      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
      await page.waitForTimeout(1000);
      result.checks.viewportMatches = await page.evaluate(width => innerWidth === width, profile.width);

      if (profile.isMobile) {
        const hamburger = page.locator('header button[aria-label]:not(.vn-i18n-trigger)').first();
        if (await hamburger.isVisible().catch(() => false)) {
          await hamburger.click({ timeout: 5000 });
          await page.waitForTimeout(250);
        }
      }

      const switcher = page.locator('.vn-i18n-switcher:visible').first();
      const trigger = switcher.locator('.vn-i18n-trigger');
      result.checks.languageTriggerVisible = await trigger.isVisible().catch(() => false);
      if (result.checks.languageTriggerVisible) {
        await trigger.click({ timeout: 5000 });
        const option = switcher.locator(`[data-language="${language}"]`);
        await option.waitFor({ state: 'visible', timeout: 5000 });
        await option.click({ timeout: 5000 });
        await page.waitForTimeout(500);
      }

      result.checks.languageSelected = await page.locator('html').getAttribute('data-language') === language;
      result.checks.documentLanguageMatches = await page.locator('html').getAttribute('lang') === language;

      if (profile.isMobile) {
        const hamburger = page.locator('header button[aria-label]:not(.vn-i18n-trigger)').first();
        const mobileMenuOpen = await page.locator('header .vn-mobile-nav-list').first().evaluate(el =>
          getComputedStyle(el.parentElement.parentElement).pointerEvents !== 'none'
        ).catch(() => false);
        if (mobileMenuOpen) {
          await hamburger.click({ timeout: 5000 });
          await page.waitForTimeout(250);
        }
      }

      // Trigger reveal animations before measuring content throughout the page.
      await page.evaluate(async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const step = Math.max(Math.floor(innerHeight * 0.85), 500);
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
          scrollTo(0, y);
          await wait(70);
        }
        scrollTo(0, 0);
        await wait(250);
      });

      const bodyText = await page.locator('body').innerText();
      const navText = await page.locator('header.fixed.top-0').innerText();
      const heroText = await page.locator('.hero-fv-wrapper').innerText();
      const dashboardText = await page.locator('.mockup-main').first().innerText();
      const footerText = await page.locator('footer').innerText();
      result.importantText = { nav: navText, hero: heroText, dashboard: dashboardText, footer: footerText };
      result.checks.navTranslated = navText.includes(expected.nav);
      result.checks.heroTaglineTranslated = heroText.includes(expected.heroTagline);
      result.checks.ctaTranslated = bodyText.includes(expected.cta);
      result.checks.dashboardTranslated = dashboardText.includes(expected.dashboard);
      result.checks.footerDisclaimerTranslated = footerText.includes(expected.footerDisclaimer);

      const overflow = await page.evaluate(() => ({
        viewportWidth: innerWidth,
        documentScrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
      }));
      result.overflow = overflow;
      result.checks.noHorizontalOverflow = overflow.documentScrollWidth <= overflow.viewportWidth + 1;

      result.japaneseResiduals = await page.locator('header, .hero-fv-wrapper, .mockup-main, footer').evaluateAll((roots, selectedLanguage) => {
        if (selectedLanguage === 'ja') return [];
        const japanese = /[\u3040-\u30ff\u3400-\u9fff]/;
        const values = [];
        for (const root of roots) {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            const text = node.nodeValue?.trim().replace(/\s+/g, ' ');
            const parent = node.parentElement;
            if (!text || !parent || !japanese.test(text) || parent.getClientRects().length === 0) continue;
            const style = getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            values.push(text);
          }
        }
        return [...new Set(values)].slice(0, 100);
      }, language);
      result.checks.noJapaneseResidualsInCriticalAreas = language === 'ja' || result.japaneseResiduals.length === 0;

      result.clippedText = await page.locator('header, .hero-fv-wrapper, .mockup-main, footer').evaluateAll(roots => {
        const candidates = roots.flatMap(root => [...root.querySelectorAll('h1, h2, h3, p, span, a, button')]);
        return candidates.filter(element => {
          const text = element.textContent?.trim().replace(/\s+/g, ' ');
          if (!text || element.getClientRects().length === 0) return false;
          const style = getComputedStyle(element);
          const clipsX = ['hidden', 'clip'].includes(style.overflowX);
          const clipsY = ['hidden', 'clip'].includes(style.overflowY) || style.webkitLineClamp !== 'none';
          return (clipsX && element.scrollWidth > element.clientWidth + 1) ||
            (clipsY && element.scrollHeight > element.clientHeight + 1);
        }).map(element => ({
          text: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 160),
          tag: element.tagName,
          className: element.className,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        })).slice(0, 100);
      });
      result.checks.noClippedCriticalText = result.clippedText.length === 0;

      await page.screenshot({
        path: path.join(outputDir, `step7-1-${key}-page.png`),
        fullPage: true,
        animations: 'disabled',
      });

      const heroCta = page.locator('.hero-fv-wrapper button').filter({ hasText: expected.cta }).first();
      result.checks.heroCtaVisible = await heroCta.isVisible().catch(() => false);
      if (result.checks.heroCtaVisible) await heroCta.click({ timeout: 5000 });
      const dialog = page.locator('[role="dialog"][aria-modal="true"]');
      await dialog.waitFor({ state: 'visible', timeout: 5000 });
      const dialogText = await dialog.innerText();
      result.modalText = dialogText;
      result.checks.modalOpened = true;
      result.checks.modalTitleTranslated = dialogText.includes(expected.modalTitle);
      result.checks.modalActionTranslated = dialogText.includes(expected.modalAction);
      await page.screenshot({
        path: path.join(outputDir, `step7-1-${key}-modal.png`),
        fullPage: false,
        animations: 'disabled',
      });

      const modalAction = dialog.getByRole('button', { name: expected.modalAction, exact: false });
      await modalAction.click({ timeout: 5000 });
      const toast = page.locator('.toast');
      await toast.waitFor({ state: 'visible', timeout: 5000 });
      result.toastText = await toast.innerText();
      result.checks.toastTranslated = result.toastText.includes(expected.toast);
      await page.screenshot({
        path: path.join(outputDir, `step7-1-${key}-modal-toast.png`),
        fullPage: false,
        animations: 'disabled',
      });

      result.qaSummary = {
        checkCount: Object.keys(result.checks).length,
        passedCheckCount: Object.values(result.checks).filter(Boolean).length,
        consoleErrorCount: result.consoleErrors.length,
        pageErrorCount: result.pageErrors.length,
        failedRequestCount: result.failedRequests.length,
      };
      result.status = Object.values(result.checks).every(Boolean) && result.pageErrors.length === 0
        ? 'PASS'
        : 'FAIL';
    } catch (error) {
      result.errors.push(String(error));
      result.status = 'NOT TESTED';
    } finally {
      step71Results[key] = result;
      await context.close();
    }
  }
}

summary.step71I18nQa = step71Results;
await fs.writeFile(
  path.join(outputDir, 'step7-1-i18n-diagnostics.json'),
  JSON.stringify(step71Results, null, 2)
);

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
