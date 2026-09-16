// عارض صفحة الكتاب — طبقةٌ تعلو الشاشة الجارية ولا تستبدلها.
//
// الفكرة كلّها في السرعة: فتح الكتاب كاملاً يعني تنزيل ملفٍّ بالميغابايتات،
// أما صورة الصفحة الواحدة فنحو ٥٠ كيلوبايت فتظهر في لمح البصر. والكتاب كاملاً
// يبقى على بُعد ضغطةٍ لمن أراد ما قبل الصفحة وما بعدها.
//
// ولماذا طبقةٌ لا شاشة؟ لأن الطالب قد يفتحها وهو في أثناء التصحيح الذاتيّ،
// فلو استُبدلت الشاشة لضاع تأشيره على النقاط. الطبقة تُغلَق فيجد عمله كما تركه.

import * as data from '../data.js';
import { el, ar, empty } from '../ui.js';

const TITLE = {
  'daleel-altalib': 'دليل الطالب لنيل المطالب',
  'ghayat-almureed': 'غاية المريد في علم التجويد',
  'tuhfa-saniyya': 'التحفة السنية بشرح الآجرومية',
  'meethaq-almasjid': 'ميثاق المسجد',
  'bareeq-aljuman': 'بريق الجمان بشرح أركان الإيمان',
  'zubdat-altafseer': 'زبدة التفسير',
};

export const bookTitle = (id) => TITLE[id] || 'الكتاب';

/**
 * النسخةُ ذاتُ الملفِّ الواحد (`tools/بناء_نسخة_واحدة.py`) لا تحمل الكتبَ PDF
 * (٢٧ م.ب) ولا صورَ الصفحات (١٢ م.ب). فيُصرَّح بذلك للطالبِ في موضعه، ولا
 * يُترَك رابطاً مكسوراً ولا زرّاً يَعِدُ بما لا يفي به.
 */
const PREVIEW = typeof window !== 'undefined' && window.__PREVIEW === true;

let layer = null;
let returnFocusTo = null;

/*
 * أقيدَ الطبقةِ في سجلِّ المتصفّحِ ما زال قائماً؟
 *
 * الطبقةُ تدفع قيداً عند فتحِها (`history.pushState`) ليستهلكَه زرُّ الرجوع
 * فتُغلَق وحدَها. فإن أُغلِقت بـ✕ أو بـEscape بقي القيدُ **يتيماً** في السجلّ:
 * لا طبقةَ تُغلَق به، فتُصرَف به ضغطةُ رجوعٍ إلى غيرِ ما قصدَ الطالب. ومن فتح
 * خمسَ صفحاتٍ وأغلقها بـ✕ خلَّف خمسةَ قيود.
 *
 * فمن أغلقَ بيدِه استُهلِك قيدُه بـ`history.back()`. ومن أغلقَ بزرِّ الرجوعِ
 * فالقيدُ مستهلَكٌ أصلاً، ولو استُهلِك ثانيةً لخرجَ من شاشته — فيُفرَّق بينهما
 * بـ`fromPop`.
 */
let pushedEntry = false;

/** يعرفه الموجِّه ليجعل زرَّ الرجوعِ يُغلق الطبقةَ لا يغادر الشاشة. */
export const isPageOpen = () => !!layer;

export function closePage(fromPop = false) {
  const had = pushedEntry;
  pushedEntry = false;
  layer?.remove();
  layer = null;
  document.removeEventListener('keydown', onKey);
  // القيدُ اليتيمُ يُستهلَك — إلا أن يكون الرجوعُ نفسُه هو الذي أغلقها.
  if (had && !fromPop) {
    try { history.back(); } catch { /* لا شيء */ }
  }

  // يُرفَع الجمودُ عمّا تحتها ويعود التركيزُ إلى ما فُتِحت منه — وإلا وقف
  // التركيزُ على عنصرٍ مُزال، فتبدأ لوحةُ المفاتيحِ من أوّل الصفحةِ كلَّ مرّة.
  for (const id of ['screen', 'tabbar']) document.getElementById(id)?.removeAttribute('inert');
  if (returnFocusTo && document.contains(returnFocusTo)) returnFocusTo.focus({ preventScroll: true });
  returnFocusTo = null;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function onKey(e) {
  if (!layer) return;
  if (e.key === 'Escape') { closePage(); return; }
  if (e.key !== 'Tab') return;

  // حجزٌ يدويٌّ للدَّور — احتياطاً لمتصفّحٍ لا يعرف `inert`، ولأنّ `inert` لا
  // يُدير الدَّورَ داخلَ الطبقةِ نفسِها.
  const items = [...layer.querySelectorAll(FOCUSABLE)].filter((n) => !n.disabled);
  if (!items.length) { e.preventDefault(); layer.focus(); return; }
  const first = items[0];
  const last = items[items.length - 1];
  const here = document.activeElement;
  if (!layer.contains(here)) { e.preventDefault(); first.focus(); return; }
  if (!e.shiftKey && here === last) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && here === first) { e.preventDefault(); last.focus(); }
}

/** يفتح صفحةً من كتابٍ فوق الشاشة الجارية. */
export function openPage(ref) {
  // طبقةٌ تُفتَح فوق أخرى تَرِث قيدَها ولا تدفع ثانياً — وإلا تراكمت القيود.
  const inherit = pushedEntry;
  closePage(true);
  let page = ref.page;

  /*
   * الطبقةُ تُعلِن `aria-modal` فيجب أن تكون حاجزةً فعلاً.
   *
   * وكانت تُعلِنه ولا تحجز شيئاً: التركيزُ يبقى على الشارةِ التي فُتِحت منها
   * **خارج** الطبقة، وTab يمشي على ما تحتها — أزرارُ التصحيحِ الذاتيِّ
   * و«السؤال التالي» — فيؤشِّر الطالبُ درجةً ويُثبِّتها وينقل السؤالَ **من غير
   * أن يرى ما يفعل**، والطبقةُ تغطّي الشاشة. ومحتوى الطبقةِ نفسِه — الإغلاقُ
   * والصفحةُ السابقةُ والتالية — لا يُنال بلوحةِ المفاتيحِ البتّة.
   *
   * و`inert` يكفي الثلاثةَ: يحجز التركيزَ، ويُخفي عن قارئِ الشاشة، ويمنع النقر.
   * وهو في سفاري من ١٥٫٥، ومن قبلها يبقى الحجزُ اليدويُّ في `onKey` عاملاً.
   */
  layer = el('div.pagelayer', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': `صفحةٌ من ${bookTitle(ref.book)}`,
    tabindex: '-1',
  });
  returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.getElementById('device').appendChild(layer);
  for (const id of ['screen', 'tabbar']) document.getElementById(id)?.setAttribute('inert', '');
  document.addEventListener('keydown', onKey);

  // قيدٌ في سجلِّ المتصفّحِ تستهلكه سحبةُ الرجوع فتُغلَق الطبقةُ وحدَها،
  // ويبقى الطالبُ في شاشته — ولا يُقذَف منها وقد ترك تصحيحاً في نصفه.
  if (!inherit) history.pushState({ overlay: true }, '');
  pushedEntry = true;

  const paint = () => {
    const total = data.bookPageCount(ref.book);
    const hasPdf = !!total;          // الفهرس لا يُبنى إلا لكتابٍ له ملفّ

    const img = el('img', {
      src: `books/pages/${ref.book}-${page}.jpg`,
      alt: `صفحة ${page} من ${bookTitle(ref.book)}`,
      style: { width: '100%', height: 'auto', display: 'block', borderRadius: '18px', background: '#fff' },
    });

    const body = el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', padding: '0 20px 4px' } }, img);
    img.addEventListener('error', () => {
      /*
       * السببُ يُقال على وجهِه، ولا يُخلَط سببٌ بسبب.
       *
       * وكانت الرسالةُ واحدةً: «هذه الصفحة غير مرسومة» — تُقال للإمامِ في مسجدٍ
       * لا شبكةَ فيه، والصفحةُ **مرسومةٌ** وموجودةٌ على الخادم، وإنّما لم
       * تُحمَّل بعد. فيُصدَّق أنّها ناقصةٌ من التطبيق، ويَكِلُّ عن طلبها ثانيةً
       * حيث تُنال — وهذا ضررُ الخبرِ الخاطئ، لا ضررُ انقطاعِ الشبكة.
       *
       * وثلاثةُ أسبابٍ لا رابعَ لها: نسخةٌ تجريبيّةٌ لا صورَ فيها، أو انقطاعُ
       * شبكةٍ وما خُزِّنت، أو كتابٌ ليس في التطبيقِ أصلاً.
       */
      const offline = !navigator.onLine;
      const title = PREVIEW ? 'صور الصفحات ليست في النسخة التجريبية'
        : offline ? 'لا شبكة — وهذه الصفحة لم تُحمَّل بعد'
        : hasPdf ? 'هذه الصفحة غير مرسومة'
        : `${bookTitle(ref.book)} غير مرفوعٍ داخل التطبيق`;
      const note = PREVIEW
        ? `المطلوب صفحة ${ar(page)} من ${bookTitle(ref.book)} — وهي في النسخة المنشورة كاملةً.`
        : offline
          ? `صفحة ${ar(page)} موجودةٌ في التطبيق، وتُفتَح وتبقى في جهازك إذا فتحتَها مرّةً والشبكةُ موصولة.`
          : hasPdf ? 'افتح الكتاب كاملاً من الزرّ أدناه.'
            : `المطلوب صفحة ${ar(page)}. افتح الكتاب من مرجعه الرسميّ أدناه.`;

      body.replaceChildren(el('div.card.card--sand', [
        el('span', { style: { fontSize: '13.5px', fontWeight: '600', color: 'var(--sand-ink)' } }, title),
        el('span.fine', { style: { color: 'var(--sand-ink2)' } }, note),
      ]), bookRefCard(ref.book));
    });

    layer.replaceChildren(
      el('div.topbar', { style: { justifyContent: 'space-between', paddingTop: '18px' } }, [
        // `onclick: closePage` كان يُمرِّر الحدثَ مكانَ `fromPop` فيُقرَأ صِدقاً
        // ويُترَك القيدُ يتيماً — فيُلَفُّ النداءُ.
        el('button.iconbtn', { onclick: () => closePage(), 'aria-label': 'إغلاق' }, '✕'),
        el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' } }, [
          el('span', { style: { fontSize: '13.5px', fontWeight: '600' } }, bookTitle(ref.book)),
          el('span', { style: { fontSize: '12px', color: 'var(--ink-5)' } },
            total ? `صفحة ${ar(page)} من ${ar(total)}` : `صفحة ${ar(page)}`),
        ]),
        el('span', { style: { width: '38px' } }),
      ]),

      /*
       * شارةٌ صريحة، وثلاثُ درجاتٍ لا درجتان — كانت تقول «قوبِلت على الكتاب»
       * عن ٤٦٦ سؤالاً قوبِلت على نصٍّ مستخرَجٍ لا على صورةِ صفحةٍ، وكتابُها
       * لا صورةَ له في التطبيقِ أصلاً. (الشرحُ عند `collationOf` في data.js.)
       */
      el('div', { style: { padding: '8px 20px 12px', display: 'flex' } },
        ref.collated === 'image'
          ? el('span.pagecite', `${ref.label} — قوبِلت على صورة الصفحة`)
          : ref.collated === 'text'
            ? el('span.hintcite', `${ref.label} — قوبِلت على نصٍّ مستخرَجٍ، لا على صورة`)
            : el('span.hintcite', 'ترشيحٌ آليّ — قد لا تكون هذه صفحته')),

      body,

      el('div', { style: { padding: '12px 20px max(20px, env(safe-area-inset-bottom))', display: 'flex', gap: '10px', alignItems: 'center', flexShrink: '0' } }, [
        el('button.iconbtn', {
          onclick: () => { if (page > 1) { page -= 1; paint(); } },
          disabled: page <= 1, 'aria-label': 'الصفحة السابقة',
        }, '→'),
        /*
         * `PREVIEW` يُعلَن في بقيّةِ الملفِّ ولم يُعلَن ههنا.
         *
         * فكان زرُّ «افتح الكتاب كاملاً» يظهر في نسخةِ الملفِّ الواحدِ أيضاً،
         * وهي لا تحمل الكتبَ PDF (٢٧ م.ب) — فيُفتَح لسانٌ على لا شيء. وهذه
         * النسخةُ هي التي تُرسَل في واتساب لمن يُجرِّب، فأوّلُ ما يلمسه زرٌّ
         * يَعِدُ ولا يفي.
         */
        PREVIEW
          ? el('span', { style: { flex: '1', textAlign: 'center', fontSize: '12.5px', color: 'var(--ink-6)' } },
              'الكتب كاملةً في النسخة المنشورة')
          : hasPdf
            ? el('a.btn', {
                href: `books/${ref.book}.pdf#page=${page}`, target: '_blank', rel: 'noopener',
                style: { flex: '1', fontSize: '15px', textDecoration: 'none' },
              }, 'افتح الكتاب كاملاً')
            : el('span', { style: { flex: '1', textAlign: 'center', fontSize: '12.5px', color: 'var(--ink-6)' } },
                'الكتاب غير مرفوع'),
        el('button.iconbtn', {
          onclick: () => { if (!total || page < total) { page += 1; paint(); } },
          disabled: !!total && page >= total, 'aria-label': 'الصفحة التالية',
        }, '←'),
      ]),
    );
  };

  paint();

  // التركيزُ ينتقل إلى الطبقةِ بعد رسمِها — فيبدأ الدَّورُ من داخلها، ويعلم
  // قارئُ الشاشةِ أنّ نافذةً فُتِحت وما اسمُها.
  (layer.querySelector(FOCUSABLE) || layer).focus({ preventScroll: true });

}

/**
 * بطاقة المرجع — البديل حين لا يكون الكتاب مرفوعاً.
 * وهو ما أوصى به دليل الكتب: أَحِل الطالبَ على المصدر الرسميّ بدل رفع الملفّ.
 */
export function bookRefCard(bookId) {
  const info = data.bookLink(bookId);
  if (!info) return null;
  return el('div.card', { style: { gap: '10px' } }, [
    el('div.row', [
      el('span', { style: { fontSize: '13px', fontWeight: '600', color: 'var(--green)' } }, 'مرجع الكتاب'),
      el('span.fine', info.author || ''),
    ]),
    ...(info.links || []).map((l) =>
      el('a', {
        href: l.url, target: '_blank', rel: 'noopener',
        style: {
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
          background: l.best ? 'var(--green-tint)' : 'var(--paper)', borderRadius: '16px',
          padding: '12px 15px', textDecoration: 'none', color: 'var(--ink)',
          fontSize: '13.5px', lineHeight: '1.6',
        },
      }, [el('span', l.label), el('span', { 'aria-hidden': 'true', style: { color: 'var(--ink-8)' } }, '↗')])),
    info.warning ? el('p.fine', { style: { color: 'var(--sand-ink3)' } }, info.warning) : null,
  ]);
}

/** فهرس الكتب الكاملة — مدخلٌ للتصفّح الحرّ من شاشة «الكتب». */
export function libraryScreen() {
  const inside = [], outside = [];
  for (const [id, title] of Object.entries(TITLE)) {
    (data.bookPageCount(id) ? inside : outside).push([id, title]);
  }

  return el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } }, [
    el('div', { style: { padding: '22px 24px 8px', display: 'flex', flexDirection: 'column', gap: '6px' } }, [
      el('h1.title', 'الكتب كاملةً'),
      el('p.lede', PREVIEW
        ? 'هذه نسخةٌ تجريبيةٌ في ملفٍّ واحد، والكتبُ فيها ليست محمولةً. وهي في النسخة المنشورة تُفتَح بلا اتصال.'
        : 'ما كان داخل التطبيق يُفتَح بلا اتصال، وما سواه يُحال إلى مرجعه الرسميّ.'),
    ]),
    el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', padding: '8px 24px 26px', display: 'flex', flexDirection: 'column', gap: '12px' } }, [
      ...inside.map(([id, title]) =>
        el(PREVIEW ? 'div.card' : 'a.card', PREVIEW ? { style: { gap: '10px' } } : {
          href: `books/${id}.pdf`, target: '_blank', rel: 'noopener',
          style: { textDecoration: 'none', color: 'inherit' },
        }, [
          el('div.row', [
            el('span', { style: { fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: '700', textAlign: 'start' } }, title),
            el('span', { 'aria-hidden': 'true', style: { fontSize: '18px', color: 'var(--ink-8)' } }, '‹'),
          ]),
          el('span.fine', PREVIEW
            ? `${ar(data.bookPageCount(id))} صفحة — في النسخة المنشورة`
            : `${ar(data.bookPageCount(id))} صفحة — داخل التطبيق`),
        ])),

      outside.length ? el('span.section-title', { style: { marginTop: '10px' } }, 'كتبٌ تُقرأ من مرجعها') : null,
      ...outside.map(([id, title]) =>
        el('div.card', { style: { gap: '12px' } }, [
          el('span', { style: { fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: '700' } }, title),
          bookRefCard(id),
        ])),
    ]),
  ]);
}
