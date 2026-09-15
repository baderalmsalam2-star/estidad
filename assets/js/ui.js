// أدوات بناء الواجهة: عناصر DOM، والأرقام العربية، والملاحة بين الشاشات.

/* ── الأرقام ─────────────────────────────────────────────────────────── */

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** كل رقمٍ يظهر للطالب يُكتب بالأرقام العربية — قاعدةٌ في التصميم كلّه. */
export function ar(n) {
  return String(n).replace(/\d/g, (d) => AR_DIGITS[+d]);
}

export const pct = (x) => `${ar(Math.round(x * 100))}٪`;

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
export function topbar({ onBack, title, right = null, icon = '→' } = {}) {
  return el('header.topbar', [
    onBack ? el('button.iconbtn', { onclick: onBack, 'aria-label': 'رجوع' }, icon) : el('span', { style: { width: '38px' } }),
    el('span.topbar-title', title || ''),
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

export function empty(title, note) {
  return el('div.empty', [el('span.head', title), note ? el('p.lede', note) : null]);
}

/* ── الملاحة ─────────────────────────────────────────────────────────── */

let pageRef = () => null;
let openPageLayer = () => {};
let onNavigate = () => {};
export const setNavigateHook = (fn) => { onNavigate = fn; };
/** يحقنهما app.js تفادياً لدورة استيرادٍ بين ui وdata وscreens. */
export const setPageRefResolver = (fn) => { pageRef = fn; };
export const setPageOpener = (fn) => { openPageLayer = fn; };

/** أمفتوحةٌ طبقةُ صفحةِ الكتاب فوق الشاشة؟ يحقنه app.js كسابقَيه. */
let overlayOpen = () => false;
export const setOverlayProbe = (fn) => { overlayOpen = fn; };

const host = () => document.getElementById('screen');
const tabbarEl = () => document.getElementById('tabbar');

const TABS = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'books', label: 'الكتب' },
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
  book: 'books', search: 'books', mastered: 'books', library: 'books',
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
const trail = [];
let popping = false;

function remember(name, params) {
  if (popping) return;
  const top = trail[trail.length - 1];
  // إعادةُ رسمِ الشاشةِ نفسِها ليست انتقالاً، فلا تُقيَّد قيداً يُرجَع إليه.
  if (top && top.name === name) { top.params = params; return; }
  trail.push({ name, params });
  if (trail.length === 1) history.replaceState({ depth: 1 }, '');
  else history.pushState({ depth: trail.length }, '');
}

window.addEventListener('popstate', () => {
  // طبقةُ صفحةِ الكتابِ أولى بالرجوع: تُغلَق وتبقى الشاشةُ تحتها.
  if (overlayOpen()) { onNavigate(); return; }

  trail.pop();
  const prev = trail[trail.length - 1];
  if (!prev) return;   // لا شاشةَ قبلها — يُترَك للمتصفّح أن يخرج
  popping = true;
  try {
    go(prev.name, prev.params);
  } finally {
    popping = false;
  }
});

export function defineRoutes(map) {
  routes = map;
}

/** go('essay', { … }) — يستبدل محتوى الشاشة ويضبط شريط التنقّل. */
export function go(name, params = {}) {
  const view = routes[name];
  if (!view) throw new Error(`لا توجد شاشة باسم ${name}`);
  onNavigate();
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
  return node;
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
      }, t.label),
    ),
  );
}

/** يُخفي شريط التنقّل داخل مهمّةٍ مركَّزة (جلسة تسميعٍ مثلاً) حتى لا يحجب أزرارها. */
export function hideTabs() {
  const nav = tabbarEl();
  nav.hidden = true;
  nav.replaceChildren();
}
