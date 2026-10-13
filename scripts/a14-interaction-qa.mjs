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
async function runCase(browser, profile, area) {
  const caseId = profile.id + '-' + area;
  const record = { caseId, commit, language: profile.lang, viewport: profile.width,
    area, status: 'NOT TESTED', steps: [], currentStep: null, reason: null,
    errorCode: null, consoleErrors: [], downloads: [], screenshot: null };
  let context, page;
  const steps = async (name, callback) => {
    activeStep = name;
    record.currentStep = name;
    try {
      await callback();
      record.steps.push({ name, status: 'PASS' });
    } catch (error) {
      record.steps.push({ name, status: error?.code === 'LOCATOR_UNCONFIRMED' ? 'NOT TESTED' : 'FAIL',
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
        const before = await panel.getByText(e.chat, { exact: true }).count();
        const question = 'What can this demonstration do?';
        await page.locator('#vn-ai-chat-input').fill(question);
        await page.locator('.vn-ai-chat-send').click({ timeout: 8000 });
        await panel.getByText(question, { exact: true }).last().waitFor({ state: 'visible', timeout: 8000 });
        await page.waitForFunction(({ answer, previous }) => {
          const panel = document.querySelector('#vn-ai-chat-panel');
          const matches = [...(panel?.querySelectorAll('*') || [])].filter(
            (el) => el.textContent?.trim() === answer);
          return matches.length > previous;
        }, { answer: e.chat, previous: before }, { timeout: 8000 });
        const answer = panel.getByText(e.chat, { exact: true }).last();
        assertSame(await answer.textContent(), e.chat, 'new chat reply');
        record.actualAnswer = await answer.textContent();
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
        // Count only within the export-history heading's container, not the entire page.
        const title = page.getByText(e.history, { exact: true });
        const section = title.locator('xpath=..');
        const readCount = async () => {
          const text = await section.innerText();
          const match = text.match(e.historyCounter);
          if (!match) { const error = new Error('history count not identified'); error.code = 'LOCATOR_UNCONFIRMED'; throw error; }
          return Number(match[1]);
        };
        const previous = await readCount();
        record.historyBefore = previous;
        const action = await visibleUnique(page.getByRole('button', { name: e.exportAction, exact: true }).filter({ visible: true }), 'PDF export action');
        await action.click({ timeout: 8000 });
        await toastMatches(page, e.exportToast);
        await page.waitForFunction(({ label, target, isEnglish }) => {
          const title = [...document.querySelectorAll('*')].find((x) => x.textContent?.trim() === label);
          const parentText = title?.parentElement?.innerText || '';
          const match = parentText.match(isEnglish ? /(?:Export history|History):\s*(\d+)/i : /出力履歴:\s*(\d+)件/u);
          return Boolean(match && Number(match[1]) === target);
        }, { label: e.history, target: previous + 1, isEnglish: profile.lang === 'en' }, { timeout: 8000 });
        record.historyAfter = await readCount();
        if (record.historyAfter !== previous + 1) throw new Error('history count did not increase by one');
      });
      await steps('history-view-no-file', async () => {
        // The view-button name is not yet verified across languages/DOM.
        const view = page.getByRole('button', { name: /履歴デモを見る|View history demo/i }).filter({ visible: true });
        const matches = await view.count();
        if (matches < 1) { const error = new Error('history view locator not confirmed'); error.code = 'LOCATOR_UNCONFIRMED'; throw error; }
        await view.first().click({ timeout: 8000 });
        const toast = page.locator('.toast span');
        await toast.waitFor({ state: 'visible', timeout: 8000 });
        const message = await toast.first().textContent();
        record.historyViewToast = message;
        if (!/(?:ファイル|file)/i.test(message || '') || !/(?:ありません|ない|no|not)/i.test(message || '')) {
          throw new Error('history view Toast did not indicate absence of real file: ' + message);
        }
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
        const unexpectedDownload = page.waitForEvent('download', { timeout: 1500 }).then(
          (d) => d.suggestedFilename(), () => null);
        await pdf.click({ timeout: 8000 });
        await toastMatches(page, e.pdfNote);
        const observedDownload = await unexpectedDownload;
        if (observedDownload || record.downloads.length > before) {
          throw new Error('Unexpected PDF download: ' + (observedDownload || record.downloads.join(',')));
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
    record.status = error?.code === 'LOCATOR_UNCONFIRMED' || !page ? 'NOT TESTED' : 'FAIL';
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
