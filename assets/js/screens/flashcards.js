// ١٠ — بطاقات الحفظ. للتعدادات وحدها: شروط الصلاة تسعة، وموجبات الغسل سبعة…

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, go, empty, pageCite, devBadge, frac } from '../ui.js';

export default function flashcardsScreen() {
  const track = store.get().track;
  const cards = data.flashcardsOf(track);

  if (!cards.length) return empty('لا بطاقاتٍ بعد', 'البطاقات تُبنى من الأسئلة ذات الإجابات المعدودة.');

  let i = 0;
  let flipped = false;

  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } });

  const paint = () => {
    const { q, count, items, caveats, numbered, stated } = cards[i];
    const known = store.isMemorized(q.id);

    wrap.replaceChildren(
      el('div.topbar', { style: { justifyContent: 'space-between' } }, [
        el('button.iconbtn', { onclick: () => go('home'), 'aria-label': 'رجوع' }, '→'),
        el('h1.topbar-title', 'بطاقات الحفظ'),
        el('span.num', { style: { fontSize: '13px', color: 'var(--ink-5)', width: '38px', textAlign: 'center' } },
          frac(i + 1, cards.length)),
      ]),

      el('div.pane', { style: { gap: '18px' } }, [
        el('div.deck', [
          el('div.under.a'),
          el('div.under.b'),
          el('button.flashcard', {
            onclick: () => { flipped = !flipped; paint(); },
            style: { font: 'inherit', textAlign: 'start', cursor: 'pointer', color: 'inherit' },
          }, flipped ? back(q, count, items, caveats, numbered, stated) : front(q)),
        ]),

        el('div.btn-row', { style: { marginTop: 'auto' } }, [
          el('button.btn', {
            class: known ? 'btn--ghost' : '',
            style: { flex: '1' },
            onclick: () => { store.toggleMemorized(q.id); next(); },
          }, known ? 'حفظتُها ✓' : 'حفظتُها'),
          el('button.btn.btn--ghost', { onclick: next }, 'أعِدها عليّ'),
        ]),
      ]),
    );
  };

  function next() {
    i = (i + 1) % cards.length;
    flipped = false;
    paint();
  }

  function front(q) {
    return [
      el('span.chip', `${q.subject}${q.topic ? ' · ' + q.topic : ''}`),
      el('span', { style: { fontFamily: 'var(--serif)', fontSize: '30px', fontWeight: '700', lineHeight: '1.5' } }, q.question),
      el('div', { style: { marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--hairline)' } }, [
        el('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [pageCite(q), devBadge(q)]),
        el('span.fine', 'اقلب البطاقة'),
      ]),
    ];
  }

  function back(q, count, items, caveats, numbered, stated) {
    return [
      el('span.chip', `${q.subject}${q.topic ? ' · ' + q.topic : ''}`),
      count ? el('span.count', count) : null,
      // لا تُرقَّم البنود إلا إذا فُصلت عن القيود بيقين، وإلا ناقض الترقيمُ
      // العددَ المذكور فعلَّم الطالب خطأً.
      el('ol', items.map((t, n) => el('li', numbered ? `${ar(n + 1)} — ${t}` : `— ${t}`))),
      // وإن كان العددُ المذكورُ غيرَ عددِ ما سيقَ قيل ذلك في البطاقةِ نفسِها،
      // فلا يحفظ الطالبُ ناقصاً وهو يحسبه تامّاً. (وموضعُ إصلاحِه البياناتُ
      // لا هذه الشاشة — انظر `flashcardsOf` في data.js.)
      stated
        ? el('span.fine', { style: { color: 'var(--sand-ink3)' } },
            `العددُ في الكتاب ${ar(stated)}، والمذكورُ ههنا ${ar(items.length)} — فالبطاقةُ ناقصةٌ، راجِعْ صفحتَها.`)
        : null,
      caveats && caveats.length
        ? el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px', borderTop: '1px solid var(--hairline)' } },
            [el('span.fine', { style: { color: 'var(--sand-ink3)' } }, 'قيود:'),
             ...caveats.map((c) => el('span.fine', `· ${c}`))])
        : null,
      el('div', { style: { marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--hairline)' } }, [
        el('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [pageCite(q), devBadge(q)]),
        el('span.fine', 'اقلبها ثانيةً'),
      ]),
    ];
  }

  paint();
  return wrap;
}
