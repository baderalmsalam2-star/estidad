// إرسالُ الإجابات مجهولةً إلى خادم الإحصاء — إن وُجد، وإن أذِن الطالب.

/**
 * القاعدةُ الأولى ههنا: **لا يعتمد التطبيقُ على هذا الملفّ في شيء.**
 *
 * فإن لم يُنشَر خادمٌ (`SERVER` فارغ)، أو سقط، أو انقطعت الشبكة، أو لم يأذن
 * الطالبُ بالمشاركة — عمل التطبيقُ كما هو ولم يرَ فرقاً. ولا يُنتظَر ردُّ
 * الخادمِ في مسارِ الإقلاع ولا في مسارِ الإجابة.
 *
 * والقاعدةُ الثانية: **لا يُرسَل عن الطالب شيءٌ يدلُّ عليه.** المعرِّفُ رقمٌ
 * عشوائيٌّ يولِّده الجهازُ لنفسه، ولا يُطلَب اسمٌ ولا هاتفٌ ولا بريد. وإن مسح
 * تقدُّمَه وُلِّد غيرُه فانقطع الوصلُ بالقديم.
 */

/**
 * عنوانُ خادم الإحصاء بعد نشره. وما دام فارغاً فلا إرسالَ أصلاً، ولا يظهر
 * للطالب خيارٌ ولا كلامٌ عن مشاركة، ولا للمشرف كتلةُ «أرقام الطلاب».
 *
 * ويُقبَل نوعان، ويُعرَفان من الرابط نفسِه فلا يُضبَط شيءٌ آخَر:
 *   • **عاملُ Cloudflare** (`server/worker.js`) — أسرعُ وأقوى، ويحتاج طرفيّةً.
 *   • **جدولُ جوجل** (`server/جوجل-شيت/الكود.gs`) — رابطُه ينتهي بـ`/exec`،
 *     لا يحتاج إلا نسخاً ولصقاً، والبياناتُ تنزل في جدولٍ يُفتَح من الجوّال.
 */
export const SERVER = '';

/** جدولُ جوجل يُعرَف برابطه، ويختلف عن العامل في مسارِ الطلب وشكلِ جسمه. */
const isSheet = () => /script\.google\.com/.test(SERVER);

const KEY = 'awqaf-prep/sync';

const EMPTY = {
  device: null,   // UUID يُولَّد عند أوّلِ إرسال
  on: null,       // لم يُسأل بعدُ — والإرسالُ لا يقع حتى يقول «نعم» صريحاً
  queue: [],      // ما لم يصل بعدُ: [{ id, score, at }]
  sentAt: 0,
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

let cache = read();

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch { /* التخزين ممتلئ — الإحصاء أهونُ ما يُضحَّى به */ }
}

/** أمفعَّلٌ أصلاً؟ لا خادمَ ⇐ لا شيءَ من هذا الباب يُعرَض ولا يُذكَر. */
export const available = () => !!SERVER;

/**
 * المشاركةُ **بالطلبِ لا بالسكوت** — `on !== false` كانت تُشغِّلها بالسكوت.
 *
 * وكان الوصفُ في رأسِ هذا الملفِّ يقول «وإن أذِن الطالب»، والمبدأُ المكتوبُ
 * في `EMPTY` يقول `on: true`. فالإذنُ مُدَّعىً لا مأخوذ.
 *
 * وليس عَطَبُه اليومَ ظاهراً لأنّ `SERVER` فارغٌ فلا إرسالَ ولا بطاقةَ ولا
 * سؤال. لكنّه فخٌّ منصوب: يومَ يُنشَر الخادمُ ويُملأ `SERVER`، يصل التحديثُ
 * إلى كلِّ جهازٍ نُصِّب التطبيقُ فيه، فيجد `on` غيرَ `false` — إذ لم يُسأل
 * صاحبُه قطُّ — فيبدأ الإرسالُ من أوّلِ إقلاعٍ عن أناسٍ لم يُستأذَنوا. وهذا
 * لا يُصلَح يومَه: الطابورُ يكون قد سار.
 *
 * فصارت الحالةُ ثلاثاً لا اثنتَين: `null` لم يُسأل، و`true` أذِن، و`false`
 * منع. والإرسالُ في `true` وحدَها.
 */
export const enabled = () => available() && cache.on === true;

/** أسُئل الطالبُ فأجاب؟ تُعرَض له البطاقةُ سؤالاً ما دام لم يُجِب. */
export const decided = () => cache.on === true || cache.on === false;

export function setEnabled(on) {
  cache.on = !!on;
  if (!on) cache.queue = [];   // أطفأها فلا يبقى في جهازه طابورٌ ينتظر
  write();
}

/** لا يُولَّد المعرِّفُ إلا عند أوّلِ إرسالٍ فعليّ — لا لمجرّدِ فتحِ التطبيق. */
function deviceId() {
  if (!cache.device) {
    cache.device = (crypto.randomUUID ? crypto.randomUUID()
      : `${Date.now().toString(16)}-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      }));
    write();
  }
  return cache.device;
}

/**
 * تُقيَّد الإجابةُ في طابورٍ محلّيٍّ ثمّ تُرسَل الدفعةُ جملةً.
 *
 * لا تُرسَل كلُّ إجابةٍ وحدَها: الطالبُ في المسجدِ على شبكةٍ ضعيفة، وطلبٌ لكلِّ
 * سؤالٍ يستنزفها ويُبطئ الجلسة. والطابورُ محفوظٌ فلا يضيع بإغلاق التطبيق.
 */
/**
 * دقّةُ الوقتِ المُرسَل — ساعةٌ لا مللي.
 *
 * وكان يُرسَل `Date.now()` بدقّةِ المللي لكلِّ إجابة، ويُخزَّن عند الخادمِ
 * أبداً. ولا استعلامَ واحدٌ في `/stats` يستعمل أدقَّ من اليوم: النافذةُ
 * سبعةُ أيّامٍ على `devices.last`، وأصعبُ الأسئلةِ متوسّطٌ بلا زمن.
 *
 * ودقّةُ المللي ليست بلا ثمن: تتابعُ الطوابعِ في دفعةٍ واحدةٍ يرسم **إيقاعَ
 * جلسةِ الطالب** — متى بدأ، وكم أطالَ في كلِّ سؤال، وأينَ توقّف. وذاك أدلُّ
 * عليه من كثيرٍ ممّا يُتحرَّز منه، ويُجمَع تحت معرِّفٍ واحدٍ فيصير سِمةً.
 *
 * فيُقرَّب إلى الساعة: يكفي كلَّ ما يُسأل عنه اليوم، ولا يبقى فيه إيقاع.
 */
const HOUR = 3_600_000;

export function record(question, score) {
  if (!enabled()) return;
  cache.queue.push({ id: question.id, score, at: Math.floor(Date.now() / HOUR) * HOUR });
  if (cache.queue.length > 2000) cache.queue = cache.queue.slice(-2000);
  write();
}

/**
 * يُفرِغ الطابور. يُنادى عند ختم الجلسة وعند إقلاع التطبيق — لا في أثناء السؤال.
 * ولا يُرمى منه خطأ: فشلُ الإرسالِ يُبقي الطابورَ ويُعيد `false` لا غير.
 */
export async function flush(track) {
  if (!enabled() || !cache.queue.length || !navigator.onLine) return false;

  const batch = cache.queue.slice(0, 500);
  const payload = JSON.stringify({ device: deviceId(), track, answers: batch });
  try {
    // جدولُ جوجل لا يُجيب فحصَ CORS المسبق، والفحصُ يُطلَب لأيِّ نوعٍ غيرِ
    // `text/plain`. فيُرسَل إليه نصّاً بسيطاً — وهو يُحوّله إلى JSON عنده.
    const res = await fetch(isSheet() ? SERVER : `${SERVER}/answers`, {
      method: 'POST',
      headers: { 'content-type': isSheet() ? 'text/plain;charset=utf-8' : 'application/json' },
      body: payload,
      keepalive: true,
    });
    if (!res.ok) return false;

    /*
     * ── جدولُ جوجل يُجيب ٢٠٠ عن كلِّ شيء، فالحالةُ وحدَها لا تكفي ──────────
     *
     * `ContentService` في Apps Script لا يملك ضبطَ رمزِ الحالة: كلُّ ردٍّ ٢٠٠،
     * والخطأُ يُقال في **جسمِ** الرد `{ error: … }`. وكان الفحصُ ههنا `res.ok`
     * وحدَه، فدفعةٌ رُدَّت كلُّها — «مسار غير معروف»، «دفعة غير صالحة»، «خطأ في
     * الخادم» — تُعَدُّ واصلةً فتُحذَف من الطابور.
     *
     * فتضيع إجاباتُ الطالبِ صامتةً: لا هي عند الخادمِ ولا هي في جهازه. وهو
     * أسوأُ من انقطاعِ الشبكةِ لأنّ الانقطاعَ يُبقي الطابورَ فيصل لاحقاً.
     *
     * ويُقرَأ الجسمُ في الحالَين لا في حالِ الجدولِ وحدَها: العاملُ يُرجِع
     * رموزَ حالةٍ صحيحةً، لكنّ قراءةَ الجسمِ لا تضرُّ وتصونُ إن تبدَّل.
     */
    let body = null;
    try { body = await res.json(); } catch { /* ردٌّ ليس JSON — يُعامَل كنجاح */ }
    if (body && body.error) return false;

    cache.queue = cache.queue.slice(batch.length);
    cache.sentAt = Date.now();
    write();
    return true;
  } catch {
    return false;   // الشبكةُ سقطت — يبقى الطابورُ إلى المرّة القادمة
  }
}

/** ما لم يصلْ بعدُ — يُعرَض للطالب في «حسابي» فيعرف ما في جهازه. */
export const pending = () => cache.queue.length;

/** يُنسى الجهازُ كلَّه: يُمحى المعرِّفُ والطابور. لا يُمحى ما وصل الخادمَ. */
export function reset() {
  cache = { ...EMPTY };
  try {
    localStorage.removeItem(KEY);
  } catch { /* لا شيء */ }
}

/** أرقامُ الطلاب المجمَّعة — للمشرف وحدَه، بمفتاحه. */
export async function stats(adminKey) {
  if (!SERVER) throw new Error('لا خادمَ منشور');
  // ترويساتُ HTTP لاتينيّةٌ لا تحمل حرفاً عربياً، فمفتاحٌ عربيٌّ يُسقِط `fetch`
  // بخطأٍ غامض. يُقال ذلك صراحةً قبل الإرسال.
  if (!/^[\x20-\x7e]+$/.test(adminKey || '')) {
    throw new Error('المفتاح يكون بحروفٍ وأرقامٍ لاتينية، لا عربية');
  }
  // الجدولُ يأخذ المفتاحَ في الرابط (ترويساتُه لا تصل عبر إعادةِ التوجيه)،
  // والعاملُ يأخذه في ترويسةٍ فلا يُسجَّل في سجلّاتِ الوسائط.
  const res = await (isSheet()
    ? fetch(`${SERVER}?key=${encodeURIComponent(adminKey)}`)
    : fetch(`${SERVER}/stats`, { headers: { 'x-admin-key': adminKey } }));
  if (res.ok) {
    const d = await res.json();
    if (d && d.error) throw new Error(d.error);
    return d;
  }
  if (res.status === 401) throw new Error('المفتاح غير صحيح');
  throw new Error('تعذّر الوصول إلى الخادم');
}
