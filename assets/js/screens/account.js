// حسابي — التقدّم، وتغيير المسار، والتنبيهات التي لا يصحّ إخفاؤها.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, pct, go, waLink, WHATSAPP_MARK, frac } from '../ui.js';
import * as sync from '../sync.js';
import * as owner from '../owner.js';
import * as reminder from '../reminder.js';
import * as version from '../version.js';

export default function accountScreen() {
  const track = store.get().track;
  const pool = data.forTrack(track);
  const subjects = store.bySubject(pool).sort((a, b) => b.mastery - a.mastery);
  const label = data.trackLabel(track);
  const r = store.rank();
  const ch = store.chapters(pool);

  return el('div.pane', [
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
            el('span', { style: { color: 'var(--ink-4)', fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' } },
              s.done ? [frac(s.done, s.total), el('span.num', `— ${pct(s.mastery)}`)] : el('span.num', '—')),
          ]),
          el('div.bar', el('i', { style: { width: `${Math.round(s.mastery * 100)}%` } })),
        ]))),
    ]),

    // كانت ههنا بطاقتان تظهران بوضع المطوّر: «لوحة المشرف» و«اعتماد التوثيق».
    // وقد صارتا بابَين في لوحة الإدارة، فحُذفتا من ههنا: بابٌ واحدٌ للإدارة
    // أهونُ من ثلاثةٍ تُفتَح بشروطٍ مختلفة.
    ownerCard(),

    goalCard(),

    textSizeCard(),

    reminderCard(),

    el('button.card', { onclick: () => go('track') }, [
      el('div.row', [
        el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, 'غيّر المسار'),
        el('span', { 'aria-hidden': 'true', style: { fontSize: '18px', color: 'var(--ink-8)' } }, '‹'),
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
        onclick: async () => {
          if (!confirm('سيُمحى تقدّمك كلّه من هذا الجهاز — ومعه تسجيلات التسميع. أمتأكّد؟')) return;
          // يُنتظَر محوُ التسجيلاتِ قبل الانتقال، فلا يُقال «مُحي» وهو يُمحى.
          await store.reset();
          go('track');
        },
        style: {
          font: 'inherit', fontSize: '13.5px', color: 'var(--wrong)', background: 'none',
          border: 'none', cursor: 'pointer', textAlign: 'start', padding: '4px 0 0',
        },
      }, 'امسح تقدّمي'),
    ]),

    shareStatsCard(),

    contactCard(),

    versionCard(),
  ]);
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

  const what = 'تُرسَل درجاتُك على الأسئلة مجهولةً ليُعرَف أيُّ سؤالٍ يصعب على الناس فيُراجَع. '
    + 'يُرسَل: رقمُ السؤال، والدرجة، والمسار، والوقت، ورقمٌ عشوائيٌّ يولّده جهازك لنفسه. '
    // «مسحُ تقدّمك يمحو ذلك الرقم» كانت تُقرَأ محواً لما وصل الخادم، وليست هي:
    // المحوُ يقع في الجهازِ وحدَه، والصفوفُ المُرسَلةُ تبقى — مقطوعةَ الصلةِ بما
    // بعدها، وتُمحى بمضيِّ سنة. فيُقال الأمرانِ على وجههما ولا يُترَك الفهمُ
    // للظنّ. (والمدّةُ في `KEEP_DAYS` بـ`server/worker.js`.)
    + 'ولا يُرسَل اسمٌ ولا هاتفٌ ولا بريدٌ ولا موضع. ومسحُ تقدّمك يمحو الرقمَ من '
    + 'جهازك فيُولَّد غيرُه ولا يوصَل بالقديم — أمّا ما أُرسِل قبلَه فيبقى عند '
    + 'الخادم مجهولاً حتى يمضي عليه عام، ثمّ يُمحى.';

  const draw = () => {
    const on = sync.enabled();
    const waiting = sync.pending();

    /*
     * ما لم يُسأل الطالبُ بعدُ عُرِض عليه السؤالُ نفسُه بزرَّين، لا مفتاحٌ
     * يجده مفتوحاً. فالفرقُ بين «أطفئها إن شئتَ» و«أتأذن؟» هو الفرقُ بين
     * إذنٍ مُدَّعىً وإذنٍ مأخوذ — والأوّلُ لا يُؤخَذ بالسكوت.
     */
    if (!sync.decided()) {
      card.replaceChildren(
        el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, 'أتأذن بمشاركة الإحصاء؟'),
        el('span.fine', { style: { textAlign: 'start' } }, what),
        el('div', { role: 'group', 'aria-label': 'الإذن بمشاركة الإحصاء', style: { display: 'flex', gap: '8px', paddingTop: '2px' } }, [
          el('button.chip', {
            onclick: () => { sync.setEnabled(true); draw(); },
            style: {
              cursor: 'pointer', border: 'none', font: 'inherit', padding: '9px 18px',
              background: 'var(--green)', color: 'var(--paper)', fontWeight: '600',
            },
          }, 'أذِنتُ'),
          el('button.chip', {
            onclick: () => { sync.setEnabled(false); draw(); },
            style: {
              cursor: 'pointer', border: 'none', font: 'inherit', padding: '9px 18px',
              background: 'var(--surface)', color: 'var(--ink-3)',
            },
          }, 'لا، شكراً'),
        ]),
        el('span.fine', { style: { textAlign: 'start', color: 'var(--ink-5)' } },
          'ولا يُرسَل شيءٌ حتى تأذن. والتطبيقُ يعمل كما هو على الحالَين.'),
      );
      return;
    }

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
      el('span.fine', { style: { textAlign: 'start' } }, what),
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
 * بابُ لوحة الإدارة: سبعُ نقراتٍ على العنوان، ثمّ كلمةُ الدخول.
 *
 * ولمَ نقراتٌ ثمّ كلمة، ولا تكفي الكلمةُ وحدَها؟ لأنّ حقلَ كلمةٍ ظاهراً في
 * «حسابي» يُقلِق الطالبَ ويُوهمه أنّ عليه حساباً يُنشئه. فالنقراتُ تكشف
 * الباب، والكلمةُ تفتحه.
 *
 * ومن دخل مرّةً بقي داخلاً في هذا الجهاز، فتظهر له بطاقةُ اللوحةِ ظاهرةً ولا
 * يعود يعدُّ النقرات.
 */
function gate() {
  const h = el('h1.title', {
    style: {
      cursor: 'default', WebkitUserSelect: 'none', userSelect: 'none',
      WebkitTouchCallout: 'none', touchAction: 'manipulation',
      display: 'inline-flex', alignItems: 'center', gap: '10px',
    },
  }, 'حسابي');

  // مؤشّرُ التقدّم — بابٌ خفيٌّ بلا إشارةٍ لا يُعلَم أيعمل أم لا، فيُظنُّ معطوباً.
  // ولا يظهر إلا بعد الثالثة، فالطالبُ لا يبلغها بنقرةٍ عابرة.
  const dots = el('span', {
    style: {
      fontSize: '13px', color: 'var(--ink-8)', fontFamily: 'var(--mono)',
      opacity: '0', transition: 'opacity .15s ease',
    },
  }, '');

  let taps = 0;
  let last = 0;
  let timer = null;

  const paint = () => {
    dots.textContent = '·'.repeat(taps);
    dots.style.opacity = taps >= 3 ? '1' : '0';
  };

  // `pointerdown` لا `click`: النقرُ في سفاري يتأخّر ويُدمَج مع نقرةِ التكبير
  // المزدوجة، فتضيع نقراتٌ من السبع فلا تُفتَح البوّابةُ أبداً على لوحيّ.
  h.addEventListener('pointerdown', () => {
    const now = Date.now();
    taps = now - last < 1500 ? taps + 1 : 1;
    last = now;
    paint();

    clearTimeout(timer);
    timer = setTimeout(() => { taps = 0; paint(); }, 1700);

    if (taps < 7) return;
    clearTimeout(timer);
    taps = 0;
    paint();
    go(owner.isOwner() ? 'owner' : 'signin');
  });

  h.append(dots);
  return h;
}

/** مدخلُ اللوحةِ ظاهراً — لمن دخل وحدَه، ولا يراه الطالبُ البتّة. */
function ownerCard() {
  if (!owner.isOwner()) return null;
  return el('button.card.card--green', { onclick: () => go('owner') }, [
    el('div.row', [
      el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, 'لوحة الإدارة'),
      el('span', { 'aria-hidden': 'true', style: { fontSize: '18px', opacity: '0.7' } }, '‹'),
    ]),
    el('span', { style: { fontSize: '12.5px', lineHeight: '1.8', opacity: '0.88', textAlign: 'start' } },
      'أرقامُ الطلاب، وصحّةُ البنك، وما ينقصه.'),
  ]);
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
/**
 * مقاسُ الخطّ — **خيارٌ لا أصل**.
 *
 * كثيرٌ من الأئمة كبارُ سنّ، وقياساتُ التطبيق كلُّها بالبكسل فلا تتبع مقاسَ
 * خطِّ النظام. ويُكبَّر اللوحُ كلُّه لا الحروفُ وحدَها، فلا يضيق زرٌّ عن حرفٍ
 * كبُر فيه. والمعاينةُ تقع فوراً: يضغط فيرى، لا يُصدِّق وصفاً.
 */
/**
 * تنبيهُ الوِرد اليوميّ — عبر تقويم الجهاز.
 *
 * ولا يُدَّعى أنّ التطبيقَ هو الذي يُنبِّه: صفحةُ الوِبّ لا توقظ جهازاً مغلقاً،
 * والدفعُ يحتاج خادماً لا وجودَ له. فيُقال للطالب ما يجري فعلاً — يدخل الحدثُ
 * تقويمَه فيُوقِظه التقويم — ولا يُضبَط زرٌّ يَعِدُ بما لا يأتي.
 */
/**
 * نسخةُ التطبيقِ على هذا الجهاز، وزرُّ تجديدها.
 *
 * وُضِعت لأنّ الشكوى تكرّرت: يُنشَر إصلاحٌ ولا يظهر، ولا يُعرَف أالنشرُ تأخّر أم
 * الجهازُ بقي على القديم. فالاسمُ يُقرَأ من مخزن عامل الخدمة نفسِه — لا يُكتَب
 * في الكود فيكذب — والزرُّ يُجدِّد قطعاً لا انتظاراً.
 */
function versionCard() {
  const line = el('span.fine', { class: 'num', style: { direction: 'ltr' } }, '…');
  const btn = el('button', {
    style: {
      font: 'inherit', fontSize: '13.5px', fontWeight: '600', color: 'var(--green)',
      background: 'none', border: 'none', cursor: 'pointer', textAlign: 'start', padding: '4px 0 0',
    },
    onclick: async () => {
      btn.textContent = 'يُجدَّد…';
      btn.disabled = true;
      try {
        await version.refresh();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'جدِّد التطبيق الآن';
        line.textContent = e.message;
      }
    },
  }, 'جدِّد التطبيق الآن');

  version.current().then((name) => {
    line.textContent = name || 'لم يُنصَّب عاملُ الخدمة بعد';
  });

  return el('div.card', { style: { gap: '6px' } }, [
    el('div.row-base', [
      el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, 'نسخة التطبيق'),
      line,
    ]),
    el('span.fine', { style: { textAlign: 'start' } },
      'التطبيقُ يُقلِع من مخزنِ جهازك ليعمل بلا شبكة، فقد يبقى على نسخةٍ قديمةٍ '
      + 'زيارةً أو زيارتين بعد أيِّ تحديث. وهذا يُنزِل الجديدَ الآن.'),
    btn,
  ]);
}

/**
 * زرُّ «أضِفْه إلى التقويم» — ويُخبِر بما وقع.
 *
 * ولكلِّ حالٍ لفظُها: على iOS تُفتَح ورقةُ المشاركةِ فيختار الطالبُ «التقويم»،
 * وعلى الحاسوبِ يُنزَّل الملفُّ فيُفتَح، ومن لا يفعل واحدةً منهما يُفتَح له
 * الملفُّ ويُقال له ما يفعله به. ولا يُسكَت عن ضغطةٍ لم تُثمِر.
 */
function addToCalendarBtn(at) {
  const was = 'أضِفْه إلى التقويم';
  const btn = el('button.btn', { style: { fontSize: '14.5px', minHeight: '48px' } }, was);
  const note = el('span.fine', { style: { textAlign: 'start', display: 'none' } });

  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = 'يُهيَّأ…';
    let how = 'failed';
    try {
      how = await reminder.download(at, { url: location.origin + location.pathname });
    } catch { /* how يبقى failed */ }

    const said = {
      shared: ['أُرسِل إلى التقويم ✓', 'إن لم تَرَه في تقويمك فاختر «التقويم» من ورقة المشاركة.'],
      downloaded: ['نُزِّل الملفّ ✓', 'افتحه من تنزيلاتك ليُضاف الحدث المتكرّر إلى تقويمك.'],
      opened: ['فُتِح الملفّ', 'اضغط «مشاركة» ثمّ «التقويم» لتُضيفه — أو احفظه وافتحه من «الملفّات».'],
      blocked: ['منعَ المتصفّحُ فتحَه', 'اسمحْ بالنوافذ لهذا الموقع ثمّ أعِدْ المحاولة.'],
      cancelled: [was, ''],
      failed: ['تعذّر التهيئة', 'أعِدْ المحاولة، أو اضبط التنبيه في تقويم جهازك مباشرةً.'],
    }[how] || [was, ''];

    btn.textContent = said[0];
    if (said[1]) { note.textContent = said[1]; note.style.display = ''; }
    btn.disabled = false;
    setTimeout(() => { if (btn.isConnected) btn.textContent = was; }, 6000);
  };

  return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [btn, note]);
}

function reminderCard() {
  const card = el('div.card', { style: { gap: '10px' } });
  const TIMES = ['06:00', '13:00', '19:00', '21:00'];

  const draw = () => {
    const at = store.reminderAt();
    card.replaceChildren(
      el('div.row-base', [
        el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, 'تنبيه الوِرد'),
        el('span.fine', at ? reminder.readable(at) : 'غير مضبوط'),
      ]),
      el('span.fine', { style: { textAlign: 'start' } },
        'اختر وقتاً، ثمّ أضِفْه إلى تقويم جهازك — فهو الذي يُنبِّهك كلَّ يوم، '
        + 'ويعمل بلا إنترنت. والتطبيقُ صفحةُ وِبّ لا توقظ جهازاً مغلقاً.'),
      /*
       * مجموعةٌ لها اسمٌ يُقرَأ — وكانت شاراتُ الخيارِ إحدى عشرةَ في «حسابي»
       * كلُّها `aria-pressed` بلا مجموعةٍ تضمُّها ولا اسمٍ يربطها. فيسمعها
       * قارئُ الشاشةِ أرقاماً مجرَّدة: «١٠ زرُّ تبديلٍ غيرُ مضغوط»، «٢٠
       * مضغوط» — ولا يعلم أنّها وِردُ اليومِ ولا أنّ الأربعةَ صنفٌ واحدٌ
       * يُختار منه واحد. والأسوأُ أنّ أربعَ مجموعاتٍ متعارضةٍ تتوالى فيُظنُّ
       * المضغوطُ في الثانيةِ متعلّقاً بالأولى.
       */
      el('div', { role: 'group', 'aria-label': 'وقت تنبيه الوِرد', style: { display: 'flex', gap: '8px', paddingTop: '2px' } },
        TIMES.map((tm) => el('button.chip', {
          onclick: () => { store.setReminderAt(tm); draw(); },
          'aria-pressed': tm === at ? 'true' : 'false',
          style: {
            cursor: 'pointer', border: 'none', font: 'inherit', flex: '1',
            fontSize: '12px', padding: '9px 6px', textAlign: 'center',
            background: tm === at ? 'var(--green)' : 'var(--surface)',
            color: tm === at ? 'var(--paper)' : 'var(--ink-3)',
          },
        }, reminder.readable(tm)))),
      // ويُقال للطالبِ ما وقع — فالزرُّ كان يُضغَط ولا يقع شيءٌ على iOS ولا
      // يُقال له شيء، والوقتُ فوقَه معروضٌ مضبوطاً فيظنُّ التنبيهَ قائماً.
      at ? addToCalendarBtn(at) : null,
      at
        ? el('button', {
            onclick: () => { store.setReminderAt(null); draw(); },
            style: {
              font: 'inherit', fontSize: '12.5px', color: 'var(--ink-6)', background: 'none',
              border: 'none', cursor: 'pointer', textAlign: 'start', padding: '2px 0 0',
            },
          }, 'ألغِ الوقت')
        : null,
    );
  };

  draw();
  return card;
}

function textSizeCard() {
  const OPTIONS = [
    { v: 1, label: 'الأصل' },
    { v: 1.15, label: 'أكبر' },
    { v: 1.3, label: 'الأكبر' },
  ];
  const card = el('div.card', { style: { gap: '10px' } });

  const draw = () => {
    const cur = store.textScale();
    card.replaceChildren(
      el('div.row-base', [
        el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, 'مقاس الخطّ'),
        el('span.fine', (OPTIONS.find((o) => o.v === cur) || OPTIONS[0]).label),
      ]),
      el('span.fine', { style: { textAlign: 'start' } },
        'يُكبَّر معه كلُّ شيء — الحروفُ والأزرارُ ومواضعُ اللمس. ويبقى على جهازك هذا.'),
      el('div', { role: 'group', 'aria-label': 'مقاس الخطّ', style: { display: 'flex', gap: '8px', paddingTop: '2px' } },
        OPTIONS.map((o) => el('button.chip', {
          onclick: () => { store.setTextScale(o.v); draw(); },
          'aria-pressed': o.v === cur ? 'true' : 'false',
          style: {
            cursor: 'pointer', border: 'none', font: 'inherit', flex: '1',
            fontSize: `${Math.round(12.5 * o.v)}px`,
            background: o.v === cur ? 'var(--green)' : 'var(--surface)',
            color: o.v === cur ? 'var(--paper)' : 'var(--ink-3)',
          },
        }, o.label))),
    );
  };

  draw();
  return card;
}

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
      el('div', { role: 'group', 'aria-label': 'عدد أسئلة الوِرد اليوميّ', style: { display: 'flex', gap: '8px', paddingTop: '2px' } },
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
