// ٠٨ — محرّك التجويد. ٥٦٤ آية × ٢٩٣٨ حكماً، كلمةً كلمة، على غاية المريد.
// الرواية: حفصٌ من طريق الشاطبية، كما يُلزم به ميثاق المسجد الإمامَ (ص١٠٣).

import * as data from '../data.js';
import { el, ar, go, topbar, empty } from '../ui.js';

// تلوينٌ على أسرتين اثنتين فقط — كما في التصميم: الغنّة والإدغام أخضر، والمدود ذهبيّ.
const FAMILY = (ruleKey = '', rule = '') => {
  if (/^madd|madd_/.test(ruleKey) || rule.startsWith('مدّ')) return 'madd';
  if (/ghunnah|idgham|ikhfa|iqlab|izhar/.test(ruleKey)) return 'ghunnah';
  return null;
};

let cache = null;

export default function tajweedScreen({ index = 0 } = {}) {
  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } });

  if (cache) {
    paint(wrap, index);
  } else {
    wrap.append(empty('يُحمَّل محرّك التجويد…', 'نحو ٩٠٠ كيلوبايت، مرةً واحدة.'));
    data.loadTajweed().then((db) => {
      cache = db;
      paint(wrap, index);
    }).catch(() => {
      wrap.replaceChildren(empty('تعذّر تحميل أحكام التجويد', 'تأكّد من وجود ملف data/tajweed.'));
    });
  }

  return wrap;
}

function paint(wrap, index) {
  const ayat = cache.ayat;
  const i = Math.max(0, Math.min(ayat.length - 1, index));
  const a = ayat[i];

  wrap.replaceChildren(
    // الشريطُ العلويُّ كالشاشاتِ كلِّها: خروجٌ ثمّ عنوان. وكان ركناه مشغولَين
    // بتنقُّلِ الآيات فلم يبقَ للطالبِ بابٌ يخرج منه، فيبقى محبوساً في الآية.
    topbar({ onBack: () => go('surahs'), title: `سورة ${a.surahName} — آية ${ar(a.ayah)}` }),

    el('div', { style: { padding: '22px 24px 26px', display: 'flex', flexDirection: 'column', gap: '18px', flexShrink: '0' } }, [
      ayahLine(a),
      el('div.legend', [
        el('span', [el('i', { style: { background: 'var(--green)' } }), 'الغنّة والإدغام']),
        el('span', [el('i', { style: { background: '#a07a2c' } }), 'المدود']),
      ]),
      el('div.ayahnav', [
        el('button', { onclick: () => paint(wrap, i - 1), disabled: i === 0 }, '→ السابقة'),
        el('span.num', `${ar(i + 1)} من ${ar(ayat.length)}`),
        el('button', { onclick: () => paint(wrap, i + 1), disabled: i === ayat.length - 1 }, 'التالية ←'),
      ]),
    ]),

    rulingsSheet(a),
  );

  wrap.closest('.screen')?.scrollTo({ top: 0 });
}

/** الآية بكلماتها، وكل كلمةٍ لها حكمٌ تُوضَع تحتها خطٌّ بلون أسرته. */
function ayahLine(a) {
  const words = a.uthmani.split(' ');
  const hl = new Map();
  for (const r of a.rulings) {
    const fam = FAMILY(r.ruleKey, r.rule);
    // المدّ يغلب في العرض لأنه أظهر أثراً في التلاوة
    if (fam && (!hl.has(r.wordIndex) || fam === 'madd')) hl.set(r.wordIndex, fam);
  }

  const line = el('div.ayah');
  words.forEach((w, idx) => {
    line.append(el('w', hl.has(idx) ? { 'data-hl': hl.get(idx) } : null, w));
    if (idx < words.length - 1) line.append(document.createTextNode(' '));
  });
  line.append(el('span.ayah-no', ` ۝${ar(a.ayah)}`));
  return line;
}

function rulingsSheet(a) {
  const sheet = el('div.sheet');
  sheet.append(
    el('div.row-base', [
      el('span', { style: { fontSize: '17px', fontWeight: '700' } }, 'أحكام هذه الآية'),
      el('span.num', { style: { fontSize: '12.5px', color: 'var(--ink-5)' } },
        a.rulingCount ? `${ar(a.rulingCount)} أحكام` : 'لا أحكام'),
    ]),
  );

  const body = el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' } });

  a.rulings.forEach((r, idx) => {
    const linked = r.linkedQuestion ? data.questionById(r.linkedQuestion) : null;

    if (idx === 0) {
      // الحكم الأول مبسوطٌ بلونه، وما بعده مطويٌّ في صفوف.
      body.append(el('div.card.card--green', { style: { borderRadius: 'var(--r-card-2)' } }, [
        el('div.row', [
          el('span', { style: { fontSize: '16px', fontWeight: '700' } }, r.rule),
          el('span', { style: { fontFamily: 'var(--quran)', fontSize: '24px' } }, r.word),
        ]),
        el('p', { style: { fontSize: '13.5px', lineHeight: '1.95', opacity: '0.9' } }, r.note || ''),
        el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' } }, [
          el('span.pagecite', 'غاية المريد'),
          linked
            ? el('button', {
                onclick: () => go('quiz', { questions: [linked], mode: 'study', title: 'سؤال التجويد المرتبط' }),
                style: {
                  font: 'inherit', fontSize: '12.5px', fontWeight: '600', marginInlineStart: 'auto',
                  background: 'none', border: 'none', color: 'inherit', opacity: '0.9', cursor: 'pointer',
                },
              }, 'السؤال المرتبط ←')
            : null,
        ]),
      ]));
      return;
    }

    body.append(el(linked ? 'button.card.card--paper' : 'div.card.card--paper', {
      style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px' },
      onclick: linked ? () => go('quiz', { questions: [linked], mode: 'study', title: 'سؤال التجويد المرتبط' }) : undefined,
    }, [
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'start' } }, [
        el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, r.rule),
        el('span', { style: { fontSize: '12.5px', color: 'var(--ink-4)' } },
          `${r.note ? r.note.split('—')[0].trim() + ' · ' : ''}${r.word}`),
      ]),
      linked ? el('span', { 'aria-hidden': 'true', style: { fontSize: '18px', color: 'var(--ink-8)' } }, '‹') : null,
    ]));
  });

  if (!a.rulings.length) body.append(el('p.lede', 'لا أحكامَ مستخرَجةً في هذه الآية.'));

  sheet.append(body, el('p.fine', { style: { marginTop: 'auto', color: 'var(--ink-5)' } },
    'الرواية: حفصٌ من طريق الشاطبية. الأحكام مستخرَجةٌ آلياً وبانتظار مراجعة مُقرِئٍ مجاز.'));
  return sheet;
}

/* ── فهرس السور ─────────────────────────────────────────────────────── */

export function surahsScreen() {
  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } });

  // كان الفهرسُ يقذف الطالبَ إلى أوّلِ آيةٍ إن لم يكن المحرّكُ محمَّلاً بعدُ —
  // وهو مدخلُ التجويدِ من الرئيسية، فكان يُقذَف دائماً. فصار يحمّله لنفسه.
  if (cache) {
    paintSurahs(wrap);
  } else {
    wrap.append(empty('يُحمَّل محرّك التجويد…', 'نحو ٩٠٠ كيلوبايت، مرةً واحدة.'));
    data.loadTajweed().then((db) => {
      cache = db;
      paintSurahs(wrap);
    }).catch(() => {
      wrap.replaceChildren(empty('تعذّر تحميل أحكام التجويد', 'تأكّد من وجود ملف data/tajweed.'));
    });
  }

  return wrap;
}

function paintSurahs(wrap) {
  const surahs = [];
  cache.ayat.forEach((a, i) => {
    const last = surahs[surahs.length - 1];
    if (!last || last.surah !== a.surah) surahs.push({ surah: a.surah, name: a.surahName, from: i, ayat: 1 });
    else last.ayat += 1;
  });

  wrap.replaceChildren(
    topbar({ onBack: () => go('home'), title: 'جزء عمّ' }),
    el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', padding: '18px 24px 26px' } }, [
      el('div.list', surahs.map((s) =>
        el('button.list-item', { onclick: () => go('tajweed', { index: s.from }) }, [
          el('span', { style: { fontSize: '16px' } }, `سورة ${s.name}`),
          el('span.num', `${ar(s.ayat)} آية`),
        ]))),
      el('p.fine', { style: { marginTop: '18px' } },
        'لا فواتحَ حروفيّةً في جزء عمّ فلا مدَّ لازمٌ حرفيٌّ فيه البتّة · ولا إمالةَ لحفصٍ فيه · ولا تسهيل · ولا يقع من مواضع السكت إلا ﴿بَلْ ۜ رَانَ﴾.'),
    ]),
  );
}
