/*
 * فحصُ الشاشات — يفتح كلَّ شاشةٍ ويتنقّل فيها، ويرصد أيَّ خطأٍ في المتصفّح.
 *
 * كان في مجلّدٍ مؤقّتٍ فضاع بين الجلسات، فصار في المستودع: الفحصُ الذي لا
 * يُعثَر عليه لا يُشغَّل، والفحصُ الذي لا يُشغَّل لا يمنع خطأً.
 *
 *     node tools/serve.js &        # ثمّ
 *     node tools/فحص_الشاشات.mjs
 */

import { execSync } from 'node:child_process';

/**
 * Playwright قد يكون مُنصَّباً عالمياً لا في المشروع (فالمشروع بلا اعتماديات
 * أصلاً)، فيُبحَث عنه في الموضعين — وإلا لم يعمل الفحص إلا على جهازٍ واحد.
 */
async function loadChromium() {
  for (const spec of ['playwright', null]) {
    try {
      const mod = await import(spec || `${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.js`);
      const c = mod.chromium || mod.default?.chromium;
      if (c) return c;
    } catch { /* جرّب الموضع التالي */ }
  }
  throw new Error('لم يُعثَر على playwright — نصِّبه: npm i -g playwright');
}

const chromium = await loadChromium();

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.BASE || 'http://localhost:3000';

const errors = [];
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => errors.push(`js: ${String(e).slice(0, 160)}`));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  // خطوطُ جوجل محجوبةٌ في بيئة الفحص وحدَها، فلا تُحسَب خطأً في التطبيق.
  if (/fonts\.(googleapis|gstatic)/.test(t)) return;
  errors.push(`console: ${t.slice(0, 160)}`);
});

const seed = (track = 'imam') => page.evaluate((t) => {
  localStorage.setItem('awqaf-prep/v1', JSON.stringify({
    track: t, answers: {}, resume: null, memorized: {}, exams: [], reviews: {}, dailyGoal: 20,
  }));
}, track);

const go = async (name, params = 'undefined') => {
  await page.evaluate(async ([n, p]) => {
    const ui = await import('/assets/js/ui.js');
    ui.go(n, p === 'undefined' ? {} : JSON.parse(p));
  }, [name, params]);
  await page.waitForTimeout(450);
};

const has = async (text) => (await page.locator('body').innerText()).includes(text);

await page.goto(`${BASE}/?dev=1`, { waitUntil: 'networkidle' });
await seed();
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1400);

/* ── كلُّ شاشةٍ تُفتَح وتُرسَم ────────────────────────────────────────── */

const SCREENS = ['track', 'home', 'books', 'account', 'recite', 'flashcards',
  'custom', 'search', 'tajweed', 'library', 'mastered', 'admin', 'review'];

for (const s of SCREENS) {
  await go(s);
  const n = await page.locator('.screen > *').count();
  if (!n) errors.push(`${s}: الشاشة فارغة`);
  if (!(await page.locator('.credit').count())) errors.push(`${s}: سطر الاعتماد مفقود`);
  process.stdout.write(`${s} `);
}
console.log();

/* ── تدفُّقٌ حقيقيٌّ: كتاب ← جلسة ← تصحيح ← نتيجة ──────────────────── */

await go('home');
await page.locator('#tabbar button', { hasText: 'الكتب' }).click();
await page.waitForTimeout(500);
await page.locator('.card').filter({ hasText: 'الفقه' }).first().click();
await page.waitForTimeout(600);
if (!(await has('ابدأ الدراسة'))) errors.push('كتاب: لا زرَّ للدراسة');
await page.getByRole('button', { name: 'ابدأ الدراسة' }).click();
await page.waitForTimeout(600);
if (!(await page.locator('.bar').count())) errors.push('جلسة: لا شريطَ تقدّم');

const reveal = page.locator('.btn').filter({ hasText: 'أظهر الإجابة' }).first();
if (await reveal.count()) {
  await reveal.click();
  await page.waitForTimeout(300);
  for (const label of ['أصبتُ الكلَّ', 'لم أُجِبْ بشيء']) {
    if (!(await page.locator('.chip').filter({ hasText: label }).count())) {
      errors.push(`تصحيح: زرُّ «${label}» مفقود`);
    }
  }
  await page.locator('.chip').filter({ hasText: 'أصبتُ الكلَّ' }).click();
  await page.waitForTimeout(250);
  if (!(await has('١٠٠٪'))) errors.push('تصحيح: «أصبتُ الكلَّ» لم يُبلِغ مئةً في المائة');
}

/* ── الاختبارُ بمُهلة ───────────────────────────────────────────────── */

await go('home');
await page.locator('.tile', { hasText: 'اختبار شامل' }).click();
await page.waitForTimeout(450);
if (!(await has('المقترَح'))) errors.push('اختبار: لم تظهر ورقةُ اختيار المُهلة');
else {
  await page.locator('.btn', { hasText: 'المقترَح' }).click();
  await page.waitForTimeout(700);
  const t1 = await page.locator('.num').first().innerText();
  await page.waitForTimeout(2200);
  const t2 = await page.locator('.num').first().innerText();
  if (t1 === t2) errors.push(`اختبار: العدّاد واقفٌ عند ${t1}`);
  if (!/^[٠-٩]+:[٠-٩]{2}$/.test(t1.trim())) errors.push(`اختبار: صيغةُ العدّاد «${t1}»`);
}

/* ── شريطُ الأسبوع يبدأ باليوم في اليمين ───────────────────────────── */

await go('home');
const week = await page.$$eval('.week-day', (ns) => ns.map((n) => ({
  x: Math.round(n.getBoundingClientRect().x),
  letter: n.querySelector('em').textContent,
})));
if (week.length !== 7) errors.push(`الوِرد: أيامُ الأسبوع ${week.length} لا سبعة`);
else {
  const rightmost = [...week].sort((a, b) => b.x - a.x)[0];
  const DAYS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
  if (rightmost.letter !== DAYS[new Date().getDay()]) {
    errors.push(`الوِرد: أوّلُ الشريط في اليمين «${rightmost.letter}» واليومُ «${DAYS[new Date().getDay()]}»`);
  }
}

/* ── بطاقةُ النتيجة صورةً ───────────────────────────────────────────── */

const card = await page.evaluate(async () => {
  try {
    const m = await import('/assets/js/share.js');
    await document.fonts.ready;
    const b = await m.resultCard({ title: 'فحص', score: 0.8, right: 8, total: 10, seconds: 120, rank: 'مُتعلِّم' });
    return b ? b.size : 0;
  } catch (e) { return `خطأ: ${e.message}`; }
});
if (typeof card !== 'number' || card < 5000) errors.push(`بطاقة النتيجة: ${card}`);

/* ── المسارات الثلاثة تُحمَّل كلُّها ───────────────────────────────── */

for (const t of ['muezzin', 'muezzin_retired']) {
  await seed(t);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (!(await has('أهلاً بك'))) errors.push(`مسار ${t}: الرئيسية لم تُفتَح`);
}

console.log(`\n=== أخطاء (${errors.length}) ===`);
for (const e of errors) console.log(' !', e);
await browser.close();
process.exit(errors.length ? 1 : 0);
