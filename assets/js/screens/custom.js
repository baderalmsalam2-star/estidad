// اختبارٌ مخصّص — الطالب يختار العلوم والعدد والصعوبة.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, go, topbar } from '../ui.js';

const COUNTS = [10, 15, 25, 34];
// المُدَياتُ في `data.LEVEL_RANGES` — والسببُ مشروحٌ عندها. والعددُ يُكتَب على
// الزرِّ نفسِه، فلا يختار الطالبُ صعوبةً ثمّ يجد «المتاح: ٠».
const LEVELS = [
  { v: null, label: 'الكلّ' },
  { v: 'easy', label: 'سهل' },
  { v: 'mid', label: 'متوسط' },
  { v: 'hard', label: 'صعب' },
];

export default function customScreen() {
  const track = store.get().track;
  const subjects = data.subjectsOf(track);

  const picked = new Set(subjects.map((s) => s.subject));
  let count = 15;
  let difficulty = null;

  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } });

  const paint = () => {
    // عدٌّ بلا سحب — السحبُ الموزونُ كان يُعاد في كلِّ نقرةٍ ثمّ تُرمى نتيجتُه.
    const available = data.countCustom(track, { subjects: [...picked], difficulty });

    wrap.replaceChildren(
      topbar({ onBack: () => go('home'), title: 'اختبار مخصّص' }),

      el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', padding: '18px 24px 0', display: 'flex', flexDirection: 'column', gap: '22px' } }, [
        group('العلوم', el('div', { role: 'group', 'aria-label': 'العلوم', style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
          subjects.map((s) => toggle(s.subject, `${s.subject} — ${ar(s.total)}`, picked.has(s.subject), () => {
            if (picked.has(s.subject)) picked.delete(s.subject); else picked.add(s.subject);
            if (!picked.size) picked.add(s.subject);
            paint();
          })))),

        group('عدد الأسئلة', el('div', { role: 'group', 'aria-label': 'عدد الأسئلة', style: { display: 'flex', gap: '8px' } },
          COUNTS.map((c) => toggle(c, ar(c), c === count, () => { count = c; paint(); })))),

        group('الصعوبة', el('div', { role: 'group', 'aria-label': 'الصعوبة', style: { display: 'flex', gap: '8px' } },
          LEVELS.map((l) => {
            const n = data.countCustom(track, { subjects: [...picked], difficulty: l.v });
            return toggle(l.label, `${l.label} — ${ar(n)}`, l.v === difficulty,
              () => { difficulty = l.v; paint(); });
          }))),

        el('p.fine', `المتاح بهذه الشروط: ${ar(available)} سؤالاً.`),
      ]),

      el('div', { style: { padding: '14px 24px 26px' } },
        el('button.btn', {
          disabled: !available,
          onclick: () => go('quiz', {
            questions: data.buildCustomExam(track, { subjects: [...picked], count, difficulty }),
            mode: 'custom',
            title: 'اختبار مخصّص',
          }),
        }, available ? `ابدأ — ${ar(Math.min(count, available))} سؤالاً` : 'لا أسئلة بهذه الشروط')),
    );
  };

  paint();
  return wrap;
}

const group = (title, body) =>
  el('div.stack', [el('span.section-title', title), body]);

function toggle(key, label, on, onclick) {
  return el('button', {
    onclick,
    'aria-pressed': on,
    style: {
      font: 'inherit', fontSize: '13.5px', cursor: 'pointer', borderRadius: 'var(--r-chip)',
      padding: '9px 15px', border: 'none',
      background: on ? 'var(--green)' : 'var(--surface)',
      color: on ? 'var(--paper)' : 'var(--ink-3)',
      fontWeight: on ? '600' : '400',
    },
  }, label);
}
