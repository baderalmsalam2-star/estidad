/*
 * فحصُ الوصول — أيقرأ التطبيقَ من لا يرى كما يقرؤه من يرى؟
 *
 * والفحوصُ الثلاثةُ قبلَه تسأل: أتُرسَم الشاشةُ بلا خطأ (`فحص_الشاشات`)، وأيَجِدُ
 * الطالبُ طريقَه (`فحص_التنقل`)، وأهي مرسومةٌ كما قُصِدت (`فحص_الهيئة`). وهذا
 * يسأل عن أربعٍ لا تُرى في لقطةٍ ولا يُوقِف خللُها شيئاً:
 *
 *   ١) تباينُ كلِّ لونِ نصٍّ على كلِّ خلفيةٍ يُستعمَل عليها — ٤٫٥:١ (WCAG AA).
 *   ٢) حلقةُ التركيزِ — ٣:١، فمن يتنقّل بلوحةِ المفاتيحِ يعلم أين هو.
 *   ٣) موضعُ اللمسِ — ٤٤×٤٤ في كلِّ الشاشات.
 *   ٤) عنوانٌ (`heading`) في كلِّ شاشة، وموضعُ `aria-live` يُعلِن تبدُّلَها.
 *
 * وكلُّها كانت مُخِلَّةً في الفحصِ الأوّلِ للتطبيق: ٣٠ زوجَ تباينٍ دون الحدّ،
 * وحلقةُ تركيزٍ بـ١٫٠٥:١، و١٢٥ صنفاً من مواضعِ اللمسِ دون ٤٤، وثمانُ شاشاتٍ
 * بلا عنوان. فيُقاس ههنا كلَّ مرّةٍ لئلّا يعود شيءٌ منها في تعديلٍ لاحق.
 *
 *     node tools/serve.js &        # ثمّ
 *     node tools/فحص_الوصول.mjs
 *
 * ويُبدَّل العنوانُ بـ`ESTIDAD_BASE` إن كان الخادمُ على غيرِ ٣٠٠٠.
 */

import { execSync } from 'node:child_process';
const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
const pw = await import(`${root}/playwright/index.js`);
const chromium = pw.chromium || pw.default.chromium;

// والافتراضُ منفذُ `tools/serve.js` نفسُه (٣٠٠٠). وكان ٨٩٣١ فيسقط الفحصُ
// بـ`ERR_CONNECTION_REFUSED` على من شغَّله كما يأمر الرأسُ أعلاه.
const BASE = process.env.ESTIDAD_BASE || 'http://127.0.0.1:3000';

let fails = 0;
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => { fails += 1; console.log(`✗ ${m}`); };

/* ── التباين ─────────────────────────────────────────────────────────── */

const lin = (c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : (((c / 255) + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
await p.goto(`${BASE}/index.html`, { waitUntil: 'load' });
await p.waitForTimeout(3500);
await p.evaluate(async () => {
  const store = await import('./assets/js/store.js');
  store.setTrack('imam');
  store.setReminderAt('19:00');
});

const SCREENS = ['track', 'home', 'books', 'search', 'recite', 'account', 'flashcards',
  'custom', 'tajweed', 'library', 'mastered', 'admin'];

/**
 * ── ولوحةُ المشرفِ تُفتَح فعلاً، وإلا أخفقَ الفحص ─────────────────────────
 *
 * كانت `admin` في القائمةِ ويُقال في ثلاثةِ مواضعَ «الشاشاتُ الاثنتا عشرة» —
 * وهي لا تُفتَح البتّة: `adminScreen` تبدأ بـ`if (!owner.isOwner()) go('signin')`،
 * فيُقاس `signin` ويُنسَب القياسُ إلى اللوحة. وزُرِعت في اللوحةِ ثلاثُ مخالفاتٍ
 * متعمَّدةٍ (تباينُ ١:١، وزرٌّ ١٠×١٠، وأرقامٌ لاتينيّةٌ في نصٍّ عربيّ) فمرَّ
 * الفحصُ **بصفرِ إخفاق** — وهو «تحقُّقٌ يُخطَّى في صمتٍ فلا يُخفِق أبداً».
 *
 * فيُسجَّل الدخولُ كما في `فحص_الشاشات.mjs`، ويُوضَع حارسٌ كحارسِه: إن رُدَّت
 * الشاشةُ إلى الدخولِ أخفقَ الفحصُ صريحاً ولم يمضِ.
 */
const signedIn = await p.evaluate(async () => {
  const src = await fetch('/assets/js/owner.js').then((r) => r.text());
  const sha = /export const PASS_SHA = '([0-9a-f]{64})'/.exec(src)?.[1];
  const key = /const KEY = '([^']+)'/.exec(src)?.[1];
  if (!sha || !key) return false;
  localStorage.setItem(key, sha);
  return true;
});
if (!signedIn) bad('تعذّر الدخولُ بصفةِ المالك — لن تُفحَص لوحةُ المشرف');
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(3000);

const OWNED = new Set(['admin']);

const goTo = async (n) => {
  await p.evaluate(async (name) => {
    const { go } = await import('./assets/js/ui.js');
    go(name);
    await new Promise((r) => setTimeout(r, 550));
  }, n);
  if (!OWNED.has(n)) return;
  // الحارس: شاشةُ الدخولِ لها عنوانُها، فيُعرَف أنّ اللوحةَ لم تُرسَم.
  const fellBack = await p.evaluate(() => /هذا البابُ لصاحب التطبيق|دخول المشرف/
    .test(document.getElementById('screen').innerText));
  if (fellBack) bad(`لم تُفتَح «${n}» — رُدَّت إلى شاشةِ الدخول، فما بعدَها ليس قياساً لها`);
};

console.log('\nتباينُ النصّ (٤٫٥:١)');

/** يُجمَع لونُ كلِّ نصٍّ مع خلفيّتِه الفعليّةِ المحسوبةِ من شجرةِ الأبوين. */
const collect = () => p.evaluate(() => {
  const parse = (s) => {
    const m = (s || '').match(/[\d.]+/g) || [];
    return { c: m.slice(0, 3).map(Number), a: m.length > 3 ? +m[3] : 1 };
  };
  /**
   * الخلفيّةُ الفعليّة — **تُركَّب** الطبقاتُ الشفّافةُ ولا يُكتفى بأوّلِ لون.
   *
   * فالشارةُ على البطاقةِ الخضراء خلفيّتُها `rgba(250,247,241,.16)`: لونٌ غيرُ
   * شفّافٍ تماماً، فلو أُخِذ كما هو لقيسَ نصٌّ أبيضُ على أبيضَ فقيل ١:١ — وهو
   * على الشاشةِ أخضرُ فاتحٌ يقرأ عليه الأبيضُ جيّداً. فتُركَّب على ما تحتها.
   */
  const opaque = (n) => {
    const stack = [];
    for (let x = n; x; x = x.parentElement) {
      const { c, a } = parse(getComputedStyle(x).backgroundColor);
      if (a > 0) stack.push({ c, a });
      if (a >= 1) break;
    }
    const base = parse(getComputedStyle(document.body).backgroundColor);
    let out = base.c;
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const { c, a } = stack[i];
      out = out.map((v, k) => Math.round(c[k] * a + v * (1 - a)));
    }
    return out;
  };
  const out = [];
  for (const n of document.querySelectorAll('#screen *')) {
    // النصُّ المباشرُ وحدَه — لا نصُّ الأبناء.
    const own = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (!own) continue;
    const cs = getComputedStyle(n);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const r = n.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (n.disabled || n.closest('[disabled]')) continue;   // المُعطَّلُ مُستثنى
    // ما أُخفِي عن قارئِ الشاشةِ زخرفةٌ لا نصّ — والسهمُ «‹» منه. وحدُّه ٣:١
    // كغيرِ النصّ، وهو محقَّقٌ في `--ink-8`، ولا يُقاس ههنا قياسَ الحرف.
    if (n.closest('[aria-hidden="true"]')) continue;
    const size = parseFloat(cs.fontSize);
    const weight = +cs.fontWeight || 400;
    // النصُّ الكبير (١٨٫٦٦ غليظاً أو ٢٤ عادياً) حدُّه ٣:١
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const fgp = parse(cs.color);
    const under = opaque(n);
    const fg = fgp.a >= 1 ? fgp.c
      : fgp.c.map((v, k) => Math.round(v * fgp.a + under[k] * (1 - fgp.a)));
    out.push({
      fg, bg: under, size, large,
      txt: n.textContent.trim().slice(0, 22),
      cls: String(n.className || n.tagName).slice(0, 26),
    });
  }
  return out;
});

const lowContrast = new Map();
for (const name of SCREENS) {
  await goTo(name);
  for (const r of await collect()) {
    const need = r.large ? 3 : 4.5;
    const got = ratio(r.fg, r.bg);
    if (got < need - 0.005) {
      const key = `${r.cls} · ${got.toFixed(2)}:1 (المطلوب ${need}) · «${r.txt}»`;
      if (!lowContrast.has(key)) lowContrast.set(key, new Set());
      lowContrast.get(key).add(name);
    }
  }
}
if (!lowContrast.size) ok('كلُّ نصٍّ في الشاشاتِ الاثنتَي عشرةَ فوق حدِّه');
else {
  bad(`${lowContrast.size} موضعَ نصٍّ دون حدِّ التباين:`);
  for (const [k, v] of [...lowContrast].slice(0, 20)) console.log(`     ${k}  [${[...v].join(' ')}]`);
}

/* ── حلقةُ التركيز ───────────────────────────────────────────────────── */

console.log('\nحلقةُ التركيز (٣:١)');
await goTo('search');
const ring = await p.evaluate(() => {
  const rgb = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
  const inp = document.querySelector('.searchbar');
  if (!inp) return null;
  inp.focus();
  const cs = getComputedStyle(inp);
  const bg = getComputedStyle(inp.parentElement).backgroundColor;
  return { outline: rgb(cs.outlineColor), width: parseFloat(cs.outlineWidth),
    style: cs.outlineStyle, on: rgb(bg), own: rgb(cs.backgroundColor) };
});
if (!ring) bad('لم أجد حقلَ البحث');
else if (ring.style === 'none' || !ring.width) bad('لا حلقةَ تركيزٍ على حقلِ البحث');
else {
  const r = Math.max(ratio(ring.outline, ring.own), ratio(ring.outline, ring.on));
  if (r >= 3) ok(`حلقةُ حقلِ البحث ${r.toFixed(2)}:1 بسمكِ ${ring.width}px`);
  else bad(`حلقةُ حقلِ البحث ${r.toFixed(2)}:1 — دون ٣:١ فلا تُرى`);
}

/* ── موضعُ اللمس ─────────────────────────────────────────────────────── */

console.log('\nموضعُ اللمس (٤٤×٤٤)');
const small = new Map();
for (const name of SCREENS) {
  await goTo(name);
  const rows = await p.evaluate(() => {
    const sel = 'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
    const out = [];
    for (const n of document.querySelectorAll(sel)) {
      const r = n.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(n);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (n.classList.contains('tap-inline')) continue;
      if (r.width < 44 || r.height < 44) {
        out.push({ w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10,
          cls: String(n.className || n.tagName).slice(0, 26),
          txt: (n.innerText || n.getAttribute('aria-label') || '').trim().slice(0, 20) });
      }
    }
    return out;
  });
  for (const r of rows) {
    const key = `${r.cls} · ${r.w}×${r.h} · «${r.txt}»`;
    if (!small.has(key)) small.set(key, new Set());
    small.get(key).add(name);
  }
}
if (!small.size) ok('كلُّ موضعِ لمسٍ في الشاشاتِ الاثنتَي عشرةَ ٤٤×٤٤ أو أكبر');
else {
  bad(`${small.size} صنفاً من مواضعِ اللمسِ دون ٤٤×٤٤:`);
  for (const [k, v] of [...small].slice(0, 20)) console.log(`     ${k}  [${[...v].join(' ')}]`);
}

/* ── العنوانُ وإعلانُ التبدُّل ───────────────────────────────────────── */

console.log('\nعنوانُ الشاشةِ وإعلانُ تبدُّلها');
const noHead = [];
for (const name of SCREENS) {
  await goTo(name);
  const h = await p.evaluate(() => {
    const scr = document.getElementById('screen');
    const n = scr.querySelector('h1,h2,h3,[role="heading"]');
    return n ? (n.textContent || '').trim().slice(0, 30) : null;
  });
  if (!h) noHead.push(name);
}
if (!noHead.length) ok('كلُّ شاشةٍ من الاثنتَي عشرةَ لها عنوانٌ يُقرَأ');
else bad(`${noHead.length} شاشةً بلا عنوان: ${noHead.join(' ')}`);

const crier = await p.evaluate(() => {
  const n = document.querySelector('[aria-live]');
  return n ? { live: n.getAttribute('aria-live'), text: (n.textContent || '').trim() } : null;
});
if (crier && crier.live === 'polite' && crier.text) {
  ok(`وتبدُّلُها يُعلَن: «${crier.text}»`);
} else bad('تبدُّلُ الشاشةِ صامتٌ — لا موضعَ aria-live فيه اسمُها');

const title = await p.evaluate(() => document.title);
if (/—/.test(title)) ok(`وعنوانُ الصفحةِ يتبعها: «${title.slice(0, 50)}»`);
else bad(`عنوانُ الصفحةِ لا يتبع الشاشة: «${title}»`);

/* ── يومُ الأسبوعِ: خبرٌ لا يُحمَل على اللونِ وحدَه ─────────────────── */

console.log('\nشريطُ أيّامِ الأسبوع');
await goTo('home');
const week = await p.evaluate(() => {
  const rgb = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
  const days = [...document.querySelectorAll('.week-day')];
  return days.map((d) => {
    const dot = d.querySelector('.dot');
    const cs = getComputedStyle(dot);
    return { label: d.getAttribute('aria-label'), cls: dot.className,
      bg: rgb(cs.backgroundColor), border: rgb(cs.borderTopColor), bw: parseFloat(cs.borderTopWidth) };
  });
});
if (week.length && week.every((d) => d.label)) ok(`لكلِّ يومٍ اسمٌ يُقرَأ (${week.length} يوماً)`);
else bad('بعضُ الأيّامِ بلا اسمٍ يُقرَأ — الخبرُ باللونِ وحدَه');

const plain = week.find((d) => d.cls === 'dot');
const some = week.find((d) => /dot--some/.test(d.cls));
if (plain && some) {
  const byFill = ratio(plain.bg, some.bg);
  const byEdge = ratio(plain.bg, some.border);
  if (Math.max(byFill, byEdge) >= 3) {
    ok(`ويومٌ فيه عملٌ يُفرَّق عن الخالي بـ${Math.max(byFill, byEdge).toFixed(2)}:1`);
  } else bad(`يومٌ فيه عملٌ يوازي الخاليَ (${byFill.toFixed(2)}:1 حشواً، ${byEdge.toFixed(2)}:1 حدّاً)`);
} else console.log('  · لا تقدُّمَ في هذا الجهازِ فلم تُقَس الحالاتُ الثلاث');

/* ── الاتّجاهُ والاسمُ المقروء ────────────────────────────────────────── */

console.log('\nكسورُ «أ/ب» واتّجاهُها');
// `١٢/٤٠` في سطرٍ عربيٍّ تُقرَأ «٤٠/١٢» إن لم يُعزَل اتّجاهُها — انظر `frac`.
{
  const flipped = new Map();
  for (const name of SCREENS) {
    await goTo(name);
    const rows = await p.evaluate(() => {
      const out = [];
      for (const n of document.querySelectorAll('#screen *')) {
        const own = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
        if (!own) continue;
        const t = n.textContent.trim();
        if (!/[٠-٩]+\/[٠-٩]+/.test(t)) continue;
        const cs = getComputedStyle(n);
        const isolated = cs.direction === 'ltr' && /isolate|plaintext/.test(cs.unicodeBidi);
        if (!isolated) out.push({ t: t.slice(0, 30), cls: String(n.className || n.tagName).slice(0, 22) });
      }
      return out;
    });
    for (const r of rows) {
      const key = `${r.cls} · «${r.t}»`;
      if (!flipped.has(key)) flipped.set(key, new Set());
      flipped.get(key).add(name);
    }
  }
  if (!flipped.size) ok('كلُّ كسرٍ معزولُ الاتّجاهِ فلا ينقلب ترتيبُه');
  else {
    bad(`${flipped.size} كسراً بلا عزلِ اتّجاه:`);
    for (const [k, v] of [...flipped].slice(0, 10)) console.log(`     ${k}  [${[...v].join(' ')}]`);
  }
}

console.log('\nشاراتُ الخيارِ ومجموعاتُها');
// `aria-pressed` بلا مجموعةٍ تضمُّها ولا اسمٍ يربطها تُنطَق أرقاماً مجرَّدة.
{
  const loose = new Map();
  for (const name of SCREENS) {
    await goTo(name);
    const rows = await p.evaluate(() => {
      const out = [];
      for (const n of document.querySelectorAll('#screen [aria-pressed]')) {
        const g = n.closest('[role="group"], [role="radiogroup"], fieldset');
        const named = g && (g.getAttribute('aria-label') || g.getAttribute('aria-labelledby'));
        if (!named) out.push((n.innerText || n.getAttribute('aria-label') || '?').trim().slice(0, 16));
      }
      return out;
    });
    for (const r of rows) {
      if (!loose.has(r)) loose.set(r, new Set());
      loose.get(r).add(name);
    }
  }
  if (!loose.size) ok('كلُّ شارةِ خيارٍ في مجموعةٍ لها اسمٌ يُقرَأ');
  else {
    bad(`${loose.size} شارةَ خيارٍ بلا مجموعةٍ مُسمّاة:`);
    for (const [k, v] of [...loose].slice(0, 12)) console.log(`     «${k}»  [${[...v].join(' ')}]`);
  }
}

console.log('\nالأرقامُ العربيةُ في كلِّ ما يُعرَض');
// قاعدةٌ منصوصةٌ في `ui.js`: «كل رقمٍ يظهر للطالب يُكتب بالأرقام العربية».
{
  const latin = new Map();
  for (const name of SCREENS) {
    await goTo(name);
    const rows = await p.evaluate(() => {
      const out = [];
      for (const n of document.querySelectorAll('#screen *')) {
        const own = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
        if (!own) continue;
        const t = n.textContent.trim();
        // الرقمُ اللاتينيُّ في نصٍّ فيه حرفٌ عربيّ — لا في معرِّفٍ ولا رابط
        if (!/\d/.test(t) || !/[\u0600-\u06ff]/.test(t)) continue;
        if (n.closest('a[href], code, .num')) continue;
        if (/^[A-Z]{2,4}(-[A-Z]{2,4})?-\d+$/.test(t)) continue;      // رقمُ سؤال
        if (/awqaf-prep-v\d+/.test(t)) continue;                      // اسمُ المخزن
        out.push({ t: t.slice(0, 34), cls: String(n.className || n.tagName).slice(0, 20) });
      }
      return out;
    });
    for (const r of rows) {
      const key = `${r.cls} · «${r.t}»`;
      if (!latin.has(key)) latin.set(key, new Set());
      latin.get(key).add(name);
    }
  }
  if (!latin.size) ok('لا رقمَ لاتينيٌّ في نصٍّ عربيٍّ معروضٍ على الطالب');
  else {
    bad(`${latin.size} موضعاً فيه رقمٌ لاتينيٌّ في نصٍّ عربيّ:`);
    for (const [k, v] of [...latin].slice(0, 10)) console.log(`     ${k}  [${[...v].join(' ')}]`);
  }
}

await b.close();
console.log(`\n=== إخفاقات (${fails}) ===`);
process.exit(fails ? 1 : 0);
