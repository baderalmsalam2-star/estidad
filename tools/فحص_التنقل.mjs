/*
 * فحصُ التنقّل — أيَجِدُ الطالبُ طريقَه؟ وأيَدخُل المشرفُ لوحتَه؟
 *
 * `فحص_الشاشات.mjs` يسأل: أتُرسَم الشاشةُ بلا خطأ؟ وهذا يسأل ما بعده: أمن كلِّ
 * شاشةٍ مَخرَج، وأيرجع زرُّ الرجوعِ في الجهاز إلى ما قبلها لا إلى خارج التطبيق،
 * وأيحجب شريطُ التنقّلِ زرّاً تحته؟ وهذه أخطاءٌ لا تُرى في السجلّ ولا تُوقِف
 * شيئاً — يقع فيها الطالبُ وحدَه فلا يُخبِر أحداً.
 *
 *     node tools/serve.js &        # ثمّ
 *     node tools/فحص_التنقل.mjs
 */

import { execSync } from 'node:child_process';

const URL = 'http://localhost:3000/';
const TEMP_PASS = 'estidad-admin';   // الكلمةُ المؤقّتةُ في tools/مفتاح_المشرف.py

const fails = [];
const ok = (cond, msg) => {
  if (!cond) fails.push(msg);
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
};

const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
const pw = await import(`${root}/playwright/index.js`);
const chromium = pw.chromium || pw.default.chromium;
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({
  viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});

const crashes = [];
page.on('pageerror', (e) => crashes.push(e.message));

/** عنوانُ الشاشةِ نفسِها، لا عنوانَ الشريطِ العلويِّ الذي يسمّي ما قبلها. */
const title = () => page.evaluate(() =>
  (document.querySelector('.pane .title, .pane .head')?.textContent
    || document.querySelector('.topbar-title')?.textContent || '').trim());

const tabs = () => page.evaluate(() => ({
  vis: !document.getElementById('tabbar').hidden,
  on: document.querySelector('#tabbar [aria-current]')?.textContent || '—',
}));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.locator('text=متابعة').first().click();
await page.waitForTimeout(500);

/* ── محرّكُ التجويد: ثلاثُ مراتبَ لكلٍّ مَخرَج ───────────────────────── */

await page.locator('text=محرّك التجويد').first().click();
await page.waitForTimeout(1800);
ok(await title() === 'جزء عمّ', `الدخولُ يقع على فهرس السور (${await title()})`);

await page.locator('.list-item').first().click();
await page.waitForTimeout(700);
const ayah = await title();
ok(/سورة .* — آية/.test(ayah), `شاشةُ الآية (${ayah})`);
ok(await page.locator('.ayahnav button').count() === 2, 'زرّا السابقة والتالية تحت الآية');

await page.locator('.ayahnav button').last().click();
await page.waitForTimeout(400);
ok(await title() !== ayah, 'زرُّ «التالية» ينقل فعلاً');

await page.locator('.topbar .iconbtn').first().click();
await page.waitForTimeout(500);
ok(await title() === 'جزء عمّ', 'الخروجُ من الآية يرجع إلى الفهرس');
await page.locator('.topbar .iconbtn').first().click();
await page.waitForTimeout(500);
ok(!(await title()).includes('جزء'), `الخروجُ من الفهرس يرجع إلى الرئيسية (${await title()})`);

/* ── زرُّ الرجوع في الجهاز ────────────────────────────────────────────── */

await page.locator('text=محرّك التجويد').first().click();
await page.waitForTimeout(700);
await page.locator('.list-item').first().click();
await page.waitForTimeout(700);
await page.goBack();
await page.waitForTimeout(500);
ok(await title() === 'جزء عمّ', 'زرُّ الرجوع ← الفهرس');
await page.goBack();
await page.waitForTimeout(500);
ok(!(await title()).includes('جزء'), 'زرُّ الرجوع ← الرئيسية');

/* ── شريطُ التنقّل: ظاهرٌ ولا يحجب ───────────────────────────────────── */

await page.locator('.tabbar >> text=الكتب').click();
await page.waitForTimeout(600);
await page.locator('.card >> text=غاية المريد').first().click();
await page.waitForTimeout(700);
let t = await tabs();
ok(t.vis && t.on === 'الكتب', `شاشةُ الكتاب: الشريطُ ظاهرٌ على «${t.on}»`);

const btn = await page.locator('text=ابدأ الدراسة').first().boundingBox();
const bar = await page.locator('#tabbar').boundingBox();
ok(btn && bar && btn.y + btn.height <= bar.y + 1, 'زرُّ «ابدأ الدراسة» فوق الشريط لا تحته');

await page.goBack();
await page.waitForTimeout(500);
ok(await page.locator('text=ابحث في').count() > 0, 'الرجوعُ من الكتاب ← قائمةُ الكتب');

await page.locator('.card >> text=دليل الطالب').first().click();
await page.waitForTimeout(700);
await page.locator('text=ابدأ الدراسة').first().click();
await page.waitForTimeout(900);
ok(!(await tabs()).vis, 'جلسةُ الأسئلة: الشريطُ مخفيٌّ — مهمّةٌ مركَّزةٌ لها بابُها');

/* ── طبقةُ صفحةِ الكتاب تُغلَق بالرجوعِ وحدَها ──────────────────────── */

for (const label of ['أظهر الإجابة', 'اعرض الإجابة', 'الإجابة']) {
  const l = page.locator(`text=${label}`);
  if (await l.count()) { await l.first().click(); await page.waitForTimeout(500); break; }
}
const cite = page.locator('button.pagecite, button.hintcite');
if (await cite.count()) {
  await cite.first().click();
  await page.waitForTimeout(1200);
  ok(await page.locator('.pagelayer').count() > 0, 'طبقةُ صفحةِ الكتاب انفتحت');
  await page.goBack();
  await page.waitForTimeout(600);
  ok(await page.locator('.pagelayer').count() === 0, 'الرجوعُ أغلق الطبقة');
  ok(await cite.count() > 0, 'وبقي الطالبُ في سؤاله لا قُذِف منه');
} else {
  ok(false, 'لم يُعثَر على زرِّ استشهادٍ بصفحةٍ مصوَّرةٍ لفحص الطبقة');
}

/* ── لوحةُ الإدارة ───────────────────────────────────────────────────── */

// الخروجُ من الجلسةِ بإعادةِ التحميل: شريطُ التنقّل مخفيٌّ فيها عن قصد.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.locator('.tabbar >> text=حسابي').click();
await page.waitForTimeout(600);
ok(await page.locator('text=لوحة الإدارة').count() === 0, 'الطالبُ لا يرى مدخلَ اللوحة');

for (let i = 0; i < 7; i += 1) { await page.locator('h1.title').click(); await page.waitForTimeout(90); }
await page.waitForTimeout(500);
ok((await title()).includes('دخول المشرف'), 'سبعُ نقراتٍ تكشف بابَ الدخول');

await page.locator('input[type=password]').fill('لا-شيء');
await page.locator('text=ادخل').click();
await page.waitForTimeout(600);
ok(await page.locator('text=كلمةٌ غير صحيحة').count() > 0, 'الكلمةُ الخاطئةُ تُردّ ولا يُفتَح شيء');

await page.locator('input[type=password]').fill(TEMP_PASS);
await page.locator('text=ادخل').click();
await page.waitForTimeout(900);
ok((await title()).includes('لوحة الإدارة'), 'الكلمةُ الصحيحةُ تفتح اللوحة');
ok(await page.locator('.grid-cards button').count() === 8, 'أبوابُ اللوحة ثمانية');

// انكماشُ اللوحِ دون محتواه يطبع سطرَ الاعتمادِ في وسط الصفحة فوق البطاقات.
const lap = await page.evaluate(() => {
  const pane = document.querySelector('.pane');
  const cr = document.querySelector('.screen > .credit');
  if (!pane || !cr) return 'لم يوجد';
  return cr.getBoundingClientRect().top >= pane.getBoundingClientRect().bottom - 1 ? 'سليم' : 'متداخل';
});
ok(lap === 'سليم', `سطرُ الاعتماد بعد المحتوى لا فوقه (${lap})`);

await page.locator('input[type=search]').fill('صعوبة');
await page.waitForTimeout(400);
ok(await page.locator('.grid-cards button').count() === 1, 'البحثُ يُرشِّح الأقسام');
await page.locator('input[type=search]').fill('');
await page.waitForTimeout(300);

await page.locator('.grid-cards button >> text=صحّة البنك').click();
await page.waitForTimeout(900);
ok((await title()).includes('صحّة البنك'), 'بابُ «صحّة البنك» يُفتَح وحدَه');
await page.goBack();
await page.waitForTimeout(600);
ok((await title()).includes('لوحة الإدارة'), 'والرجوعُ يعيد إلى اللوحة');

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.locator('.tabbar >> text=حسابي').click();
await page.waitForTimeout(600);
ok(await page.locator('text=لوحة الإدارة').count() > 0, 'الدخولُ محفوظٌ بعد إعادةِ التحميل');

await page.locator('text=لوحة الإدارة').first().click();
await page.waitForTimeout(700);
await page.locator('.grid-cards button', { hasText: 'كلمة الدخول والخروج' }).click();
await page.waitForTimeout(700);
await page.locator('text=اخرج من هذا الجهاز').click();
await page.waitForTimeout(700);
ok(await page.locator('text=لوحة الإدارة').count() === 0, 'الخروجُ يُخفي المدخلَ من جديد');

/* ── الحصيلة ─────────────────────────────────────────────────────────── */

await browser.close();

if (crashes.length) {
  console.log(`\n=== أعطابٌ في المتصفّح (${crashes.length}) ===`);
  crashes.forEach((c) => console.log('  ' + c));
}
console.log(`\n=== إخفاقات (${fails.length + crashes.length}) ===`);
fails.forEach((f) => console.log('  ✗ ' + f));
process.exit(fails.length + crashes.length ? 1 : 0);
