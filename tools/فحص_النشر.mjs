/*
 * فحصُ النشر — أيَعمل التطبيقُ بلا شبكةٍ بعد هذا الدفع؟
 *
 * وهذا فحصٌ لا متصفّحَ فيه: يقرأ الملفّاتِ نصّاً ويقارنها بعضَها ببعض. وإنّما
 * كُتِب لأنّ في `sw.js` قائمتَين يُصانان باليدِ وحدَها، وسهوُهما لا يُخفِق شيئاً
 * ولا يظهر في سجلّ — إنّما يظهر عند إمامٍ في مسجدٍ لا شبكةَ فيه، بعد النشر.
 *
 *   ١) `SHELL` — ما يُخزَّن عند التنصيب. وكلُّ وحدةٍ جديدةٍ تُستورَد في
 *      `app.js` يجب أن تُكتَب فيها. ومن أضاف شاشةً ونسيَها فالتطبيقُ يعمل عنده
 *      تماماً (الشبكةُ حاضرة) ويسقط عند من لا شبكةَ عنده — ولا شيءَ يقول لِمَ.
 *
 *   ٢) `CACHE` — رقمُ نسخةِ المخزن. وما لم يُرفَع بقي الطالبُ على الكودِ
 *      القديمِ إلى غيرِ نهاية: يُنشَر الإصلاحُ ولا يصل، ويُظنُّ النشرُ تأخّر.
 *
 * ولا يُفحَص هذا في متصفّحٍ لأنّه لا يظهر في متصفّح: الفحوصُ الأربعةُ الأخرى
 * تُشغَّل على `localhost` والشبكةُ فيها حاضرةٌ دائماً، فتنجح كلُّها على تطبيقٍ
 * لا يعمل بلا شبكةٍ البتّة.
 *
 *     node tools/فحص_النشر.mjs
 *
 * ويُرجِع رمزَ خروجٍ غيرَ صفريٍّ عند الإخفاق، فيصلح في أيِّ مِجرًى آليّ.
 */

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, normalize, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); console.log(`${cond ? '✓' : '✗'} ${msg}`); };

/* ── قراءةُ `sw.js` ──────────────────────────────────────────────────── */

const sw = read('sw.js');

const CACHE = /const CACHE = '([^']+)'/.exec(sw)?.[1];
ok(!!CACHE, `اسمُ المخزنِ مقروءٌ من sw.js (${CACHE || '—'})`);

/** تُقرَأ المصفوفاتُ النصّيّةُ بعد تجريدِ التعليقات، فلا يُلتقَط مثالٌ في شرح. */
const stripped = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const arrayAfter = (marker) => {
  const i = stripped.indexOf(marker);
  if (i < 0) return [];
  const open = stripped.indexOf('[', i);
  const close = stripped.indexOf(']', open);
  return [...stripped.slice(open, close).matchAll(/'([^']+)'/g)].map((m) => m[1]);
};

const SHELL = arrayAfter('const SHELL');
const EXTRA = arrayAfter('const extra');
ok(SHELL.length > 10, `قائمةُ الهيكلِ مقروءة (${SHELL.length} مَدخلاً)`);

/* ── (أ) كلُّ ما في `SHELL` و`extra` له ملفٌّ على القرص ───────────────── */

const missing = [...SHELL, ...EXTRA].filter((rel) => rel !== '.' && !existsSync(join(ROOT, rel)));
ok(missing.length === 0, missing.length
  ? `مَداخِلُ في sw.js لا ملفَّ لها: ${missing.join('، ')}`
  : 'كلُّ مَدخلٍ في sw.js له ملفٌّ على القرص');

/* ── (ب) شجرةُ الاستيرادِ من `app.js` كلُّها في `SHELL` ───────────────── */

/**
 * تُتبَّع `import … from './x.js'` من `app.js` تتبُّعاً متعدّياً.
 *
 * ولا تُقرَأ من قائمةٍ مكتوبة: المقصودُ أن يُكشَف ما أُضيف ولم يُكتَب، وقائمةٌ
 * ثانيةٌ تُصان باليدِ تُعيد العَطَبَ نفسَه في موضعٍ آخَر.
 */
const walk = (entry, seen = new Set()) => {
  const rel = normalize(entry);
  if (seen.has(rel)) return seen;
  seen.add(rel);
  let src;
  try { src = read(rel); } catch { return seen; }
  const here = dirname(rel);
  for (const m of src.matchAll(/^\s*import\s[^'"]*['"](\.[^'"]+)['"]/gm)) {
    walk(normalize(join(here, m[1])), seen);
  }
  return seen;
};

const tree = [...walk('assets/js/app.js')].map((p) => relative('.', p));
const shellSet = new Set(SHELL);
const unlisted = tree.filter((p) => !shellSet.has(p));
ok(unlisted.length === 0, unlisted.length
  ? `وحداتٌ يستوردها app.js وليست في SHELL — تسقط بلا شبكة: ${unlisted.join('، ')}`
  : `شجرةُ الاستيرادِ كلُّها في SHELL (${tree.length} وحدة)`);

/* ── (ج) إن تبدّل ملفٌّ من الهيكلِ فلا بدَّ أن يتبدّل `CACHE` ─────────── */

/*
 * والمقارنةُ مع `HEAD`: أي «ما الذي تبدّل في هذا العملِ قبل أن يُلتزَم».
 *
 * فمن عدّل `app.css` ونسيَ رقمَ المخزنِ لم يصل تعديلُه إلى أحدٍ نُصِّب التطبيقُ
 * عنده — يقرأ من المخزنِ القديمِ أبداً، ولا رسالةَ خطأٍ في موضع. وهذا أخطرُ
 * ما في هذا الملفّ، لأنّه يُخفي **كلَّ** إصلاحٍ بعدَه.
 */
const git = (cmd) => {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return null; }
};

if (!git('git rev-parse HEAD')) {
  ok(false, 'لا مستودعَ git ههنا — لم يُفحَص رفعُ رقمِ المخزن');
} else {
  const changed = (git('git diff --name-only HEAD') || '').split('\n').filter(Boolean);
  const shellTouched = changed.filter((f) => shellSet.has(f) || EXTRA.includes(f));
  const swTouched = changed.includes('sw.js');

  if (!shellTouched.length) {
    ok(true, 'لم يتبدّل ملفٌّ من الهيكلِ في هذا العمل');
  } else {
    const before = git('git show HEAD:sw.js');
    const wasCache = before && /const CACHE = '([^']+)'/.exec(before)?.[1];
    ok(swTouched && wasCache !== CACHE,
      wasCache === CACHE
        ? `تبدّل ${shellTouched.length} ملفّاً من الهيكلِ و CACHE على حاله (${CACHE})`
        : `تبدّل الهيكلُ ورُفِع رقمُ المخزن (${wasCache} ← ${CACHE})`);
  }
}

/* ── (د) ما يُستورَد من `index.html` كذلك ────────────────────────────── */

const html = read('index.html');
const fromHtml = [...html.matchAll(/(?:src|href)="((?!https?:|data:)[^"#]+)"/g)]
  .map((m) => m[1])
  .filter((p) => !p.startsWith('assets/icons/'));   // الأيقوناتُ تُفحَص أعلاه
const htmlMissing = fromHtml.filter((p) => !shellSet.has(p) && !EXTRA.includes(p));
ok(htmlMissing.length === 0, htmlMissing.length
  ? `ملفّاتٌ تربطها index.html وليست في التخزينِ المسبق: ${htmlMissing.join('، ')}`
  : 'كلُّ ما تربطه index.html مخزَّنٌ مسبقاً');

console.log(`\n=== إخفاقات: ${fails.length} ===`);
if (fails.length) { for (const f of fails) console.log('  · ' + f); process.exit(1); }
