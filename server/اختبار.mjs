/*
 * اختبارُ الخادم محلّياً — بلا حسابِ Cloudflare ولا شبكة.
 *
 * يُشغَّل `worker.js` نفسَه على قاعدةِ SQLite في الذاكرة، بواجهةٍ تُحاكي D1
 * (`prepare/bind/first/all/run/batch`). فيُختبَر السكويلُ والتحقّقُ والصلاحياتُ
 * كما تعمل فعلاً — لا نُسخةٌ ثانيةٌ من المنطق تُختبَر ثمّ يُنشَر غيرُها.
 *
 *     node server/اختبار.mjs
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './worker.js';

const HERE = new URL('.', import.meta.url).pathname;
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(HERE + 'schema.sql', 'utf8'));

/** أدنى ما يكفي من واجهة D1 لتشغيل الخادم كما هو. */
const D1 = {
  prepare(sql) {
    const stmt = db.prepare(sql);
    const mk = (args) => ({
      bind: (...a) => mk(a),
      first: async () => stmt.get(...args) ?? null,
      all: async () => ({ results: stmt.all(...args) }),
      run: async () => stmt.run(...args),
      _exec: () => stmt.run(...args),
    });
    return mk([]);
  },
  async batch(list) {
    for (const s of list) s._exec();
    return list.map(() => ({ success: true }));
  },
};

const env = { DB: D1, ADMIN_KEY: 'test-admin-key-123', ALLOWED_ORIGIN: 'https://example.test' };

const call = (path, init = {}) => worker.fetch(
  new Request(`https://x.test${path}`, { headers: { origin: 'https://example.test' }, ...init }), env,
);

const post = (body) => call('/answers', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://example.test' },
  body: JSON.stringify(body),
});

let pass = 0;
let fail = 0;
const is = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok ? '' : `  — كان ${JSON.stringify(got)} والمنتظَر ${JSON.stringify(want)}`}`);
  ok ? (pass += 1) : (fail += 1);
};

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

console.log('\nالصحّة والصلاحيات');
const health = await (await call('/health')).json();
is('health', health.ok, true);
// والنبضةُ تقول حالَ الضبطِ أيضاً، فيُعرَف النقصُ من الطرفيّةِ بلا مفتاح:
// `ALLOWED_ORIGIN` فارغةً كانت تُبعَث ترويسةً خاويةً فيُردُّ كلُّ شيءٍ صامتاً.
is('والنبضةُ تقول أضُبِط الأصلُ والمفتاح', 
  { o: health.originSet, k: health.adminKeySet }, { o: true, k: true });
is('stats بلا مفتاح ← ٤٠١', (await call('/stats')).status, 401);
is('stats بمفتاحٍ خطأ ← ٤٠١',
  (await call('/stats', { headers: { 'x-admin-key': 'wrong-key', origin: 'https://example.test' } })).status, 401);
is('مسارٌ مجهول ← ٤٠٤', (await call('/nope')).status, 404);
is('OPTIONS ← ٢٠٤', (await call('/answers', { method: 'OPTIONS' })).status, 204);

console.log('\nالتحقّقُ من المدخلات');
is('معرِّفٌ ليس UUID ← ٤٠٠',
  (await post({ device: 'أنا', track: 'imam', answers: [] })).status, 400);
is('مسارٌ مخترَع ← ٤٠٠',
  (await post({ device: uuid(1), track: 'hacker', answers: [] })).status, 400);
is('دفعةٌ أكبرُ من الحدّ ← ٤١٣',
  (await post({ device: uuid(1), track: 'imam', answers: new Array(501).fill({ id: 'MTH-001', score: 1 }) })).status, 413);
is('درجةٌ خارج المدى تُسقَط',
  (await (await post({ device: uuid(1), track: 'imam', answers: [{ id: 'MTH-001', score: 9 }, { id: 'MTH-002', score: -1 }] })).json()).saved, 0);
is('رقمُ سؤالٍ ليس نصّاً يُسقَط',
  (await (await post({ device: uuid(1), track: 'imam', answers: [{ id: 42, score: 1 }] })).json()).saved, 0);

console.log('\nالحفظُ وأمانُ التكرار');
const batch1 = [{ id: 'MTH-001', score: 1 }, { id: 'MTH-002', score: 0.2 }, { id: 'MTH-003', score: 0.8 }];
is('دفعةٌ أولى', (await (await post({ device: uuid(1), track: 'imam', answers: batch1 })).json()).saved, 3);
is('إعادةُ الدفعةِ نفسِها لا تُضاعِف',
  (await (await post({ device: uuid(1), track: 'imam', answers: batch1 })).json()).saved, 3);
is('العددُ في القاعدةِ ثلاثةٌ لا ستّة',
  db.prepare('SELECT COUNT(*) AS n FROM answers').get().n, 3);
is('الجهازُ واحدٌ لا اثنان',
  db.prepare('SELECT COUNT(*) AS n FROM devices').get().n, 1);

// آخِرُ درجةٍ هي المحفوظة
await post({ device: uuid(1), track: 'imam', answers: [{ id: 'MTH-002', score: 0.9 }] });
is('الدرجةُ تُستبدَل بآخرِها',
  db.prepare("SELECT score FROM answers WHERE device = ? AND question = 'MTH-002'").get(uuid(1)).score, 0.9);

console.log('\nحدُّ الخمسةِ في /stats');
// أربعةُ أجهزةٍ على Q9 — دون الحدّ، فلا يظهر
for (let i = 2; i <= 5; i += 1) {
  await post({ device: uuid(i), track: 'imam', answers: [{ id: 'GEN-FQH-009', score: 0 }] });
}
let d = await (await call('/stats', { headers: { 'x-admin-key': env.ADMIN_KEY, origin: 'https://example.test' } })).json();
is('سؤالٌ بأربعِ إجاباتٍ لا يظهر', d.hardest.some((r) => r.id === 'GEN-FQH-009'), false);

// الخامسُ يُبلغه الحدَّ فيظهر
await post({ device: uuid(6), track: 'muezzin', answers: [{ id: 'GEN-FQH-009', score: 0 }] });
d = await (await call('/stats', { headers: { 'x-admin-key': env.ADMIN_KEY, origin: 'https://example.test' } })).json();
is('وبخمسٍ يظهر', d.hardest.some((r) => r.id === 'GEN-FQH-009'), true);
is('وهو أصعبُها', d.hardest[0].id, 'GEN-FQH-009');
is('بمتوسّطِ صفر', d.hardest[0].avg, 0);

/*
 * كان ههنا تأكيدٌ عنوانُه «مفتاحٌ عربيٌّ في ترويسةٍ يُرمى خطأ»، وجسمُه في فرعِ
 * الالتقاطِ `is(…, 'خطأ', 'خطأ')` — أي يُقارَن الثابتُ بنفسِه فينجح أبداً.
 * وهو مع ذلك لا يفحص كودَ المشروعِ في شيء: يفحص أنّ `Request` في **نود**
 * يرفض حرفاً غيرَ لاتينيٍّ في ترويسة. فإن تبدّلت نودُ يوماً تبدّل «الفحص»،
 * وإن كُسِر الحارسُ في `sync.stats` لم يقل هذا شيئاً.
 *
 * والحارسُ الحقيقيُّ في العميل (`assets/js/sync.js`)، ولا يُستورَد ههنا لأنّه
 * يقرأ `localStorage` عند التحميل. فحُذِف التأكيدُ الكاذبُ ولم يُستبدَل به
 * كاذبٌ آخَر — ونقصٌ مُعلَنٌ خيرٌ من تغطيةٍ مُدَّعاة.
 */

console.log('\nالمجاميع');
is('عددُ الأجهزة', d.devices, 6);
is('توزيعُ المسارات', d.byTrack, { imam: 5, muezzin: 1 });
is('لا صفوفَ فرديّةٍ في الرد',
  Object.keys(d).some((k) => k === 'answersList' || k === 'devicesList'), false);
is('لا معرِّفَ جهازٍ في الردّ',
  JSON.stringify(d).includes(uuid(1)), false);

console.log('\nصورةُ رقمِ السؤال');
// ما ليس على صورةِ معرِّفاتِ البنكِ يُرَدّ، فلا يُحشَر في «أصعبُ الأسئلة» كلامٌ
// مخترَعٌ يظهر بحرفه في لوحةِ المشرف. ويُوضَع ههنا في آخرِ الفحصِ لأنّ إضافةَ
// جهازٍ جديدٍ تُزيح مجاميعَ ما قبله.
is('معرِّفٌ ليس على صورةِ البنكِ يُرَدّ',
  (await (await post({ device: uuid(9), track: 'imam',
    answers: [{ id: '؟؟ سؤالٌ مخترَع', score: 0 }, { id: 'q1', score: 0 },
      { id: 'MTH-0001-X', score: 0 }] })).json()).saved, 0);
is('والصحيحُ صورةً يُقبَل',
  (await (await post({ device: uuid(9), track: 'imam',
    answers: [{ id: 'NHW-036', score: 1 }] })).json()).saved, 1);

/* ── حدُّ التكرارِ اليوميّ ─────────────────────────────────────────────── */

console.log('\nحدُّ المصدرِ اليوميّ');

// المِلحُ والعنوانُ كلاهما لازم: بغيابِ أحدهما لا يُحسَب حدٌّ ولا يُمنَع إرسالٌ
// — وهو ما تعمل به الفحوصُ كلُّها قبل هذا الموضع.
const salted = { ...env, IP_SALT: 'pepper-for-test' };
const postFrom = (ip, body, e = salted) => worker.fetch(new Request('https://x.test/answers', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://example.test', 'CF-Connecting-IP': ip },
  body: JSON.stringify(body),
}), e);

const many = (n, from = 0) => Array.from({ length: n }, (_, i) => ({
  id: `GEN-FQH-${String(((i + from) % 999) + 1).padStart(3, '0')}`, score: 1,
}));

// جهازٌ واحدٌ من عنوانٍ واحد: دفعتان دون السقفِ تُقبَلان.
is('دفعةٌ من عنوانٍ جديدٍ تُقبَل',
  (await (await postFrom('203.0.113.7', { device: uuid(40), track: 'imam', answers: many(400) })).json()).saved, 400);

// ثمّ يُخترَع جهازٌ جديدٌ في كلِّ دفعةٍ — وهذا عينُ ما لا يردُّه سقفُ الجهاز.
let blocked = 0;
let accepted = 0;
for (let k = 0; k < 6; k += 1) {
  const res = await postFrom('203.0.113.7', { device: uuid(50 + k), track: 'imam', answers: many(400, k * 400) });
  if (res.status === 429) blocked += 1; else accepted += 1;
}
is('اختراعُ جهازٍ في كلِّ دفعةٍ يُردُّ عند بلوغِ السقف', blocked > 0, true);
is('وما قبل السقفِ قُبِل', accepted > 0, true);

// وعنوانٌ آخَرُ لا يُعاقَب بذنبِ الأوّل — العدّادُ لكلِّ مصدرٍ وحدَه.
is('عنوانٌ آخَرُ لا يمسُّه حدُّ غيرِه',
  (await postFrom('198.51.100.9', { device: uuid(70), track: 'imam', answers: many(50) })).status, 200);

// ولا يُخزَّن عنوانٌ في القاعدة، ولا ما يُرَدُّ إليه.
const buckets = db.prepare('SELECT bucket FROM quota').all().map((r) => r.bucket);
is('لا عنوانَ في جدولِ الحدّ', buckets.some((b) => /203\.0\.113|198\.51\.100/.test(b)), false);
is('بل تلخيصٌ ستّونيٌّ طولُه ٦٤', buckets.every((b) => /^[0-9a-f]{64}$/.test(b)), true);

// وبغيابِ المِلحِ لا حدَّ — فلا يتعطّل خادمٌ نُشِر بلا ضبطِ `IP_SALT`.
is('بلا مِلحٍ لا يُمنَع إرسال',
  (await postFrom('203.0.113.7', { device: uuid(80), track: 'imam', answers: many(10) }, env)).status, 200);

/* ── ما أُصلِح من الملحوظاتِ المتوسّطة ──────────────────────────────── */

console.log('\nترويسةُ الأصلِ بلا ضبط');
// كانت تُبعَث خاويةً (`allow-origin: `) فيردُّ المتصفّحُ كلَّ شيءٍ صامتاً —
// حتى النبضة. والصوابُ ألّا تُبعَث أصلاً، فيُعطي المتصفّحُ خطأَه المعروف.
{
  const bare = { ...env, ALLOWED_ORIGIN: '' };
  const res = await worker.fetch(
    new Request('https://x.test/health', { headers: { origin: 'https://example.test' } }), bare);
  is('لا تُبعَث ترويسةُ أصلٍ خاوية', res.headers.get('access-control-allow-origin'), null);
  is('والنبضةُ تقول إنّ الأصلَ غيرُ مضبوط', (await res.json()).originSet, false);
  const set = await (await call('/health')).json();
  is('وتقولُ إنّه مضبوطٌ حيث ضُبِط', set.originSet, true);
}

console.log('\nحدُّ تجريبِ مفتاحِ المشرف');
// كان يُجرَّب بلا نهايةٍ ولا أثر — وهو القُفلُ الحقيقيُّ في المشروع.
{
  const tryKey = (ip, key) => worker.fetch(new Request('https://x.test/stats', {
    headers: { origin: 'https://example.test', 'x-admin-key': key, 'CF-Connecting-IP': ip },
  }), salted);
  let got429 = 0;
  for (let i = 0; i < 60; i += 1) {
    if ((await tryKey('192.0.2.50', `guess-${i}`)).status === 429) got429 += 1;
  }
  is('تجريبُ المفتاحِ يُردُّ بعد بلوغِ الحدّ', got429 > 0, true);
  is('والمفتاحُ الصحيحُ يُقبَل بعدَه — العدُّ للإخفاقِ وحدَه',
    (await tryKey('192.0.2.50', env.ADMIN_KEY)).status, 200);
  is('وعنوانٌ آخَرُ لا يمسُّه حدُّ غيرِه',
    (await tryKey('192.0.2.77', 'wrong')).status, 401);
}

console.log('\nحجمُ الجسم');
// كان يُفَكُّ الجسمُ كلُّه قبلَ أيِّ حدٍّ على حجمه.
is('جسمٌ أكبرُ من الحدِّ يُردُّ على الترويسةِ قبل الفكّ',
  (await worker.fetch(new Request('https://x.test/answers', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://example.test',
      'content-length': String(300_000) },
    body: JSON.stringify({ device: uuid(1), track: 'imam', answers: [] }),
  }), env)).status, 413);

console.log('\nمدّةُ بقاءِ الصفوف');
// لم يكن لما وصلَ الخادمَ مدّةٌ ولا سبيلٌ إلى محوِه، والنصُّ المعروضُ على
// الطالبِ يُفهَم محواً. فصار يُمحى بمضيِّ عام.
{
  const old = Date.now() - 400 * 86_400_000;
  db.prepare('INSERT OR REPLACE INTO answers (device, question, score, track, at) VALUES (?,?,?,?,?)')
    .run(uuid(99), 'MTH-001', 1, 'imam', old);
  db.prepare('INSERT OR REPLACE INTO devices (device, track, first, last) VALUES (?,?,?,?)')
    .run(uuid(99), 'imam', old, old);
  const before = db.prepare('SELECT COUNT(*) AS n FROM answers WHERE at < ?')
    .get(Date.now() - 365 * 86_400_000).n;
  is('صفٌّ عمرُه أكثرُ من عامٍ موجودٌ قبل الكنس', before > 0, true);
  // الكنسُ عَرَضيٌّ (١٪) فيُستدعى حتى يقع — ولا يُنتظَر حظٌّ في فحص.
  for (let i = 0; i < 2000; i += 1) {
    await post({ device: uuid(1), track: 'imam', answers: [{ id: 'MTH-001', score: 1 }] });
    if (!db.prepare('SELECT COUNT(*) AS n FROM answers WHERE at < ?')
      .get(Date.now() - 365 * 86_400_000).n) break;
  }
  is('وبعد الكنسِ لا يبقى', db.prepare('SELECT COUNT(*) AS n FROM answers WHERE at < ?')
    .get(Date.now() - 365 * 86_400_000).n, 0);
  is('وجهازُه مُحي معه', db.prepare('SELECT COUNT(*) AS n FROM devices WHERE device = ?')
    .get(uuid(99)).n, 0);
}

console.log(`\n=== نجح ${pass} · فشل ${fail} ===`);
process.exit(fail ? 1 : 0);
