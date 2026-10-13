// A-14 Playwright smoke QA; intentionally NOT connected to Actions.
// Execution requires separate approval. Browser/Actions are not run by this commit.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:3000/';
const commit = process.env.GITHUB_SHA || 'local';
const outputDir = path.resolve('visual-preview/a14-interaction');
const profiles = [
  { id: 'JP-1440', lang: 'ja', width: 1440, height: 900 },
  { id: 'JP-320', lang: 'ja', width: 320, height: 720 },
  { id: 'EN-1440', lang: 'en', width: 1440, height: 900 },
];
const areas = ['T01', 'T02', 'T03'];
const expected = {
  ja: {
    chat: 'ご質問ありがとうございます。このAIチャットはポートフォリオ用のデモです。実際のAIによる市場調査・回答生成には対応していません。画面操作と回答表示のサンプルをご確認いただけます。',
    history: '出力履歴（デモ）',
    historyNote: 'デモ用の出力履歴です。ファイル名・日時・容量・数値はサンプルであり、実際のレポート生成やファイル保存は行われません。',
    exportToast: 'PDFのサンプル出力履歴を追加しました。実ファイルは生成されません。',
    modalNote: '※本画面はポートフォリオ用のデモです。掲載内容・数値はサンプルであり、実際のレポート生成、データ取得、会員登録には対応していません。',
    pdfNote: 'デモ画面のため、PDFファイルの生成・ダウンロードは行われません。',
    exportMenu: 'レポート出力',
    exportAction: '「PDF」出力デモを実行',
    openModal: 'サンプルレポートを見る',
    modalPdf: 'PDF出力デモについて',
    closeModal: '閉じる',
    historyViewToast: /^(?<name>.+?) の履歴デモです。実ファイルはありません。$/u,
    historyCounter: /出力履歴:\s*(\d+)件/u,
  },
  en: {
    chat: 'Thank you for your question. This AI chat is a portfolio demo. It does not perform real AI market research or generate AI answers. You can explore sample interactions and responses.',
    history: 'Export history (demo)',
    historyNote: 'This is a demo export history. File names, dates, sizes, and figures are samples. No report is generated or file saved.',
    exportToast: 'Sample PDF export history added. No file was generated.',
    modalNote: 'This is a portfolio demo. All content and figures are samples. Real report generation, data retrieval, and account registration are not supported.',
    pdfNote: 'This is a demo. No PDF file is generated or downloaded.',
    exportMenu: 'Export reports',
    exportAction: 'Run PDF export demo',
    openModal: 'View sample report',
    modalPdf: 'About PDF export demo',
    closeModal: 'Close',
    historyViewToast: /^History demo for (?<name>.+?)\. No actual file exists\.$/u,
    historyCounter: /(?:Export history|History):\s*(\d+)/iu,
  },
};
const normalize = (value) => String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
const assertSame = (actual, wanted, label) => {
  if (normalize(actual) !== normalize(wanted)) {
    throw new Error(label + ': expected ' + JSON.stringify(wanted) + ', observed ' + JSON.stringify(actual));
  }
};
const results = [];
const caseIds = profiles.flatMap((p) => areas.map((area) => p.id + '-' + area));
let activeStep = 'initialization';

async function saveResults() {
  await fs.mkdir(outputDir, { recursive: true });
  const destination = path.join(outputDir, 'a14-smoke-diagnostics.json');
  const temp = destination + '.tmp';
  await fs.writeFile(temp, JSON.stringify({
    commit, baseUrl, generatedAt: new Date().toISOString(),
    plannedCases: caseIds.length, results,
    totals: Object.fromEntries(['PASS', 'FAIL', 'NOT TESTED'].map(
      (status) => [status, results.filter((r) => r.status === status).length])),
  }, null, 2));
  await fs.rename(temp, destination);
}
async function screenshot(page, caseId) {
  if (!page) return null;
  const relative = 'visual-preview/a14-interaction/' + caseId + '.png';
  try { await page.screenshot({ path: path.resolve(relative), timeout: 5000 }); return relative; }
  catch { return null; }
}
function visibleUnique(locator, label) {
  return locator.count().then((count) => {
    if (count !== 1) {
      const error = new Error(label + ': locator count=' + count);
      error.code = 'LOCATOR_UNCONFIRMED';
      throw error;
    }
    return locator;
  });
}
async function chooseLanguage(page, code) {
  if (await page.locator('html').getAttribute('lang') === code) return;
  const trigger = await visibleUnique(page.locator('.vn-i18n-trigger:visible'), 'language trigger');
  await trigger.click({ timeout: 8000 });
  const option = await visibleUnique(page.locator('[role="option"][data-language="' + code + '"]:visible'), 'language option');
  await option.click({ timeout: 8000 });
  await page.waitForFunction((wanted) => document.documentElement.lang === wanted, code, { timeout: 8000 });
}
async function toastMatches(page, wanted) {
  const toast = page.locator('.toast span');
  await toast.filter({ hasText: wanted }).first().waitFor({ state: 'visible', timeout: 8000 });
  assertSame(await toast.first().textContent(), wanted, 'Toast');
}
function classifyError(error) {
  if (error?.code === 'LOCATOR_UNCONFIRMED') return { status: 'NOT TESTED', category: 'TEST_SELECTOR' };
  if (error?.code === 'ENVIRONMENT_ERROR' || /browser has been closed|target page, context or browser has been closed|net::ERR_|Navigation failed/i.test(String(error?.message || ''))) return { status: 'NOT TESTED', category: 'ENVIRONMENT' };
  return { status: 'FAIL', category: 'APPLICATION_OR_ASSERTION' };
}
async function runCase(browser, profile, area) {
  const caseId = profile.id + '-' + area;
  const record = { caseId, commit, language: profile.lang, viewport: profile.width,
    area, status: 'NOT TESTED', steps: [], currentStep: null, reason: null,
    errorCode: null, errorCategory: null, consoleErrors: [], downloads: [], screenshot: null };
  let context, page;
  const steps = async (name, callback) => {
    activeStep = name;
    record.currentStep = name;
    try {
      await callback();
      record.steps.push({ name, status: 'PASS' });
    } catch (error) {
      record.steps.push({ name, status: classifyError(error).status, category: classifyError(error).category,
        reason: String(error?.message || error) });
      throw error;
    }
  };
  try {
    context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      screen: { width: profile.width, height: profile.height },
      isMobile: profile.width === 320, hasTouch: profile.width === 320,
      deviceScaleFactor: 1, acceptDownloads: true,
    });
    page = await context.newPage();
    page.on('console', (message) => { if (message.type() === 'error') record.consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => record.consoleErrors.push(error.message));
    page.on('download', (download) => record.downloads.push(download.suggestedFilename()));
    await steps('navigation', () => page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }));
    await steps('language', () => chooseLanguage(page, profile.lang));
    const e = expected[profile.lang];

    if (area === 'T01') {
      await steps('open-chat', async () => {
        await page.locator('.vn-ai-chat-launcher').click({ timeout: 8000 });
        await page.locator('#vn-ai-chat-panel').waitFor({ state: 'visible', timeout: 8000 });
      });
      await steps('send-new-message-and-reply', async () => {
        const panel = page.locator('#vn-ai-chat-panel');
        const users = panel.locator('.vn-ai-chat-message-user .vn-ai-chat-message-text');
        const answers = panel.locator('.vn-ai-chat-message-assistant:not(.vn-ai-chat-typing) .vn-ai-chat-message-text');
        const beforeUsers = await users.count();
        const beforeAnswers = await answers.count();
        const question = 'What can this demonstration do?';
        await page.locator('#vn-ai-chat-input').fill(question);
        await page.locator('.vn-ai-chat-send').click({ timeout: 8000 });
        await page.waitForFunction(({ u, a }) => {
          const root = document.querySelector('#vn-ai-chat-panel');
          return root?.querySelectorAll('.vn-ai-chat-message-user .vn-ai-chat-message-text').length === u + 1 &&
            root?.querySelectorAll('.vn-ai-chat-message-assistant:not(.vn-ai-chat-typing) .vn-ai-chat-message-text').length === a + 1;
        }, { u: beforeUsers, a: beforeAnswers }, { timeout: 8000 });
        assertSame(await users.last().textContent(), question, 'new question');
        assertSame(await answers.last().textContent(), e.chat, 'new reply');
        record.actualAnswer = await answers.last().textContent();
      });
      await steps('language-round-trip', async () => {
        const alternate = profile.lang === 'ja' ? 'en' : 'ja';
        await chooseLanguage(page, alternate);
        await chooseLanguage(page, profile.lang);
        assertSame(await page.locator('html').getAttribute('lang'), profile.lang, 'restored language');
        const messages = page.locator('#vn-ai-chat-panel .vn-ai-chat-message-assistant:not(.vn-ai-chat-typing) .vn-ai-chat-message-text');
        await messages.last().waitFor({ state: 'visible', timeout: 8000 });
        assertSame(await messages.last().textContent(), e.chat, 'reply after round trip');
      });
      await steps('close-chat', () => page.locator('.vn-ai-chat-close').click({ timeout: 8000 }));
    } else if (area === 'T02') {
      await steps('open-exports', async () => {
        // Dashboard button name is translated dynamically; check a single visible match.
        const menu = await visibleUnique(page.getByRole('button', { name: e.exportMenu, exact: true }).filter({ visible: true }), 'export menu');
        await menu.click({ timeout: 8000 });
        await page.getByText(e.history, { exact: true }).waitFor({ state: 'visible', timeout: 8000 });
        await page.getByText(e.historyNote, { exact: true }).waitFor({ state: 'visible', timeout: 8000 });
      });
      await steps('history-plus-one-and-toast', async () => {
        // Counter is in export header, separate from the history list card.
        const counters = page.locator('span').filter({ hasText: e.historyCounter }).filter({ visible: true });
        const readCount = async () => {
          const element = await visibleUnique(counters, 'export history counter');
          const match = (await element.innerText()).match(e.historyCounter);
          if (!match) { const error = new Error('history counter not found'); error.code = 'LOCATOR_UNCONFIRMED'; throw error; }
          return Number(match[1]);
        };
        const historyCard = page.getByText(e.history, { exact: true }).locator('xpath=..');
        const rows = historyCard.locator('div.flex.items-center.justify-between.p-1\\.5');
        const previous = await readCount();
        const rowCount = await rows.count();
        record.historyBefore = previous;
        record.historyRowsBefore = rowCount;
        if (rowCount !== previous) throw new Error('counter and rows differ before export');
        const action = await visibleUnique(page.getByRole('button', { name: e.exportAction, exact: true }).filter({ visible: true }), 'PDF export action');
        await action.click({ timeout: 8000 });
        await toastMatches(page, e.exportToast);
        await page.waitForFunction(({ target, english }) => {
          const pattern = english ? /(?:Export history|History):\\s*(\\d+)/i : /出力履歴:\\s*(\\d+)件/u;
          return [...document.querySelectorAll('span')].some(el => {
            const m = el.textContent?.trim().match(pattern);
            return m && Number(m[1]) === target;
          });
        }, { target: previous + 1, english: profile.lang === 'en' }, { timeout: 8000 });
        record.historyAfter = await readCount();
        record.historyRowsAfter = await rows.count();
        if (record.historyAfter !== previous + 1 || record.historyRowsAfter !== rowCount + 1) throw new Error('history row/counter increment mismatch');
      });
      await steps('history-view-no-file', async () => {
        const card = page.getByText(e.history, { exact: true }).locator('xpath=..');
        const newest = card.locator('div.flex.items-center.justify-between.p-1\\.5').first();
        const view = await visibleUnique(newest.getByRole('button'), 'new history row view button');
        const name = normalize(await newest.locator('div.flex.flex-col.min-w-0 > span').first().textContent());
        record.newestHistoryName = name;
        await view.click({ timeout: 8000 });
        const toast = page.locator('.toast span').first();
        await toast.waitFor({ state: 'visible', timeout: 8000 });
        const message = normalize(await toast.textContent());
        record.historyViewToast = message;
        const matched = message.match(e.historyViewToast);
        if (!matched || normalize(matched.groups?.name) !== name) throw new Error('new history row Toast mismatch: ' + message);
      });
    } else if (area === 'T03') {
      await steps('open-modal', async () => {
        const footer = page.locator('.vn-footer__sample-link:visible');
        if (await footer.count() === 1) await footer.click({ timeout: 8000 });
        else {
          const launch = await visibleUnique(page.getByRole('button', { name: e.openModal, exact: true }).filter({ visible: true }), 'modal launcher');
          await launch.click({ timeout: 8000 });
        }
        await page.locator('[role="dialog"][aria-modal="true"]').waitFor({ state: 'visible', timeout: 8000 });
      });
      await steps('modal-disclosures', async () => {
        const dialog = page.locator('[role="dialog"][aria-modal="true"]');
        await dialog.getByText(e.modalNote, { exact: true }).waitFor({ state: 'visible', timeout: 8000 });
        await dialog.getByText(e.pdfNote, { exact: true }).waitFor({ state: 'visible', timeout: 8000 });
      });
      await steps('pdf-toast-no-download', async () => {
        const pdf = await visibleUnique(page.locator('[role="dialog"][aria-modal="true"]')
          .getByRole('button', { name: e.modalPdf, exact: true }), 'modal PDF button');
        const before = record.downloads.length;
        // Observe the download channel before clicking and through the Toast display window.
        // Attach before click and keep listening until after Toast observation.
        const detected = [];
        const listener = (download) => detected.push(download.suggestedFilename());
        page.on('download', listener);
        try {
          await pdf.click({ timeout: 8000 });
          await toastMatches(page, e.pdfNote);
          await page.waitForTimeout(1500);
        } finally {
          page.off('download', listener);
        }
        if (detected.length || record.downloads.length > before) {
          throw new Error('Unexpected PDF download: ' + detected.concat(record.downloads.slice(before)).join(','));
        }
      });
      await steps('close-modal', async () => {
        const dialog = page.locator('[role="dialog"][aria-modal="true"]');
        await dialog.getByRole('button', { name: e.closeModal, exact: true }).click({ timeout: 8000 });
        await dialog.waitFor({ state: 'hidden', timeout: 8000 });
      });
    }
    if (record.downloads.length) throw new Error('Unexpected download: ' + record.downloads.join(','));
    record.status = 'PASS';
  } catch (error) {
    record.reason = String(error?.message || error);
    record.errorCode = error?.code || null;
    const classification = !page ? { status: 'NOT TESTED', category: 'ENVIRONMENT' } : classifyError(error);
    record.status = classification.status;
    record.errorCategory = classification.category;
    record.screenshot = await screenshot(page, caseId);
  } finally {
    if (page && !record.screenshot) record.screenshot = await screenshot(page, caseId);
    try { await context?.close(); } catch (error) { record.contextCloseError = String(error); }
    results.push(record);
    await saveResults();
  }
}

await saveResults(); // Create an inventory before browser startup, even if launch fails.
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const profile of profiles) {
    for (const area of areas) await runCase(browser, profile, area);
  }
} catch (error) {
  // Also cover browser startup failures: unstarted cases remain explicitly NOT TESTED.
  const completed = new Set(results.map((r) => r.caseId));
  for (const profile of profiles) for (const area of areas) {
    const caseId = profile.id + '-' + area;
    if (!completed.has(caseId)) {
      results.push({ caseId, commit, language: profile.lang, viewport: profile.width,
        area, status: 'NOT TESTED', reason: 'Execution could not start/continue: ' + String(error?.message || error),
        steps: [], screenshot: null });
    }
  }
  await saveResults();
} finally {
  try { await browser?.close(); } finally { await saveResults(); }
}
const totals = Object.fromEntries(['PASS', 'FAIL', 'NOT TESTED'].map(
  (status) => [status, results.filter((r) => r.status === status).length]));
console.log(JSON.stringify({ commit, total: results.length, totals, output: outputDir }));
if (totals.FAIL || totals['NOT TESTED']) process.exitCode = 1;
