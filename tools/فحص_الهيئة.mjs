/*
 * فحصُ الهيئة — أهيَ مرسومةٌ كما قُصِدت؟
 *
 * الفحصانِ الآخَران يسألان: أتُرسَم الشاشةُ بلا خطأ (`فحص_الشاشات`)، وأيَجِدُ
 * الطالبُ طريقَه (`فحص_التنقل`). وهذا يسأل عن الهيئة: أعلى الترويسةِ زَلِّيجٌ
 * يتلاشى، وأمرسومةٌ حلقةُ التقدّمِ برقمها في جوفها، وأتنبض النقطةُ عند التأشير،
 * وأعلى الشاشةِ الفارغةِ نجمٌ لا سطرٌ يتيم؟
 *
 * وهذه كلُّها تُحذَف سهواً في تعديلٍ لاحقٍ ولا يُوقِف حذفُها شيئاً ولا يظهر في
 * سجلّ — فلا يُعلَم إلا بالنظر، وهذا يَنظُر عنّا.
 *
 *     node tools/serve.js &        # ثمّ
 *     node tools/فحص_الهيئة.mjs
 */

import { execSync } from 'node:child_process';
const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
const pw = await import(`${root}/playwright/index.js`);
const chromium = pw.chromium || pw.default.chromium;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const S = '/tmp/claude-0/-home-user/48112700-91c7-5fe7-a711-4a3efca4e45f/scratchpad';
const p = await b.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const bad = []; p.on('pageerror', (e) => bad.push(e.message));
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); console.log(`${c ? '✓' : '✗'} ${m}`); };

await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(500);
await p.locator('text=متابعة').first().click(); await p.waitForTimeout(800);

// ١ — ترويسةٌ مزخرفة
const hero = await p.evaluate(() => {
  const h = document.querySelector('.hero');
  if (!h) return null;
  const st = getComputedStyle(h, '::before');
  return { img: st.backgroundImage !== 'none', mask: (st.maskImage || st.webkitMaskImage || '') !== 'none' };
});
ok(hero && hero.img, 'الترويسةُ عليها زَلِّيج');
ok(hero && hero.mask, 'ويتلاشى بـmask فلا حدَّ مرسوم');

// ٢ — حلقةُ التقدّم، والقوسُ يمتدُّ بعد الرسم
await p.waitForTimeout(900);
// لا يُلاحَق إطارُ الحركة — يصل القوسُ موضعَه قبل أن يُقرَأ. فيُفحَص الانتقالُ
// نفسُه: أمضبوطٌ على `stroke-dashoffset` وبمدّةٍ غيرِ صفر؟
// لا يُكتفى بوجودِ العنصرِ في الشجرة: `document.createElement('svg')` يُنشئ
// عنصراً في فضاءِ أسماءِ HTML يوجد ولا يُرسَم. فيُفحَص فضاءُ الأسماءِ ومقاسُه
// على الشاشة — وهذا العَطَبُ وقع فعلاً ولم يكشفه فحصُ الوجود.
const r = await p.evaluate(() => {
  const el = document.querySelector('.ring');
  const f = document.querySelector('.ring .fill');
  if (!el || !f) return null;
  const st = getComputedStyle(f);
  const box = el.getBoundingClientRect();
  return {
    prop: st.transitionProperty, dur: st.transitionDuration,
    svg: el.namespaceURI === 'http://www.w3.org/2000/svg',
    w: Math.round(box.width), h: Math.round(box.height),
  };
});
ok(r && r.svg, `الحلقةُ في فضاءِ أسماءِ SVG فتُرسَم فعلاً (${r ? r.svg : '—'})`);
ok(r && r.w > 40 && r.h > 40, `ولها مقاسٌ على الشاشة: ${r ? `${r.w}×${r.h}` : '—'}`);
ok(r && /stroke-dashoffset/.test(r.prop) && r.dur !== '0s',
   `والقوسُ يمتدُّ بانتقالٍ لا يوضَع دفعةً (${r ? r.dur : '—'})`);
ok(await p.locator('.card .num').first().count() > 0, 'والرقمُ في جوفها');
await p.screenshot({ path: `${S}/رئيسية-جديدة.png` });

// ٤ — الشاشةُ الفارغةُ عليها نجم
await p.locator('.tabbar >> text=الكتب').click(); await p.waitForTimeout(600);
await p.locator('.card.card--green >> text=الكتب كاملةً').click(); await p.waitForTimeout(800);
await p.locator('.tabbar >> text=الرئيسية').click(); await p.waitForTimeout(600);
await p.locator('.tabbar >> text=حسابي').click(); await p.waitForTimeout(500);
await p.locator('.tabbar >> text=الرئيسية').click(); await p.waitForTimeout(600);
await p.locator('.card >> text=صندوق المراجعة').click(); await p.waitForTimeout(800);
const mark = await p.locator('.empty-mark svg').count();
ok(mark > 0, `نجمُ الشاشةِ الفارغة: ${mark}`);
await p.screenshot({ path: `${S}/فارغة.png` });

// ٣ — حركةُ الإصابة
await p.locator('.tabbar >> text=الكتب').click(); await p.waitForTimeout(600);
await p.locator('.card >> text=دليل الطالب').first().click(); await p.waitForTimeout(700);
await p.locator('text=ابدأ الدراسة').first().click(); await p.waitForTimeout(1000);
const rev = p.locator('text=أظهر الإجابة النموذجية');
if (await rev.count()) { await rev.first().click(); await p.waitForTimeout(700); }
if (await p.locator('.point').count()) {
  await p.locator('.point').first().click();
  await p.waitForTimeout(120);
  const anim = await p.evaluate(() => {
    const box = document.querySelector('.point[aria-pressed="true"] .box');
    return box ? getComputedStyle(box).animationName : 'لا شيء';
  });
  ok(anim === 'pop', `النقطةُ تنبض عند التأشير (${anim})`);
}
await b.close();
if (bad.length) {
  console.log(`\n=== أعطابٌ في المتصفّح (${bad.length}) ===`);
  bad.forEach((e) => console.log('  ' + e));
}
console.log(`\n=== إخفاقات (${fails.length + bad.length}) ===`);
fails.forEach((f) => console.log('  ✗ ' + f));
process.exit(fails.length + bad.length ? 1 : 0);
