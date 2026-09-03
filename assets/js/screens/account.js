// حسابي — التقدّم، وتغيير المسار، والتنبيهات التي لا يصحّ إخفاؤها.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, pct, go, padNav, devMode } from '../ui.js';

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
      ? el('button.card.card--green', { onclick: () => go('admin'), style: { marginBottom: '-4px' } }, [
          el('div.row', [
            el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, 'لوحة المشرف'),
            el('span', { style: { fontSize: '18px', opacity: '0.7' } }, '‹'),
          ]),
          el('span', { style: { fontSize: '12.5px', lineHeight: '1.8', opacity: '0.88', textAlign: 'start' } },
            'صحّةُ بنك الأسئلة وثغراتُه، وأرقامُ هذا الجهاز. للمشرف لا للطالب.'),
        ])
      : null,

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

    contactCard(),
  ]));
}

/**
 * التواصل مع صاحب التطبيق.
 *
 * كان ههنا هاتفُ إدارةِ الشؤون الفنية، فحُذف: التطبيقُ ليس جهةً رسميةً ولا
 * يتكلّم باسمها، ونشرُ هاتفِها فيه يوهم الطالبَ أنّه قناتُها.
 *
 * والرقمُ في `CONTACT` رقمُ صاحبِ المشروع، فلا يُخمَّن ولا يُملأ إلا من فمه.
 * وما دام فارغاً فلا زرَّ أصلاً — لا زرٌّ يفتح محادثةً مع لا أحد.
 */
const CONTACT = {
  // رقمٌ دوليٌّ بلا + ولا فراغات، مثل: '96550000000'
  whatsapp: '',
  message: 'السلام عليكم، عندي ملاحظةٌ على تطبيق الاستعداد:',
};

function contactCard() {
  if (!CONTACT.whatsapp) return null;
  const href = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(CONTACT.message)}`;

  return el('a.card', {
    href, target: '_blank', rel: 'noopener',
    style: { textDecoration: 'none', color: 'inherit', gap: '8px' },
  }, [
    el('div.row', [
      el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, 'راسِلنا على واتساب'),
      el('span', { style: { display: 'flex', color: 'var(--green)' }, html: WHATSAPP_MARK }),
    ]),
    el('span.fine', { style: { textAlign: 'start' } },
      'خطأٌ في سؤالٍ، أو اقتراحٌ، أو صفحةٌ لم تُفتَح — اكتبها لنا مباشرةً.'),
  ]);
}

// أيقونة واتساب مرسومةٌ متجهةً — لا صورةَ خارجيةً تُحمَّل من طرفٍ ثالث.
const WHATSAPP_MARK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
  + '<path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.95L2 22.5l5.7-1.5A9.9 9.9 0 1 0 12.04 2zm0 1.9a8 8 0 1 1-4.1 14.86l-.29-.17-3.38.89.9-3.3-.19-.3A8 8 0 0 1 12.04 3.9zm4.6 10.1c-.25-.13-1.47-.72-1.7-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.24a7.5 7.5 0 0 1-1.38-1.72c-.15-.25-.02-.38.11-.5.11-.12.25-.29.37-.44.12-.15.16-.25.25-.42.08-.16.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.55-.42h-.47c-.16 0-.42.06-.64.31-.22.25-.84.82-.84 2s.86 2.32.98 2.48c.13.16 1.7 2.6 4.12 3.64.57.25 1.02.4 1.37.51.58.18 1.1.16 1.52.1.46-.07 1.42-.58 1.62-1.15.2-.56.2-1.05.14-1.15-.06-.1-.22-.16-.47-.29z"/></svg>';

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
