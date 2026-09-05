// إرسالُ الإجابات مجهولةً إلى خادم الإحصاء — إن وُجد، وإن أذِن الطالب.

/**
 * القاعدةُ الأولى ههنا: **لا يعتمد التطبيقُ على هذا الملفّ في شيء.**
 *
 * فإن لم يُنشَر خادمٌ (`SERVER` فارغ)، أو سقط، أو انقطعت الشبكة، أو أطفأ
 * الطالبُ المشاركة — عمل التطبيقُ كما هو ولم يرَ فرقاً. ولا يُنتظَر ردُّ
 * الخادمِ في مسارِ الإقلاع ولا في مسارِ الإجابة.
 *
 * والقاعدةُ الثانية: **لا يُرسَل عن الطالب شيءٌ يدلُّ عليه.** المعرِّفُ رقمٌ
 * عشوائيٌّ يولِّده الجهازُ لنفسه، ولا يُطلَب اسمٌ ولا هاتفٌ ولا بريد. وإن مسح
 * تقدُّمَه وُلِّد غيرُه فانقطع الوصلُ بالقديم.
 */

// عنوانُ الخادم بعد نشره (انظر `server/اقرأني.md`). وما دام فارغاً فلا إرسالَ
// أصلاً، ولا يظهر للطالب خيارٌ ولا كلامٌ عن مشاركة.
export const SERVER = '';

const KEY = 'awqaf-prep/sync';

const EMPTY = {
  device: null,   // UUID يُولَّد عند أوّلِ إرسال
  on: true,       // مشاركةُ الإحصاء — يُطفئها الطالب من «حسابي»
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

export const enabled = () => available() && cache.on !== false;

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
export function record(question, score) {
  if (!enabled()) return;
  cache.queue.push({ id: question.id, score, at: Date.now() });
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
  try {
    const res = await fetch(`${SERVER}/answers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device: deviceId(), track, answers: batch }),
      keepalive: true,
    });
    if (!res.ok) return false;
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
  const res = await fetch(`${SERVER}/stats`, { headers: { 'x-admin-key': adminKey } });
  if (res.status === 401) throw new Error('المفتاح غير صحيح');
  if (!res.ok) throw new Error('تعذّر الوصول إلى الخادم');
  return res.json();
}
