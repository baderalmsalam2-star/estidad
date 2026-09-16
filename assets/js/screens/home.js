// ٠٢ — الرئيسية. التقدّم، ومتابعة ما انقطع، ومداخل الأوضاع الستّة.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, go, ring, MAGNIFIER } from '../ui.js';
import * as icons from '../icons.js';
import { openTopic } from './books.js';

export default function homeScreen() {
  const track = store.get().track;
  const pool = data.forTrack(track);
  const mistakes = store.mistakes(pool);
  const kept = store.correctOnes(pool).length;
  const resume = store.get().resume;
  const label = data.trackLabel(track);

  // الحسابُ في `data.examSize` — موضعٌ واحدٌ تقرؤه هذه الشاشةُ وشاشةُ النتيجة.
  const exam = data.examSize(track);

  return el('div.pane', [
    // الترويسةُ على زَلِّيجٍ يتلاشى — فيبدأ التطبيقُ بهويّةٍ لا بسطرٍ مجرَّد.
    el('div.hero', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } }, [
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } }, [
        el('span.meta', `مسار ${label}`),
        // عنوانُ الرئيسيةِ عنوانٌ لا `span` — انظر `topbar` في ui.js.
        el('h1.title', 'أهلاً بك'),
      ]),
      el('div', { style: { display: 'flex', gap: '8px' } }, [
        el('button.iconbtn', {
          onclick: () => go('search'),
          'aria-label': 'ابحث في المنهج',
          style: { background: 'var(--surface)' },
          // لا خطَّ أيقوناتٍ في المشروع، ورمزُ العدسة ⌕ يخرج ضئيلاً في أكثر
          // الخطوط، فرُسِمت العدسةُ متجهةً حتى تستوي في كل جهاز.
          html: MAGNIFIER,
        }),
        el('button.iconbtn', {
          onclick: () => go('account'),
          'aria-label': 'حسابي',
          style: { background: 'var(--surface)' },
        }, '⋯'),
      ]),
    ]),

    // تخزينٌ لا يقبل الكتابة: يُقال صريحاً، فالصمتُ يجعل الطالبَ يظنُّ التطبيقَ
    // أكلَ عملَه وهو لم يُحفَظ أصلاً.
    storageCard(),

    // بنكٌ لم يصل: يُقال صريحاً. والطالبُ يدرُس على ما وصل، لكنّه يعلم أنّ
    // علماً ناقصٌ فلا يظنُّ أنّه أتمّ المنهجَ وقد سقط منه بابٌ في صمت.
    missingCard(),

    // «تابِع» أوّلُ ما يقع عليه البصر: هو الفعلُ الذي جاء الطالبُ من أجله،
    // وكان تحت ثلاثِ بطاقاتٍ يُمرَّر إليها، فيبدأ من الكتب كلَّ مرّة.
    resume ? resumeCard(track, resume) : null,

    rankCard(),

    masteryCard(pool),

    wirdCard(track),

    el('div.grid2', [
      tile('اختبار شامل', `${ar(exam)} سؤالاً · بوقت`, () => openExam(track, exam),
        '', icons.EXAM),
      tile('التسميع', 'القرآن والأذان', () => go('recite'),
        'tile--ink', icons.RECITE),
      tile('بطاقات الحفظ', 'التعدادات', () => go('flashcards'),
        'tile--gold', icons.CARDS),
      tile('اختبار مخصّص', 'اختر العلوم والصعوبة', () => go('custom'),
        'tile--ink', icons.CUSTOM),
      tile('محرّك التجويد', 'جزء عمّ · كلمةً كلمة', () => go('surahs'),
        'tile--gold', icons.TAJWEED),
      tile(
        'مراجعة الأخطاء',
        mistakes.length ? `${ar(mistakes.length)} بانتظارك` : 'لا أخطاءَ بعد',
        mistakes.length
          ? () => go('quiz', { questions: mistakes, mode: 'review', title: 'مراجعة الأخطاء' })
          : null,
        'tile--sand', icons.REVIEW,
      ),
    ]),

    // ما أصابه الطالبُ خرج من الدورة إلى ههنا، فلا بدَّ من بابٍ ظاهرٍ يدخل منه.
    el('button.card', { onclick: () => go('mastered'), style: { gap: '6px' } }, [
      el('div.row-base', { style: { width: '100%' } }, [
        el('span', { style: { fontSize: '15.5px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '9px' } }, [
          el('span', { html: icons.BOX, style: { display: 'flex', color: 'var(--green)', width: '19px', height: '19px' } }),
          'صندوق المراجعة',
        ]),
        el('span.num', { style: { fontSize: '13px', color: 'var(--ink-5)' } }, ar(kept)),
      ]),
      el('span.fine', { style: { textAlign: 'start', width: '100%' } },
        kept
          ? `${ar(kept)} سؤالاً أصبتَه فرُفِع من دورةِ الأسئلة. افتحه متى شئت.`
          : 'ما تُصيبه يُرفَع من دورةِ الأسئلة ويُحفَظ ههنا، فلا يُعاد عليك إلا أن تطلبه.'),
    ]),
  ]);
}

/**
 * الرُّتبةُ والنقاطُ — صدرُ الشاشة.
 *
 * كان هنا «تقدّمك في المنهج ٠٪ — ٠/٤٠١٠»، وهو رقمٌ لا يتحرَّك: عشرون سؤالاً
 * في اليوم لا تُزحزح الكسرَ عن الصِّفر، فيَقنَط المجتهدُ من أوّلِ أسبوع.
 * والنقطةُ تُرى في جلسةٍ واحدة، والرُّتبةُ غايةٌ قريبةٌ تُطلَب.
 */
/**
 * تخزينٌ لا يقبل الكتابة — يُقال، ولا يُترَك الطالبُ يُذاكِر على غيرِ حفظ.
 *
 * ويقع في التصفُّحِ الخاصِّ في سفاري، وفي تخزينٍ ممتلئ، وفي متصفّحٍ مُنِع فيه
 * تخزينُ المواقع. وكلُّها لا يُنبِّه عليها المتصفّحُ بشيءٍ يفهمه الإمام.
 */
function storageCard() {
  if (!store.storageBroken()) return null;
  return el('div.card.card--sand', { style: { gap: '8px' } }, [
    el('span', { style: { fontSize: '13.5px', fontWeight: '600', color: 'var(--sand-ink)' } },
      'تقدُّمك لا يُحفَظ في هذا الجهاز'),
    el('span.fine', { style: { color: 'var(--sand-ink2)' } },
      'المتصفّحُ يمنع التطبيقَ من الحفظ — وذلك يقع في التصفُّح الخاصّ، أو إذا '
      + 'امتلأ تخزينُ الجهاز. تستطيع المذاكرةَ الآن، لكنّ ما تُجيبه اليومَ لن '
      + 'يبقى إذا أغلقتَ التطبيق. اخرُجْ من التصفُّح الخاصّ أو أفرِغْ شيئاً من '
      + 'مساحة جهازك.'),
  ]);
}

function missingCard() {
  const missing = data.missingBanks();
  if (!missing.length) return null;
  return el('div.card.card--sand', { style: { gap: '8px' } }, [
    el('span', { style: { fontSize: '13.5px', fontWeight: '600', color: 'var(--sand-ink)' } },
      `${ar(missing.length)} من ملفّاتِ الأسئلةِ لم تصل`),
    el('span.fine', { style: { color: 'var(--sand-ink2)' } },
      'تدرُس الآن على ما وصل، وينقصك بعضُ العلوم. أعِدْ فتحَ التطبيقِ وأنت '
      + 'متّصلٌ ليكتمل — ثمّ يعمل بلا إنترنت.'),
  ]);
}

function rankCard() {
  const r = store.rank();

  // كانت خضراءَ مصمَتةً كبطاقةِ «تابِع» فوقها، فتجاوَرَ أخضرانِ ثقيلان في أوّلِ
  // الشاشة وتزاحما على العين. والأخضرُ المصمَتُ للفعلِ الذي يُقصَد — وهو
  // «تابِع» — والرتبةُ خبرٌ يُقرَأ، فرُدَّت إلى الورق وبقي الأخضرُ في الاسمِ
  // والشريطِ وحدَهما.
  return el('div.card.card--lg', { style: { gap: '14px' } }, [
    el('div.row-base', [
      el('span', { style: { fontSize: '14px', color: 'var(--ink-5)' } }, 'رتبتك'),
      el('span.num', { style: { fontSize: '14px', color: 'var(--ink-5)' } }, `${ar(r.points)} نقطة`),
    ]),
    el('span', { style: { fontFamily: 'var(--serif)', fontSize: '46px', fontWeight: '700', lineHeight: '1.15', color: 'var(--green)' } }, r.name),
    el('div.bar', el('i', { style: { width: `${Math.round(r.pct * 100)}%` } })),
    el('span', { style: { fontSize: '12.5px', color: 'var(--ink-5)' } },
      r.next ? `${ar(r.toNext)} نقطةً إلى رتبة «${r.next}»` : 'بلغتَ أعلى الرُّتَب'),
  ]);
}

/** إتقانُ الأبواب — بديلُ الكسرِ الكبير: رقمٌ يُقلِّبه بابٌ واحدٌ في اليوم. */
function masteryCard(pool) {
  const ch = store.chapters(pool);

  // حلقةٌ بدل الشريطِ المسطَّح: الرقمُ في جوفها فلا يُبحَث عنه في طرفِ سطر،
  // والقوسُ يُرسَم أمام الطالبِ فيرى حصيلتَه تتقدّم لا توضَع.
  // ولا نسبةَ مئويةٌ هنا: بابٌ من ثلاثمائةٍ يُقرَأ «٠٪»، فيعود المقياسُ إلى ما هربنا منه.
  return el('button.card', { onclick: () => go('books'), style: { gap: '14px' } }, [
    el('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', width: '100%' } }, [
      ring(ch.pct, { size: 76, width: 8, label: ar(ch.mastered), sub: `من ${ar(ch.total)}` }),
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px', textAlign: 'start', flex: '1', minWidth: '0' } }, [
        el('span.section-title', 'إتقانُ الأبواب'),
        el('span.fine', ch.started
          ? `${ar(ch.started)} باباً قيدَ الدرس. والبابُ متقَنٌ إذا أتقنتَ ثلثَي أسئلته.`
          : 'البابُ يُعَدُّ متقَناً إذا أتقنتَ ثلثَي أسئلته. ابدأ من الكتب.'),
      ]),
    ]),
  ]);
}

/** تمييزُ العدد في العربية: مفردٌ، فمثنّى، فجمعُ قلَّةٍ مجرور، فمفردٌ منصوب. */
function streakLabel(n) {
  if (!n) return 'ابدأ سلسلتك اليوم';
  if (n === 1) return 'يومٌ واحدٌ متَّصل';
  if (n === 2) return 'يومانِ متَّصلانِ';
  if (n <= 10) return `${ar(n)} أيامٍ متَّصلة`;
  return `${ar(n)} يوماً متَّصلاً`;
}

/**
 * وِردُ اليوم — الاختبارُ موعدٌ لا يُؤجَّل، والدفعةُ اليوميةُ الصغيرةُ أنفعُ من
 * جلسةٍ واحدةٍ طويلة. والسلسلةُ تُعرَض لأنها أصدقُ حافزٍ على المواظبة.
 */
function wirdCard(track) {
  const { today, goal, streak, week } = store.daily();
  const left = Math.max(0, goal - today);
  const done = left === 0;

  const DAY_LETTERS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

  return el('div.card', { style: { gap: '14px' } }, [
    el('div.row-base', [
      el('span.section-title', 'وِرد اليوم'),
      el('span.num', { style: { fontSize: '13px', color: 'var(--ink-5)' } },
        `${ar(Math.min(today, goal))} / ${ar(goal)}`),
    ]),

    /*
     * والخبرُ لا يُحمَل على اللونِ وحدَه: لكلِّ يومٍ اسمٌ يُقرَأ صريحاً — يومُه
     * وعددُ ما أُجيب فيه وأبلغَ الوِردَ أم لا. و`title` وحدَها كانت لا تُغني:
     * لا تُنال باللمسِ على الجوّال، ولا يُعوَّل عليها عند قارئِ الشاشة.
     */
    el('div.week', { role: 'list', 'aria-label': 'مذاكرةُ الأسبوع' }, week.map((d) => {
      const full = d.count >= goal;
      const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const said = d.count
        ? `${ar(d.count)} سؤالاً${full ? ' — تمَّ الوِرد' : ''}`
        : 'لا مذاكرة';
      return el('span.week-day', {
        role: 'listitem',
        'aria-label': `${DAY_NAMES[d.date.getDay()]}: ${said}`,
        title: said,
      }, [
        el('i', { class: d.count ? (full ? 'dot dot--full' : 'dot dot--some') : 'dot', 'aria-hidden': 'true' }),
        el('em', { 'aria-hidden': 'true' }, DAY_LETTERS[d.date.getDay()]),
      ]);
    })),

    el('div.row-base', [
      el('span.fine', streakLabel(streak)),
      done
        ? el('span.chip', { style: { background: 'var(--green-tint)', color: 'var(--green)' } }, 'تمَّ وِردُك')
        : null,
    ]),

    el('div.bar', el('i', { style: { width: `${Math.round((Math.min(today, goal) / goal) * 100)}%` } })),

    el('button.btn', {
      // «جلسةٌ أخرى» تُعيد بناءَ الوِرد لا تُعيد أسئلتَه — وإلا كُرّر ما أُتقن.
      onclick: () => openWird(track, left || goal),
      // الوعدُ على ما سيُفتَح فعلاً: يُبنى الوِردُ ليُعَدَّ، فلا يقول الزرُّ
      // «ابدأ — ٢٠ سؤالاً» وتُفتَح جلسةٌ من سؤالَين.
    }, (() => {
      const want = left || goal;
      const have = data.buildWird(track, want, store.scoreOf, store.answeredAt).length;
      if (!have) return 'لا أسئلةَ في مسارك';
      return done ? `زِدْ ${ar(have)} سؤالاً` : `ابدأ — ${ar(have)} سؤالاً`;
    })()),
  ]);
}

/**
 * الاختبارُ الشاملُ بوقت.
 *
 * **مدّةُ الاختبارِ الرسميِّ غيرُ معلومةٍ لنا**، والوزارةُ لا تنشرها. فلا تُختلَق
 * مدّةٌ ويُقال إنّها الرسمية؛ بل يختار الطالبُ مُهلتَه، والافتراضُ دقيقتانِ
 * للسؤالِ المقاليّ — وهو تقديرُ تدريبٍ لا نقلٌ عن أحد.
 */
function openExam(track, count) {
  const suggested = Math.max(15, Math.round((count * 2) / 5) * 5);
  const start = (minutes) => go('quiz', {
    questions: data.buildFullExam(track),
    mode: 'exam',
    title: minutes ? `اختبار شامل — ${ar(minutes)} دقيقة` : 'اختبار شامل بلا وقت',
    minutes,
  });

  go('sheet', {
    title: 'اختبار شامل محاكٍ',
    note: `${ar(count)} سؤالاً. ومدّةُ الاختبار الرسميّ غير معلومةٍ لنا، فاختر مُهلتَك — `
      + `والمقترَح دقيقتان للسؤال.`,
    back: () => go('home'),
    options: [
      [`${ar(suggested)} دقيقة — المقترَح`, () => start(suggested)],
      [`${ar(Math.round(suggested / 2 / 5) * 5)} دقيقة — أضيق`, () => start(Math.max(10, Math.round(suggested / 2 / 5) * 5))],
      [`${ar(suggested * 2)} دقيقة — أوسع`, () => start(suggested * 2)],
      ['بلا وقت', () => start(0)],
    ],
  });
}

/**
 * يفتح وِردَ اليوم — ولا يسكُت إن لم يجد.
 *
 * وكان `if (!questions.length) return;` يبتلع الحالَ صامتاً، فيضغط من أتمّ
 * منهجَه زرّاً لا يستجيب ولا يُقال له لِمَ. (والرافدُ الثالثُ في `buildWird`
 * جعل ذلك نادراً، لكنّ «نادر» ليس «مستحيل»: مسارٌ لا أسئلةَ فيه أصلاً.)
 */
function openWird(track, n) {
  const questions = data.buildWird(track, n, store.scoreOf, store.answeredAt);
  if (!questions.length) {
    alert('لا أسئلةَ في مسارك الآن. تأكّدْ من وصولِ ملفّاتِ الأسئلةِ ثمّ أعِدْ فتحَ التطبيق.');
    return;
  }
  const { today, goal } = store.daily();
  go('quiz', {
    questions,
    mode: 'study',
    title: today >= goal ? 'زيادةٌ على الوِرد' : 'وِرد اليوم',
    again: () => openWird(track, store.dailyGoal()),
  });
}

/**
 * «تابِع من حيث وقفت».
 *
 * والعددُ يُحسَب من البنكِ الآن لا يُقرَأ من اللقطةِ المحفوظةِ يومَ فُتِح الباب:
 * تلك تُكتَب مرّةً عند فتح الجلسة ثمّ لا تتحرّك، فيُجيب الطالبُ عشرةً ويرى
 * الرقمَ كما تركه فيظنُّ أنّه لم يتقدّم.
 *
 * ويُقال «بقي كذا» لا «كذا من كذا»: الباقي هو ما يعنيه، وهو الذي ينقص كلَّ يوم.
 */
function resumeCard(track, resume) {
  const topic = resume.topic === 'الكتاب كاملاً' ? null : resume.topic;
  const qs = data.questionsIn(track, resume.subject, topic);
  if (!qs.length) return null;

  const done = qs.filter((q) => store.isCorrect(q.id)).length;
  const left = qs.length - done;

  return el('div.stack', { style: { gap: '10px' } }, [
    el('div.row-base', [
      el('span.section-title', 'تابِع من حيث وقفت'),
      el('button', {
        onclick: () => go('books'),
        style: { font: 'inherit', fontSize: '13px', color: 'var(--ink-5)', background: 'none', border: 'none', cursor: 'pointer' },
      }, 'الكلّ'),
    ]),
    el('button.card.card--green', {
      style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
      onclick: () => openTopic(resume.subject, topic),
    }, [
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'start', flex: '1', minWidth: '0' } }, [
        el('span', { style: { fontFamily: 'var(--serif)', fontSize: '26px', fontWeight: '700' } }, resume.topic),
        el('span', { style: { fontSize: '13px', opacity: '0.88' } },
          left
            ? `${resume.subject} — بقي ${ar(left)} من ${ar(qs.length)}`
            : `${resume.subject} — أصبتَ الباب كلَّه`),
        el('div.bar.bar--onGreen', { style: { marginTop: '2px' } },
          el('i', { style: { width: `${Math.round((done / qs.length) * 100)}%` } })),
      ]),
      el('span.iconbtn.iconbtn--lg', { style: { marginInlineStart: '14px' } }, '▶'),
    ]),
  ]);
}

function tile(title, note, onclick, cls = '', icon = null) {
  return el(`button.tile${cls ? '.' + cls : ''}`, {
    onclick: onclick || undefined,
    disabled: !onclick,
    style: onclick ? null : { opacity: '0.55', cursor: 'default' },
  }, [
    icon ? el('span.tile-ico', { html: icon }) : null,
    el('span.h-card', title),
    el('span.fine', note),
  ]);
}
