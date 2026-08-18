// ٠٢ — الرئيسية. التقدّم، ومتابعة ما انقطع، ومداخل الأوضاع الستّة.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, pct, go, padNav, credit, MAGNIFIER } from '../ui.js';
import { openTopic } from './books.js';

export default function homeScreen() {
  const track = store.get().track;
  const pool = data.forTrack(track);
  const prog = store.progress(pool);
  const mistakes = store.mistakes(pool);
  const resume = store.get().resume;
  const label = data.manifest().tracks[track].label;

  const exam = data.EXAM_BLUEPRINT.reduce(
    (n, b) => n + (data.questionsIn(track, b.subject).length ? b.count : 0),
    0,
  );

  return padNav(el('div.pane', [
    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } }, [
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } }, [
        el('span.meta', `مسار ${label}`),
        el('span.title', 'أهلاً بك'),
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

    // تقدّمك في المنهج
    el('div.card.card--lg.card--green', { style: { gap: '16px' } }, [
      el('div.row-base', [
        el('span', { style: { fontSize: '14px', opacity: '0.85' } }, 'تقدّمك في المنهج'),
        el('span.num', { style: { fontSize: '14px' } }, `${ar(prog.done)} / ${ar(prog.total)}`),
      ]),
      el('span', { style: { fontFamily: 'var(--serif)', fontSize: '52px', fontWeight: '700', lineHeight: '1' } }, pct(prog.pct)),
      el('div.bar.bar--onGreen', el('i', { style: { width: `${Math.round(prog.pct * 100)}%` } })),
    ]),

    wirdCard(track),

    resume ? resumeCard(resume) : null,

    el('div.grid2', [
      tile('اختبار شامل', `${ar(exam)} سؤالاً · محاكاة`, () => go('quiz', {
        questions: data.buildFullExam(track),
        mode: 'exam',
        title: 'اختبار شامل محاكٍ',
      })),
      tile('التسميع', 'القرآن والأذان', () => go('recite')),
      tile('بطاقات الحفظ', 'التعدادات', () => go('flashcards')),
      tile('اختبار مخصّص', 'اختر العلوم والصعوبة', () => go('custom')),
      tile('محرّك التجويد', 'جزء عمّ · كلمةً كلمة', () => go('tajweed')),
      tile(
        'مراجعة الأخطاء',
        mistakes.length ? `${ar(mistakes.length)} بانتظارك` : 'لا أخطاءَ بعد',
        mistakes.length
          ? () => go('quiz', { questions: mistakes, mode: 'review', title: 'مراجعة الأخطاء' })
          : null,
        'tile--sand',
      ),
    ]),

    credit(),
  ]));
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

    el('div.week', week.map((d) => {
      const full = d.count >= goal;
      return el('span.week-day', { title: `${ar(d.count)} سؤالاً` }, [
        el('i', { class: d.count ? (full ? 'dot dot--full' : 'dot dot--some') : 'dot' }),
        el('em', DAY_LETTERS[d.date.getDay()]),
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
      onclick: () => {
        const questions = data.buildWird(track, left || goal, store.scoreOf);
        if (!questions.length) return;
        go('quiz', {
          questions,
          mode: 'study',
          title: done ? 'زيادةٌ على الوِرد' : 'وِرد اليوم',
        });
      },
    }, done ? `زِدْ ${ar(goal)} سؤالاً` : `ابدأ — ${ar(left)} سؤالاً`),
  ]);
}

function resumeCard(resume) {
  return el('div.stack', [
    el('div.row-base', [
      el('span.section-title', 'تابِع من حيث وقفت'),
      el('button', {
        onclick: () => go('books'),
        style: { font: 'inherit', fontSize: '13px', color: 'var(--ink-5)', background: 'none', border: 'none', cursor: 'pointer' },
      }, 'الكلّ'),
    ]),
    el('button.card', {
      style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
      onclick: () => openTopic(resume.subject, resume.topic === 'الكتاب كاملاً' ? null : resume.topic),
    }, [
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px', textAlign: 'start' } }, [
        el('span', { style: { fontFamily: 'var(--serif)', fontSize: '26px', fontWeight: '700' } }, resume.topic),
        el('span', { style: { fontSize: '13px', color: 'var(--ink-4)' } },
          `${resume.subject} — ${ar(resume.done)} من ${ar(resume.total)}`),
      ]),
      el('span.iconbtn.iconbtn--lg', '▶'),
    ]),
  ]);
}

function tile(title, note, onclick, cls = '') {
  return el(`button.tile${cls ? '.' + cls : ''}`, {
    onclick: onclick || undefined,
    disabled: !onclick,
    style: onclick ? null : { opacity: '0.55', cursor: 'default' },
  }, [
    el('span.h-card', title),
    el('span.fine', note),
  ]);
}
