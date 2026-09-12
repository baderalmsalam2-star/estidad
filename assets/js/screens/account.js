// حسابي — التقدّم، وتغيير المسار، والتنبيهات التي لا يصحّ إخفاؤها.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, pct, go, padNav, devMode, setDevMode, waLink, WHATSAPP_MARK } from '../ui.js';
import * as sync from '../sync.js';

export default function accountScreen() {
  const track = store.get().track;
  const pool = data.forTrack(track);
  const subjects = store.bySubject(pool).sort((a, b) => b.mastery - a.mastery);
  const label = data.manifest().tracks[track].label;
  const r = store.rank();
  const ch = store.chapters(pool);

  return padNav(el('div.pane', [
    el('div.stack', { style: { gap: '6px' } }, [
      gate(),
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
      // الوعدُ يُكتَب على ما هو كائنٌ فعلاً. فإن نُشِر خادمُ الإحصاء تبدّل نصُّه،
      // ولم يبقَ «لا خادم» مكتوباً وفي التطبيق خادم.
      el('span.fine', sync.available()
        ? 'تقدّمك محفوظٌ على جهازك وحده، ولا حسابَ لك ولا كلمةَ سرّ. وتسجيلات التسميع تُحذف تلقائياً بعد ٣٠ يوماً.'
        : 'تقدّمك محفوظٌ على جهازك وحده. لا حساب، ولا خادم، ولا بياناتٍ شخصية. وتسجيلات التسميع تُحذف تلقائياً بعد ٣٠ يوماً.'),
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

    shareStatsCard(),

    contactCard(),
  ]));
}

/**
 * مشاركةُ الإحصاء — تُعرَض إن نُشِر خادمٌ، وتُخفى إن لم يُنشَر.
 *
 * ويُقال للطالب **ما يُرسَل بعينه** لا كلامٌ مجمَل، ويُترَك له المفتاح. وما
 * دام لا خادمَ فلا بطاقةَ ولا كلامَ عن مشاركةٍ لا تقع.
 */
function shareStatsCard() {
  if (!sync.available()) return null;

  const card = el('div.card', { style: { gap: '10px' } });

  const draw = () => {
    const on = sync.enabled();
    const waiting = sync.pending();
    card.replaceChildren(
      el('div.row-base', [
        el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, 'مشاركة الإحصاء'),
        el('button.chip', {
          onclick: () => { sync.setEnabled(!on); draw(); },
          'aria-pressed': on ? 'true' : 'false',
          style: {
            cursor: 'pointer', border: 'none', font: 'inherit', padding: '7px 16px',
            background: on ? 'var(--green)' : 'var(--surface)',
            color: on ? 'var(--paper)' : 'var(--ink-3)',
          },
        }, on ? 'مفعَّلة' : 'مُطفأة'),
      ]),
      el('span.fine', { style: { textAlign: 'start' } },
        'تُرسَل درجاتُك على الأسئلة مجهولةً ليُعرَف أيُّ سؤالٍ يصعب على الناس فيُراجَع. '
        + 'يُرسَل: رقمُ السؤال، والدرجة، والمسار، والوقت، ورقمٌ عشوائيٌّ يولّده جهازك لنفسه. '
        + 'ولا يُرسَل اسمٌ ولا هاتفٌ ولا بريدٌ ولا موضع. ومسحُ تقدّمك يمحو ذلك الرقمَ فيُولَّد غيرُه.'),
      waiting
        ? el('span.fine', { style: { textAlign: 'start', color: 'var(--ink-5)' } },
            `${ar(waiting)} إجابةً في جهازك لم تُرسَل بعدُ.`)
        : null,
    );
  };

  draw();
  return card;
}

/**
 * بابُ لوحة المشرف: سبعُ نقراتٍ على العنوان.
 *
 * كانت اللوحةُ خلفَ `?dev=1` يُكتَب في شريطِ العنوان، وهذا لا يُفعَل على جوّالٍ
 * ولا يُتذكَّر، فكانت اللوحةُ كأنّها غيرُ موجودة. فصار لها بابٌ في التطبيق.
 *
 * وليست هذه حِمايةً ولا تُدَّعى: المفتاحُ في كودٍ مقروءٍ لمن قرأه. وإنّما هي
 * سِترٌ عن الطالب كي لا تُشوِّش عليه صفحةٌ ليست له — واللوحةُ لا تعرض عن أحدٍ
 * شيئاً خاصّاً أصلاً، فلا سرَّ يُحمى.
 */
function gate() {
  const h = el('h1.title', { style: { cursor: 'default', WebkitUserSelect: 'none', userSelect: 'none' } }, 'حسابي');
  let taps = 0;
  let last = 0;

  h.addEventListener('click', () => {
    const now = Date.now();
    taps = now - last < 900 ? taps + 1 : 1;
    last = now;
    if (taps < 7) return;
    taps = 0;
    const on = devMode();
    if (on) {
      setDevMode(false);
      go('account');
      return;
    }
    setDevMode(true);
    go('admin');
  });

  return h;
}

/**
 * التواصل مع صاحب التطبيق.
 *
 * كان ههنا هاتفُ إدارةِ الشؤون الفنية، فحُذف: التطبيقُ ليس جهةً رسميةً ولا
 * يتكلّم باسمها، ونشرُ هاتفِها فيه يوهم الطالبَ أنّه قناتُها.
 * والرقمُ في `CONTACT` بـ`ui.js` — موضعٌ واحدٌ لا نسخةٌ في كلِّ شاشة.
 */
function contactCard() {
  const href = waLink('السلام عليكم، عندي ملاحظةٌ على تطبيق الاستعداد:\n\n');
  if (!href) return null;

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
