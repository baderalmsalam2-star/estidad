/*
 * خادمُ الإحصاء — Cloudflare Worker + D1، بلا اعتمادياتٍ ولا إطار.
 *
 * التطبيقُ نفسُه يبقى ملفاتٍ ساكنةً يعمل بلا شبكة؛ وهذا الخادمُ زائدٌ عليه لا
 * شرطٌ فيه: إن سقط أو لم يُنشَر أصلاً عمل التطبيقُ كما هو، ولا يرى الطالبُ
 * فرقاً. فلا يُجعَل في مسارِ الإقلاعِ شيءٌ يعتمد عليه.
 *
 * وما يُخزَّن: معرِّفٌ عشوائيٌّ يولِّده الجهاز، ورقمُ السؤال، والدرجة، والمسار،
 * والوقت. **لا اسمَ ولا هاتفَ ولا بريدَ ولا موضع.**
 *
 * المسارات:
 *   POST /answers   ← دفعةُ إجاباتٍ من جهاز        (عامّ)
 *   GET  /stats     ← الأرقامُ المجمَّعة            (بمفتاح المشرف)
 *   GET  /health    ← نبضةٌ للتأكّد أنّه يعمل        (عامّ)
 *
 * النشر:  cd server && npx wrangler d1 create awqaf-stats
 *         npx wrangler d1 execute awqaf-stats --remote --file=schema.sql
 *         npx wrangler secret put ADMIN_KEY
 *         npx wrangler deploy
 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

/** الأصولُ المسموحُ لها بالإرسال. تُضبَط في `wrangler.toml` ← `ALLOWED_ORIGIN`. */
function corsHeaders(env, origin) {
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'access-control-allow-origin': ok ? origin : (allowed[0] || ''),
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-admin-key',
    'access-control-max-age': '86400',
  };
}

const json = (body, status, extra) =>
  new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });

/** معرِّفُ الجهاز: UUID لا غير. يُرفَض ما سواه كي لا يُحشَر في العمود ما ليس منه. */
const isUuid = (s) => typeof s === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const TRACKS = new Set(['imam', 'muezzin', 'muezzin_retired']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    const cors = corsHeaders(env, origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      if (url.pathname === '/health') return json({ ok: true }, 200, cors);
      if (url.pathname === '/answers' && request.method === 'POST') return postAnswers(request, env, cors);
      if (url.pathname === '/stats' && request.method === 'GET') return getStats(request, env, cors);
      return json({ error: 'لا مسارَ بهذا الاسم' }, 404, cors);
    } catch (e) {
      // لا يُعاد نصُّ الخطأ إلى العميل — قد يحمل تفاصيلَ البنية.
      console.error(e);
      return json({ error: 'خطأٌ في الخادم' }, 500, cors);
    }
  },
};

/* ── استقبالُ دفعةِ إجابات ───────────────────────────────────────────── */

const MAX_BATCH = 500;

async function postAnswers(request, env, cors) {
  const body = await request.json().catch(() => null);
  if (!body || !isUuid(body.device) || !Array.isArray(body.answers)) {
    return json({ error: 'دفعةٌ غير صالحة' }, 400, cors);
  }
  if (!TRACKS.has(body.track)) return json({ error: 'مسارٌ غير معروف' }, 400, cors);
  if (body.answers.length > MAX_BATCH) return json({ error: 'الدفعةُ أكبرُ من الحدّ' }, 413, cors);

  const now = Date.now();
  const rows = [];
  for (const a of body.answers) {
    if (typeof a?.id !== 'string' || a.id.length > 64) continue;
    const score = Number(a.score);
    if (!Number.isFinite(score) || score < 0 || score > 1) continue;
    // وقتُ الجهاز لا يُؤتمَن على إطلاقه: يُقبَل ما كان في نافذةٍ معقولةٍ حولَ الآن.
    const at = Number(a.at);
    const stamp = Number.isFinite(at) && Math.abs(now - at) < 366 * 86_400_000 ? at : now;
    rows.push([body.device, a.id, score, body.track, stamp]);
  }
  if (!rows.length) return json({ saved: 0 }, 200, cors);

  const put = env.DB.prepare(
    'INSERT INTO answers (device, question, score, track, at) VALUES (?, ?, ?, ?, ?)'
    + ' ON CONFLICT (device, question) DO UPDATE SET score = excluded.score, at = excluded.at',
  );

  await env.DB.batch([
    ...rows.map((r) => put.bind(...r)),
    env.DB.prepare(
      'INSERT INTO devices (device, track, first, last) VALUES (?, ?, ?, ?)'
      + ' ON CONFLICT (device) DO UPDATE SET last = excluded.last, track = excluded.track',
    ).bind(body.device, body.track, now, now),
  ]);

  return json({ saved: rows.length }, 200, cors);
}

/* ── الأرقامُ المجمَّعة ──────────────────────────────────────────────── */

/**
 * لا تُعاد صفوفٌ فرديّةٌ البتّة — مجاميعُ فقط.
 *
 * ولا يُعاد سؤالٌ أجاب عنه أقلُّ من `MIN` من الأجهزة: نسبةٌ من إجابةٍ واحدةٍ
 * ليست إحصاءً، وعرضُها يُغري بالبناءِ عليها. والحدُّ يحمي أيضاً من أن يُستدَلَّ
 * على إجابةِ شخصٍ بعينه في مسجدٍ صغير.
 */
const MIN_ANSWERS = 5;

async function getStats(request, env, cors) {
  if (!env.ADMIN_KEY || request.headers.get('x-admin-key') !== env.ADMIN_KEY) {
    return json({ error: 'مفتاحُ المشرف مطلوب' }, 401, cors);
  }

  const day = 86_400_000;
  const now = Date.now();

  const [totals, byTrack, hardest, easiest, active] = await Promise.all([
    env.DB.prepare(
      'SELECT (SELECT COUNT(*) FROM devices) AS devices,'
      + ' (SELECT COUNT(*) FROM answers) AS answers,'
      + ' (SELECT COUNT(*) FROM answers WHERE score >= 0.7) AS right_,'
      + ' (SELECT COUNT(DISTINCT question) FROM answers) AS questions',
    ).first(),

    env.DB.prepare('SELECT track, COUNT(*) AS n FROM devices GROUP BY track').all(),

    env.DB.prepare(
      'SELECT question, COUNT(*) AS n, AVG(score) AS avg FROM answers'
      + ' GROUP BY question HAVING n >= ? ORDER BY avg ASC LIMIT 20',
    ).bind(MIN_ANSWERS).all(),

    env.DB.prepare(
      'SELECT question, COUNT(*) AS n, AVG(score) AS avg FROM answers'
      + ' GROUP BY question HAVING n >= ? ORDER BY avg DESC LIMIT 10',
    ).bind(MIN_ANSWERS).all(),

    env.DB.prepare(
      'SELECT COUNT(*) AS d7 FROM devices WHERE last >= ?',
    ).bind(now - 7 * day).first(),
  ]);

  return json({
    at: now,
    minAnswers: MIN_ANSWERS,
    devices: totals.devices,
    devices7d: active.d7,
    answers: totals.answers,
    right: totals.right_,
    questionsSeen: totals.questions,
    byTrack: Object.fromEntries((byTrack.results || []).map((r) => [r.track, r.n])),
    hardest: (hardest.results || []).map((r) => ({ id: r.question, n: r.n, avg: r.avg })),
    easiest: (easiest.results || []).map((r) => ({ id: r.question, n: r.n, avg: r.avg })),
  }, 200, cors);
}
