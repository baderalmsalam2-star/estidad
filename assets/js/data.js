// تحميل بنوك الأسئلة والمنهج، وبناء الفهارس التي تعتمد عليها الشاشات.

// قائمة البنوك تُقرأ من `data/manifest.json` نفسِه، فلا تنفصل عنه إذا أُضيف بنكٌ جديد.

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
  missingBanks: [],  // بنوكٌ لم تصل في هذه الجلسة — تُعلَن للطالب لا تُكتَم
  pageIndex: {},    // أي صفحةٍ رُسمت صورتُها
  bookLinks: {},    // مراجع الكتب غير المرفوعة
  covers: {},       // الكتب التي رُسم غلافُها صورةً
};

// العلم → مُعرِّف كتابه في books/
export const BOOK_ID = {
  'الفقه': 'daleel-altalib', 'التجويد': 'ghayat-almureed',
  'النحو': 'tuhfa-saniyya', 'ميثاق المسجد': 'meethaq-almasjid',
  'العقيدة': 'bareeq-aljuman', 'التفسير': 'zubdat-altafseer',
};

const AR2EN = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
const EN2AR = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * الأرقامُ العربيةُ الهنديّة — قاعدةٌ في التطبيقِ كلِّه منصوصةٌ في `ui.js`:
 * «كل رقمٍ يظهر للطالب يُكتب بالأرقام العربية».
 *
 * وشارةُ الصفحةِ المُرشَّحةِ كانت تُبنى ههنا `ص${h.page}` فتخرج «ص20»
 * بأرقامٍ لاتينيّةٍ في سطرٍ عربيّ — وحدَها في التطبيق. ولا يُستورَد `ar` من
 * `ui.js` لأنّ `ui` يستورد `data` (دورة)، فتُكرَّر الدالّةُ ههنا بسطرٍ واحد.
 */
const arNum = (n) => String(n).replace(/\d/g, (d) => EN2AR[+d]);

/** «ص٢٨-٣١» → 28. أول صفحةٍ في الاستشهاد هي التي تُفتَح. */
export function firstPageOf(label) {
  const m = String(label || '').replace(/[٠-٩]/g, (d) => AR2EN[d]).match(/\d+/);
  return m ? +m[0] : null;
}

/**
 * درجةُ المقابلةِ — ثلاثٌ لا اثنتان.
 *
 * وكان `bookVerified` علماً واحداً (`true`/`false`) يحمل دعوتَين مختلفتَين:
 *
 *   • «قوبِلت على **صورةِ** الصفحة» — وهي الأوثق، وعليها ٣١٤٢ سؤالاً.
 *   • «قوبِلت على **نصٍّ** مستخرَجٍ بالـOCR» — و٤٦٦ سؤالٍ في العقيدةِ عليها،
 *     وكتابُها (بريق الجمان) **لا صورةَ صفحةٍ له في التطبيقِ أصلاً** — كما
 *     يقول `note` في بنكِه صريحاً. فالنصُّ قد يكون فيه خطأُ مسحٍ لم يُلحَظ.
 *
 * فكان التطبيقُ يطبع على الـ٤٦٦ «قوبِلت على الكتاب»، وهو أقوى ممّا وقع.
 * والطالبُ يتحرّى، فإن قيل له «قوبِلت» اعتمدَ ولم يُراجِع الأصل.
 *
 * و٤٤ سؤالاً مختومةٌ موثَّقةً بلا بيانِ مصدرٍ في البنك — لا تُرفَع إلى
 * الدرجةِ الأولى بالظنّ، فتُعَدُّ في «نصّ» لا في «صورة».
 *
 * والدرجةُ الثالثةُ لا مقابلةَ فيها: ترشيحُ بحثٍ آليٍّ من `page-hints`.
 */
const collationOf = (q) => (
  q.provenance === 'generated-from-page' || q.provenance === 'collated-on-page' ? 'image' : 'text'
);

/**
 * أين يذهب الطالب من هذا السؤال؟
 *
 * `collated`: `'image'` قوبِلت على صورةِ الصفحة، `'text'` على نصٍّ مستخرَجٍ
 * لا على صورة، `'hint'` ترشيحُ بحثٍ آليٍّ لا مقابلةَ فيه. و`verified` باقٍ
 * لِما يسأل: «أفيها مقابلةٌ من أيِّ نوع؟».
 */
export function pageRefOf(q) {
  const book = BOOK_ID[q.subject];
  if (!book) return null;
  if (q.bookPage) {
    const page = firstPageOf(q.bookPage);
    return page && {
      book, page, label: q.bookPage, verified: true,
      collated: collationOf(q), hasImage: hasImage(book, page),
    };
  }
  const h = state.hints[q.id];
  return h && { book: h.book, page: h.page, label: `ص${arNum(h.page)}`, verified: false,
                collated: 'hint',
                confidence: h.confidence, countWord: h.countWord, countAgrees: h.countAgrees,
                hasImage: hasImage(h.book, h.page) };
}

const hasImage = (book, page) => !!state.pageIndex[book]?.pages?.includes(page);
export const bookPageCount = (book) => state.pageIndex[book]?.count || null;
/** مرجعُ الكتاب الرسميّ — يُعرَض حين لا يكون مرفوعاً داخل التطبيق. */
export const bookLink = (book) => state.bookLinks[book] || null;
export const allBookLinks = () => state.bookLinks;

/**
 * مسارُ غلاف الكتاب صورةً، أو `null` لمن لا غلافَ له فيُكتَب غلافُه بالخطّ.
 *
 * ويُقرأ من فهرسٍ لا يُجرَّب الرابطُ رأساً: ثلاثةٌ من الكتبِ السبعةِ لم تُرفَع
 * ملفّاتُها، وطلبُ غلافٍ لها يرجع ٤٠٤ في كلِّ فتحةٍ ويُخزَّن في عامل الخدمة.
 */
export const bookCoverSrc = (book) => state.covers[book] || null;

async function getJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`تعذّر تحميل ${path} (${res.status})`);
  return res.json();
}

/**
 * يحمّل المنيفست وكل بنوك الأسئلة مرةً واحدة.
 *
 * ── وتقدُّمُ التحميلِ يُرى ────────────────────────────────────────────────
 *
 * والبنوكُ ٦٫٥ م.ب في أربعةَ عشرَ ملفاً، وأحكامُ التجويدِ ٩٠٨ ك.ب. وعلى شبكةِ
 * مسجدٍ ضعيفةٍ يقف الإمامُ أمام سطرٍ ساكنٍ «يُحمَّل المنهج…» نصفَ دقيقةٍ أو
 * أكثر — لا يتحرّك، ولا يدلُّ على أنّ شيئاً يقع. فيحسبه واقفاً فيُغلِقه ويُعيد
 * الفتحَ، فيبدأ من أوّله.
 *
 * فيُبلَّغ المُنادي بكلِّ ملفٍّ يصل (`onProgress`)، فيُرى الرقمُ يتقدّم. ولا
 * يُبدَّل شيءٌ في التحميلِ نفسِه: التوازي كما هو، والسقوطُ مُحتمَلٌ كما كان.
 */
export async function load({ onProgress = null } = {}) {
  if (state.manifest) return state;

  const manifest = await getJSON('data/manifest.json');
  const bankFiles = (manifest.banks || []).map((b) => b.file);

  let done = 0;
  const total = bankFiles.length + 4;
  const tick = () => {
    done += 1;
    if (onProgress) { try { onProgress(done, total); } catch { /* لا شيء */ } }
  };
  const counted = (pr) => pr.then((v) => { tick(); return v; });

  const [hints, pageIndex, bookLinks, covers, ...banks] = await Promise.all([
    counted(getJSON('data/page-hints.json').catch(() => ({}))),
    counted(getJSON('books/pages-index.json').catch(() => ({}))),
    counted(getJSON('data/book-links.json').catch(() => ({}))),
    counted(getJSON('data/covers.json').catch(() => ({}))),
    // `null` لا رَفضٌ: يُحتمَل سقوطُ بنكٍ كما احتُمِل سقوطُ الملفّاتِ المساعدة.
    ...bankFiles.map((f) => counted(getJSON(`data/banks/${f}`).catch(() => null))),
  ]);

  state.manifest = manifest;
  state.hints = hints;
  state.pageIndex = pageIndex;
  state.bookLinks = bookLinks;
  state.covers = covers;

  /*
   * سقوطُ بنكٍ واحدٍ لا يُسقِط الثلاثةَ عشرَ التي وصلت.
   *
   * كانت البنوكُ في `Promise.all` بلا حراسةٍ بخلافِ الملفّاتِ المساعدة، فسقوطُ
   * اتّصالٍ واحدٍ من أربعةَ عشرَ طلباً متوازياً — وهو الغالبُ على شبكةِ مسجدٍ
   * ضعيفة، لا النادر — يُرفَض به الوعدُ كلُّه فتُهدَر البنوكُ الواصلة، ويقف
   * التطبيقُ على شاشةِ خطأٍ لا منهجَ فيها البتّة.
   *
   * فصار الناقصُ يُسمّى ويُعلَن للطالبِ (`state.missingBanks`) ويدرُس على ما
   * وصل. والعلمُ الناقصُ خيرٌ من لا علم.
   */
  state.missingBanks = bankFiles.filter((_, i) => !banks[i]);

  banks.forEach((bank, i) => {
    if (!bank) return;                 // بنكٌ لم يصل — سُمِّي أعلاه ويُتجاوَز
    const file = bankFiles[i];
    for (const q of bank.questions || []) {
      // بعض البنوك تضع العلم على مستوى البنك لا على مستوى السؤال.
      const subject = q.subject || bank.subject;
      const item = { ...q, subject, bank: file, book: bank.book || null };
      state.questions.push(item);
      state.byId.set(item.id, item);
    }
  });

  dedupe();
  return state;
}

/* ── سؤالٌ واحدٌ بمعرِّفَين ──────────────────────────────────────────────── */

/** يُطبَّع النصُّ ليُقارَن: تُجرَّد الحركاتُ وتُوحَّد الألفُ والياءُ والتاء. */
function normText(s) {
  return String(s || '')
    .normalize('NFKC')
    .replace(/[ً-ْٰ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * المعرِّفُ الذي طُوِي ← المعرِّفُ الذي بقي.
 *
 * يُبنى منه نقلُ إجابةِ الطالب: من أجاب عن السؤالِ بمعرِّفِه المطويِّ قبل أن
 * يُطوى لا تضيع إجابتُه بطيِّه. (يُستعمَل في `store.prune` عند الإقلاع.)
 */
export function aliases() {
  const m = new Map();
  for (const d of state.duplicates || []) m.set(d.dropped, d.kept);
  return m;
}

/** المكرَّراتُ التي طُويت — تُعرَض في لوحةِ المشرف ليُقرِّر فيها. */
export const duplicates = () => state.duplicates || [];

/**
 * ستّةُ أسئلةٍ في العقيدةِ نصُّها واحدٌ ولها معرِّفان.
 *
 * وخمسةٌ منها كُتِبت يدوياً (`AQD-*`) ثمّ وُلِّدت ثانيةً من نصِّ الكتاب
 * (`GAQ-*`)، وواحدٌ مكرَّرٌ داخلَ المولَّدِ نفسِه. وأثرُه ثلاثة:
 *
 *   • يُسحَبان معاً في ورقةٍ واحدةٍ فيرى الطالبُ السؤالَ مرّتَين ويحسب في
 *     الاختبارِ أنّه أخطأ الفهم.
 *   • يُعَدّانِ سؤالَين في قياسِ الإتقان، فلا يُتقَن البابُ حتى يُجابَ الواحدُ
 *     مرّتَين.
 *   • ويُرسَلان إلى الإحصاءِ صفَّين، فيبدو السؤالُ أكثرَ ورودَاً ممّا هو.
 *
 * ── ولِمَ لا يُحذَف من البنكِ رأساً ────────────────────────────────────
 *
 * لأنّ البنكَ مادّةٌ شرعيّةٌ لم تُراجَع بعدُ مراجعةً عِلميّة، وحذفُ سؤالٍ منه
 * قرارُ صاحبِ التطبيقِ لا قرارُ كودٍ يعمل في الخلفية. فيُطوى عند التحميلِ
 * ويُعرَض المطويُّ في اللوحةِ ليُنظَر فيه — والطيُّ يُرَدُّ بحذفِ هذه الدالّة،
 * والحذفُ لا يُرَدّ.
 *
 * والمُبقَى أوثقُهما توثيقاً: ما قوبِل على صورةِ الصفحة، ثمّ ما له صفحةٌ
 * أصلاً، ثمّ الأقدمُ معرِّفاً — فلا يكون الاختيارُ بالمصادفة.
 */
function dedupe() {
  const rank = (q) => (
    (q.provenance === 'generated-from-page' || q.provenance === 'collated-on-page' ? 4 : 0)
    + (q.bookPage ? 2 : 0)
    + (q.keyPoints?.length ? 1 : 0)
  );

  const seen = new Map();
  const dropped = [];
  for (const q of state.questions) {
    const text = normText(q.question);
    if (!text) continue;                       // سؤالٌ بلا نصّ لا يُقارَن بشيء
    const key = `${q.subject}\u0000${text}`;
    const prev = seen.get(key);
    if (!prev) { seen.set(key, q); continue; }
    const [keep, drop] = rank(q) > rank(prev) ? [q, prev] : [prev, q];
    seen.set(key, keep);
    dropped.push({ kept: keep.id, dropped: drop.id, subject: q.subject, question: q.question });
  }
  if (!dropped.length) { state.duplicates = []; return; }

  const out = new Set(dropped.map((d) => d.dropped));
  state.questions = state.questions.filter((q) => !out.has(q.id));
  for (const id of out) state.byId.delete(id);
  state.duplicates = dropped;
}

export const manifest = () => state.manifest;

/**
 * أمسارٌ معروفٌ هذا؟ ولِمَ يُسأل أصلاً؟
 *
 * لأنّ المسارَ يُقرَأ من `localStorage`، وما فيه ليس ممّا يُؤتمَن: يبقى من نسخةٍ
 * قديمةٍ سُمّي فيها المسارُ بغيرِ اسمِه اليوم، أو يُعدَّل بيدٍ من أدواتِ
 * المتصفّح، أو يصل التطبيقُ بمَنهجٍ حُذِف منه مسار.
 *
 * وكانت الرئيسيةُ و«حسابي» تقرآنِ `manifest().tracks[track].label` رأساً، فقيمةٌ
 * لا يعرفها المنهجُ تُسقِط الرسمَ كلَّه بـ`TypeError`. وهذا **عَطَبٌ لا مخرجَ
 * منه**: الشاشةُ الأولى تسقط، فلا يبلغ الطالبُ «حسابي» ليضغط «امسح تقدّمي»،
 * ولا شيءَ يُرسَم ليضغط عليه. فيبقى التطبيقُ أبيضَ إلى أن يُمحى تخزينُ الموقعِ
 * من إعداداتِ المتصفّح — وإمامٌ في مسجدٍ لا يفعل هذا، بل يحسب التطبيقَ تالفاً.
 *
 * فيُفحَص المسارُ عند الإقلاعِ فيُنسى إن لم يُعرَف، ويرجع الطالبُ إلى شاشةِ
 * اختيارِ المسارِ — وهي صحيحةُ الحال: مسارٌ لا يُعرَف كمسارٍ لم يُختَر.
 */
export const isTrack = (t) => !!(state.manifest && state.manifest.tracks && state.manifest.tracks[t]);

/** اسمُ المسارِ للعرض — لا يُرمى منه خطأٌ على قيمةٍ لا تُعرَف. */
export const trackLabel = (t) => (state.manifest?.tracks?.[t]?.label) || '';

/** بنوكٌ لم تصل في هذه الجلسة. فارغةٌ في الحال السويّة. */
export const missingBanks = () => state.missingBanks || [];
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

/**
 * كم سؤالاً في ورقةِ هذا المسار؟
 *
 * و**ليست ٣٤ لكلِّ مسار**: `EXAM_BLUEPRINT` مجموعُه ٣٤، لكنّ `buildFullExam`
 * يتخطّى كلَّ علمٍ لا أسئلةَ له في المسار — فالمؤذّنُ بلا نحوٍ ورقتُه ٣١،
 * والمتقاعدُ أقلّ. وكانت الرئيسيةُ تحسبه على وجهه، و`examReport` في شاشةِ
 * النتيجةِ تكتب «٣٤» ثابتةً: «نصيبُه من الورقة ١٠ من ٣٤» — فيُنسَب إلى ورقةٍ
 * لم يجلس إليها، ويبني على النسبةِ الخطأِ حكمَه على نفسِه.
 *
 * فصار الحسابُ في موضعٍ واحدٍ يُنادى منهما جميعاً.
 */
export const examSize = (track) => EXAM_BLUEPRINT.reduce(
  (n, b) => n + (questionsIn(track, b.subject).length ? b.count : 0), 0,
);

/** اختبارٌ شاملٌ محاكٍ لورقة الاختبار — بالتوزيع المعتمد على أعلامِ المسار. */
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
/**
 * ── الصعوبةُ مدًى لا رقمٌ بعينه ──────────────────────────────────────────
 *
 * حقلُ `difficulty` في البنوكِ على سُلَّمِ **واحدٍ إلى تسعة**، وأزرارُ الشاشةِ
 * ثلاثةٌ كانت تُرسِل `1` و`2` و`3` والفلترةُ `q.difficulty === difficulty`
 * مطابقةً تامّة. فكان الأثرُ أمرَين، كلاهما خفيٌّ:
 *
 *   • **٢٩٢٠ سؤالاً من ٤٠١٠ (٧٢٪) لا يبلغها زرٌّ البتّة** — كلُّ ما درجتُه
 *     أربعةٌ فما فوق. والطالبُ يظنُّ أنّه اختار «صعب» فاستوعبَ الصعبَ كلَّه.
 *   • **والمعنى مقلوب**: «صعب» كانت تُعطي درجةَ ٣ — وهي من السهلِ على سُلَّمِ
 *     التسعة — ولا يصل الطالبُ إلى ٧ و٨ و٩ أبداً، وهي التي يحتاج تمرينَها.
 *
 * فصارت الأزرارُ مُدَياتٍ تستوعب السُّلَّمَ كلَّه: ١–٣ · ٤–٥ · ٦–٩.
 * والتوزيعُ لا يستوي (١٠٩٠ · ٢٥٦٤ · ٣٥٦) لأنّ البنكَ كذلك، ولا يُعدَّل
 * بالتسويةِ المصطنَعةِ في الفلتر — بل يُعرَض عددُ كلِّ زرٍّ على الزرِّ نفسِه.
 */
export const LEVEL_RANGES = {
  easy: [1, 3],
  mid: [4, 5],
  hard: [6, 9],
};

/** يُطبَّق ما اختاره الطالبُ من شروط — بلا سحبٍ، فيصلح للعدِّ وللبناء. */
function customPool(track, { subjects = [], difficulty = null, types = null } = {}) {
  let pool = forTrack(track);
  if (subjects.length) pool = pool.filter((q) => subjects.includes(q.subject));
  if (difficulty) {
    const [lo, hi] = LEVEL_RANGES[difficulty] || [];
    if (lo) pool = pool.filter((q) => q.difficulty >= lo && q.difficulty <= hi);
  }
  if (types && types.length) pool = pool.filter((q) => types.includes(q.type));
  return pool;
}

/**
 * كم سؤالاً يستوفي الشروط — بلا سحبٍ ولا ترتيب.
 *
 * وكانت الشاشةُ تعدُّ بـ`buildCustomExam(…, { count: 999 })`: تُصفّي أربعةَ
 * آلافِ سؤالٍ ثمّ **تسحب منها تسعمائةً وتسعةً وتسعين سحباً موزوناً** — في كلِّ
 * نقرةٍ على علمٍ أو عددٍ أو صعوبة. والسحبُ الموزونُ هو أثقلُ ما في الملفّ،
 * ونتيجتُه تُرمى ولا يُؤخَذ منها إلا `.length`. فتُحسُّ الشاشةُ ثقيلةً على
 * جهازٍ قديم، وذلك في شاشةِ اختيارٍ لا عملَ فيها أصلاً.
 */
export const countCustom = (track, opts) => customPool(track, opts).length;

export function buildCustomExam(track, { count = 15, ...opts } = {}) {
  const pool = customPool(track, opts);
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
 * `scoreOf` و`answeredAt` تُمرَّران من store لئلّا يعتمد data على حالة الطالب.
 */
/**
 * ── ولا يُخلِف الوِردُ وعدَه ─────────────────────────────────────────────
 *
 * كان الوِردُ مبنيّاً على رافدَين: ما أخطأ فيه، وما لم يمرَّ عليه. فإذا نفدَ
 * الرافدانِ وقعَ أمران، كلاهما في وجهِ الطالبِ المجتهدِ وحدَه:
 *
 *   • **الزرُّ لا يفعل شيئاً البتّة.** من أصابَ أسئلةَ مسارِه كلَّها يرجع
 *     الوِردُ فارغاً، و`openWird` تقول `if (!questions.length) return;` —
 *     فيضغط الرجلُ ولا يقع شيءٌ ولا تُقال كلمة. وهو جزاءُ من أتمَّ المنهج.
 *
 *   • **أو يُفتَح بثُلثِ ما وعد.** فإن بقي خطأانِ ولا جديدَ: `take` اثنان،
 *     و`weightedSample(fresh, 18)` تُرجِع ما وجدت — فيقول الزرُّ «ابدأ — ٢٠
 *     سؤالاً» وتُفتَح جلسةٌ من سؤالَين.
 *
 * فأُضيف رافدٌ ثالثٌ: **ما أصابه وطال عهدُه به** — الأقدمُ إجابةً أوّلاً. وهو
 * الصوابُ في التعليمِ لا حيلةٌ لملءِ العدد: المحفوظُ يُنسى، ومراجعتُه على
 * التباعُدِ أثبتُ من تركه. ومن أتمَّ المنهجَ فحاجتُه إلى التثبيتِ لا إلى
 * الوقوفِ أمام زرٍّ لا يستجيب.
 *
 * ويبقى الترتيبُ على حاله: الخطأُ أوّلاً، ثمّ الجديد، ثمّ المراجعة.
 */
/**
 * و`correct` تُمرَّر ولا تُكتَب رقماً ههنا: العتبةُ مِلكُ `store` (هي
 * `store.CORRECT`)، و`data` لا يعرف عن تقدُّمِ الطالبِ شيئاً — لذلك تُمرَّر
 * إليه `scoreOf` و`answeredAt` أصلاً. وكان `0.7` مكتوباً في سطرَين ههنا،
 * فكان تبديلُ العتبةِ في `store` يُبدِّل «الأخطاء» ولا يُبدِّل وِردَ اليوم.
 */
export function buildWird(track, n, scoreOf, answeredAt = () => 0, correct = 0.7) {
  const pool = forTrack(track);
  const weak = pool
    .filter((q) => { const s = scoreOf(q.id); return s !== null && s < correct; })
    .sort((a, b) => scoreOf(a.id) - scoreOf(b.id));
  const fresh = pool.filter((q) => scoreOf(q.id) === null);

  const rand = mulberry32(Math.floor(Date.now() / 86_400_000));
  const take = Math.min(weak.length, Math.floor(n / 3));
  const chosen = [
    ...weak.slice(0, take),
    ...weightedSample(fresh, Math.max(0, n - take), rand),
  ];

  // ما نقصَ عن الوعدِ يُتمَّم ممّا أصابه وطال عهدُه به.
  if (chosen.length < n) {
    const taken = new Set(chosen.map((q) => q.id));
    const settled = pool
      .filter((q) => !taken.has(q.id) && (scoreOf(q.id) ?? -1) >= correct)
      .sort((a, b) => (answeredAt(a.id) || 0) - (answeredAt(b.id) || 0));
    chosen.push(...settled.slice(0, n - chosen.length));
  }

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
      /*
       * القيودُ تُقرأ في الفرعَين معاً — وكانت في الفرعِ الأوّلِ وحدَه.
       *
       * فسؤالٌ فيه `answer.caveats` ولا `answer.items` له يمضي إلى الفرعِ
       * الثاني، فتُكتَب `caveats: []` وتُهدَر قيودُه. ومنها ما يُنبِّه على
       * اختلافِ الوثيقةِ على نفسها — وذاك أنفعُ ما في البطاقةِ لا زينةٌ فيها.
       */
      const caveats = (q.answer && Array.isArray(q.answer.caveats)) ? q.answer.caveats : [];

      /*
       * والفرعُ المُهيكَلُ يُشترَط فيه أن تكون بنودُه **ثلاثاً فأكثر**، لا أن
       * تكون `items` مصفوفةً فحسب.
       *
       * فـ`GEN-SLT-007` عنده `answer.items = []` و`keyPoints` اثنتا عشرةَ
       * نقطةً حاضرة: فكانت المصفوفةُ الفارغةُ تجتاز `Array.isArray` فيُؤخَذ
       * الفرعُ الأوّلُ بصفرِ بندٍ، ثمّ يُسقِطه `items.length >= 3` — فيسقط
       * سؤالٌ تامٌّ من بطاقاتِ الحفظِ بسببِ حقلٍ فارغٍ يَحجُب ما تحته.
       */
      if (q.answer && Array.isArray(q.answer.items) && q.answer.items.length >= 3) {
        /*
         * ولا تُرقَّم البنودُ إلا إذا صدَّق عددُها العددَ المذكور.
         *
         * فأربعةَ عشرَ بطاقةً تكتب عدداً وتُرقِّم تحته بنوداً أقلَّ أو أكثر:
         * «ثمانيةٌ وعشرونَ حرفاً» ثمّ أربعةُ بنود، «تَرتيبٌ واحِدٌ» ثمّ تسعة.
         * وأصلُه في أداةِ الهيكلة: `count` أُخِذ من لفظِ العددِ في نصِّ الكتاب،
         * و`items` من البنودِ المذكورة، والكتابُ يذكر العددَ ولا يسوق بنودَه
         * كلَّها. والبطاقةُ أداةُ حفظٍ تُكرَّر حتى ترسخ، فترقيمٌ يُناقِض عدداً
         * يُرسِّخ الخطأَ لا يُنبِّه عليه — وهو عينُ ما يُحذِّر منه تعليقُ
         * الشاشةِ نفسِها.
         *
         * وليس لنا أن نُصلِح البياناتِ ههنا (الكتابُ هو الحَكَم، والبنكُ لم
         * يُراجِعه عالِمٌ بعد)، فيُقال ما هو: العددُ عددُ الكتابِ، والمذكورُ
         * منه كذا. و`short` هو الفرق، ويُعرَض صريحاً في البطاقة.
         */
        const n = q.answer.count;
        const agrees = typeof n !== 'number' || n === q.answer.items.length;
        return {
          q,
          count: q.answer.countWord,
          items: q.answer.items,
          caveats,
          numbered: agrees,
          stated: agrees ? null : n,
        };
      }
      const first = q.keyPoints[0] || '';
      const countMatch = first.match(/^العدد[:：]\s*(.+)$/);
      const count = countMatch ? countMatch[1].trim() : (first.match(NUMBER_WORDS) || [])[0] || null;
      const items = countMatch ? q.keyPoints.slice(1) : q.keyPoints;
      return { q, count, items, caveats, numbered: false, stated: null };
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
