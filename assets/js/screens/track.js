// ٠١ — اختيار المسار. أوّل شاشةٍ في التطبيق، وكلُّ ما بعدها يُفلتَر على اختيارها.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, go } from '../ui.js';

/**
 * شعارُ التطبيق — محرابٌ مرسوم، لا حرفاً في مربَّع.
 *
 * كان حرفَ «و» فبدا كأنّه اختصارُ جهةٍ رسمية، والتطبيقُ ليس جهةً ولا يمثّلها.
 * والمحرابُ يدلُّ على موضعِ الإمامِ من غيرِ ادِّعاءِ صفةٍ، ويُرسَم متجهاً فيستوي
 * على كلِّ شاشةٍ ولا يقعُ في تفاوتِ الخطوط. وقوسُه من قوسِ حرفِ الحاءِ في أميري.
 */
const MARK = () => el('span', {
  style: { display: 'flex', width: '54px', height: '54px' },
  'aria-hidden': 'true',
  html: `<svg viewBox="0 0 54 54" width="54" height="54" fill="none">
    <rect width="54" height="54" rx="18" fill="var(--green)"/>
    <path d="M27 12.5c-5.6 0-10 4.3-10 9.8V39h20V22.3c0-5.5-4.4-9.8-10-9.8z"
          stroke="var(--paper)" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M27 25.2c-1.7 0-2.9 1.3-2.9 3V39h5.8v-10.8c0-1.7-1.2-3-2.9-3z"
          fill="var(--paper)"/>
    <path d="M13 42.5h28" stroke="var(--paper)" stroke-width="2.3" stroke-linecap="round"/>
  </svg>`,
});

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
        MARK(),
        el('h1.display', { style: { marginTop: '8px' } }, 'اختر مسارك'),
        el('p.lede', { style: { maxWidth: '300px' } }, 'يُفلتَر المنهج كلّه على مسارك: الكتب، والأسئلة، ومقدار الحفظ.'),
      ]),

      // مجموعةٌ لها اسمٌ يُقرَأ: البطاقاتُ الثلاثُ خيارٌ واحدٌ يُختار منه واحد،
      // وكانت `aria-pressed` بلا ما يربطها فتُنطَق ثلاثةَ أزرارِ تبديلٍ متفرّقة.
      el('div.stack', { role: 'group', 'aria-label': 'مسارك في المنهج' },
        Object.entries(tracks).map(([key, t]) => {
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
                  'aria-hidden': 'true',
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
