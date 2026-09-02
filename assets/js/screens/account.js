// حسابي — التقدّم، وتغيير المسار، والتنبيهات التي لا يصحّ إخفاؤها.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, pct, go, padNav, credit, devMode } from '../ui.js';

export default function accountScreen() {
  const track = store.get().track;
  const pool = data.forTrack(track);
  const subjects = store.bySubject(pool).sort((a, b) => b.mastery - a.mastery);
  const label = data.manifest().tracks[track].label;
  const r = store.rank();
  const ch = store.chapters(pool);

  return padNav(el('div.pane', [
    el('div.stack', { style: { gap: '6px' } }, [
      el('h1.title', 'حسابي'),
      el('p.lede', `مسار ${label} — أجبتَ عن ${ar(store.seenCount())} سؤالاً.`),
    ]),

    el('div.card', { style: { gap: '10px' } }, [
      el('div.row-base', [
        el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, r.name),
        el('span.num', { style: { fontSize: '13px', color: 'var(--ink-5)' } }, `${ar(r.points)} نقطة`),
      ]),
      el('div.bar', el('i', { style: { width: `${Math.round(r.pct * 100)}%` } })),
      el('span.fine', { style: { textAlign: 'start' } },
        `${r.next ? `${ar(r.toNext)} نقطةً إلى «${r.next}» — ` : ''}أتقنتَ ${ar(ch.mastered)} من ${ar(ch.total)} باباً.`),
    ]),

    el('div.stack', [
      el('span.section-title', 'الإتقان حسب العلم'),
      el('div.stack', subjects.map((s) =>
        el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
          el('div.row', { style: { fontSize: '13.5px' } }, [
            el('span', s.subject),
            el('span.num', { style: { color: 'var(--ink-4)' } },
              s.done ? `${ar(s.done)}/${ar(s.total)} — ${pct(s.mastery)}` : '—'),
          ]),
          el('div.bar', el('i', { style: { width: `${Math.round(s.mastery * 100)}%` } })),
        ]))),
    ]),

    devMode()
      ? el('button.card.card--green', { onclick: () => go('review') }, [
          el('div.row', [
            el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, 'اعتماد التوثيق'),
            el('span', { style: { fontSize: '18px', opacity: '0.7' } }, '‹'),
          ]),
          el('span', { style: { fontSize: '12.5px', lineHeight: '1.8', opacity: '0.88', textAlign: 'start' } },
            'مرّ على الأسئلة غير الموثَّقة وأقرّها على صفحاتها. للمراجع لا للطالب.'),
        ])
      : null,

    goalCard(),

    el('button.card', { onclick: () => go('track') }, [
      el('div.row', [
        el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, 'غيّر المسار'),
        el('span', { style: { fontSize: '18px', color: 'var(--ink-8)' } }, '‹'),
      ]),
      el('span.fine', { style: { textAlign: 'start' } }, 'الأئمة · المؤذنون · المتقاعدون'),
    ]),

    // التنبيهان اللذان لا يُخفَيان عن الطالب (README §٥.٣ و§٥.٤)
    el('div.card.card--sand', { style: { gap: '8px' } }, [
      el('span', { style: { fontSize: '13.5px', fontWeight: '600', color: 'var(--sand-ink)' } }, 'قبل أن تعتمد على هذه الأسئلة'),
      el('span.fine', { style: { color: 'var(--sand-ink2)' } },
        'هي اجتهادٌ تدريبيٌّ مبنيٌّ على الكتب المقرَّرة، لا أسئلةَ اختباراتٍ رسمية — والوزارة لا تنشر نماذج أسئلة. والفقه على المذهب الحنبليّ، فالصواب ما في دليل الطالب لا ما اشتُهر في غيره.'),
    ]),

    el('div.card', { style: { gap: '8px' } }, [
      el('span', { style: { fontSize: '13.5px', fontWeight: '600' } }, 'بياناتك'),
      el('span.fine', 'تقدّمك محفوظٌ على جهازك وحده. لا حساب، ولا خادم، ولا بياناتٍ شخصية. وتسجيلات التسميع تُحذف تلقائياً بعد ٣٠ يوماً.'),
      el('button', {
        onclick: () => {
          if (confirm('سيُمحى تقدّمك كلّه من هذا الجهاز. أمتأكّد؟')) { store.reset(); go('track'); }
        },
        style: {
          font: 'inherit', fontSize: '13.5px', color: 'var(--wrong)', background: 'none',
          border: 'none', cursor: 'pointer', textAlign: 'start', padding: '4px 0 0',
        },
      }, 'امسح تقدّمي'),
    ]),

    el('p.fine', { style: { textAlign: 'center' } },
      'إدارة الشؤون الفنية — قطاع المساجد، هاتف ٢٢٢٦٢٧٤٠'),

    credit(),
  ]));
}

/**
 * قَدرُ الوِرد اليوميّ. خِياراتٌ محدودةٌ لا حقلُ إدخالٍ حرّ: الطالب يختار عادةً
 * قبل أن يعرف طاقتَه، فحصرُ الخيار أرفقُ به من تركه أمام خانةٍ فارغة.
 */
function goalCard() {
  const OPTIONS = [10, 20, 30, 50];
  const card = el('div.card', { style: { gap: '10px' } });

  const draw = () => {
    const goal = store.dailyGoal();
    card.replaceChildren(
      el('div.row-base', [
        el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, 'وِرد اليوم'),
        el('span.num', { style: { fontSize: '13px', color: 'var(--ink-5)' } }, `${ar(goal)} سؤالاً`),
      ]),
      el('span.fine', { style: { textAlign: 'start' } },
        'كم سؤالاً تلتزمه كلَّ يوم؟ الدفعةُ الصغيرة المتَّصلة أنفعُ من جلسةٍ واحدةٍ طويلة.'),
      el('div', { style: { display: 'flex', gap: '8px', paddingTop: '2px' } },
        OPTIONS.map((n) => el('button.chip', {
          onclick: () => { store.setDailyGoal(n); draw(); },
          'aria-pressed': n === goal ? 'true' : 'false',
          style: {
            cursor: 'pointer', border: 'none', font: 'inherit', flex: '1',
            background: n === goal ? 'var(--green)' : 'var(--surface)',
            color: n === goal ? 'var(--paper)' : 'var(--ink-3)',
          },
        }, ar(n)))),
    );
  };

  draw();
  return card;
}
