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
