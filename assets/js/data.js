// تحميل بنوك الأسئلة والمنهج، وبناء الفهارس التي تعتمد عليها الشاشات.

const BANK_FILES = [
  '00_verified_fiqh.json',
  '01_tajweed.json',
  '02_hadeeth.json',
  '03_tafseer.json',
  '04_aqeedah.json',
  '05_fiqh_muamalat.json',
  '06_nahw.json',
  '07_meethaq.json',
  '08_fiqh_janaiz.json',
  '09_generated_fiqh.json',
  '10_generated_meethaq.json',
  '11_generated_tajweed.json',
  '12_generated_aqeedah.json',
];

// الكتاب المقرَّر لكل علم — مصدره حقل `book` في البنوك و`sourceBooks` في المنيفست.
export const BOOK_OF_SUBJECT = {
  'الفقه':        { title: 'دليل الطالب لنيل المطالب', note: 'الفقه على المذهب الحنبليّ', pages: 396 },
  'التجويد':      { title: 'غاية المريد في علم التجويد', note: 'عطية قابل نصر', pages: 304 },
  'الحديث':       { title: 'الأربعون النووية بالشرح', note: 'متناً وشرحاً', pages: null },
  'التفسير':      { title: 'زبدة التفسير', note: 'جزء عمّ — ص٥٥٥ إلى ٦٠٤', pages: 609 },
  'العقيدة':      { title: 'بريق الجمان', note: 'العقيدة والتوحيد', pages: 283 },
  'النحو':        { title: 'التحفة السنية', note: 'شرح المقدمة الآجرومية', pages: 183 },
  'ميثاق المسجد': { title: 'ميثاق المسجد', note: 'الوثيقة الرسمية — قطاع المساجد', pages: null },
};

// توزيع الاختبار الشامل، منقولٌ من ورقة اختبارٍ فعلية (README §٩).
export const EXAM_BLUEPRINT = [
  { subject: 'الفقه', count: 10 },
  { subject: 'العقيدة', count: 5 },
  { subject: 'الحديث', count: 5 },
  { subject: 'التفسير', count: 4 },
  { subject: 'التجويد', count: 4 },
  { subject: 'ميثاق المسجد', count: 3 },
  { subject: 'النحو', count: 3 },
];

const state = {
  manifest: null,
  questions: [],
  byId: new Map(),
  tajweed: null,
  hints: {},        // ترشيحات الصفحات — مُرشِّحٌ لا حَكَم
  pageIndex: {},    // أي صفحةٍ رُسمت صورتُها
  bookLinks: {},    // مراجع الكتب غير المرفوعة
};

// العلم → مُعرِّف كتابه في books/
export const BOOK_ID = {
  'الفقه': 'daleel-altalib', 'التجويد': 'ghayat-almureed',
  'النحو': 'tuhfa-saniyya', 'ميثاق المسجد': 'meethaq-almasjid',
  'العقيدة': 'bareeq-aljuman', 'التفسير': 'zubdat-altafseer',
};

const AR2EN = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };

/** «ص٢٨-٣١» → 28. أول صفحةٍ في الاستشهاد هي التي تُفتَح. */
export function firstPageOf(label) {
  const m = String(label || '').replace(/[٠-٩]/g, (d) => AR2EN[d]).match(/\d+/);
  return m ? +m[0] : null;
}

/**
 * أين يذهب الطالب من هذا السؤال؟
 * `verified` يعني أن الصفحة قوبِلت حرفاً بحرف؛ وإلا فهي ترشيحُ بحثٍ آليّ.
 */
export function pageRefOf(q) {
  const book = BOOK_ID[q.subject];
  if (!book) return null;
  if (q.bookPage) {
    const page = firstPageOf(q.bookPage);
    return page && { book, page, label: q.bookPage, verified: true, hasImage: hasImage(book, page) };
  }
  const h = state.hints[q.id];
  return h && { book: h.book, page: h.page, label: `ص${h.page}`, verified: false,
                confidence: h.confidence, countWord: h.countWord, countAgrees: h.countAgrees,
                hasImage: hasImage(h.book, h.page) };
}

const hasImage = (book, page) => !!state.pageIndex[book]?.pages?.includes(page);
export const bookPageCount = (book) => state.pageIndex[book]?.count || null;
/** مرجعُ الكتاب الرسميّ — يُعرَض حين لا يكون مرفوعاً داخل التطبيق. */
export const bookLink = (book) => state.bookLinks[book] || null;
export const allBookLinks = () => state.bookLinks;

async function getJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`تعذّر تحميل ${path} (${res.status})`);
  return res.json();
}

/** يحمّل المنيفست وكل بنوك الأسئلة مرةً واحدة. */
export async function load() {
  if (state.manifest) return state;

  const [manifest, hints, pageIndex, bookLinks, ...banks] = await Promise.all([
    getJSON('data/manifest.json'),
    getJSON('data/page-hints.json').catch(() => ({})),
    getJSON('books/pages-index.json').catch(() => ({})),
    getJSON('data/book-links.json').catch(() => ({})),
    ...BANK_FILES.map((f) => getJSON(`data/banks/${f}`)),
  ]);

  state.manifest = manifest;
  state.hints = hints;
  state.pageIndex = pageIndex;
  state.bookLinks = bookLinks;

  banks.forEach((bank, i) => {
    const file = BANK_FILES[i];
    for (const q of bank.questions || []) {
      // بعض البنوك تضع العلم على مستوى البنك لا على مستوى السؤال.
      const subject = q.subject || bank.subject;
      const item = { ...q, subject, bank: file, book: bank.book || null };
      state.questions.push(item);
      state.byId.set(item.id, item);
    }
  });

  return state;
}

export const manifest = () => state.manifest;
export const allQuestions = () => state.questions;
export const questionById = (id) => state.byId.get(id) || null;

/** أحكام التجويد ثقيلة (نحو ٩٠٠ ك.ب) فلا تُحمَّل إلا عند دخول شاشاتها. */
export async function loadTajweed() {
  if (!state.tajweed) state.tajweed = await getJSON('data/tajweed/juz-amma-rulings.json');
  return state.tajweed;
}

/* ── الفلترة على المسار ──────────────────────────────────────────────── */

/** أساس كل شيء: لا يرى الطالب إلا ما يخصّ مساره. */
export function forTrack(track) {
  return state.questions.filter((q) => (q.tracks || []).includes(track));
}

export function subjectsOf(track) {
  const map = new Map();
  for (const q of forTrack(track)) {
    if (!map.has(q.subject)) map.set(q.subject, { subject: q.subject, total: 0, topics: new Map() });
    const s = map.get(q.subject);
    s.total += 1;
    const topic = q.topic || 'عامّ';
    s.topics.set(topic, (s.topics.get(topic) || 0) + 1);
  }
  // الترتيب على حجم البنك — الفقه أولاً كما في ورقة الاختبار.
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function questionsIn(track, subject, topic = null) {
  return forTrack(track).filter(
    (q) => q.subject === subject && (topic === null || (q.topic || 'عامّ') === topic),
  );
}

/* ── اختيار أسئلة الاختبار ───────────────────────────────────────────── */

/**
 * `frequency` و`verified` حقلان داخليّان لا يُعرَضان للطالب أبداً (README §٥.١)،
 * وفائدتهما الوحيدة ترجيحُ الاختيار هنا: ما تكرّر في الاختبارات الفعلية أولى بالظهور.
 */
function weightOf(q) {
  return 1 + (q.frequency || 1) - 1 + (q.verified ? 1.5 : 0);
}

function weightedSample(pool, n, rand) {
  const items = [...pool];
  const picked = [];
  while (picked.length < n && items.length) {
    const weights = items.map(weightOf);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let idx = 0;
    while (idx < items.length - 1 && (r -= weights[idx]) > 0) idx += 1;
    picked.push(items.splice(idx, 1)[0]);
  }
  return picked;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** اختبارٌ شاملٌ محاكٍ لورقة الاختبار: ٣٤ سؤالاً بالتوزيع المعتمد. */
export function buildFullExam(track, seed = Date.now()) {
  const rand = mulberry32(seed);
  const out = [];
  for (const { subject, count } of EXAM_BLUEPRINT) {
    const pool = questionsIn(track, subject);
    if (!pool.length) continue; // المتقاعدون مثلاً بلا تجويدٍ ولا حديث
    out.push(...weightedSample(pool, Math.min(count, pool.length), rand));
  }
  return out;
}

/** اختبارٌ مخصّص: الطالب يختار العلوم والعدد والصعوبة والنوع. */
export function buildCustomExam(track, { subjects = [], count = 15, difficulty = null, types = null } = {}) {
  let pool = forTrack(track);
  if (subjects.length) pool = pool.filter((q) => subjects.includes(q.subject));
  if (difficulty) pool = pool.filter((q) => q.difficulty === difficulty);
  if (types && types.length) pool = pool.filter((q) => types.includes(q.type));
  return weightedSample(pool, Math.min(count, pool.length), mulberry32(Date.now()));
}

/**
 * وِردُ اليوم — جلسةٌ قصيرةٌ يُلزِمها الطالبُ نفسَه كلَّ يوم.
 *
 * ثلثُها ممّا أخطأ فيه (فالخطأ أحقُّ بالمراجعة من الجديد)، وبقيّتُها ممّا لم
 * يمرَّ عليه بعدُ. ثمّ تُوزَّع على العلوم بالتناوب حتى لا يقع الوِرد كلُّه في
 * علمٍ واحد. والبذرة يومُ التقويم نفسُه، فالوِردُ ثابتٌ ما دام اليومُ قائماً
 * ولو أغلق التطبيقَ وعاد.
 *
 * `scoreOf` تُمرَّر من store لئلّا يعتمد data على حالة الطالب.
 */
export function buildWird(track, n, scoreOf) {
  const pool = forTrack(track);
  const weak = pool
    .filter((q) => { const s = scoreOf(q.id); return s !== null && s < 0.7; })
    .sort((a, b) => scoreOf(a.id) - scoreOf(b.id));
  const fresh = pool.filter((q) => scoreOf(q.id) === null);

  const rand = mulberry32(Math.floor(Date.now() / 86_400_000));
  const take = Math.min(weak.length, Math.floor(n / 3));
  const chosen = [
    ...weak.slice(0, take),
    ...weightedSample(fresh, Math.max(0, n - take), rand),
  ];

  // تناوبٌ على العلوم: أوّلُ كلِّ علمٍ، ثمّ ثانيه، وهكذا.
  const lanes = new Map();
  for (const q of chosen) {
    if (!lanes.has(q.subject)) lanes.set(q.subject, []);
    lanes.get(q.subject).push(q);
  }
  const out = [];
  const queues = [...lanes.values()];
  while (out.length < chosen.length) {
    for (const lane of queues) if (lane.length) out.push(lane.shift());
  }
  return out;
}

/* ── بطاقات الحفظ ────────────────────────────────────────────────────── */

/**
 * البطاقات للتعدادات: كل سؤالٍ إجابته قائمةٌ معدودة (شروط الصلاة تسعة…)
 * يصلح بطاقةً. ونلتقطها من `keyPoints` حين تكون ثلاثاً فأكثر.
 */
export function flashcardsOf(track) {
  const NUMBER_WORDS = /\b(اثنان|ثلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة|عشرة|أحد عشر|خمسٌ|سبعٌ|تسعٌ|ثلاثٌ)\b/;
  return forTrack(track)
    .filter((q) => Array.isArray(q.keyPoints) && q.keyPoints.length >= 3)
    .map((q) => {
      // إن هُيكلت الإجابة (tools/هيكلة_الإجابات.py) فالعدد والبنود مفصولان
      // بيقين، فتُرقَّم البنود بأمان. وإلا فلا ترقيم.
      if (q.answer && Array.isArray(q.answer.items)) {
        return { q, count: q.answer.countWord, items: q.answer.items,
                 caveats: q.answer.caveats || [], numbered: true };
      }
      const first = q.keyPoints[0] || '';
      const countMatch = first.match(/^العدد[:：]\s*(.+)$/);
      const count = countMatch ? countMatch[1].trim() : (first.match(NUMBER_WORDS) || [])[0] || null;
      const items = countMatch ? q.keyPoints.slice(1) : q.keyPoints;
      return { q, count, items, caveats: [], numbered: false };
    })
    .filter((c) => c.items.length >= 3);
}

/* ── تصحيح الأنواع الموضوعية ─────────────────────────────────────────── */

/** تجريد التشكيل والتطويل وتوحيد الهمزات — لمطابقة إجابات نوع `fill`. */
export function normalizeArabic(s) {
  return String(s)
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^ء-ي\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function checkObjective(q, given) {
  if (q.type === 'mcq') return given === q.answer;
  if (q.type === 'truefalse') return given === q.answer;
  if (q.type === 'fill') {
    const norm = normalizeArabic(given);
    if (!norm) return false;
    return (Array.isArray(q.answer) ? q.answer : [q.answer]).some(
      (a) => normalizeArabic(a) === norm,
    );
  }
  return false;
}
