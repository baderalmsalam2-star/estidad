// تقدّم الطالب — محليٌّ على الجهاز وحده. لا حساب، ولا خادم، ولا بيانات شخصية.

import * as sync from './sync.js';
import * as audio from './audio.js';

const KEY = 'awqaf-prep/v1';

/**
 * الحالُ الفارغةُ **دالّةٌ لا كائنٌ واحد**.
 *
 * وكان كائناً واحداً يُنسَخ بـ`{ ...EMPTY }`، والنسخُ سطحيّ: فالحقولُ التي
 * قيمتُها كائنٌ — `answers` و`days` و`memorized` و`reviews` و`exams` — تبقى
 * **الكائنَ نفسَه** في النسخة. فطالبٌ لا مفتاحَ له في التخزين (أو مفتاحٌ من
 * نسخةٍ أقدمَ لا يحمل الحقلَ) تُكتَب زياداتُه في كائنِ `EMPTY` نفسِه، فيتلوَّث
 * «الفارغ» — و`reset()` بعدَه يُرجِع حالاً فيها بقايا.
 *
 * فتُبنى جديدةً كلَّ مرّة، ولا يُشارَك كائنٌ بين حالٍ وحال.
 */
const empty = () => ({
  track: null,
  // id السؤال → { score: 0..1, at: طابع زمني, type }
  answers: {},
  /*
   * «يوم → كم سؤالاً أُجيب فيه» — سجلٌّ يُزاد ولا يُنقَض.
   *
   * وكان الوِردُ والسلسلةُ يُشتقّانِ من طوابعِ `answers[].at` وحدَها، وكُتِب
   * ههنا أنّ ذلك أنقى: «لا سجلَّ زائداً يُحفَظ». وهو خطأٌ في الاشتقاق، لأنّ
   * `answers` **خريطةٌ** مفتاحُها رقمُ السؤال، فالإجابةُ الثانيةُ على سؤالٍ
   * تكتب فوقَ الأولى وتنقل طابعَها إلى اليوم.
   *
   * فطالبٌ ذاكرَ أمسِ عشرةَ أسئلةٍ ثمّ راجعها اليومَ في «راجع أخطاءك»: انتقلت
   * طوابعُها كلُّها إلى اليوم، فصار أمسِ يوماً خالياً — فانقطعت سلسلةُ
   * مواظبتِه، وتبدّل شريطُ أسبوعِه، **بأنّه ذاكر أكثر**. وهذا أسوأُ ما يفعله
   * عدّادُ مواظبةٍ: يعاقب على المواظبة.
   *
   * والعددُ ههنا عددُ **إجاباتٍ** لا أسئلةٍ مختلفة، وهو الصحيحُ لوِردٍ يوميّ:
   * من أجاب عشرين مرّةً اليومَ فقد بلغ وِردَه، أعادَ أم استجدّ.
   */
  days: {},
  // آخر موضعٍ في الدراسة، ليعمل زرّ «تابِع من حيث وقفت»
  resume: null,
  // بطاقات حُفِظت
  memorized: {},
  exams: [],
  // قرارات اعتماد التوثيق — للمراجع لا للطالب
  reviews: {},
  // وِرد اليوم: كم سؤالاً يلتزمه الطالب يومياً
  dailyGoal: 20,
  // مقاسُ الخطّ: ١ هو الأصل، وما فوقه تكبيرٌ يختاره الطالب
  textScale: 1,
  // وقتُ تنبيه الوِرد «HH:MM» — يُحفَظ ليُعرَض، والتنبيهُ نفسُه في تقويم الجهاز
  reminderAt: null,
});

/**
 * ما في `localStorage` ليس ممّا يُوثَق بنوعِه.
 *
 * وكان `{ ...empty(), ...JSON.parse(raw) }` يقبل ما وجد كما وجده: فإن كان
 * `answers` نصّاً — من نسخةٍ أقدم، أو تحريرٍ بيدٍ في أدواتِ المتصفّح، أو كتابةٍ
 * انقطعت في نصفها — سقطَ كلُّ ما يمرُّ عليه (`Object.values(cache.answers)`)،
 * وإن كان `dailyGoal` نصّاً غيرَ رقميٍّ خرجت `NaN` إلى الشاشةِ فقُرِئت
 * «NaN / ٢٠» ووقفَ الشريطُ بعرضٍ `NaN%`.
 *
 * والأسوأُ أنّه لا مخرجَ منه: العَطَبُ في التخزينِ فيعود مع كلِّ فتحة.
 *
 * فيُفحَص كلُّ حقلٍ على نوعه، وما خالفَ رُدَّ إلى أصلِه بلا ضجّة. ولا يُمحى
 * الباقي لأجلِ حقلٍ فسد: الطالبُ يحتفظ بما صحَّ من تقدُّمه.
 */
function sane(raw) {
  const d = empty();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;

  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
  const num = (v, min, max, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  if (typeof raw.track === 'string') d.track = raw.track;
  if (typeof raw.reminderAt === 'string' && /^\d{1,2}:\d{2}$/.test(raw.reminderAt)) {
    d.reminderAt = raw.reminderAt;
  }
  d.dailyGoal = num(raw.dailyGoal, 5, 100, 20);
  d.textScale = num(raw.textScale, 1, 2, 1);
  if (Array.isArray(raw.exams)) d.exams = raw.exams.filter((x) => obj(x)).slice(0, 20);
  if (obj(raw.resume)) d.resume = raw.resume;
  if (obj(raw.memorized)) d.memorized = obj(raw.memorized);
  if (obj(raw.reviews)) d.reviews = obj(raw.reviews);

  // الإجاباتُ أثقلُ ما فيه — يُفحَص كلُّ صفٍّ، ويُسقَط الفاسدُ وحدَه.
  const answers = obj(raw.answers);
  if (answers) {
    for (const [id, a] of Object.entries(answers)) {
      if (!obj(a)) continue;
      const score = Number(a.score);
      const at = Number(a.at);
      if (!Number.isFinite(score) || !Number.isFinite(at)) continue;
      d.answers[id] = {
        score: Math.min(1, Math.max(0, score)),
        at,
        subject: typeof a.subject === 'string' ? a.subject : undefined,
        type: typeof a.type === 'string' ? a.type : undefined,
      };
    }
  }

  const days = obj(raw.days);
  if (days) {
    for (const [k, n] of Object.entries(days)) {
      const v = Number(n);
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isFinite(v) && v > 0) d.days[k] = Math.round(v);
    }
  }
  return d;
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sane(JSON.parse(raw)) : empty();
  } catch {
    return empty();
  }
}

let cache = read();

/**
 * أخفقتِ الكتابةُ في هذه الجلسة؟ يُعرَض للطالبِ في الرئيسيةِ إن وقع.
 *
 * وكان الإخفاقُ يُبتلَع صامتاً: يُذاكِر الإمامُ ساعةً في تصفُّحٍ خاصٍّ أو على
 * تخزينٍ ممتلئ، ثمّ يُغلِق التطبيقَ فيجد كلَّ شيءٍ كما تركه أوّلَ مرّة — ولا
 * سطرَ واحدٌ قال له إنّ شيئاً لا يُحفَظ. فلا يُلام على ظنِّه أنّ التطبيقَ أكلَ
 * عملَه. والصمتُ ههنا أسوأُ من الخلل.
 */
let writeFailed = false;
export const storageBroken = () => writeFailed;

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
    writeFailed = false;
  } catch {
    // التخزين ممتلئ أو محجوب — يُرفَع العلمُ وتُخبِر به الرئيسية.
    writeFailed = true;
  }
}

export const get = () => cache;

export function setTrack(track) {
  cache.track = track;
  write();
}

/** score من ٠ إلى ١ — للمقاليّ نسبةُ النقاط التي أشّر عليها، وللموضوعيّ ٠ أو ١. */
export function record(question, score) {
  const s = Math.max(0, Math.min(1, score));
  const now = Date.now();
  cache.answers[question.id] = {
    score: s,
    at: now,
    subject: question.subject,
    type: question.type,
  };
  // يُقيَّد اليومُ في سجلِّه قبلَ الكتابة — فإعادةُ سؤالٍ تزيد اليومَ ولا تنقل
  // ماضياً. (الشرحُ عند `days` في `empty`.)
  const k = dayKey(now);
  cache.days[k] = (cache.days[k] || 0) + 1;
  write();
  // يُقيَّد في طابورٍ محلّيٍّ لا يُرسَل الآن — والإرسالُ لا يُؤثّر في شيءٍ ههنا.
  sync.record(question, s);
}

export function scoreOf(id) {
  return cache.answers[id]?.score ?? null;
}

export const seenCount = () => Object.keys(cache.answers).length;

/**
 * مقاسُ الخطّ — **خيارٌ لا أصل**: الأصلُ يبقى كما صُمِّم، ومن احتاج كبَّر.
 *
 * وكثيرٌ من الأئمة كبارُ سنّ، والقياساتُ في التطبيق كلُّها بالبكسل فلا تتبع
 * مقاسَ خطِّ النظام. فيُكبَّر اللوحُ كلُّه — الحروفُ والأزرارُ ومواضعُ اللمس
 * معاً — لا الحروفُ وحدَها، وإلا ضاقت الأزرارُ عمّا فيها.
 */
export const textScale = () => cache.textScale || 1;

export function setTextScale(v) {
  cache.textScale = v;
  write();
  applyTextScale();
}

/** يُنادى عند الإقلاع وعند كلِّ تبديل. */
export function applyTextScale() {
  try {
    document.body.dataset.text = String(textScale());
  } catch { /* لا مستندَ — في فحصٍ خارج المتصفّح */ }
}

export const reminderAt = () => cache.reminderAt;

export function setReminderAt(hhmm) {
  cache.reminderAt = hhmm || null;
  write();
}

export function setResume(resume) {
  cache.resume = resume;
  write();
}

export function saveExam(result) {
  cache.exams.unshift(result);
  cache.exams = cache.exams.slice(0, 20);
  write();
}

export function toggleMemorized(id) {
  if (cache.memorized[id]) delete cache.memorized[id];
  else cache.memorized[id] = Date.now();
  write();
  return !!cache.memorized[id];
}

export const isMemorized = (id) => !!cache.memorized[id];

/** ما أخطأ فيه الطالب أو قصّر: أقلّ من ٧٠٪ — هذه مادة «مراجعة الأخطاء». */
export function mistakes(questions) {
  return questions.filter((q) => {
    const a = cache.answers[q.id];
    return a && a.score < 0.7;
  });
}

/**
 * الحدُّ الفاصلُ بين الصوابِ والخطأ — سبعون في المائة، وهو حدٌّ **واحدٌ** في
 * التطبيق كلِّه: به يُعَدُّ السؤالُ صواباً فيخرج من دورةِ الأسئلة إلى صندوقِ
 * المراجعة، وبه يُعَدُّ خطأً فيُعاد على الطالب حتى يُصيبه.
 */
export const CORRECT = 0.7;

/** أصابه: فلا يُعرَض عليه في جلسةٍ تلقائيةٍ بعدُ، إلا أن يفتح صندوقَ المراجعة. */
export const isCorrect = (id) => (cache.answers[id]?.score ?? -1) >= CORRECT;

/** ما أصابه الطالبُ — مادّةُ «صندوق المراجعة»، الأحدثُ إصابةً أوّلاً. */
export function correctOnes(questions) {
  return questions
    .filter((q) => isCorrect(q.id))
    .sort((a, b) => (cache.answers[b.id]?.at || 0) - (cache.answers[a.id]?.at || 0));
}

/**
 * إتقانُ الأبواب — المقياسُ الذي يتحرَّك.
 *
 * كان التقدّمُ يُقاس بـ«كم سؤالاً من أربعة آلافٍ»، فيبقى الطالبُ على الصفرِ
 * أسبوعاً كاملاً وهو مجتهد. والأبوابُ نحوٌ من مائةٍ وخمسين، فجلسةٌ واحدةٌ
 * تُقلِّب باباً من «قيدَ الدرس» إلى «مُتقَن» — رقمٌ يراه في يومه.
 *
 * والبابُ متقَنٌ إذا أُصيب ثلثا أسئلته، لا كلُّها: اشتراطُ الكلِّ في بابٍ فيه
 * مائةُ سؤالٍ يجعل الإتقانَ بعيداً كبُعدِ المقياسِ الأوّل.
 */
export function chapters(questions) {
  const map = new Map();
  for (const q of questions) {
    const key = `${q.subject}|${q.topic || 'عامّ'}`;
    if (!map.has(key)) map.set(key, { subject: q.subject, topic: q.topic || 'عامّ', total: 0, done: 0, good: 0 });
    const c = map.get(key);
    c.total += 1;
    const a = cache.answers[q.id];
    if (a) {
      c.done += 1;
      if (a.score >= CORRECT) c.good += 1;
    }
  }
  const list = [...map.values()].map((c) => ({ ...c, ratio: c.total ? c.good / c.total : 0 }));
  const mastered = list.filter((c) => c.ratio >= 2 / 3).length;
  const started = list.filter((c) => c.done > 0 && c.ratio < 2 / 3).length;
  return { list, mastered, started, total: list.length, pct: list.length ? mastered / list.length : 0 };
}

/* ── النقاط والرُّتَب ────────────────────────────────────────────────── */

/**
 * النقاطُ مشتقّةٌ من الإجاباتِ نفسِها ومن السلسلة، لا تُخزَّن في حقلٍ مستقلّ —
 * فلا تنكسر إن تغيّر شكلُ التخزين، ولا تُزوَّر بتحريرِ رقمٍ واحد.
 * عشرُ نقاطٍ للسؤالِ المتقَن، وما دونه بحسابِ درجته، وخمسٌ لكلِّ يومٍ مُتَّصل.
 */
export function points() {
  let n = 0;
  for (const a of Object.values(cache.answers)) n += Math.round(10 * (a?.score ?? 0));
  return n + daily().streak * 5;
}

/**
 * الرُّتَبُ أوصافُ اجتهادٍ في الطلب، لا ألقابَ علمٍ ولا إجازاتٍ شرعية —
 * كي لا يُفهَم من التطبيق تزكيةٌ لا يملكها.
 */
const RANKS = [
  { at: 0, name: 'مبتدئ' },
  { at: 200, name: 'مُتعلِّم' },
  { at: 600, name: 'طالبُ علمٍ' },
  { at: 1200, name: 'مُلازِم' },
  { at: 2500, name: 'ضابِط' },
  { at: 5000, name: 'مُتقِن' },
  { at: 9000, name: 'مُبرِّز' },
];

export function rank(p = points()) {
  let i = 0;
  while (i + 1 < RANKS.length && p >= RANKS[i + 1].at) i += 1;
  const cur = RANKS[i];
  const next = RANKS[i + 1] || null;
  return {
    points: p,
    name: cur.name,
    level: i + 1,
    levels: RANKS.length,
    next: next ? next.name : null,
    toNext: next ? next.at - p : 0,
    pct: next ? Math.min(1, (p - cur.at) / (next.at - cur.at)) : 1,
  };
}

/** نسبة الإتقان لكل علم — تُستخدم في الرئيسية وفي تحليل النتيجة. */
export function bySubject(questions) {
  const map = new Map();
  for (const q of questions) {
    if (!map.has(q.subject)) map.set(q.subject, { subject: q.subject, total: 0, done: 0, sum: 0 });
    const s = map.get(q.subject);
    s.total += 1;
    const a = cache.answers[q.id];
    if (a) {
      s.done += 1;
      s.sum += a.score;
    }
  }
  return [...map.values()].map((s) => ({ ...s, mastery: s.done ? s.sum / s.done : 0 }));
}

/* ── وِرد اليوم وسلسلة المواظبة ──────────────────────────────────────── */

/**
 * الاختبار موعدٌ لا يُؤجَّل، والمذاكرة على دفعاتٍ يوميةٍ أنفعُ من جلسةٍ واحدةٍ
 * طويلة. والسلسلةُ كلُّها مُشتَقّةٌ من طوابع `answers[].at` — لا سجلَّ زائداً
 * يُحفَظ، فلا شيءَ يفسد إن تغيّر شكلُ التخزين.
 */
const dayKey = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const dailyGoal = () => Math.max(5, cache.dailyGoal || 20);

export function setDailyGoal(n) {
  cache.dailyGoal = Math.max(5, Math.min(100, Math.round(n)));
  write();
  return cache.dailyGoal;
}

/**
 * تُقرَأ الأيّامُ من سجلِّها. ولمن كان عنده تقدُّمٌ قبلَ وجودِ السجلِّ يُبنى
 * مرّةً واحدةً من طوابعِ `answers` — وهو أحسنُ ما يُستخرَج منها، وإن كان قد
 * فقدَ ما نُقِل من الطوابعِ قبلَ اليوم. فالبديلُ أن يستقبلَ الطالبُ التحديثَ
 * بسلسلةٍ صفراً وشريطٍ خالٍ، وذاك أسوأُ من نقصٍ في ماضٍ لا يُسترَدّ.
 */
function backfillDays() {
  if (cache.days && Object.keys(cache.days).length) return;
  if (!cache.answers || !Object.keys(cache.answers).length) return;
  const seeded = {};
  for (const a of Object.values(cache.answers)) {
    if (!a || !a.at) continue;
    const k = dayKey(a.at);
    seeded[k] = (seeded[k] || 0) + 1;
  }
  cache.days = seeded;
  write();
}

function countsByDay() {
  backfillDays();
  const map = new Map();
  for (const [k, n] of Object.entries(cache.days || {})) {
    if (Number.isFinite(n) && n > 0) map.set(k, n);
  }
  return map;
}

/**
 * `{ today, goal, streak, week }`.
 * السلسلة تُعَدُّ رجوعاً من اليوم، فإن لم يُذاكِر اليوم بَعدُ بُدئ من أمسِ —
 * وإلا انقطعت سلسلةُ من يفتح التطبيق صباحاً قبل أن يبدأ.
 */
export function daily() {
  const counts = countsByDay();
  const now = new Date();
  const at = (back) => {
    const d = new Date(now);
    d.setDate(d.getDate() - back);
    return { key: dayKey(d), date: d, count: counts.get(dayKey(d)) || 0 };
  };

  const today = at(0).count;
  let streak = 0;
  for (let back = today > 0 ? 0 : 1; back < 400; back += 1) {
    if (at(back).count > 0) streak += 1;
    else break;
  }

  // اليومُ أوّلُ الشريط، فيقع في اليمين — وتمتدُّ الأيامُ الماضيةُ عنه شمالاً،
  // كما تُقرأ العربية. وكان أوّلُه أقدمَ الأيام فيقع اليومُ في أقصى اليسار.
  const week = [];
  for (let back = 0; back <= 6; back += 1) week.push(at(back));

  return { today, goal: dailyGoal(), streak, week };
}

/* ── اعتماد التوثيق ─────────────────────────────────────────────────── */

export function setReview(id, status, page) {
  cache.reviews[id] = { status, page, at: Date.now() };
  write();
}

export const reviewOf = (id) => cache.reviews[id]?.status || null;
export const allReviews = () => cache.reviews;

export function reset() {
  cache = empty();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* لا شيء */
  }
  // مسحُ التقدُّم يمحو معرِّفَ الجهاز أيضاً، فيُولَّد غيرُه ولا يوصَل بالقديم.
  sync.reset();
  // ومفتاحُ خادمِ الإحصاء — إن كان صاحبُ التطبيقِ فتح اللوحةَ في هذا الجهاز.
  // «امسح تقدّمي» يُفهَم محواً لكلِّ ما تركه المستعملُ، والمفتاحُ أخطرُه.
  for (const store of [globalThis.localStorage, globalThis.sessionStorage]) {
    try { store?.removeItem('awqaf-prep/adminKey'); } catch { /* لا شيء */ }
  }
  // وتسجيلاتُ التسميعِ في IndexedDB لا في localStorage، فلا يمحوها ما سبق —
  // وهي صوتُ الطالبِ نفسِه، وأولى ما يُمحى إذا قال «امسح تقدّمي».
  return audio.wipe();
}
