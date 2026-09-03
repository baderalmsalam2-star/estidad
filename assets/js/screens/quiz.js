// ٠٤ و٠٥ و٠٦ و٠٧ — جلسة الأسئلة: المقاليّ، والتصحيح الذاتيّ، والموضوعيّ، والنتيجة.
//
// الاختبار الحقيقيّ مقاليٌّ بالكامل، فجوهر هذه الشاشة أنّ الطالب يكتب ثم يصحّح نفسه
// على `keyPoints`. ولا يُحاوَل تصحيحٌ آليٌّ للنصّ الحرّ البتّة.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, pct, arTime, go, pageCite, devBadge, empty } from '../ui.js';

export default function quizScreen({ questions, mode = 'study', title = '', back = null, again = null, pool = null }) {
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
    index: 0,
    results: [],           // { q, score } — قد يتكرّر السؤالُ إن أُعيد
    retried: new Set(),    // ما أُعيد مرّةً، فلا يُعاد ثانيةً
    startedAt: Date.now(),
  };

  const host = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } });
  renderQuestion(host, session);
  return host;
}

/* ── الترويسة المشتركة: إغلاق، وشريط تقدّم، وعدّاد ──────────────────── */

function header(session, onClose) {
  const n = session.questions.length;
  return el('div', { style: { padding: '16px 24px 0', display: 'flex', alignItems: 'center', gap: '14px', flexShrink: '0' } }, [
    el('button.iconbtn', { onclick: onClose, 'aria-label': 'إنهاء' }, '✕'),
    el('div.bar', { style: { flex: '1' } },
      el('i', { style: { width: `${Math.round((session.index / n) * 100)}%` } })),
    el('span.num', { style: { fontSize: '13px', color: 'var(--ink-5)' } }, `${ar(session.index + 1)}/${ar(n)}`),
  ]);
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
      el('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [pageCite(q), devBadge(q)]),
    ]),
    el('p', { style: { fontFamily: 'var(--serif)', fontSize: '18px', lineHeight: '1.9' } },
      q.modelAnswer || q.explanation || ''),
    q.correctionNote
      ? el('p.fine', { style: { color: 'var(--sand-ink3)' } }, `تصحيح: ${q.correctionNote}`)
      : null,
  ]);

  const buttons = [];
  const list = points
    ? el('div.stack-sm', points.map((p, i) => {
        const b = el('button.point', {
          'aria-pressed': 'false',
          onclick: (e) => {
            const btn = e.currentTarget;
            const on = btn.getAttribute('aria-pressed') === 'true';
            btn.setAttribute('aria-pressed', String(!on));
            if (on) ticked.delete(i); else ticked.add(i);
            updateTally();
          },
        }, [el('span.box', '✓'), el('span', p)]);
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
    session.results.push({ q, score });
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
            if (isRight) { b.dataset.state = 'right'; b.append(el('span.mark', '✓')); }
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

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check.click(); });
    wrap.append(...head, input, explainSlot, el('div.push.stack', [check, nextBtn]));
  }

  return wrap;
}

function explainCard(q, correct) {
  const answerText = q.type === 'fill' ? (Array.isArray(q.answer) ? q.answer[0] : q.answer) : null;
  return el('div.card', { style: { gap: '8px' } }, [
    el('div.row', [
      el('span', {
        style: { fontSize: '13px', fontWeight: '600', color: correct ? 'var(--green)' : 'var(--wrong)' },
      }, correct ? 'أصبتَ' : 'راجِعها'),
      el('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, [pageCite(q), devBadge(q)]),
    ]),
    answerText && !correct
      ? el('p', { style: { fontFamily: 'var(--serif)', fontSize: '18px', lineHeight: '1.8' } }, answerText)
      : null,
    el('p', { style: { fontSize: '14.5px', lineHeight: '1.95', color: '#4a4238' } },
      q.explanation || q.modelAnswer || ''),
  ]);
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
  if (session.mode === 'exam') return;
  const last = session.results[session.results.length - 1];
  if (!last || last.score >= store.CORRECT) return;
  if (session.retried.has(last.q.id)) return;
  session.retried.add(last.q.id);
  session.questions.push(last.q);
}

function advance(host, session) {
  requeueIfWrong(session);
  session.index += 1;
  if (session.index < session.questions.length) {
    renderQuestion(host, session);
    host.closest('.screen')?.scrollTo({ top: 0 });
  } else {
    finishSession(host, session);
  }
}

function finishSession(host, session) {
  const seconds = Math.round((Date.now() - session.startedAt) / 1000);

  // السؤالُ المُعادُ يُحسَب بآخرِ محاولةٍ لا بأوّلها — وإلا عوقب على خطأٍ صحّحه.
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

  // ثمرةُ الجلسةِ نقاطاً — تُحسَب كما تُحسَب في المخزن: عشرٌ للمتقَن وما دونه بحسابه.
  const earned = result.items.reduce((a, r) => a + Math.round(10 * r.score), 0);
  const now = store.rank();
  const before = store.rank(Math.max(0, now.points - earned));
  const roseUp = before.name !== now.name;

  return el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } }, [
    el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', padding: '26px 24px 0', display: 'flex', flexDirection: 'column', gap: '22px' } }, [
      el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '14px 0' } }, [
        el('span.meta', `${session.title} — ${ar(total)} سؤالاً`),
        el('span', { style: { fontFamily: 'var(--serif)', fontSize: '68px', fontWeight: '700', color: 'var(--green)', lineHeight: '1' } }, pct(overall)),
        // المقاليّ يُعطي درجةً جزئية، فالمجموع كسريّ — يُقرَّب للعرض حتى لا يُقرأ «١٦٫٨ من ٣٤».
        el('span', { style: { fontSize: '14px', color: 'var(--ink-3)' } },
          `أصبتَ ما يعادل ${ar(Math.round(sum))} من ${ar(total)} في ${arTime(result.seconds)}`),
        el('span.chip', {
          style: { background: 'var(--green-tint)', color: 'var(--green)', fontWeight: '600', marginTop: '4px' },
          // لا علامةَ زائدٍ: تنقلب في العربية إلى يمين الرقم فتُقرأ «٢٠٠+».
        }, `${ar(earned)} نقطةً جديدة`),
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
