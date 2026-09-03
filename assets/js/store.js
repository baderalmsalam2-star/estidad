// تقدّم الطالب — محليٌّ على الجهاز وحده. لا حساب، ولا خادم، ولا بيانات شخصية.

const KEY = 'awqaf-prep/v1';

const EMPTY = {
  track: null,
  // id السؤال → { score: 0..1, at: طابع زمني, type }
  answers: {},
  // آخر موضعٍ في الدراسة، ليعمل زرّ «تابِع من حيث وقفت»
  resume: null,
  // بطاقات حُفِظت
  memorized: {},
  exams: [],
  // قرارات اعتماد التوثيق — للمراجع لا للطالب
  reviews: {},
  // وِرد اليوم: كم سؤالاً يلتزمه الطالب يومياً
  dailyGoal: 20,
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
  } catch {
    /* التخزين ممتلئ أو محجوب — التطبيق يظل يعمل بلا حفظ */
  }
}

export const get = () => cache;

export function setTrack(track) {
  cache.track = track;
  write();
}

/** score من ٠ إلى ١ — للمقاليّ نسبةُ النقاط التي أشّر عليها، وللموضوعيّ ٠ أو ١. */
export function record(question, score) {
  cache.answers[question.id] = {
    score: Math.max(0, Math.min(1, score)),
    at: Date.now(),
    subject: question.subject,
    type: question.type,
  };
  write();
}

export function scoreOf(id) {
  return cache.answers[id]?.score ?? null;
}

export const seenCount = () => Object.keys(cache.answers).length;

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

function countsByDay() {
  const map = new Map();
  for (const a of Object.values(cache.answers)) {
    if (!a || !a.at) continue;
    const k = dayKey(a.at);
    map.set(k, (map.get(k) || 0) + 1);
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
  cache = { ...EMPTY };
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* لا شيء */
  }
}
