// ٠١ — اختيار المسار. أوّل شاشةٍ في التطبيق، وكلُّ ما بعدها يُفلتَر على اختيارها.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, go } from '../ui.js';

const BLURB = {
  imam: 'ثمانية علوم · بالنحو وفقه المعاملات',
  muezzin: 'لا نحوَ ولا معاملات',
  muezzin_retired: 'القرآن والعقيدة والفقه والميثاق · بلا تجويدٍ ولا حديث',
};

// ما ينفرد به مسار الأئمة — الفروق الثلاثة التي نصّ عليها المنهج الرسميّ.
const TAGS = { imam: ['النحو', 'فقه المعاملات', 'التفسير'] };

export default function trackScreen() {
  const tracks = data.manifest().tracks;
  let picked = store.get().track || 'imam';

  const pane = el('div.pane');

  const render = () => {
    pane.replaceChildren(
      el('div.stack', { style: { gap: '14px' } }, [
        el('div', {
          style: {
            width: '50px', height: '50px', borderRadius: '17px', background: 'var(--green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--paper)', fontFamily: 'var(--serif)', fontSize: '27px', fontWeight: '700',
          },
        }, 'و'),
        el('h1.display', { style: { marginTop: '8px' } }, 'اختر مسارك'),
        el('p.lede', { style: { maxWidth: '300px' } }, 'يُفلتَر المنهج كلّه على مسارك: الكتب، والأسئلة، ومقدار الحفظ.'),
      ]),

      el('div.stack', Object.entries(tracks).map(([key, t]) => {
        const count = data.forTrack(key).length;
        const on = key === picked;

        return el('button.card', {
          class: on ? 'card--green' : '',
          style: { padding: '18px', gap: on ? '12px' : '8px' },
          'aria-pressed': on,
          onclick: () => { picked = key; render(); },
        }, [
          el('div.row', [
            el('span', { style: { fontFamily: 'var(--serif)', fontSize: '30px', fontWeight: '700' } }, t.label),
            on
              ? el('span', {
                  style: {
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: 'rgba(250,247,241,0.22)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '13px',
                  },
                }, '✓')
              : el('span.num', { style: { fontSize: '12.5px', color: 'var(--ink-5)' } }, ar(count)),
          ]),
          el('div', {
            style: {
              fontSize: '13.5px', lineHeight: '1.75',
              color: on ? 'inherit' : 'var(--ink-3)', opacity: on ? '0.88' : '1',
            },
          }, `${t.hifz} · ${BLURB[key] || ''}${on ? `، و${ar(count)} سؤالاً` : ''}`),
          on && TAGS[key]
            ? el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: '2px' } },
                TAGS[key].map((tag) => el('span.chip.chip--onGreen', tag)))
            : null,
        ]);
      })),

      el('div.push.stack', { style: { gap: '14px' } }, [
        // التنبيه الذي لا يُخالَف (README §٥.٣)
        el('p.disclaimer', 'الأسئلة اجتهادٌ تدريبيٌّ مبنيٌّ على الكتب المقرَّرة، لا أسئلةَ اختباراتٍ رسمية.'),
        el('button.btn', {
          onclick: () => { store.setTrack(picked); go('home'); },
        }, 'متابعة'),
      ]),
    );
  };

  render();
  return pane;
}
