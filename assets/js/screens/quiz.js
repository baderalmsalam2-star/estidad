// ٠٤ و٠٥ و٠٦ و٠٧ — جلسة الأسئلة: المقاليّ، والتصحيح الذاتيّ، والموضوعيّ، والنتيجة.
//
// الاختبار الحقيقيّ مقاليٌّ بالكامل، فجوهر هذه الشاشة أنّ الطالب يكتب ثم يصحّح نفسه
// على `keyPoints`. ولا يُحاوَل تصحيحٌ آليٌّ للنصّ الحرّ البتّة.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, pct, arTime, go, pageCite, devBadge, empty, reportLink } from '../ui.js';
import { resultCard, shareCard, shareText } from '../share.js';
import * as sync from '../sync.js';

export default function quizScreen({ questions, mode = 'study', title = '', back = null, again = null, pool = null, minutes = 0, startAt = 0, endsAt = 0 }) {
  if (!questions || !questions.length) {
    return empty('لا أسئلة هنا', 'جرّب باباً آخر أو غيّر شروط الاختبار.');
  }

  const session = {
    // نسخةٌ خاصّة: الجلسةُ تُلحِق بها ما أخطأ فيه، فلا تُمَسُّ قائمةُ المُنادي.
    questions: [...questions],
    mode,
    title,
    back: back || (() => go('home')),
    again,                 // يلتقط دفعةً جديدة من البابِ نفسِه
    pool,                  // أسئلةُ الباب كلِّه — لبيان موقعِ الطالب منه
    // يبدأ من أوّلها، إلا ورقةً استُؤنِفت فتبدأ من موضعِ الوقوف.
    index: Math.min(Math.max(0, startAt), questions.length - 1),
    results: [],           // { q, score } — قد يتكرّر السؤالُ إن أُعيد
    retried: new Set(),    // ما أُعيد مرّةً، فلا يُعاد ثانيةً
    startedAt: Date.now(),
    /*
     * نقاطُ الطالبِ قبلَ الجلسة — تُلتقَط ههنا لتُطرَح في الآخِر.
     *
     * وكانت ثمرةُ الجلسةِ تُحسَب جمعاً لدرجاتِ أسئلتها: `Σ round(10 × score)`.
     * وذاك ليس ما يُكسَب، لأنّ `store.points()` تجمع على **`answers`** وهي
     * خريطةٌ مفتاحُها رقمُ السؤال، فتأخذ آخرَ درجةٍ لكلِّ سؤالٍ لا كلَّ محاولة.
     *
     * فمن أعاد عشرةَ أسئلةٍ كان مُتقِناً لها: تُعلِن الشاشةُ «١٠٠ نقطةً جديدة»
     * ورصيدُه لم يتحرّك نقطةً. ومن كان مُصيباً سؤالاً فأخطأه اليومَ: رصيدُه
     * **نقصَ** والشاشةُ تُبشِّره بزيادة.
     *
     * وأسوأُ منه أثرُه في الرتبة: `before` كانت تُحسَب من `now.points - earned`،
     * فإذا انتُفخ `earned` هبطَ `before` إلى رتبةٍ أدنى ممّا كان الطالبُ فيه
     * فعلاً، فتُعلَن «ارتفعت رتبتُك» إلى رتبةٍ هو فيها منذ أسبوع.
     *
     * فالثمرةُ فرقٌ يُقاس لا مجموعٌ يُقدَّر: رصيدٌ قبلَ ورصيدٌ بعد.
     */
    pointsBefore: store.points(),
    // مُهلةُ الاختبار بالدقائق (صفرٌ = بلا مُهلة). تُحسَب من لحظة البدء لا من
    // لحظة السؤال، فالوقتُ الضائع في سؤالٍ يُنقِص من بقيّةِ الأسئلة كما في القاعة.
    // و`endsAt` تُمرَّر كما هي عند الاستئناف، فلا يُستأنَف اختبارٌ بمُهلةٍ كاملةٍ
    // من جديد — الوقتُ الذي مضى مضى.
    endsAt: endsAt || (minutes ? Date.now() + minutes * 60_000 : 0),
    over: false,
  };

  savePaper(session);

  const host = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } });
  // نفادُ الوقت يختم الجلسةَ، وما لم يُجَب يُحسَب صفراً في ورقةِ الاختبارِ
  // (انظر `fillUnanswered`) ولا يُسجَّل في مخزنِ الطالب.
  session.onTimeout = () => finishSession(host, session);
  renderQuestion(host, session);
  return host;
}

/* ── الترويسة المشتركة: إغلاق، وشريط تقدّم، وعدّاد ──────────────────── */

function header(session, onClose) {
  const n = session.questions.length;
  // «أ/ب» ينقلب ترتيبُه في العربية فيُقرَأ «٤٠/١٢» — انظر `frac` في ui.js.
  const counter = el('span.num', {
    style: { fontSize: '13px', color: 'var(--ink-5)', direction: 'ltr', unicodeBidi: 'isolate' },
  }, `${ar(session.index + 1)}/${ar(n)}`);

  const row = el('div', { style: { padding: '16px 24px 0', display: 'flex', alignItems: 'center', gap: '14px', flexShrink: '0' } }, [
    el('button.iconbtn', { onclick: onClose, 'aria-label': 'إنهاء' }, '✕'),
    el('div.bar', { style: { flex: '1' } },
      el('i', { style: { width: `${Math.round((session.index / n) * 100)}%` } })),
    counter,
  ]);

  if (session.endsAt) row.insertBefore(clock(session), counter);
  return row;
}

/**
 * عدّادُ الاختبار النازل.
 *
 * الاختبارُ موعدٌ بوقتٍ محدود، والتدرُّبُ عليه بلا وقتٍ يُعلِّم نصفَه. فإذا نفد
 * الوقتُ خُتِمت الجلسةُ على ما أُجيب، ويُحسَب ما لم يُجَب صفراً — كما في القاعة.
 *
 * والمؤقّتُ يُوقَف عند أوّلِ انتقالٍ عن الشاشة كي لا يبقى يعملُ بعد انتهائها.
 */
function clock(session) {
  const box = el('span.num', {
    // عزلُ الاتّجاهِ حَرْزٌ لا علاجُ عَطَبٍ قائم: قِسْتُ «١٢:٠٥» بالعزلِ
    // وبغيرِه فكان الرسمُ واحداً — النقطتان `CS` بين رقمَين `AN` تصيران
    // `AN` (UAX #9 W4) فيصير الكلُّ جريةً واحدةً. وإنّما يبقى لئلّا تكون
    // الصحّةُ معلَّقةً بصنفِ كلِّ محرفٍ يدخل. والشرحُ عند `frac` في ui.js.
    style: {
      fontSize: '13px', fontWeight: '600', padding: '4px 10px', borderRadius: 'var(--r-chip)',
      direction: 'ltr', unicodeBidi: 'isolate',
    },
  });

  const tick = () => {
    const left = Math.max(0, session.endsAt - Date.now());
    const secs = Math.round(left / 1000);
    box.textContent = `${ar(Math.floor(secs / 60))}:${ar(String(secs % 60).padStart(2, '0'))}`;
    const low = secs <= 60;
    box.style.background = low ? 'var(--wrong-tint)' : 'var(--surface)';
    box.style.color = low ? 'var(--wrong)' : 'var(--ink-3)';
    if (left <= 0) {
      clearInterval(id);
      if (!session.over) { session.over = true; session.timedOut = true; session.onTimeout?.(); }
    }
  };

  const id = setInterval(() => (box.isConnected ? tick() : clearInterval(id)), 1000);
  tick();
  return box;
}

/* ── السؤال ─────────────────────────────────────────────────────────── */

function renderQuestion(host, session) {
  const q = session.questions[session.index];
  host.replaceChildren(header(session, session.back));
  host.append(q.type === 'essay' ? essayView(host, session, q) : objectiveView(host, session, q));
}

/* ── ٠٤ المقاليّ ────────────────────────────────────────────────────── */

function essayView(host, session, q) {
  const box = el('textarea.answerbox', {
    placeholder: 'اكتب ما تحفظه…',
    'aria-label': 'إجابتك',
    rows: 5,
  });

  const words = el('span.num', 'صفر كلمة');
  box.addEventListener('input', () => {
    const n = box.value.trim() ? box.value.trim().split(/\s+/).length : 0;
    words.textContent = n ? `${ar(n)} كلمة` : 'صفر كلمة';
  });

  return el('div.pane.pane--tight', { style: { gap: '18px' } }, [
    el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
      el('span.chip', `${q.subject}${q.topic ? ' · ' + q.topic : ''}`),
    ]),
    el('h1.display', { style: { fontSize: '34px', lineHeight: '1.45' } }, q.question),
    box,
    el('div.row', { style: { fontSize: '12.5px', color: 'var(--ink-6)', padding: '0 6px' } }, [
      el('span', 'اكتب ما تحفظه ثم صحّح نفسك.'),
      words,
    ]),
    el('button.btn', {
      onclick: () => {
        host.replaceChildren(header(session, session.back));
        host.append(selfGradeView(host, session, q));
      },
    }, 'أظهر الإجابة النموذجية'),
  ]);
}

/* ── ٠٥ التصحيح الذاتيّ ─────────────────────────────────────────────── */

function selfGradeView(host, session, q) {
  const points = q.keyPoints && q.keyPoints.length ? q.keyPoints : null;
  const ticked = new Set();

  const tally = el('span.num', { style: { fontSize: '15px', color: 'var(--green)' } });

  // آخِرُ سؤالٍ في الجلسة قد لا يكون آخِرَها: الخطأُ يُعاد. فلا يقول الزرُّ
  // «أنهِ الجلسة» ثمّ يأتي بسؤالٍ جديد — بل يتبدّل مع الدرجة قبل الضغط.
  const nextBtn = el('button.btn', { style: { flex: '1', fontSize: '15.5px' } });
  const scoreNow = () => (points ? ticked.size / points.length : 1);
  const updateTally = () => {
    if (points) tally.textContent = `${ar(ticked.size)} / ${ar(points.length)} — ${pct(ticked.size / points.length)}`;
    nextBtn.textContent = lastLabel(session, scoreNow());
  };
  updateTally();

  const model = el('div.card', [
    el('div.row', [
      el('span', { style: { fontSize: '13px', fontWeight: '600', color: 'var(--green)' } }, 'الإجابة النموذجية'),
      // شارة الصفحة — ورقة الثقة الوحيدة في تطبيقٍ فرديٍّ بلا جهة اعتماد.
      // وبجانبها شارة المطوّر إن كان الوضع مفعَّلاً.
      el('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [levelBadge(q), pageCite(q), devBadge(q)]),
    ]),
    el('p', { style: { fontFamily: 'var(--serif)', fontSize: '18px', lineHeight: '1.9' } },
      q.modelAnswer || q.explanation || ''),
    q.correctionNote
      ? el('p.fine', { style: { color: 'var(--sand-ink3)' } }, `تصحيح: ${q.correctionNote}`)
      : null,
    // موضعُ المسألةِ بعنوانِه في الكتاب — انظر `explainCard` أدناه.
    bookPlace(q),
    // الطالبُ أوّلُ من يقع على الخطأ، فله قناةٌ يُبلِّغ بها من موضع السؤال.
    reportLink(q),
  ]);

  const buttons = [];
  const list = points
    // مجموعةٌ لها اسمٌ يُقرَأ: تسعُ شاراتٍ متتاليةٍ بـ`aria-pressed` بلا ما
    // يربطها تُنطَق جُملاً متفرّقةً لا يُعلَم أنّها نقاطُ تصحيحِ سؤالٍ واحد.
    // (وعلامةُ «✓» فيها `aria-hidden` فلا تُنطَق وهي غيرُ مؤشَّرة.)
    ? el('div.stack-sm', { role: 'group', 'aria-label': 'أشِّر على ما أصبتَه من نقاط الإجابة' },
      points.map((p, i) => {
        const b = el('button.point', {
          'aria-pressed': 'false',
          onclick: (e) => {
            const btn = e.currentTarget;
            const on = btn.getAttribute('aria-pressed') === 'true';
            btn.setAttribute('aria-pressed', String(!on));
            if (on) ticked.delete(i); else ticked.add(i);
            updateTally();
          },
        }, [el('span.box', { 'aria-hidden': 'true' }, '✓'), el('span', p)]);
        buttons.push(b);
        return b;
      }))
    : el('p.lede', 'هذا السؤال بلا نقاطِ تحقُّقٍ مفصَّلة — قابِل إجابتك بالنصّ أعلاه واحكم لنفسك.');

  /**
   * طرفا التصحيح في ضغطةٍ واحدة.
   *
   * أكثرُ الأجوبةِ في الطرفين: إمّا أصابها كلَّها فيؤشّر على تسعِ نقاطٍ واحدةً
   * واحدة، وإمّا لم يُجب بشيءٍ فلا يجد ما يقوله إلا زرَّ «لاحقاً» المبهم.
   * فصار للطرفين زرّاهما، وتبقى التأشيرةُ لما بينهما.
   */
  const setAll = (on) => {
    ticked.clear();
    if (on && points) points.forEach((_, i) => ticked.add(i));
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(!!on)));
    updateTally();
  };

  const ends = points
    ? el('div', { style: { display: 'flex', gap: '8px' } }, [
        el('button.chip', {
          onclick: () => setAll(true),
          style: { cursor: 'pointer', border: 'none', font: 'inherit', flex: '1', textAlign: 'center', alignSelf: 'stretch', padding: '10px 12px' },
        }, 'أصبتُ الكلَّ'),
        el('button.chip.chip--muted', {
          onclick: () => setAll(false),
          style: { cursor: 'pointer', border: 'none', font: 'inherit', flex: '1', textAlign: 'center', alignSelf: 'stretch', padding: '10px 12px' },
        }, 'لم أُجِبْ بشيء'),
      ])
    : null;

  const finish = (score) => {
    store.record(q, score);
    // ما لم يؤشِّر عليه هو الذي فاته — يُحمَل إلى خاتمة الجلسة ليُقرَأ مجموعاً،
    // فالنقطةُ تمرُّ في السؤال ثمّ تُنسى، ومجموعُها في الآخِر درسٌ واحدٌ يُراجَع.
    const missed = points ? points.filter((_, i) => !ticked.has(i)) : [];
    session.results.push({ q, score, missed });
    advance(host, session);
  };

  return el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } }, [
    el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', padding: '16px 24px 0', display: 'flex', flexDirection: 'column', gap: '12px' } }, [
      model,
      points ? el('div.row-base', [el('span.section-title', 'أشِّر على ما أصبتَه'), tally]) : null,
      ends,
      list,
    ]),
    el('div', { style: { padding: '14px 24px 26px', display: 'flex', gap: '10px', alignItems: 'center', flexShrink: '0' } }, [
      Object.assign(nextBtn, { onclick: () => finish(scoreNow()) }),
      // «لاحقاً» كان يُسجَّل صفراً في صمت، فيُظنّ تأجيلاً وهو خطأٌ يُحسَب.
      el('button.btn.btn--ghost', { onclick: () => finish(0) }, 'أجِّلْه'),
    ]),
  ]);
}

/* ── ٠٦ الموضوعيّ: اختيارٌ من متعدد، وصح/خطأ، وإكمالٌ ────────────────── */

function objectiveView(host, session, q) {
  const wrap = el('div.pane.pane--tight', { style: { gap: '16px' } });
  let answered = false;

  const head = [
    el('span.chip', `${q.subject}${q.topic ? ' · ' + q.topic : ''}`),
    el('h1.head', { style: { fontSize: '28px', lineHeight: '1.5' } }, q.question),
  ];

  const explainSlot = el('div');
  const nextBtn = el('button.btn', {
    disabled: true,
    onclick: () => advance(host, session),
  }, lastLabel(session, 1));

  const settle = (correct) => {
    answered = true;
    store.record(q, correct ? 1 : 0);
    session.results.push({ q, score: correct ? 1 : 0 });
    nextBtn.disabled = false;
    nextBtn.textContent = lastLabel(session, correct ? 1 : 0);
    explainSlot.replaceChildren(explainCard(q, correct));
  };

  if (q.type === 'mcq' || q.type === 'truefalse') {
    const options = q.type === 'mcq'
      ? q.options.map((text, i) => ({ text, value: i }))
      : [{ text: 'صحيح', value: true }, { text: 'خطأ', value: false }];

    const buttons = options.map((opt) =>
      el('button.choice', {
        onclick: () => {
          if (answered) return;
          const correct = data.checkObjective(q, opt.value);
          buttons.forEach((b, i) => {
            const isRight = data.checkObjective(q, options[i].value);
            if (isRight) { b.dataset.state = 'right'; b.append(el('span.mark', { 'aria-hidden': 'true' }, '✓')); }
            else if (options[i].value === opt.value) { b.dataset.state = 'wrong'; b.append(el('span.mark', '✕')); }
            else b.dataset.state = 'dim';
          });
          settle(correct);
        },
      }, el('span', opt.text)));

    wrap.append(...head, el('div.stack', buttons), explainSlot, el('div.push', nextBtn));
  } else {
    // نوع `fill` — تُطابَق الإجابة بعد تجريد التشكيل.
    const input = el('input.answerbox', {
      type: 'text',
      placeholder: 'اكتب الإجابة…',
      'aria-label': 'إجابتك',
      style: { minHeight: 'auto', flex: 'none', lineHeight: '1.8' },
    });
    const check = el('button.btn', {
      onclick: () => {
        if (answered || !input.value.trim()) return;
        const correct = data.checkObjective(q, input.value);
        input.style.outline = `2px solid ${correct ? 'var(--green)' : 'var(--wrong)'}`;
        check.remove();
        settle(correct);
      },
    }, 'تحقّق');

    /*
     * ومخرجٌ لمن لا يعرف الجواب — كنظيرِه في المقاليّ.
     *
     * فسؤالُ الإكمالِ كان بابَين لا ثالثَ لهما: أن يكتب شيئاً يُحتسَب عليه
     * خطأً، أو أن يُنهيَ الجلسةَ كلَّها بـ✕. و«تحقّق» لا يعمل على حقلٍ فارغ،
     * و«التالي» لا يُفتَح حتى يُجيب. فمن وقف على كلمةٍ في وسطِ اختبارٍ من
     * أربعين سؤالاً خسِر الأربعين.
     *
     * ويُسجَّل صفراً صريحاً لا «تخطّياً» لا يُحسَب: ذاك يُفسِد قياسَ الإتقانِ
     * وسِجِلَّ الأخطاء، وهو عينُ ما صُحِّح في المقاليّ.
     */
    const defer = el('button.btn.btn--ghost', {
      onclick: () => {
        if (answered) return;
        check.remove();
        defer.remove();
        input.disabled = true;
        settle(false);
      },
    }, 'أجِّلْه');

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check.click(); });
    wrap.append(...head, input, explainSlot, el('div.push.stack', [check, defer, nextBtn]));
  }

  return wrap;
}

/**
 * موضعُ المسألةِ في الكتاب — بعنوانِه كما هو، لا بوصفٍ نخترعه له.
 *
 * وهو في البيانات لكلِّ سؤالٍ من الأربعةِ آلاف (`reference`: «كتاب الغصب»،
 * «كتاب الصلاة — سنن الأفعال»، «سورة النبأ: ٢٣») ولم يكن يُعرَض قطّ. والطالبُ
 * يقرأ الجوابَ فيريد أن يرجع إليه في كتابه: الصفحةُ تُعطيه الموضعَ بالرقم،
 * وهذا يُعطيه إيّاه بالاسمِ الذي يَعرِفه من فهرسِ الكتاب.
 *
 * وهو كذلك ما يمنع تكرارَ بلاغٍ وقعَ: أنّ التطبيقَ سمّى «كتابَ الغصب» باباً.
 * فإذا نُقِل العنوانُ نقلاً لم يُسَمَّ شيءٌ بغيرِ اسمه.
 */
const bookPlace = (q) => (q.reference
  ? el('span.fine', { style: { textAlign: 'start' } }, `في الكتاب: ${q.reference}`)
  : null);

/**
 * درجةُ السؤالِ المُعلَنة.
 *
 * كانت في البيانات لكلِّ سؤالٍ ولا تُعرَض قطّ، فيقرأ الطالبُ خطأَه في سؤالٍ
 * درجتُه ٩ كما يقرؤه في سؤالٍ درجتُه ٢ — ويحسبهما سواءً في الدلالةِ على حالِه.
 *
 * و«المُعلَنة» قيدٌ لازم: هي تقديرُ المولِّدِ لا قياساً على الطلاب. ولوحةُ
 * المشرفِ تقابلها بما قِيس فعلاً (`admin.js`: «أُعلِن ٧ وقِيس ٤»)، فلا تُقدَّم
 * ههنا على أنّها حكمٌ مقطوعٌ به — ولذلك جاءت في `title` لا في نصِّ الشارة.
 */
const levelBadge = (q) => (q.difficulty
  ? el('span.levelcite', { title: `درجةٌ مُعلَنة: ${ar(q.difficulty)} من ٩` },
    `${data.levelName(q.difficulty)} ${ar(q.difficulty)}`)
  : null);

function explainCard(q, correct) {
  const answerText = q.type === 'fill' ? (Array.isArray(q.answer) ? q.answer[0] : q.answer) : null;
  // `explain-in`: ترتفع البطاقةُ قليلاً وتظهر — خبرٌ بأنّ جواباً جديداً وصل،
  // لا زينة. ومن أطفأ الحركةَ في نظامه رآها في موضعها فوراً.
  return el('div.card.explain-in', { style: { gap: '8px' } }, [
    el('div.row', [
      el('span', {
        style: { fontSize: '13px', fontWeight: '600', color: correct ? 'var(--green)' : 'var(--wrong)' },
      }, correct ? 'أصبتَ' : 'راجِعها'),
      el('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [levelBadge(q), pageCite(q), devBadge(q)]),
    ]),
    answerText && !correct
      ? el('p', { style: { fontFamily: 'var(--serif)', fontSize: '18px', lineHeight: '1.8' } }, answerText)
      : null,
    el('p', { style: { fontSize: '14.5px', lineHeight: '1.95', color: '#4a4238' } },
      q.explanation || q.modelAnswer || ''),
    bookPlace(q),
    reportLink(q),
  ]);
}

/**
 * زرُّ مشاركةِ النتيجة صورةً.
 *
 * الحماسُ يتعدَّى: طالبٌ يبعث بطاقتَه في مجموعته فيُذكِّر عشرةً بوِردهم. ولا
 * يُكتَب في البطاقة اسمٌ ولا شيءٌ عن صاحبها — التطبيقُ لا يعرف عنه شيئاً.
 *
 * ويُخبِر الزرُّ بما وقع فعلاً: شُورِكت، أو نُزِّلت، أو تعذّرت.
 */
function shareButton(session, result, overall, sum, total) {
  const btn = el('button.btn.btn--ghost', { style: { width: '100%', fontSize: '14px' } }, 'شارِك نتيجتك صورةً');

  btn.onclick = async () => {
    const was = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'تُرسَم…';
    try {
      const blob = await resultCard({
        title: session.title || 'جلسة',
        score: overall,
        right: Math.round(sum),
        total,
        seconds: result.seconds,
        rank: store.rank().name,
      });
      const how = await shareCard(blob, shareText(session.title || 'جلسة', overall));
      // لكلِّ ما وقع لفظُه — ولا يُقال «حُفِظت في جهازك ✓» إلا لمن حُفِظت عنده.
      btn.textContent = how === 'shared' ? 'شُورِكت ✓'
        : how === 'downloaded' ? 'حُفِظت في جهازك ✓'
        : how === 'opened' ? 'فُتِحت — اضغط عليها مطوَّلاً لتحفظها'
        : how === 'blocked' ? 'منعَ المتصفّحُ فتحَها'
        : was;
    } catch {
      btn.textContent = 'تعذّرت المشاركة';
    }
    btn.disabled = false;
    setTimeout(() => { if (btn.isConnected) btn.textContent = was; }, 4000);
  };

  return btn;
}

/** نصُّ زرِّ الانتقال: أيبقى بعدَه سؤالٌ — أصليٌّ أو مُعادٌ — أم هي الخاتمة؟ */
function lastLabel(session, score) {
  const more = session.index + 1 < session.questions.length;
  const willRepeat = session.mode !== 'exam'
    && score < store.CORRECT
    && !session.retried.has(session.questions[session.index].id);
  return more || willRepeat ? 'السؤال التالي' : 'أنهِ الجلسة';
}

/* ── الانتقال والنتيجة ──────────────────────────────────────────────── */

/**
 * الخطأُ يُعاد في الجلسةِ نفسِها — بعدَ أن قرأ جوابَه، فيَعلَق.
 *
 * ولا يُعاد إلا مرّةً واحدةً، وإلا دارت الجلسةُ على سؤالٍ لا يُصيبه فلا تنتهي.
 * والاختبارُ مُستثنًى: لا تُعاد فيه مسألةٌ، وإلا لم يكن اختباراً.
 */
function requeueIfWrong(session) {
  // الإعادةُ لأوضاعِ **الدراسة** وحدَها، لا لكلِّ ما ليس `exam`.
  //
  // كان الشرطُ `mode === 'exam'` فحسب، و«الاختبارُ المخصَّص» وضعُه `custom` فلم
  // يشمله الاستثناء: يُعرَض عليه جوابُه النموذجيُّ ثمّ يُعاد عليه السؤالُ في
  // آخرِ الورقة، و`finishSession` يحتسب آخرَ محاولةٍ — فنتيجتُه مائةٌ في
  // المائةِ دائماً و«لا أخطاء»، فلا يعلم ما أخطأ فيه. وعُدَّت لذلك بيضاءَ في
  // سجلِّ اختباراته.
  //
  // والعدُّ صار على المُستثنى إليه لا على المُستثنى منه: فإن أُضيف وضعٌ جديدٌ
  // لم يُعَد فيه سهواً، وإنّما يُذكَر ههنا إن أُريدت إعادتُه.
  if (session.mode !== 'study' && session.mode !== 'review') return;
  const last = session.results[session.results.length - 1];
  if (!last || last.score >= store.CORRECT) return;
  if (session.retried.has(last.q.id)) return;
  session.retried.add(last.q.id);
  session.questions.push(last.q);
}

/**
 * تقريرُ الاختبار الشامل: **أين تخسر الدرجات** — على التوزيع الرسميّ نفسِه.
 *
 * فالنسبةُ المئويةُ وحدَها لا تدلُّ على موضع الخلل: من أصاب ٧٠٪ قد يكون خسر
 * كلَّ درجاتِ الفقهِ وهو أثقلُ العلومِ في الورقة (عشرٌ من أربعٍ وثلاثين).
 * فيُرتَّب على **ما خسره** لا على نسبته، ويُقرَن بنصيبِ العلمِ من الورقة.
 *
 * ولا يُذكَر حدُّ نجاحٍ ولا يُحكَم بنجاحٍ أو رسوب: درجةُ النجاح في الاختبار
 * الرسميّ غيرُ معلومةٍ لنا، واختلاقُها يُطمئن الطالبَ أو يُقلقه بلا وجهِ حقّ.
 */
function examReport(session, rows) {
  if (session.mode !== 'exam') return null;

  const share = new Map(data.EXAM_BLUEPRINT.map((b) => [b.subject, b.count]));
  const lost = rows
    .map((r) => ({ subject: r.subject, n: r.n, got: r.sum, lost: r.n - r.sum, share: share.get(r.subject) || r.n }))
    .filter((r) => r.lost >= 0.5)
    .sort((a, b) => b.lost - a.lost);

  if (!lost.length) {
    return el('div.card.card--green', { style: { gap: '6px' } }, [
      el('span', { style: { fontSize: '13.5px', fontWeight: '600' } }, 'لم تخسر درجةً تُذكَر'),
      el('span', { style: { fontSize: '12.5px', lineHeight: '1.8', opacity: '0.88' } },
        'أصبتَ في كلِّ علمٍ ما يقارب نصيبَه من الورقة.'),
    ]);
  }

  return el('div.stack', { style: { gap: '10px' } }, [
    el('span.section-title', 'أين تخسر الدرجات'),
    el('div.stack', { style: { gap: '8px' } }, lost.map((r) =>
      el('div.row', { style: { fontSize: '13.5px', gap: '10px' } }, [
        el('span', r.subject),
        el('span.num', { style: { color: 'var(--wrong)', flexShrink: '0' } },
          `−${ar(Math.round(r.lost))} من ${ar(r.n)}`),
      ]))),
    el('p.fine',
      `ابدأ بـ${(data.BOOK_OF_SUBJECT[lost[0].subject] || {}).title || lost[0].subject}: `
      // ورقةُ هذا المسارِ لا مجموعُ المخطَّط: `EXAM_BLUEPRINT` مجموعُه ٣٤،
      // و`buildFullExam` يتخطّى كلَّ علمٍ لا أسئلةَ له في المسار — فالمؤذّنُ
      // بلا نحوٍ ورقتُه ٣١، والمتقاعدُ أقلّ. وكان يُكتَب «٣٤» للجميع، فيُنسَب
      // الطالبُ إلى ورقةٍ لم يجلس إليها ويبني عليها حكمَه على نفسِه.
      + `نصيبُه من الورقة ${ar(share.get(lost[0].subject) || lost[0].n)} من `
      + `${ar(data.examSize(store.get().track))}.`),
    el('p.fine', { style: { color: 'var(--ink-6)' } },
      'ولا يُذكَر ههنا حدُّ نجاح: درجةُ النجاح في الاختبار الرسميّ غيرُ معلومةٍ لنا، ولا تُختلَق.'),
  ]);
}

/**
 * «ما فاتك» — النقاطُ التي لم يؤشِّر عليها في الأسئلة التي لم يُتقِنها.
 *
 * وهذا هو الفرقُ بين أن يعرفَ أنّه أخطأ وأن يعرفَ **ما الذي** أخطأ فيه. والنقطةُ
 * مقرونةٌ بصفحتها من الكتاب، فمن أرادها قرأها من موضعها لا من ذاكرته.
 *
 * والأسئلةُ الموضوعيةُ لا نقاطَ تحقُّقٍ لها في البنك — وهي سبعةٌ وخمسون من أربعةِ
 * آلاف — فشرحُها في موضع الإجابة هو بيانُها، ولا تُذكَر ههنا فارغةً.
 */
function missedBlock(session) {
  const rows = (session.final || session.results)
    .filter((r) => r.score < store.CORRECT && r.missed && r.missed.length);
  if (!rows.length) return null;

  const n = rows.reduce((a, r) => a + r.missed.length, 0);

  // جلسةٌ من عشرين سؤالاً أُخطئت كلُّها تُخرِج نحوَ مائةِ نقطة، وقائمةٌ بمائةِ
  // سطرٍ لا تُقرَأ فلا تُفيد. فيُعرَض أوّلُ ما يُراجَع، ويُقال صراحةً كم بقي
  // وأين يُوجَد — لا يُحذَف شيءٌ في صمت.
  const MAX_Q = 5;
  const MAX_P = 4;
  const shown = rows.slice(0, MAX_Q);
  const restQ = rows.length - shown.length;

  return el('div.stack', { style: { gap: '10px' } }, [
    el('div.row-base', [
      el('span.section-title', 'ما فاتك'),
      el('span.fine', `${ar(n)} نقطة`),
    ]),
    el('div.stack', { style: { gap: '10px' } }, shown.map((r) => {
      const pts = r.missed.slice(0, MAX_P);
      const restP = r.missed.length - pts.length;
      return el('div.card.card--sand', { style: { gap: '8px' } }, [
        el('div.row', { style: { alignItems: 'flex-start', gap: '10px' } }, [
          el('span', { style: { fontSize: '13.5px', fontWeight: '600', color: 'var(--sand-ink)', textAlign: 'start' } },
            r.q.question),
          pageCite(r.q),
        ]),
        el('ul', { style: { display: 'flex', flexDirection: 'column', gap: '6px', paddingInlineStart: '18px' } },
          pts.map((m) => el('li', {
            style: { fontSize: '13px', lineHeight: '1.85', color: 'var(--sand-ink2)' },
          }, m))),
        restP
          ? el('span.fine', { style: { color: 'var(--sand-ink2)' } }, `وبقي ${ar(restP)} نقطةً في هذا السؤال.`)
          : null,
      ]);
    })),
    restQ
      ? el('span.fine', { style: { textAlign: 'center' } },
          `و${ar(restQ)} سؤالاً آخَرَ فاتك فيه شيء — تجدها في «راجع أخطاءك».`)
      : null,
  ]);
}

/**
 * تُقيَّد الورقةُ في التخزينِ عند كلِّ انتقال — فتُستأنَف إن أُخلِيت الصفحة.
 *
 * ولا تُحفَظ الجلسةُ كلُّها: فيها دوالُّ (`back` و`again`) وأسئلةٌ كاملة، وذلك
 * لا يُسلسَل ولا يُحتاج إليه. إنّما يُحفَظ أقلُّ ما تُبنى منه الورقةُ ثانيةً:
 * أرقامُ أسئلتها بترتيبها (وقد يزيد فيها `requeueIfWrong` فتُلتقَط في حينها)،
 * وموضعُ الوقوف، ونهايةُ الوقتِ إن كانت.
 *
 * وما أُجيب محفوظٌ في `store.answers` أصلاً، فالمُستأنَفُ يكمل ولا يُعيد.
 */
function savePaper(session) {
  store.setPaper({
    mode: session.mode,
    title: session.title,
    ids: session.questions.map((q) => q.id),
    index: session.index,
    endsAt: session.endsAt || 0,
    at: Date.now(),
  });
}

function advance(host, session) {
  requeueIfWrong(session);
  session.index += 1;
  if (session.index < session.questions.length) {
    savePaper(session);
    renderQuestion(host, session);
    host.closest('.screen')?.scrollTo({ top: 0 });
  } else {
    finishSession(host, session);
  }
}

/**
 * الأسئلةُ التي لم يبلغها الطالبُ قبل نفادِ الوقت — تُحسَب صفراً، كما في القاعة.
 *
 * وكانت تسقط من الحسابِ كلَّه: `result.items` تُبنى من `session.results` وهي لا
 * تُدفَع إلا عند إجابةٍ فعليّة، ثمّ تُقسَم النسبةُ على طولِ `items` نفسِها.
 * فالسؤالُ الذي لم يُجَب يغيب من المقسومِ والمقامِ معاً — فمن أجاب ثلاثةً من
 * أربعةٍ وثلاثين وانقضى وقتُه قرأ «١٠٠٪ · أصبتَ ما يعادل ٣ من ٣ · لم تخسر
 * درجةً تُذكَر». وذلك أسوأُ من خطأٍ في رقم: يُطمئنُه على ما يرسُب فيه.
 *
 * وتعليقُ المؤقِّتِ كان يقول «ويُحسَب ما لم يُجَب صفراً — كما في القاعة»، وتعليقٌ
 * آخَرُ يقول «وما لم يُجَب لا يُسجَّل ولا يُحسَب». والمنفَّذُ هو الثاني. فصُحِّح
 * العملُ إلى الأوّلِ ووُحِّد النصّان.
 *
 * ولا تُسجَّل هذه في مخزنِ الطالب (`store.record`): سؤالٌ لم يره لا يُثبَّت عليه
 * خطأً يُعاد عليه في دراستِه. وإنّما تُحسَب في ورقةِ هذا الاختبارِ وحدَها.
 */
function fillUnanswered(session) {
  if (session.mode === 'study' || session.mode === 'review') return;
  const seen = new Set(session.results.map((r) => r.q.id));
  for (const q of session.questions) {
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    session.results.push({ q, score: 0, missed: q.keyPoints || [], unanswered: true });
  }
}

function finishSession(host, session) {
  // خُتِمت الورقةُ — فلا يبقى في الرئيسيةِ زرُّ «أكمِلْ ما بدأت» يدعو إليها.
  store.setPaper(null);
  const seconds = Math.round((Date.now() - session.startedAt) / 1000);

  fillUnanswered(session);

  // السؤالُ المُعادُ يُحسَب بآخرِ محاولةٍ لا بأوّلها — وإلا عوقب على خطأٍ صحّحه.
  // وهذا لأوضاعِ الإعادةِ وحدَها؛ وما لا إعادةَ فيه لا تقع فيه محاولةٌ ثانيةٌ
  // أصلاً بعد إصلاحِ `requeueIfWrong`.
  const latest = new Map();
  for (const r of session.results) latest.set(r.q.id, r);
  session.final = [...latest.values()];

  const result = {
    title: session.title,
    at: Date.now(),
    seconds,
    items: session.final.map((r) => ({ id: r.q.id, subject: r.q.subject, score: r.score })),
  };
  if (session.mode !== 'study') store.saveExam(result);
  // ختمُ الجلسة موضعُ الإرسال: الشبكةُ لا تُزاحم سؤالاً، ولا يُنتظَر ردُّها.
  sync.flush(store.get().track);
  host.replaceChildren(resultView(session, result));
}

/* ── ٠٧ النتيجة ─────────────────────────────────────────────────────── */

function resultView(session, result) {
  const total = result.items.length;
  const sum = result.items.reduce((a, r) => a + r.score, 0);
  const overall = total ? sum / total : 0;

  // التوزيع حسب العلم
  const bySubject = new Map();
  for (const r of result.items) {
    if (!bySubject.has(r.subject)) bySubject.set(r.subject, { subject: r.subject, n: 0, sum: 0 });
    const s = bySubject.get(r.subject);
    s.n += 1;
    s.sum += r.score;
  }
  const rows = [...bySubject.values()].sort((a, b) => b.sum / b.n - a.sum / a.n);
  const weakest = rows[rows.length - 1];

  const wrongOnes = (session.final || session.results).filter((r) => r.score < store.CORRECT).map((r) => r.q);

  /*
   * ثمرةُ الجلسةِ = الرصيدُ الآن ناقصاً الرصيدَ قبلها. (الشرحُ عند
   * `pointsBefore` في رأس الملفّ.)
   *
   * وقد تكون صفراً — إن أعاد ما يعرفه — أو سالبةً إن أخطأ ما كان يُصيبه.
   * فلا تُعرَض بطاقةُ النقاطِ إلا إذا كُسِب شيءٌ فعلاً، ولا يُقال «نقطةً
   * جديدة» عن صفر. والسالبُ لا يُشهَّر به: الطالبُ يرى درجتَه ونسبتَه
   * وأخطاءَه، وتكفيه — ولا يُزاد عليه عدُّ ما خسر.
   */
  const now = store.rank();
  const earned = Math.max(0, now.points - (session.pointsBefore ?? now.points));
  const before = store.rank(session.pointsBefore ?? now.points);
  const roseUp = before.name !== now.name;

  return el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } }, [
    el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', padding: '26px 24px 0', display: 'flex', flexDirection: 'column', gap: '22px' } }, [
      el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '14px 0' } }, [
        el('span.meta', `${session.title} — ${ar(total)} سؤالاً`),
        session.timedOut
          ? el('span.chip', { style: { background: 'var(--wrong-tint)', color: 'var(--wrong)' } },
              'نفد الوقت')
          : null,
        el('span', { style: { fontFamily: 'var(--serif)', fontSize: '68px', fontWeight: '700', color: 'var(--green)', lineHeight: '1' } }, pct(overall)),
        // المقاليّ يُعطي درجةً جزئية، فالمجموع كسريّ — يُقرَّب للعرض حتى لا يُقرأ «١٦٫٨ من ٣٤».
        el('span', { style: { fontSize: '14px', color: 'var(--ink-3)' } },
          `أصبتَ ما يعادل ${ar(Math.round(sum))} من ${ar(total)} في ${arTime(result.seconds)}`),
        // لا بطاقةَ نقاطٍ إن لم يُكسَب شيء — وإعادةُ ما يُتقِنه لا تُكسِب.
        earned > 0
          ? el('span.chip', {
              style: { background: 'var(--green-tint)', color: 'var(--green)', fontWeight: '600', marginTop: '4px' },
              // لا علامةَ زائدٍ: تنقلب في العربية إلى يمين الرقم فتُقرأ «٢٠٠+».
            }, `${ar(earned)} نقطةً جديدة`)
          : el('span.chip', { style: { marginTop: '4px', color: 'var(--ink-4)' } },
              'مراجعةٌ — لا نقاطَ جديدة'),
        /**
         * ── والنسبةُ ليست تنبُّؤاً ────────────────────────────────────────
         *
         * بلغَنا من إمامٍ يستعدُّ فعلاً: «أحسّ وايد صعبة … قاعد أفكّر ما أختبر
         * إذا جذيه مستواها». قرأَ نسبتَه ههنا فحسبها تقديراً لنتيجتِه في
         * الاختبار، فهمَّ أن يترُك الاختبارَ أصلاً.
         *
         * والفرقُ بنيويٌّ لا في الشدّةِ وحدَها: الأسئلةُ مولَّدةٌ **صفحةً صفحة**،
         * فتسأل عن قيدٍ في سطرٍ من الصفحة؛ والممتحِنُ يسأل عمّا لا يسع الإمامَ
         * جهلُه. وفوق ذلك ٣٩٥٣ من ٤٠١٠ أسئلةً **مقاليّة** — استرجاعٌ مفتوحٌ من
         * الذاكرة، وهو أشقُّ من التعرُّف بفارقٍ معلوم.
         *
         * فيُقال هذا تحت الرقمِ نفسِه، لا في صفحةِ «عن التطبيق» التي لا تُقرأ.
         * ويُقال في كلِّ ورقةٍ لا عند الرقمِ المنخفضِ وحدَه: إن لم يُقَلْ إلا
         * لمن أخفق صار مواساةً، وهو خبرٌ عن التطبيقِ صادقٌ على كلِّ حال.
         */
        el('span.fine', {
          style: { textAlign: 'center', marginTop: '10px', maxWidth: '31ch', lineHeight: '1.8' },
        }, 'والأسئلةُ ههنا أدقُّ ممّا يُسأل في الاختبار — مولَّدةٌ من صفحاتِ '
          + 'الكتبِ بتفصيلها، فلا تَقِسْ بنسبتِك فيها نتيجتَك فيه.'),
      ]),

      roseUp
        ? el('div.card.card--green', { style: { gap: '6px', alignItems: 'center' } }, [
            el('span', { style: { fontSize: '13px', opacity: '0.85' } }, 'ارتفعت رتبتُك'),
            el('span', { style: { fontFamily: 'var(--serif)', fontSize: '30px', fontWeight: '700' } }, now.name),
          ])
        : null,

      el('div.stack', [
        el('span.section-title', 'التوزيع حسب العلم'),
        el('div.stack', rows.map((s) => {
          const v = s.sum / s.n;
          const bad = v < 0.5;
          return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
            el('div.row', { style: { fontSize: '13.5px' } }, [
              el('span', s.subject),
              el('span.num', { style: { color: bad ? 'var(--wrong)' : 'var(--ink-4)' } },
                `${ar(Math.round(s.sum))} / ${ar(s.n)}`),
            ]),
            el(`div.bar${bad ? '.bar--wrong' : ''}`, el('i', { style: { width: `${Math.round(v * 100)}%` } })),
          ]);
        })),
      ]),

      examReport(session, rows),

      missedBlock(session),

      weakest && weakest.sum / weakest.n < 0.8
        ? el('div.card.card--sand', [
            el('span', { style: { fontSize: '13.5px', fontWeight: '600', color: 'var(--sand-ink)' } },
              `أضعف بابٍ عندك: ${weakest.subject}`),
            el('span.fine', { style: { color: 'var(--sand-ink2)' } },
              `${ar(weakest.n - Math.round(weakest.sum))} من ${ar(weakest.n)} تحتاج إعادة. ابدأ بـ${(data.BOOK_OF_SUBJECT[weakest.subject] || {}).title || weakest.subject}.`),
          ])
        : null,
    ]),

    el('div', { style: { padding: '14px 24px 26px', display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: '0' } }, [
      // موقعُ الطالب من البابِ كلِّه — يُطمئنه أنّ الجلسة جزءٌ من طريقٍ لا كلُّه.
      session.pool && session.pool.length
        ? el('span.fine', { style: { textAlign: 'center', color: 'var(--ink-4)' } },
            (() => {
              const done = session.pool.filter((q) => store.isCorrect(q.id)).length;
              return `أصبتَ ${ar(done)} من ${ar(session.pool.length)} سؤالاً في هذا الباب`;
            })())
        : null,
      shareButton(session, result, overall, sum, total),
      el('div', { style: { display: 'flex', gap: '10px' } }, [
        wrongOnes.length
          ? el('button.btn', {
              style: { flex: '1', fontSize: '15px' },
              onclick: () => go('quiz', { questions: wrongOnes, mode: 'review', title: 'مراجعة الأخطاء' }),
            }, 'راجع أخطاءك')
          : session.again
            ? el('button.btn', { style: { flex: '1', fontSize: '15px' }, onclick: session.again }, 'جلسةٌ أخرى')
            : el('button.btn', { style: { flex: '1', fontSize: '15px' }, disabled: true }, 'لا أخطاء'),
        session.again && wrongOnes.length
          ? el('button.btn.btn--ghost', { onclick: session.again }, 'جلسةٌ أخرى')
          : null,
        el('button.btn.btn--ghost', { onclick: () => go('home') }, 'الرئيسية'),
      ]),
    ]),
  ]);
}
