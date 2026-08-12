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

/** شارة صفحة الكتاب — تُعرَض مع كل سؤالٍ موثَّق (README §٥.٢). */
export const pageCite = (q) =>
  q.bookPage ? el('span.pagecite', `${bookNameFor(q)} ${q.bookPage}`) : null;

function bookNameFor(q) {
  if (q.book) return q.book;
  return { الفقه: 'دليل الطالب', التجويد: 'غاية المريد', العقيدة: 'بريق الجمان', النحو: 'التحفة السنية', التفسير: 'زبدة التفسير' }[q.subject] || '';
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

const host = () => document.getElementById('screen');
const tabbarEl = () => document.getElementById('tabbar');

const TABS = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'books', label: 'الكتب' },
  { id: 'recite', label: 'التسميع' },
  { id: 'account', label: 'حسابي' },
];

let routes = {};
let current = null;

export function defineRoutes(map) {
  routes = map;
}

/** go('essay', { … }) — يستبدل محتوى الشاشة ويضبط شريط التنقّل. */
export function go(name, params = {}) {
  const view = routes[name];
  if (!view) throw new Error(`لا توجد شاشة باسم ${name}`);
  current = name;

  const screen = host();
  screen.replaceChildren();
  // إعادة الصنف إلى أصله، وإلا تسرّب pad-nav من شاشةٍ إلى ما بعدها.
  screen.className = 'screen';
  screen.scrollTop = 0;

  const node = view(params);
  if (node) screen.appendChild(node);

  renderTabs(params.tab ?? name);
  screen.focus({ preventScroll: true });
  return node;
}

export const currentRoute = () => current;

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

/** يُستدعى من الشاشات التي يظهر فوقها شريط التنقّل، لترك فراغٍ أسفلها. */
export const padNav = (node) => {
  node.classList.add('pad-nav');
  return node;
};

/** يُخفي شريط التنقّل داخل مهمّةٍ مركَّزة (جلسة تسميعٍ مثلاً) حتى لا يحجب أزرارها. */
export function hideTabs() {
  const nav = tabbarEl();
  nav.hidden = true;
  nav.replaceChildren();
}

/* ── الساعة في شريط الحالة ───────────────────────────────────────────── */

export function startClock() {
  const node = document.getElementById('clock');
  const tick = () => {
    const d = new Date();
    const h = d.getHours() % 12 || 12;
    node.textContent = `${ar(h)}:${ar(String(d.getMinutes()).padStart(2, '0'))}`;
  };
  tick();
  setInterval(tick, 20_000);
}
