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
is('health', (await (await call('/health')).json()), { ok: true });
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
  (await post({ device: uuid(1), track: 'imam', answers: new Array(501).fill({ id: 'a', score: 1 }) })).status, 413);
is('درجةٌ خارج المدى تُسقَط',
  (await (await post({ device: uuid(1), track: 'imam', answers: [{ id: 'A', score: 9 }, { id: 'B', score: -1 }] })).json()).saved, 0);
is('رقمُ سؤالٍ ليس نصّاً يُسقَط',
  (await (await post({ device: uuid(1), track: 'imam', answers: [{ id: 42, score: 1 }] })).json()).saved, 0);

console.log('\nالحفظُ وأمانُ التكرار');
const batch1 = [{ id: 'Q1', score: 1 }, { id: 'Q2', score: 0.2 }, { id: 'Q3', score: 0.8 }];
is('دفعةٌ أولى', (await (await post({ device: uuid(1), track: 'imam', answers: batch1 })).json()).saved, 3);
is('إعادةُ الدفعةِ نفسِها لا تُضاعِف',
  (await (await post({ device: uuid(1), track: 'imam', answers: batch1 })).json()).saved, 3);
is('العددُ في القاعدةِ ثلاثةٌ لا ستّة',
  db.prepare('SELECT COUNT(*) AS n FROM answers').get().n, 3);
is('الجهازُ واحدٌ لا اثنان',
  db.prepare('SELECT COUNT(*) AS n FROM devices').get().n, 1);

// آخِرُ درجةٍ هي المحفوظة
await post({ device: uuid(1), track: 'imam', answers: [{ id: 'Q2', score: 0.9 }] });
is('الدرجةُ تُستبدَل بآخرِها',
  db.prepare("SELECT score FROM answers WHERE device = ? AND question = 'Q2'").get(uuid(1)).score, 0.9);

console.log('\nحدُّ الخمسةِ في /stats');
// أربعةُ أجهزةٍ على Q9 — دون الحدّ، فلا يظهر
for (let i = 2; i <= 5; i += 1) {
  await post({ device: uuid(i), track: 'imam', answers: [{ id: 'Q9', score: 0 }] });
}
let d = await (await call('/stats', { headers: { 'x-admin-key': env.ADMIN_KEY, origin: 'https://example.test' } })).json();
is('سؤالٌ بأربعِ إجاباتٍ لا يظهر', d.hardest.some((r) => r.id === 'Q9'), false);

// الخامسُ يُبلغه الحدَّ فيظهر
await post({ device: uuid(6), track: 'muezzin', answers: [{ id: 'Q9', score: 0 }] });
d = await (await call('/stats', { headers: { 'x-admin-key': env.ADMIN_KEY, origin: 'https://example.test' } })).json();
is('وبخمسٍ يظهر', d.hardest.some((r) => r.id === 'Q9'), true);
is('وهو أصعبُها', d.hardest[0].id, 'Q9');
is('بمتوسّطِ صفر', d.hardest[0].avg, 0);

console.log('\nالمفتاحُ لا يُقبَل إلا لاتينياً');
try {
  new Request('https://x.test/stats', { headers: { 'x-admin-key': 'مفتاح-عربي' } });
  is('مفتاحٌ عربيٌّ في ترويسةٍ يُرمى خطأ', 'لم يُرمَ', 'خطأ');
} catch {
  is('مفتاحٌ عربيٌّ في ترويسةٍ يُرمى خطأ', 'خطأ', 'خطأ');
}

console.log('\nالمجاميع');
is('عددُ الأجهزة', d.devices, 6);
is('توزيعُ المسارات', d.byTrack, { imam: 5, muezzin: 1 });
is('لا صفوفَ فرديّةٍ في الرد',
  Object.keys(d).some((k) => k === 'answersList' || k === 'devicesList'), false);
is('لا معرِّفَ جهازٍ في الردّ',
  JSON.stringify(d).includes(uuid(1)), false);

console.log(`\n=== نجح ${pass} · فشل ${fail} ===`);
process.exit(fail ? 1 : 0);
