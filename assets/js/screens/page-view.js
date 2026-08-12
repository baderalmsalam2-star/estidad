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

let layer = null;

export function closePage() {
  layer?.remove();
  layer = null;
  document.removeEventListener('keydown', onKey);
}

function onKey(e) {
  if (e.key === 'Escape') closePage();
}

/** يفتح صفحةً من كتابٍ فوق الشاشة الجارية. */
export function openPage(ref) {
  closePage();
  let page = ref.page;

  layer = el('div.pagelayer', { role: 'dialog', 'aria-modal': 'true' });
  document.getElementById('device').appendChild(layer);
  document.addEventListener('keydown', onKey);

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
      body.replaceChildren(el('div.card.card--sand', [
        el('span', { style: { fontSize: '13.5px', fontWeight: '600', color: 'var(--sand-ink)' } },
          'هذه الصفحة غير مرسومة'),
        el('span.fine', { style: { color: 'var(--sand-ink2)' } }, hasPdf
          ? 'افتح الكتاب كاملاً من الزرّ أدناه.'
          : `ملفّ ${bookTitle(ref.book)} غير مرفوعٍ بعد، فلا تُعرَض صفحاته داخل التطبيق.`),
      ]));
    });

    layer.replaceChildren(
      el('div.topbar', { style: { justifyContent: 'space-between', paddingTop: '18px' } }, [
        el('button.iconbtn', { onclick: closePage, 'aria-label': 'إغلاق' }, '✕'),
        el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' } }, [
          el('span', { style: { fontSize: '13.5px', fontWeight: '600' } }, bookTitle(ref.book)),
          el('span', { style: { fontSize: '12px', color: 'var(--ink-5)' } },
            total ? `صفحة ${ar(page)} من ${ar(total)}` : `صفحة ${ar(page)}`),
        ]),
        el('span', { style: { width: '38px' } }),
      ]),

      // شارةٌ صريحة: أهي صفحةٌ قوبِلت، أم ترشيحُ بحثٍ آليٍّ قد يخطئ؟
      el('div', { style: { padding: '8px 20px 12px', display: 'flex' } },
        ref.verified
          ? el('span.pagecite', `${ref.label} — قوبِلت على الكتاب`)
          : el('span.hintcite', 'ترشيحٌ آليّ — قد لا تكون هذه صفحته')),

      body,

      el('div', { style: { padding: '12px 20px max(20px, env(safe-area-inset-bottom))', display: 'flex', gap: '10px', alignItems: 'center', flexShrink: '0' } }, [
        el('button.iconbtn', {
          onclick: () => { if (page > 1) { page -= 1; paint(); } },
          disabled: page <= 1, 'aria-label': 'الصفحة السابقة',
        }, '→'),
        hasPdf
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
}

/** فهرس الكتب الكاملة — مدخلٌ للتصفّح الحرّ من شاشة «الكتب». */
export function libraryScreen() {
  const books = Object.entries(TITLE).filter(([id]) => data.bookPageCount(id));
  if (!books.length) return empty('لا كتبَ مرفوعة', 'ضع ملفات PDF في مجلّد books/.');

  return el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } }, [
    el('div', { style: { padding: '22px 24px 8px' } }, el('h1.title', 'الكتب كاملةً')),
    el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', padding: '8px 24px 26px', display: 'flex', flexDirection: 'column', gap: '12px' } },
      books.map(([id, title]) =>
        el('a.card', {
          href: `books/${id}.pdf`, target: '_blank', rel: 'noopener',
          style: { textDecoration: 'none', color: 'inherit' },
        }, [
          el('div.row', [
            el('span', { style: { fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: '700', textAlign: 'start' } }, title),
            el('span', { style: { fontSize: '18px', color: 'var(--ink-8)' } }, '‹'),
          ]),
          el('span.fine', `${ar(data.bookPageCount(id))} صفحة`),
        ]))),
  ]);
}
