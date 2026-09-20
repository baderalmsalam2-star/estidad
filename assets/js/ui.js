// أدوات بناء الواجهة: عناصر DOM، والأرقام العربية، والملاحة بين الشاشات.

/* ── الأرقام ─────────────────────────────────────────────────────────── */

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** كل رقمٍ يظهر للطالب يُكتب بالأرقام العربية — قاعدةٌ في التصميم كلّه. */
export function ar(n) {
  return String(n).replace(/\d/g, (d) => AR_DIGITS[+d]);
}

export const pct = (x) => `${ar(Math.round(x * 100))}٪`;

/**
 * كسرٌ «أ/ب» معزولُ الاتّجاه — وحَرْزٌ لا علاجُ عَطَبٍ قائم.
 *
 * ── ما قِيس ─────────────────────────────────────────────────────────────
 *
 * قِسْتُ `١٢/٤٠` في سطرٍ عربيٍّ بالعزلِ وبغيرِه — موضعَ كلِّ محرفٍ على الشاشةِ
 * بـ`Range.getBoundingClientRect` — فكان الرسمُ واحداً: «١٢/٤٠» في الحالَين.
 * وكذلك «١٢:٠٥». وعلّتُه في الخوارزمِ نفسِه (UAX #9 قاعدة W4): الشَّرطةُ
 * المائلةُ `CS` بين رقمَين `AN` **تصير `AN`**، فيصير الكلُّ جريةً رقميّةً
 * واحدةً تُرسَم من اليسار. فالمزعومُ أنّ «١٢/٤٠ تُقرَأ ٤٠/١٢» غيرُ واقع.
 *
 * ── ولمَ يبقى العزلُ إذن ─────────────────────────────────────────────────
 *
 * لأنّ صحّةَ الرسمِ معلَّقةٌ بأن يكون **كلُّ** ما بين الطرفَين من صنفِ `AN`.
 * فيومَ يدخل الكسرَ محرفٌ ليس منه — رقمٌ لاتينيٌّ أفلتَ من `ar()`، أو مسافةٌ،
 * أو علامةُ ناقص، أو كلمةٌ بين العددَين — انقطعتِ الجريةُ وانقلبَ الترتيبُ
 * فعلاً. والعزلُ يجعل الصحّةَ مضمونةً بالبناءِ لا بخاصّيّةٍ في المدخَلات.
 *
 * فهو مكتوبٌ على أنّه حَرْزٌ، لا على أنّه يُصلِح شيئاً مكسوراً اليوم.
 */
export function frac(a, b) {
  return el('span.num', {
    style: { direction: 'ltr', unicodeBidi: 'isolate' },
  }, `${ar(a)}/${ar(b)}`);
}

export function arTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${ar(m)}:${ar(String(s).padStart(2, '0'))}`;
}

/* ── بناء العناصر ────────────────────────────────────────────────────── */

/**
 * el('div.card', { onclick }, [children])  →  HTMLElement
 * الوسم يقبل صيغة `tag.class.class` اختصاراً.
 */
export function el(spec, props = null, children = null) {
  if (Array.isArray(props) || typeof props === 'string' || props instanceof Node) {
    children = props;
    props = null;
  }
  const [tag, ...classes] = String(spec).split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');

  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className += (node.className ? ' ' : '') + v;
    else if (k === 'style') Object.assign(node.style, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }

  append(node, children);
  return node;
}

function append(node, children) {
  if (children === null || children === undefined || children === false) return;
  if (Array.isArray(children)) {
    children.forEach((c) => append(node, c));
  } else if (children instanceof Node) {
    node.appendChild(children);
  } else {
    node.appendChild(document.createTextNode(String(children)));
  }
}

/* ── لبنات متكرّرة ───────────────────────────────────────────────────── */

export const chip = (text, cls = '') => el(`span.chip${cls}`, text);

/**
 * عدسةُ البحث. لا خطَّ أيقوناتٍ في المشروع — والاعتماد على رمز يونيكود ⌕ يخرج
 * ضئيلاً مشوَّهاً في أكثر خطوط الأنظمة، فرُسِمت متجهةً لتستوي في كل جهاز.
 */
export const MAGNIFIER =
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="2.2" stroke-linecap="round" aria-hidden="true">'
  + '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.6 15.6 21 21"/></svg>';

/**
 * شارة صفحة الكتاب. تُعرَض مع كل سؤالٍ موثَّق (README §٥.٢)، وتصير زرّاً
 * يفتح صورة الصفحة فوراً متى كان الكتاب مرفوعاً.
 *
 * وللسؤال غير الموثَّق تُعرَض «صفحةٌ مرشَّحة» بشكلٍ مختلفٍ عمداً: ترشيحُ بحثٍ
 * آليٍّ أصاب ٨٧٪ في القياس، فهو معينٌ على التنقّل لا شهادةُ توثيق.
 */
export function pageCite(q) {
  const ref = pageRef(q);
  if (!ref) return q.bookPage ? el('span.pagecite', `${bookNameFor(q)} ${q.bookPage}`) : null;

  const cls = ref.verified ? 'pagecite' : 'hintcite';
  const text = ref.verified ? `${bookNameFor(q)} ${ref.label}` : `${bookNameFor(q)} ${ref.label}؟`;
  if (!ref.hasImage) return el(`span.${cls}`, text);

  return el(`button.${cls}`, {
    style: { border: ref.verified ? 'none' : null, cursor: 'pointer', font: 'inherit' },
    title: ref.verified ? 'اعرض الصفحة' : 'صفحةٌ مرشَّحةٌ آلياً — اعرضها للتأكّد',
    onclick: (e) => { e.stopPropagation(); openPageLayer(ref); },
  }, text);
}

// اسمٌ قصيرٌ يليق بشارةٍ صغيرة. حقل `book` في البنوك وصفيٌّ مطوَّل أحياناً
// («الوثيقة المنظِّمة لعمل الإمام والخطيب والمؤذن») فلا يصلح هنا.
const SHORT_BOOK = {
  'الفقه': 'دليل الطالب', 'التجويد': 'غاية المريد', 'العقيدة': 'بريق الجمان',
  'النحو': 'التحفة السنية', 'التفسير': 'زبدة التفسير', 'ميثاق المسجد': 'ميثاق المسجد',
  'الحديث': 'الأربعون النووية',
};

function bookNameFor(q) {
  return SHORT_BOOK[q.subject] || (q.book && q.book.length <= 24 ? q.book : '');
}

export function bar(value, { thin = false, onGreen = false, wrong = false } = {}) {
  const cls = `bar${thin ? ' bar--thin' : ''}${onGreen ? ' bar--onGreen' : ''}${wrong ? ' bar--wrong' : ''}`;
  return el(cls, el('i', { style: { width: `${Math.round(value * 100)}%` } }));
}

export function statusRow(left, right) {
  return el('div.row-base', [el('span', left), el('span.num', right)]);
}

/** ترويسة علوية: زرّ رجوع، وعنوان، وفعلٌ اختياريّ. */
/**
 * العنوانُ في الترويسةِ **عنوانٌ** (`h1`) لا `span`.
 *
 * وقيسَت الشاشاتُ فوُجِدت ثمانٍ من ثلاثةَ عشرةَ بلا عنوانٍ البتّة: البحثُ،
 * والبطاقاتُ، والورقةُ المخصَّصة، والتجويدُ، وصندوقُ المراجعة، واللوحةُ،
 * والمراجعةُ، والرئيسية. وأكثرُها له عنوانٌ يُرى بالعين، لكنّه `span` — فقارئُ
 * الشاشةِ لا يعلم أنّه عنوان، ولا تُبنى للصفحةِ خريطةٌ يُنتقَل بها، ومن يتنقّل
 * بالعناوينِ (وهو أوّلُ ما يفعله المستعملُ الخبير) لا يجد شيئاً.
 *
 * ولا يتبدّل المنظرُ بحرف: `.topbar-title` يحمل مقاسَه ولونَه كما كان.
 */
export function topbar({ onBack, title, right = null, icon = '→' } = {}) {
  return el('header.topbar', [
    onBack ? el('button.iconbtn', { onclick: onBack, 'aria-label': 'رجوع' }, icon) : el('span', { style: { width: '38px' } }),
    el('h1.topbar-title', title || ''),
    right || el('span', { style: { width: '38px' } }),
  ]);
}

/* ── التواصل مع صاحب المشروع ─────────────────────────────────────────── */

/**
 * قناةُ التواصل — موضعٌ واحدٌ في التطبيق كلِّه.
 *
 * رقمٌ دوليٌّ بلا `+` ولا فراغات. وإن أُفرِغ اختفت كلُّ أزرارِ المراسلةِ من
 * نفسِها — فلا زرَّ يفتح محادثةً مع لا أحد.
 */
export const CONTACT = { whatsapp: '96599925292' };

export const waLink = (text) => (CONTACT.whatsapp
  ? `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`
  : null);

// أيقونة واتساب مرسومةٌ متجهةً — لا صورةَ من طرفٍ ثالثٍ تُحمَّل.
export const WHATSAPP_MARK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
  + '<path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.95L2 22.5l5.7-1.5A9.9 9.9 0 1 0 12.04 2zm0 1.9a8 8 0 1 1-4.1 14.86l-.29-.17-3.38.89.9-3.3-.19-.3A8 8 0 0 1 12.04 3.9zm4.6 10.1c-.25-.13-1.47-.72-1.7-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.24a7.5 7.5 0 0 1-1.38-1.72c-.15-.25-.02-.38.11-.5.11-.12.25-.29.37-.44.12-.15.16-.25.25-.42.08-.16.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.55-.42h-.47c-.16 0-.42.06-.64.31-.22.25-.84.82-.84 2s.86 2.32.98 2.48c.13.16 1.7 2.6 4.12 3.64.57.25 1.02.4 1.37.51.58.18 1.1.16 1.52.1.46-.07 1.42-.58 1.62-1.15.2-.56.2-1.05.14-1.15-.06-.1-.22-.16-.47-.29z"/></svg>';

/**
 * بلاغُ خطأٍ في سؤالٍ بعينه.
 *
 * الطالبُ هو أوّلُ من يقع على الخطأ، وهو أبعدُ الناسِ عن قناةٍ يُبلِّغ بها.
 * فيُرسَل البلاغُ برقمِ السؤالِ وعلمِه وصفحتِه — كي يُعرَف السؤالُ من رقمِه بلا
 * بحثٍ، ويُقابَل على صفحتِه مباشرةً. ولا يُرسَل من التطبيق شيءٌ عن الطالب.
 */
export function reportLink(q) {
  const href = waLink(
    `بلاغُ خطأ في سؤال\n\nرقم السؤال: ${q.id}\nالعلم: ${q.subject || '—'}`
    + `${q.topic ? `\nالباب: ${q.topic}` : ''}${q.bookPage ? `\nالصفحة: ${q.bookPage}` : ''}`
    + `\n\nالسؤال: ${q.question}\n\nالخطأ الذي وجدتُه: `);
  if (!href) return null;

  return el('a', {
    href, target: '_blank', rel: 'noopener',
    style: {
      display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start',
      fontSize: '12.5px', color: 'var(--ink-6)', textDecoration: 'none', paddingTop: '2px',
    },
  }, [el('span', { style: { display: 'flex' }, html: WHATSAPP_MARK }), 'في هذا السؤال خطأ؟ أبلِغْنا']);
}

/** سطر الاعتماد — صغيرٌ أسفل الصفحة، كما في رحلة المدينة والماهر. */
export const credit = () =>
  el('p.credit', 'تم تطوير التطبيق بواسطة بدر المسلم');

/**
 * شارةٌ للمطوّر وحده لا للطالب: تميّز السؤال الذي لم يُقابَل حرفاً بحرفٍ على
 * الكتاب بعد، ليُكمل صاحب المشروع المقابلة على دفعات وهو يستعمل التطبيق.
 * تُفعَّل بـ`?dev=1` وتُطفَأ بـ`?dev=0`، ولا يراها الطالب البتّة.
 */
export function devBadge(q) {
  if (!devMode() || q.bookVerified) return null;
  return el('span.devbadge', 'لم يُقابَل');
}

const DEV_KEY = 'awqaf-prep/dev';
export const devMode = () => localStorage.getItem(DEV_KEY) === '1';
export function setDevMode(on) {
  try {
    if (on) localStorage.setItem(DEV_KEY, '1');
    else localStorage.removeItem(DEV_KEY);
  } catch { /* لا شيء */ }
}

/**
 * نجمُ الزَلِّيجِ نفسُه مرسوماً — للشاشاتِ الفارغة.
 *
 * ثمانيةُ رؤوسٍ بحِضنٍ بينها، محسوبةٌ لا منقولة، فتُطابق بلاطةَ الأرضِ شكلاً.
 */
export function zellijMark(size = 76) {
  const R = 46;
  const r = R * 0.54;
  const pts = [];
  for (let i = 0; i < 16; i += 1) {
    const rad = i % 2 === 0 ? R : r;
    const a = (i * Math.PI) / 8;
    pts.push(`${(50 + rad * Math.cos(a)).toFixed(1)},${(50 + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">`
    + `<path d="M${pts.join('L')}Z" fill="none" stroke="currentColor" stroke-width="2.4"`
    + ' stroke-linejoin="round"/>'
    + '<circle cx="50" cy="50" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>';
}

/**
 * الشاشةُ الفارغة. وكان فيها سطرٌ يتيمٌ في وسطِ بياض، فتُقرَأ عَطَباً لا حالةً
 * مقصودة. فصار فوقها نجمُ الزَلِّيجِ باهتاً — يشغل الموضعَ ويقول إنّ هذا هو
 * الشكلُ المقصود.
 */
export function empty(title, note) {
  return el('div.empty', [
    el('div.empty-mark', { html: zellijMark(76) }),
    // عنوانٌ لا `span`: الشاشةُ الفارغةُ شاشةٌ، ولها عنوانُها كغيرها.
    el('h1.head', title),
    note ? el('p.lede', note) : null,
  ]);
}

/**
 * حلقةُ تقدُّمٍ برقمها في جوفها.
 *
 * والقوسُ يبدأ من الصفرِ ثمّ يمتدُّ إلى موضعه بعد الرسم، فيرى الطالبُ حصيلتَه
 * تُرسَم أمامه لا تُوضَع أمامه. ومن أطفأ الحركةَ في نظامه رآها في موضعها فوراً.
 */
export function ring(value, { size = 78, width = 8, label = null, sub = null } = {}) {
  const R = (size - width) / 2;
  const C = 2 * Math.PI * R;
  const v = Math.max(0, Math.min(1, value || 0));
  const c = size / 2;

  // يُبنى بـ`innerHTML` لا بـ`el`: `el` تنادي `document.createElement`، وهي
  // تُنشئ عنصراً في فضاءِ أسماءِ HTML. و`<svg>` في فضاء HTML عنصرٌ مجهولٌ لا
  // يُرسَم البتّة — يوجد في الشجرةِ ولا يظهر على الشاشة. ولذلك تُبنى أيقوناتُ
  // المشروعِ كلُّها نصّاً، والحلقةُ مثلُها.
  const host = el('span', {
    style: { display: 'flex', flexShrink: '0', width: `${size}px`, height: `${size}px` },
    html: `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">`
      + `<circle class="track" cx="${c}" cy="${c}" r="${R}" stroke-width="${width}"/>`
      + `<circle class="fill" cx="${c}" cy="${c}" r="${R}" stroke-width="${width}"`
      + ` stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}"/></svg>`,
  });

  // القوسُ يبدأ تامّاً ثمّ ينكشف إلى موضعه بعد الرسم، فيرى الطالبُ حصيلتَه
  // تُرسَم أمامه. ومن أطفأ الحركةَ في نظامه رآها في موضعها فوراً.
  requestAnimationFrame(() => {
    host.querySelector('.fill')?.setAttribute('stroke-dashoffset', (C * (1 - v)).toFixed(2));
  });

  if (label === null) return host;
  // `.ring-label` صنفٌ للجوفِ — لا للشكلِ بل ليُفحَص: كان `فحص_الهيئة` يدّعي
  // فحصَ «الرقمِ في جوفها» بـ`.card .num`، وهي تُطابِق أيَّ رقمٍ في أيِّ
  // بطاقةٍ على الشاشة، فتنجح ولا حلقةَ ولا رقمَ في جوفها.
  return el('div', { style: { position: 'relative', width: `${size}px`, height: `${size}px`, flexShrink: '0' } }, [
    host,
    el('div.ring-label', {
      style: {
        position: 'absolute', inset: '0', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '1px',
      },
    }, [
      el('span.num', { style: { fontSize: '17px', fontWeight: '600', lineHeight: '1' } }, label),
      sub ? el('span', { style: { fontSize: '9.5px', color: 'var(--ink-6)' } }, sub) : null,
    ]),
  ]);
}

/* ── الملاحة ─────────────────────────────────────────────────────────── */

let pageRef = () => null;
let openPageLayer = () => {};
let onNavigate = () => {};
export const setNavigateHook = (fn) => { onNavigate = fn; };

/* ── ما يُطفَأ عند تركِ الشاشة ─────────────────────────────────────────── */

/**
 * تسجيلُ ما يجب إطفاؤه إذا تركَ الطالبُ الشاشة — والميكروفونُ أوّلُه.
 *
 * فشاشةُ التسميعِ تفتح الميكروفونَ بـ`getUserMedia`، ولم تكن تُغلِقه إلا في
 * `recorder.onstop` — أي إذا ضغط «أوقِف» بنفسه. فإن سحبَ سحبةَ الرجوعِ وهو
 * يسجِّل، أو لمس تبويباً في الشريط، رُسِمت شاشةٌ أخرى **والميكروفونُ مفتوح**:
 * النقطةُ الحمراءُ في شريطِ النظامِ باقيةٌ، والصوتُ يُلتقَط، والطالبُ يحسب أنّه
 * خرج. وهذا في مسجدٍ بين الناسِ أشدُّ ما في البابِ كلِّه.
 *
 * فصار لكلِّ شاشةٍ أن تقول ما تُطفئه، ويُطفَأ عنها من مكانٍ واحدٍ لا تُنسى فيه:
 * عند كلِّ انتقالٍ في `go`، وعند إخفاءِ الصفحةِ نفسِها (`pagehide`) — فالخروجُ
 * من التطبيقِ تركٌ أيضاً.
 *
 * ولا يُطفَأ عند فتحِ طبقةِ صفحةِ الكتابِ وإغلاقها: الطالبُ لم يترك شاشته.
 */
const leaving = [];

/** تُنادى من الشاشةِ لتقول: هذا ما يُطفَأ إذا تُرِكتُ. */
export function onLeave(fn) {
  if (typeof fn === 'function') leaving.push(fn);
}

function runLeave() {
  // تُفرَغ القائمةُ أوّلاً: الإطفاءُ قد يرسم، والرسمُ قد يُسجِّل من جديد.
  const fns = leaving.splice(0, leaving.length);
  for (const fn of fns) {
    try { fn(); } catch { /* إطفاءٌ يُخفِق لا يمنع الانتقال */ }
  }
}

window.addEventListener('pagehide', runLeave);
/** يحقنهما app.js تفادياً لدورة استيرادٍ بين ui وdata وscreens. */
export const setPageRefResolver = (fn) => { pageRef = fn; };
export const setPageOpener = (fn) => { openPageLayer = fn; };

/** أمفتوحةٌ طبقةُ صفحةِ الكتاب فوق الشاشة؟ يحقنه app.js كسابقَيه. */
let overlayOpen = () => false;
export const setOverlayProbe = (fn) => { overlayOpen = fn; };

const host = () => document.getElementById('screen');
const tabbarEl = () => document.getElementById('tabbar');

// البحثُ بينها بأيقونةٍ لا بكلمة: خمسُ كلماتٍ تتزاحم في عرضِ جوّالٍ صغير،
// والعدسةُ تُفهَم بلا قراءة. وكان البحثُ محبوساً في شاشةِ «الكتب» وحدَها.
const TABS = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'books', label: 'الكتب' },
  { id: 'search', label: 'بحث', icon: MAGNIFIER },
  { id: 'recite', label: 'التسميع' },
  { id: 'account', label: 'حسابي' },
];

/**
 * الشاشةُ الداخليةُ وتبويبُها. فالشريطُ كان لا يظهر إلا في الأربعِ نفسِها، فمن
 * دخل كتاباً أو بحثاً أو فهرسَ سورٍ بقي بلا طريقٍ إلى الرئيسيةِ إلا أن يرجع
 * خطوةً خطوة. وإنّما يُخفى في مهمّةٍ مركَّزةٍ لها بابُها: جلسةُ الأسئلة،
 * وورقةُ الاختيار، ومراجعةُ البنك، وأوّلُ شاشةٍ يُختار فيها المسار.
 */
const TAB_OF = {
  book: 'books', mastered: 'books', library: 'books',
  custom: 'home', flashcards: 'home', tajweed: 'home', surahs: 'home',
  admin: 'account', owner: 'account', ownerKey: 'account',
};

let routes = {};
let current = null;

/* ── زرُّ الرجوع في الجهاز ────────────────────────────────────────────── */

/**
 * يُقيَّد كلُّ انتقالٍ في سجلِّ المتصفّح، ليرجعَ زرُّ الرجوعِ في أندرويد وسحبةُ
 * الحافّةِ في سفاري إلى الشاشةِ السابقةِ لا إلى خارجِ التطبيق.
 *
 * وبدونه كان الطالبُ إذا سحب — وهي أوّلُ ما تفعله اليدُ — خرج من التطبيقِ كلِّه
 * وفقد موضعَه. والخروجُ إنّما يكون من الشاشةِ الأولى وحدَها، فتلك لا تُقيَّد.
 *
 * والمعاملاتُ تُحفَظ في الذاكرةِ لا في `history.state`، لأنّ فيها دوالَّ
 * (`back` و`again` في الاختبار) لا تُسلسَل. فإن أُعيد تحميلُ الصفحةِ ضاع
 * السجلُّ وبدأ من الشاشةِ الأولى — وهو الصوابُ لا نقص.
 */
/*
 * ── السجلُّ موضعٌ في مسارٍ، لا كَوْمةٌ يُرفَع منها ────────────────────────
 *
 * كان `trail` كَوْمةً، و`popstate` يُنقِص منها واحداً كلَّما وقع. وذاك يُصيب
 * الرجوعَ ويُخطئ التقدُّم، لأنّ `popstate` **يقع في الاتّجاهَين**: يقع لزرِّ
 * الرجوعِ ويقع لزرِّ التقدُّمِ سواءً بسواء، ولا يُفرَّق بينهما إلا بما في
 * `history.state`.
 *
 * فكان زرُّ التقدُّمِ يَرُدُّ الطالبَ خطوةً إلى الوراء: يَرجِع من «الكتاب» إلى
 * «الكتب»، فيضغط «تقدّم» ليعود إلى الكتاب، فيجد نفسَه في «الرئيسية». ثمّ
 * تفسدُ الحالُ كلُّها: موضعُ المتصفّحِ في السجلِّ صار أمامَ الكَوْمةِ بخطوتَين،
 * فيضغط الرجوعَ فتَفرُغ الكَوْمةُ فلا يُوجَد ما يُرجَع إليه — **فيموت زرُّ
 * الرجوع**، ولا يبقى له طريقٌ إلا شريطُ التنقّل.
 *
 * والعلاجُ أن يكون `trail` مساراً و`cursor` موضعاً فيه، وأن يُقرأ الموضعُ
 * المطلوبُ من `history.state.depth` لا يُفترَض. فالتقدُّمُ يُقدِّم والرجوعُ
 * يُرجِع، وكلاهما يصل إلى شاشتِه بعينها.
 */
const trail = [];
let cursor = -1;
let popping = false;

function remember(name, params) {
  if (popping) return;
  const top = trail[cursor];
  // إعادةُ رسمِ الشاشةِ نفسِها ليست انتقالاً، فلا تُقيَّد قيداً يُرجَع إليه.
  if (top && top.name === name) { top.params = params; return; }
  // انتقالٌ جديدٌ من موضعٍ رُجِع إليه يقطع ما كان أمامَه — كما تفعل المتصفّحات.
  trail.length = cursor + 1;
  trail.push({ name, params });
  cursor = trail.length - 1;
  if (trail.length === 1) history.replaceState({ depth: 1 }, '');
  else history.pushState({ depth: trail.length }, '');
}

window.addEventListener('popstate', (e) => {
  // طبقةُ صفحةِ الكتابِ أولى بالرجوع: تُغلَق وتبقى الشاشةُ تحتها.
  if (overlayOpen()) { onNavigate(); return; }

  // العمقُ المطلوبُ يُقرَأ من القيدِ نفسِه، فيُعرَف الرجوعُ من التقدُّم.
  const depth = Number(e.state?.depth ?? history.state?.depth);
  const target = Number.isFinite(depth) ? depth - 1 : cursor - 1;

  // خارجَ المسار: قيدٌ بقي من تحميلٍ سابقٍ ضاع مسارُه — يُترَك للمتصفّح.
  if (target < 0 || target >= trail.length) return;

  // الرجوعُ إلى موضعِ المؤشِّرِ نفسِه ليس انتقالاً — ولا يُعاد الرسمُ لأجله.
  // وإعادةُ الرسمِ ههنا تُتلِف عملَ الطالب: شاشةُ التصحيحِ الذاتيِّ تُبنى من
  // جديدٍ فتضيع تأشيراتُه، وهو عينُ ما بُنِيت طبقةُ الصفحةِ لتجنُّبه.
  if (target === cursor) return;

  cursor = target;
  const to = trail[cursor];
  popping = true;
  try {
    go(to.name, to.params);
  } finally {
    popping = false;
  }
});

/**
 * تُسقِط طبقةُ الصفحةِ قيدَها من السجلِّ إذا أُغلِقت بيدٍ — بلا `history.back()`.
 *
 * والطبقةُ تدفع قيداً عند الفتحِ ليستهلكَه زرُّ الرجوع. فإن أُغلِقت بـ✕ بقي
 * القيدُ يتيماً فتُصرَف به ضغطةُ رجوعٍ لا تفعل شيئاً.
 *
 * وأوّلُ ما جُرِّب `history.back()` في `closePage`، وكان أسوأَ من العَطَب: هو
 * **غيرُ متزامن**، فيقع `popstate` بعد حين — فيُعاد رسمُ الشاشةِ (وتضيع
 * تأشيراتُ التصحيحِ الذاتيّ)، وإن كانت طبقةٌ أخرى قد فُتِحت في تلك الأثناء
 * أُغلِقت من تحتِ يدِ الطالب.
 *
 * فالصوابُ أن يُبدَّل **معنى** القيدِ لا أن يُستهلَك: يُكتَب فيه عمقُ الشاشةِ
 * **السابقة**، فيصير قيداً يُرجِع منها إلى ما قبلها. فضغطةُ رجوعٍ واحدةٌ
 * تُغادِر الشاشةَ كما يتوقّع الطالب، ولا `popstate` يقع الآن، ولا رسمَ يُعاد.
 */
export function dropOverlayEntry() {
  try {
    history.replaceState({ depth: cursor }, '');
  } catch { /* لا شيء */ }
}

export function defineRoutes(map) {
  routes = map;
}

/** go('essay', { … }) — يستبدل محتوى الشاشة ويضبط شريط التنقّل. */
export function go(name, params = {}) {
  const view = routes[name];
  if (!view) throw new Error(`لا توجد شاشة باسم ${name}`);
  onNavigate();
  runLeave();
  remember(name, params);
  current = name;

  const screen = host();
  screen.replaceChildren();
  // إعادة الصنف إلى أصله، وإلا تسرّبت أصنافُ شاشةٍ إلى ما بعدها.
  screen.className = 'screen';
  screen.scrollTop = 0;

  const node = view(params);
  if (node) screen.appendChild(node);

  renderTabs(params.tab ?? TAB_OF[name] ?? name);
  stampCredit(screen, node);
  screen.focus({ preventScroll: true });
  announce(screen);
  return node;
}

/* ── إعلانُ تبدُّلِ الشاشة ─────────────────────────────────────────────── */

/**
 * التطبيقُ صفحةٌ واحدةٌ لا تُعاد تحميلاً، فتبدُّلُ الشاشةِ **صامتٌ** عند قارئِ
 * الشاشة: يُبدَّل المحتوى كلُّه ولا يُقال شيء، فيبقى المستعملُ يظنُّ نفسَه في
 * موضعه الأوّل ويسأل ما الذي وقع.
 *
 * ولم يكن في الصفحةِ موضعُ `aria-live` واحد. فأُضيف موضعٌ خفيٌّ يُكتَب فيه
 * اسمُ الشاشةِ بعدَ رسمها فيُقرَأ مرّةً، و`document.title` يُبدَّل معه — فهو
 * الذي يُقرَأ في قائمةِ الألسنةِ وفي سجلِّ المتصفّح.
 *
 * والاسمُ يُؤخَذ من عنوانِ الشاشةِ نفسِه (`h1`) لا من قائمةٍ تُكتَب بيدٍ، فلا
 * تُنسى شاشةٌ تُضاف ولا يُخالِف المُعلَنُ المرسوم.
 */
const BASE_TITLE = 'منصة الاستعداد لاختبارات الوظائف الدينية';
let crier = null;

function announce(screen) {
  if (!crier) {
    crier = el('div', {
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
      // يُقرَأ ولا يُرى: `display:none` يُخرِجه من شجرةِ الوصولِ فلا يُقرَأ.
      style: {
        position: 'absolute', width: '1px', height: '1px', overflow: 'hidden',
        clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap',
      },
    });
    document.body.appendChild(crier);
  }
  const h = screen.querySelector('h1, h2, [role="heading"]');
  const title = (h && h.textContent.trim()) || '';
  crier.textContent = title || 'شاشةٌ جديدة';
  try {
    document.title = title ? `${title} — ${BASE_TITLE}` : BASE_TITLE;
  } catch { /* لا شيء */ }
}

export const currentRoute = () => current;

/**
 * سطرُ الاعتماد على **كلِّ** شاشة — يُلحَق من مكانٍ واحد، فلا تُنسى شاشةٌ إذا
 * أُضيفت، ولا يُنسى حذفُه إذا حُذفت.
 *
 * ويُعلَّق على الشاشةِ لا على اللوحِ الذي تُرجِعه الشاشة، لأنّ شاشةَ الأسئلة
 * تُعيد رسمَ لوحِها مع كلِّ سؤال، فلو عُلِّق عليه لمُحي عند أوّلِ انتقال.
 * ومن أثبته في لوحِه (الرئيسيةُ وحسابي والمسار) لا يُكرَّر عليه.
 */
function stampCredit(screen, node) {
  if (node && node.querySelector && node.querySelector('.credit')) return;
  screen.appendChild(credit());
}

function renderTabs(active) {
  const nav = tabbarEl();
  const tab = TABS.find((t) => t.id === active);
  if (!tab) {
    nav.hidden = true;
    nav.replaceChildren();
    return;
  }
  nav.hidden = false;
  nav.replaceChildren(
    ...TABS.map((t) =>
      el('button', {
        onclick: () => go(t.id),
        'aria-current': t.id === active ? 'page' : null,
        'aria-label': t.icon ? t.label : null,
        html: t.icon || null,
        class: t.icon ? 'tab-icon' : null,
      }, t.icon ? null : t.label),
    ),
  );
}

/** يُخفي شريط التنقّل داخل مهمّةٍ مركَّزة (جلسة تسميعٍ مثلاً) حتى لا يحجب أزرارها. */
export function hideTabs() {
  const nav = tabbarEl();
  nav.hidden = true;
  nav.replaceChildren();
}
