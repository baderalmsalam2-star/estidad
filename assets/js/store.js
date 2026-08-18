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

/** التقدّم في المنهج: كم سؤالاً من أسئلة المسار مرّ عليه الطالب. */
export function progress(questions) {
  const done = questions.filter((q) => cache.answers[q.id]).length;
  return { done, total: questions.length, pct: questions.length ? done / questions.length : 0 };
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

  const week = [];
  for (let back = 6; back >= 0; back -= 1) week.push(at(back));

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
