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
const allowedOrigins = (env) =>
  (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);

/**
 * ترويسةُ CORS — وترويسةٌ **فارغةٌ** ليست كترويسةٍ غائبة.
 *
 * و`wrangler.toml` يُشحَن بـ`ALLOWED_ORIGIN = ""`، فكانت القائمةُ فارغةً فيُبعَث
 * `access-control-allow-origin: ` خالياً. والمتصفّحُ يردُّ كلَّ طلبٍ عندها —
 * حتى `/health` — ورسالتُه في الطرفيّةِ لا تدلُّ على السبب. فينشُر صاحبُ
 * التطبيقِ الخادمَ، ويراه يعمل بـ`curl`، ولا يصل من المتصفّحِ صفٌّ واحد، ولا
 * شيءَ في التطبيقِ يقول لِمَ — لأنّ `sync.flush` يبتلع الخطأَ صامتاً بقصد.
 *
 * فلا تُبعَث الترويسةُ فارغةً: إن لم يُضبَط شيءٌ تُحذَف، فيُعطي المتصفّحُ خطأَ
 * CORS المعروفَ الذي يُبحَث عنه، وتقول `/health` صريحاً إنّ الضبطَ ناقص.
 */
function corsHeaders(env, origin) {
  const allowed = allowedOrigins(env);
  const base = {
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-admin-key',
    'access-control-max-age': '86400',
  };
  if (!allowed.length) return base;                    // غيرُ مضبوط — لا ترويسةَ خاوية
  if (allowed.includes('*')) return { ...base, 'access-control-allow-origin': '*' };
  if (allowed.includes(origin)) return { ...base, 'access-control-allow-origin': origin };
  return { ...base, 'access-control-allow-origin': allowed[0], vary: 'Origin' };
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
      // النبضةُ تقول حالَ الضبطِ أيضاً، فيُعرَف النقصُ من الطرفيّةِ بلا تخمين.
      if (url.pathname === '/health') {
        return json({
          ok: true,
          originSet: allowedOrigins(env).length > 0,
          adminKeySet: !!env.ADMIN_KEY,
          rateLimitSet: !!env.IP_SALT,
        }, 200, cors);
      }
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

/**
 * سقفُ صفوفِ الجهازِ الواحد — أكبرُ من بنكِ الأسئلةِ كلِّه بسعةٍ، ودونَ ما
 * يُستنزَف به الخادم. فجهازٌ واحدٌ لا يُدخِل صفوفاً بلا نهاية.
 */
const MAX_PER_DEVICE = 6000;

/**
 * صورةُ رقمِ السؤالِ كما هي في البنوكِ كلِّها: حرفانِ إلى أربعةٍ لاتينيةٌ كبيرة،
 * ثمّ مقطعٌ ثانٍ اختياريٌّ مثلُه، ثمّ رقم. (قِيست على ٤٠١٠ سؤالاً: صورتان
 * وحدَهما — `A-N` و`A-A-N` — وأطولُها اثنا عشرَ محرفاً.)
 *
 * وكان يُقبَل أيُّ نصٍّ طولُه ≤٦٤، فيُحشَر في العمودِ ما ليس من البنك، ويظهر
 * بحرفه في «أصعبُ الأسئلة» عند المشرف لأنّ الشاشةَ تطبع المعرِّفَ إذا لم تجد
 * له سؤالاً. فكان المرسِلُ يكتب في لوحةِ صاحبِ التطبيقِ ما يشاء.
 *
 * وهذه صورةٌ لا عضويّة: لا تمنع معرِّفاً موافقَ الصورةِ لا وجودَ له. ومنعُ ذلك
 * يحتاج قائمةَ معرِّفاتِ البنكِ في الخادم، وهي تُنشَر معه إن أُريد ضبطٌ تامّ.
 */
const ID_SHAPE = /^[A-Z]{2,4}(-[A-Z]{2,4})?-\d{1,4}$/;

/* ── حدُّ التكرارِ اليوميّ ─────────────────────────────────────────────── */

/**
 * سقفُ الصفوفِ من مصدرٍ واحدٍ في اليومِ الواحد.
 *
 * ── المشكلة ──────────────────────────────────────────────────────────────
 *
 * `POST /answers` مفتوحٌ بلا توثيق، ولا سبيلَ إلى توثيقِه: التطبيقُ ملفّاتٌ
 * ساكنةٌ تنزل كلُّها إلى الجهاز، فأيُّ مفتاحٍ يُشحَن فيه مقروءٌ لمن فتح الكود.
 * ولا حسابَ للطالبِ ولا كلمةَ سرّ — وذلك مقصودٌ لا نقص.
 *
 * فبقيت ثغرةٌ واحدة: حاسوبٌ يكتب حلقةً تخترع UUID جديداً في كلِّ طلب، فيُدخِل
 * صفوفاً بلا حدّ. و`MAX_PER_DEVICE` لا يردُّه، لأنّ الجهازَ عندَه جديدٌ كلَّ
 * مرّة. فتصير «أصعبُ الأسئلة» و«نسبةُ الصوابِ» في لوحةِ صاحبِ التطبيقِ من صنعِ
 * المُرسِل، وهو لا يعلم — وخبرٌ خاطئٌ يُبنى عليه أسوأُ من لا خبر.
 *
 * ── وما ليس حلّاً ────────────────────────────────────────────────────────
 *
 * كان مكتوباً ههنا أنّ موضعَ الحدِّ حافّةُ Cloudflare وحدَها. وذلك نصفُ الحقّ:
 * الحافّةُ أقوى وأرخص، لكنّها **ضبطٌ يدويٌّ في لوحةٍ خارج المستودع** — إن لم
 * يُضبَط نُشِر الخادمُ مكشوفاً، ولا شيءَ في الكودِ يُنبِّه. فلا يُترَك الحدُّ
 * لخُطوةٍ قد تُنسى.
 *
 * ── الحلُّ ههنا ──────────────────────────────────────────────────────────
 *
 * عدّادٌ يوميٌّ على مصدرِ الطلبِ، مُلخَّصاً لا صريحاً: يُلخَّص عنوانُ المُرسِل
 * مع يومِه ومع مِلحٍ سرّيٍّ في `env.IP_SALT` تلخيصاً لا يُرَدُّ. فلا يُخزَّن
 * عنوانٌ في القاعدةِ ولا في سجلّ، ولا يُوصَل يومٌ بيومٍ — إذ يتبدّل التلخيصُ
 * مع اليوم. وهذا يُبقي وعدَ «لا يُرسَل موضعُ الطالب» قائماً.
 *
 * والسقفُ أُخِذ واسعاً: أكثرُ ما يُجيبه طالبٌ جادٌّ في يومٍ مئتانِ أو ثلاث،
 * والبنكُ كلُّه ٤٠١٠. فألفانِ يستوعبان بيتاً فيه إخوةٌ على شبكةٍ واحدةٍ
 * يُذاكرون جميعاً، ويَردُّ الحلقةَ التي تُدخِل مئةَ ألف.
 *
 * وإن غاب `IP_SALT` أو غاب العنوانُ لم يُمنَع الإرسال: الإحصاءُ ليس ممّا
 * يُعطَّل به التطبيق، والسقفُ سقفُ إفسادٍ لا سقفُ أمان.
 */
const MAX_PER_DAY = 2000;

/** تلخيصٌ لا يُرَدُّ: عنوانُ المُرسِل + يومُه + مِلحٌ سرّيّ. */
async function bucketOf(request, env, day) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || !env.IP_SALT) return null;
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${env.IP_SALT}|${day}|${ip}`),
  );
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * يزيد العدّادَ ويُرجِع `false` إن تجاوز السقف.
 *
 * والزيادةُ `INSERT … ON CONFLICT DO UPDATE` في طلبٍ واحد، فلا تُقرَأ ثمّ
 * تُكتَب — إذ طلبانِ متوازيانِ يقرآنِ العددَ نفسَه فيتجاوزانِ السقفَ معاً.
 */
async function withinQuota(env, bucket, day, count, cap = MAX_PER_DAY) {
  if (!bucket) return true;
  try {
    const row = await env.DB.prepare(
      'INSERT INTO quota (bucket, day, n) VALUES (?, ?, ?)'
      + ' ON CONFLICT (bucket) DO UPDATE SET n = quota.n + excluded.n, day = excluded.day'
      + ' RETURNING n',
    ).bind(bucket, day, count).first();
    // تنظيفُ ما مضى — رخيصٌ لأنّه على فهرسِ اليوم، ويمنع تراكمَ الصفوف.
    if (Math.random() < 0.02) {
      await env.DB.prepare('DELETE FROM quota WHERE day < ?').bind(day - 1).run();
    }
    return !row || row.n <= cap;
  } catch {
    return true;   // القاعدةُ تعذّرت — لا يُمنَع الإرسالُ لأجلِ عدّاد
  }
}

/**
 * أكبرُ جسمٍ يُقبَل — ٥٠٠ إجابةٍ لا تبلغ ١٥٠ ك.ب بسعةٍ واسعة.
 *
 * وكان `request.json()` يُفَكُّ الجسمُ كلُّه **قبلَ** أيِّ حدٍّ على حجمه، وحدُّ
 * `MAX_BATCH` يقع بعد الفكِّ لا قبله. فمن بعثَ مصفوفةً فيها مليونُ عنصرٍ
 * أُنفِق عليه الوقتُ والذاكرةُ كلَّها ثمّ رُدَّ. وردُّه على الترويسةِ أرخصُ
 * من ردِّه بعد الفكّ.
 *
 * و`content-length` لا تُؤتمَن وحدَها (تُكذَب أو تغيب في الإرسالِ المتدفّق)،
 * لكنّها تردُّ الغالبَ بلا كلفةٍ، وما بعدَها يردُّه `MAX_BATCH`.
 */
const MAX_BODY = 262_144;

async function postAnswers(request, env, cors) {
  const len = Number(request.headers.get('content-length'));
  if (Number.isFinite(len) && len > MAX_BODY) {
    return json({ error: 'الجسمُ أكبرُ من الحدّ' }, 413, cors);
  }
  const body = await request.json().catch(() => null);
  if (!body || !isUuid(body.device) || !Array.isArray(body.answers)) {
    return json({ error: 'دفعةٌ غير صالحة' }, 400, cors);
  }
  if (!TRACKS.has(body.track)) return json({ error: 'مسارٌ غير معروف' }, 400, cors);
  if (body.answers.length > MAX_BATCH) return json({ error: 'الدفعةُ أكبرُ من الحدّ' }, 413, cors);

  const now = Date.now();
  const rows = [];
  for (const a of body.answers) {
    if (typeof a?.id !== 'string' || !ID_SHAPE.test(a.id)) continue;
    const score = Number(a.score);
    if (!Number.isFinite(score) || score < 0 || score > 1) continue;
    // وقتُ الجهاز لا يُؤتمَن على إطلاقه: يُقبَل ما كان في نافذةٍ معقولةٍ حولَ الآن.
    const at = Number(a.at);
    const stamp = Number.isFinite(at) && Math.abs(now - at) < 366 * 86_400_000 ? at : now;
    rows.push([body.device, a.id, score, body.track, stamp]);
  }
  if (!rows.length) return json({ saved: 0 }, 200, cors);

  // سقفُ الجهازِ الواحد. ولا يُغني هذا عن حدِّ تكرارٍ حقيقيّ: ذاك يُضبَط في
  // حافّةِ Cloudflare (Security ← WAF ← Rate limiting rules) على المسار
  // `/answers`، ولا يحتاج أن يُخزَّن في التطبيقِ عنوانٌ ولا أثرٌ للمرسِل —
  // وهو الموضعُ الصحيحُ له، لأنّ حدَّ التكرارِ في الكودِ يقتضي تعريفَ المرسِل.
  const seen = await env.DB.prepare('SELECT COUNT(*) AS n FROM answers WHERE device = ?')
    .bind(body.device).first();
  if (seen && seen.n >= MAX_PER_DEVICE) {
    return json({ error: 'بلغ هذا الجهازُ حدَّه' }, 429, cors);
  }

  // وسقفُ المصدرِ اليوميّ — وهو الذي يردُّ من يخترع جهازاً في كلِّ طلب.
  const day = Math.floor(now / 86_400_000);
  const bucket = await bucketOf(request, env, day);
  if (!(await withinQuota(env, bucket, day, rows.length))) {
    return json({ error: 'بُلِغ حدُّ اليومِ من هذا المصدر' }, 429, cors);
  }

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

  await sweep(env, now);
  return json({ saved: rows.length }, 200, cors);
}

/**
 * مدّةُ بقاءِ الصفِّ — سنةٌ ثمّ يُمحى.
 *
 * ── لماذا حدٌّ أصلاً ────────────────────────────────────────────────────
 *
 * كان ما وصلَ الخادمَ يبقى **أبداً**: لا مدّةَ، ولا سبيلَ إلى محوِه. ويُقال
 * للطالبِ في «حسابي»: «ومسحُ تقدّمك يمحو ذلك الرقمَ فيُولَّد غيرُه» — وهو
 * صادقٌ في لفظه، لكنّه يُفهَم محواً، والمحوُ لا يقع: تبقى صفوفُه في الجدولِ
 * موصولةً بمعرِّفِه القديمِ إلى غيرِ نهاية.
 *
 * ولا يملك الخادمُ محوَها **بطلبِ الطالب**، لأنّه لا يعرف من هو — وذاك مقصودٌ
 * لا نقص: لو أمكنَ أن يُطلَب المحوُ بالمعرِّفِ لأمكنَ أن يُطلَب غيرُه به،
 * ولصار المعرِّفُ مفتاحاً على شخص. فالبديلُ الصحيحُ حدُّ مدّةٍ يُطبَّق على
 * الجميعِ بلا استثناءٍ ولا سؤال.
 *
 * وسنةٌ لأنّ الغرضَ كلَّه معرفةُ «أيُّ سؤالٍ يصعب على الناس» — وذاك يُعرَف من
 * موسمٍ واحد، ولا يحتاج إلى حفظِ ما قبله.
 *
 * والمحوُ يقع عَرَضاً مع الإرسالِ (بضعةٌ في المائةِ من الطلبات) لا في مُجدوِلٍ
 * مستقلّ: الطبقةُ المجانيّةُ لا تضمن `cron`، وحدُّ مدّةٍ لا يعمل إلا بضبطٍ
 * إضافيٍّ قد يُنسى ليس حدّاً.
 */
const KEEP_DAYS = 365;

async function sweep(env, now) {
  if (Math.random() >= 0.01) return;
  const cutoff = now - KEEP_DAYS * 86_400_000;
  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM answers WHERE at < ?').bind(cutoff),
      env.DB.prepare('DELETE FROM devices WHERE last < ?').bind(cutoff),
    ]);
  } catch { /* المحوُ يُعاد في طلبٍ آخَر — لا يُفشَل الإرسالُ لأجله */ }
}

/* ── الأرقامُ المجمَّعة ──────────────────────────────────────────────── */

/**
 * لا تُعاد صفوفٌ فرديّةٌ البتّة — مجاميعُ فقط.
 *
 * ولا يُعاد سؤالٌ أجاب عنه أقلُّ من `MIN` من الأجهزة، **وهذا لمعنًى واحدٍ**:
 * نسبةٌ من إجابةٍ واحدةٍ ليست إحصاءً، وعرضُها يُغري بالبناءِ عليها.
 *
 * ── وليس هذا الحدُّ حمايةً للخصوصية، وكان مكتوباً أنّه كذلك فصُحِّح ──
 *
 * كان يُقال ههنا وفي `اقرأني.md` وفي شاشةِ المشرف إنّه «يحمي من أن يُستدَلَّ
 * على إجابةِ شخصٍ بعينه في مسجدٍ صغير». وذلك **غيرُ صحيح**، لأنّ العدَّ عدُّ
 * صفوفٍ مفتاحُها `(device, question)`، و`device` لا يُوثَّق عند أحد: يُقبَل من
 * أيِّ مرسِلٍ ما كان على صورةِ UUID. فمن ملك مفتاحَ المشرفِ (فهو وحدَه يقرأ
 * هذه الأرقام) قدر أن يُرسِل أربعةَ معرِّفاتٍ بدرجاتٍ يعرفها على سؤالٍ بعينه،
 * فيبلغ الحدُّ خمسةً ويظهر المتوسّط، فيحلَّ المعادلةَ: الحقيقيُّ = المتوسّط×٥
 * ناقصاً ما أرسله. وزيادةً: الحدُّ يعدُّ أجهزةً لا أناساً، ورجلٌ واحدٌ بهاتفٍ
 * ولوحيٍّ وحاسوبٍ يبلغه وحدَه.
 *
 * فالحقُّ أن يُقال: لا شيءَ في هذا الخادمِ يمنع من يملك مفتاحَ المشرفِ من
 * الاستدلالِ على درجةِ جهازٍ بعينه في سؤالٍ بعينه. والذي يحمي الطالبَ حقّاً
 * أمران: أنّه لا يُرسَل عنه اسمٌ ولا هاتفٌ ولا بريدٌ ولا موضع — فالمستدَلُّ
 * عليه «جهازٌ» لا يُعرَف صاحبُه — وأنّ المفتاحَ عند صاحبِ التطبيقِ وحدَه.
 * ولا يُوضَع في هذا الخادمِ ما لا يُحتمَل هذا القدرُ من الكشفِ فيه.
 */
const MIN_ANSWERS = 5;

/**
 * أكثرُ ما يُحاوَل من مصدرٍ واحدٍ في اليوم على `/stats`.
 *
 * وكان البابُ مفتوحاً بلا عدّ: يُجرَّب المفتاحُ ألفَ مرّةٍ في الدقيقةِ بلا مانعٍ
 * ولا أثرٍ يُرى — وصاحبُ التطبيقِ لا يعلم أنّ أحداً يحاول، لأنّه لا سجلَّ ولا
 * عدّاد. وهذا هو القُفلُ الحقيقيُّ في المشروعِ كلِّه (أرقامُ الطلابِ خلفَه)،
 * فبقاؤه بلا حدٍّ أشدُّ من بقاءِ `/answers` بلا حدّ.
 *
 * والعدُّ على التلخيصِ اليوميِّ نفسِه الذي في `/answers` — لا يُخزَّن عنوانٌ.
 * وأربعون محاولةً في اليوم تكفي مشرفاً أخطأ في النسخ، وتُعجِز من يُجرِّب.
 *
 * ويُعَدُّ **الخطأُ وحدَه**: من معه المفتاحُ الصحيحُ يفتح الشاشةَ كما يشاء.
 */
const MAX_KEY_TRIES = 40;

async function getStats(request, env, cors) {
  const given = request.headers.get('x-admin-key');
  if (!env.ADMIN_KEY || given !== env.ADMIN_KEY) {
    const day = Math.floor(Date.now() / 86_400_000);
    const bucket = await bucketOf(request, env, day);
    // يُعَدُّ الإخفاقُ حتى في حالِ الضبطِ الناقص، فلا يُترَك بابٌ بلا عدّاد.
    const within = await withinQuota(env, bucket ? `key:${bucket}` : null, day, 1, MAX_KEY_TRIES);
    if (!within) return json({ error: 'كثُرت المحاولاتُ من هذا المصدر' }, 429, cors);
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
