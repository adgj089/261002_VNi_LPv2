// A-14 read-only browser smoke checks. Not wired into any workflow.
// Run only after explicit approval: node scripts/a14-interaction-qa.mjs
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:3000/';
const commit = process.env.GITHUB_SHA || 'local';
const out = path.resolve('visual-preview/a14-interaction');
const profiles = [
  { id: 'JP-1440', lang: 'ja', width: 1440, height: 900 },
  { id: 'JP-320', lang: 'ja', width: 320, height: 720 },
  { id: 'EN-1440', lang: 'en', width: 1440, height: 900 },
];
const expected = {
  ja: {
    chat: 'ご質問ありがとうございます。このAIチャットはポートフォリオ用のデモです。実際のAIによる市場調査・回答生成には対応していません。画面操作と回答表示のサンプルをご確認いただけます。',
    history: '出力履歴（デモ）',
    historyNote: 'デモ用の出力履歴です。ファイル名・日時・容量・数値はサンプルであり、実際のレポート生成やファイル保存は行われません。',
    exportToast: 'PDFのサンプル出力履歴を追加しました。実ファイルは生成されません。',
    modalNote: '※本画面はポートフォリオ用のデモです。掲載内容・数値はサンプルであり、実際のレポート生成、データ取得、会員登録には対応していません。',
    pdfNote: 'デモ画面のため、PDFファイルの生成・ダウンロードは行われません。',
    exportMenu: 'レポート出力',
    openModal: 'サンプルレポートを見る',
    modalPdf: 'PDF出力デモについて',
    closeModal: '閉じる',
  },
  en: {
    chat: 'Thank you for your question. This AI chat is a portfolio demo. It does not perform real AI market research or generate AI answers. You can explore sample interactions and responses.',
    history: 'Export history (demo)',
    historyNote: 'This is a demo export history. File names, dates, sizes, and figures are samples. No report is generated or file saved.',
    exportToast: 'Sample PDF export history added. No file was generated.',
    modalNote: 'This is a portfolio demo. All content and figures are samples. Real report generation, data retrieval, and account registration are not supported.',
    pdfNote: 'This is a demo. No PDF file is generated or downloaded.',
    exportMenu: 'Export reports',
    openModal: 'View sample report',
    modalPdf: 'About PDF export demo',
    closeModal: 'Close',
  },
};
const normalized = (s) => (s || '').normalize('NFC').replace(/\s+/gu, ' ').trim();
const results = [];
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function snapshot(page, caseId) {
  const file = path.join(out, caseId + '.png');
  try { await page.screenshot({ path: file, fullPage: false, timeout: 5000 }); return file; }
  catch { return null; }
}
function check(actual, wanted, label) {
  if (normalized(actual) !== normalized(wanted)) {
    throw new Error(label + ' mismatch: expected=' + JSON.stringify(wanted) + ', actual=' + JSON.stringify(actual));
  }
}
async function stableText(locator, wanted, timeout = 8000) {
  await locator.filter({ hasText: wanted }).first().waitFor({ state: 'visible', timeout });
  return locator.filter({ hasText: wanted }).first().textContent();
}
async function chooseLanguage(page, lang) {
  const code = lang === 'zh' ? 'zh' : lang;
  if (await page.locator('html').getAttribute('lang') === code) return;
  const trigger = page.locator('.vn-i18n-trigger:visible').first();
  if (await trigger.count() !== 1) throw new Error('Language trigger not unique');
  await trigger.click();
  const option = page.locator('[role="option"][data-language="' + code + '"]:visible').first();
  await option.click();
  await page.waitForFunction((wanted) => document.documentElement.lang === wanted, code, { timeout: 8000 });
}
async function runCase(profile, area) {
  const caseId = profile.id + '-' + area;
  const errors = [];
  const downloads = [];
  const record = { caseId, commit, language: profile.lang, viewport: profile.width, area,
    status: 'NOT TESTED', steps: [], errors, downloads, artifactPath: null, reason: null };
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    isMobile: profile.width === 320, hasTouch: profile.width === 320, deviceScaleFactor: 1,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => { if (e.type() === 'error') errors.push(e.text()); });
  page.on('download', (d) => downloads.push(d.suggestedFilename()));
  const e = expected[profile.lang];
  const step = async (name, fn) => {
    await fn();
    record.steps.push({ name, status: 'PASS' });
  };
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await step('language', () => chooseLanguage(page, profile.lang));
    if (area === 'T01') {
      await step('open-chat', async () => {
        await page.locator('.vn-ai-chat-launcher').click({ timeout: 8000 });
        await page.locator('#vn-ai-chat-panel').waitFor({ state: 'visible', timeout: 8000 });
      });
      await step('send-free-input-and-check-reply', async () => {
        const panel = page.locator('#vn-ai-chat-panel');
        const answerBefore = await panel.locator('*').filter({ hasText: e.chat }).count();
        await page.locator('#vn-ai-chat-input').fill('Please explain this demo in one sentence.');
        await page.locator('.vn-ai-chat-send').click({ timeout: 8000 });
        const answer = panel.getByText(e.chat, { exact: true }).last();
        await answer.waitFor({ state: 'visible', timeout: 8000 });
        check(await answer.textContent(), e.chat, 'free input reply');
        record.answerBefore = answerBefore;
        record.actualAnswer = await answer.textContent();
      });
      await step('close-chat', async () => {
        await page.locator('.vn-ai-chat-close').click({ timeout: 8000 });
      });
    } else if (area === 'T02') {
      await step('open-export-section', async () => {
        const visibleMenu = page.getByRole('button', { name: e.exportMenu, exact: true }).filter({ visible: true });
        if (await visibleMenu.count() !== 1) throw new Error('Export menu locator not unique/visible: ' + await visibleMenu.count());
        await visibleMenu.click({ timeout: 8000 });
        await page.getByText(e.history, { exact: true }).waitFor({ state: 'visible', timeout: 8000 });
        const note = page.getByText(e.historyNote, { exact: true });
        await note.waitFor({ state: 'visible', timeout: 8000 });
      });
      await step('export-demo-history', async () => {
        const beforeText = await page.locator('body').innerText();
        const countMatch = beforeText.match(/出力履歴[:：]\s*(\d+)\s*件|Export history[:：]\s*(\d+)/i);
        record.historyBefore = countMatch ? Number(countMatch[1] || countMatch[2]) : null;
        if (record.historyBefore === null) throw new Error('History counter not identified; do not infer PASS');
        const button = page.getByRole('button', { name: /PDF.*(?:出力|export).*demo|PDF.*(?:デモ|demo)/i }).filter({ visible: true });
        if (await button.count() !== 1) throw new Error('PDF export demo button not uniquely identified');
        await button.click({ timeout: 8000 });
        const toast = page.locator('.toast span');
        await toast.filter({ hasText: e.exportToast }).first().waitFor({ state: 'visible', timeout: 8000 });
        check(await toast.first().textContent(), e.exportToast, 'export toast');
        await page.waitForFunction((n) => {
          const body = document.body.innerText;
          const match = body.match(/出力履歴[:：]\s*(\d+)\s*件|Export history[:：]\s*(\d+)/i);
          return match && Number(match[1] || match[2]) === n + 1;
        }, record.historyBefore, { timeout: 8000 });
      });
    } else if (area === 'T03') {
      await step('open-modal', async () => {
        const launch = page.locator('.vn-footer__sample-link:visible');
        const candidates = await launch.count();
        if (candidates === 1) await launch.click({ timeout: 8000 });
        else {
          const buttons = page.getByRole('button', { name: e.openModal, exact: true }).filter({ visible: true });
          if (await buttons.count() !== 1) throw new Error('Modal launcher not uniquely identified');
          await buttons.click({ timeout: 8000 });
        }
        await page.locator('[role="dialog"][aria-modal="true"]').waitFor({ state: 'visible', timeout: 8000 });
      });
      await step('modal-demo-disclosures', async () => {
        const dialog = page.locator('[role="dialog"][aria-modal="true"]');
        await dialog.getByText(e.modalNote, { exact: true }).waitFor({ state: 'visible', timeout: 8000 });
        await dialog.getByText(e.pdfNote, { exact: true }).waitFor({ state: 'visible', timeout: 8000 });
      });
      await step('pdf-toast-no-file', async () => {
        const dialog = page.locator('[role="dialog"][aria-modal="true"]');
        const pdf = dialog.getByRole('button', { name: e.modalPdf, exact: true });
        if (await pdf.count() !== 1) throw new Error('Modal PDF button accessible name not confirmed');
        await pdf.click({ timeout: 8000 });
        const toast = page.locator('.toast span');
        await toast.filter({ hasText: e.pdfNote }).first().waitFor({ state: 'visible', timeout: 8000 });
        check(await toast.first().textContent(), e.pdfNote, 'modal PDF toast');
        if (downloads.length) throw new Error('Unexpected real download: ' + downloads.join(','));
      });
      await step('close-modal', async () => {
        const dialog = page.locator('[role="dialog"][aria-modal="true"]');
        await dialog.getByRole('button', { name: e.closeModal, exact: true }).click({ timeout: 8000 });
        await dialog.waitFor({ state: 'hidden', timeout: 8000 });
      });
    }
    if (downloads.length) throw new Error('Unexpected download: ' + downloads.join(','));
    record.status = 'PASS';
  } catch (err) {
    record.reason = String(err?.message || err);
    record.failedStep = record.steps.length;
    // Missing/ambiguous locators cannot establish an application regression before actual DOM validation.
    record.status = /not uniquely identified|not unique|not identified|not confirmed|locator not unique/i.test(record.reason)
      ? 'NOT TESTED' : 'FAIL';
    record.artifactPath = await snapshot(page, caseId);
  } finally {
    record.consoleErrors = errors;
    record.downloads = downloads;
    await context.close();
    results.push(record);
    await fs.writeFile(path.join(out, 'a14-smoke-diagnostics.json'),
      JSON.stringify({ commit, baseUrl, generatedAt: new Date().toISOString(), results }, null, 2));
  }
}
try {
  for (const profile of profiles) {
    for (const area of ['T01', 'T02', 'T03']) {
      await runCase(profile, area);
    }
  }
} finally {
  await browser.close();
}
const totals = Object.fromEntries(['PASS', 'FAIL', 'NOT TESTED'].map((v) =>
  [v, results.filter((r) => r.status === v).length]));
console.log(JSON.stringify({ commit, total: results.length, totals, output: out }));
if (totals.FAIL > 0 || totals['NOT TESTED'] > 0) process.exitCode = 1;
