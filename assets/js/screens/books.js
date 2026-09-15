// ٠٣ — الكتب المقرَّرة ودراستها. الشرح والإجابة النموذجية يظهران فوراً، بلا درجة.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, go, topbar, MAGNIFIER } from '../ui.js';

/* ── غلافُ الكتاب ────────────────────────────────────────────────────── */

/**
 * صورةُ الغلاف إن رُسمت، وإلّا غلافٌ يُكتَب بالخطِّ في التطبيق.
 *
 * وكان ههنا مربّعٌ مخطَّطٌ واحدٌ للكتب كلِّها، لا يدلُّ على كتابٍ بعينه — يمرُّ
 * الطالبُ على السبعةِ فلا يميّز واحداً منها بنظرة. وثلاثةٌ من الكتب لم تُرفَع
 * ملفّاتُها بعدُ، ورابعٌ نسختُه بلا غلاف، فهذه أربعةٌ يُكتَب عنوانُها في
 * مكان الصورة — لا يُترَك موضعُها فارغاً ولا يُختلَق لها غلافٌ ليس لها.
 */
export function bookCover(subject, w = 62) {
  const box = { width: `${w}px`, height: `${Math.round(w * 1.4)}px` };
  const src = data.bookCoverSrc(data.BOOK_ID[subject]);
  if (src) {
    return el('img.cover', { src, alt: '', loading: 'lazy', style: box });
  }
  const title = (data.BOOK_OF_SUBJECT[subject] || {}).title || subject;
  return el('div.cover.cover--text', {
    style: { ...box, fontSize: `${Math.max(9, Math.round(w * 0.17))}px` },
  }, title);
}

/* ── قائمة الكتب ─────────────────────────────────────────────────────── */

export function booksScreen() {
  const track = store.get().track;
  const subjects = data.subjectsOf(track);

  return el('div.pane', [
    el('div.stack', { style: { gap: '6px' } }, [
      el('h1.title', 'الكتب المقرَّرة'),
      el('p.lede', `${ar(subjects.length)} علومٍ في مسارك، على الكتب التي قرَّرتها إدارة الشؤون الفنية.`),
    ]),

    el('button.searchbar', {
      onclick: () => go('search'),
      style: {
        textAlign: 'start', cursor: 'pointer', color: 'var(--ink-7)',
        display: 'flex', alignItems: 'center', gap: '10px',
      },
    }, [
      el('span', { html: MAGNIFIER, style: { display: 'flex', flexShrink: '0' } }),
      `ابحث في ${ar(data.forTrack(track).length)} سؤالاً…`,
    ]),

    el('button.card.card--green', { onclick: () => go('library') }, [
      el('div.row', [
        el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, 'الكتب كاملةً'),
        el('span', { style: { fontSize: '18px', opacity: '0.7' } }, '‹'),
      ]),
      el('span', { style: { fontSize: '12.5px', lineHeight: '1.8', opacity: '0.88', textAlign: 'start' } },
        'افتح أي كتابٍ مقرَّرٍ كاملاً بصيغة PDF.'),
    ]),

    el('div.stack', subjects.map((s) => {
      const book = data.BOOK_OF_SUBJECT[s.subject] || {};
      // العدُّ على ما أُصيب لا على ما مرَّ: الخطأ يعودُ، فلا يُحسَب تقدُّماً.
      const done = data.questionsIn(track, s.subject).filter((q) => store.isCorrect(q.id)).length;

      return el('button.card', { onclick: () => go('book', { subject: s.subject }) }, [
        el('div.row', { style: { alignItems: 'flex-start', gap: '13px' } }, [
          bookCover(s.subject, 54),
          el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'start', flex: '1', minWidth: '0' } }, [
            el('span', { style: { fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: '700', lineHeight: '1.3' } }, book.title || s.subject),
            el('span.meta', `${s.subject}${book.note ? ' · ' + book.note : ''}`),
          ]),
          el('span.num', { style: { fontSize: '12.5px', color: 'var(--ink-5)', flexShrink: '0' } }, ar(s.total)),
        ]),
        el('div.bar', { style: { marginTop: '4px' } },
          el('i', { style: { width: `${Math.round((done / s.total) * 100)}%` } })),
      ]);
    })),
  ]);
}

/* ── كتابٌ واحد: أبوابه ─────────────────────────────────────────────── */

export function bookScreen({ subject }) {
  const track = store.get().track;
  const book = data.BOOK_OF_SUBJECT[subject] || {};
  const all = data.questionsIn(track, subject);
  const topics = tableOfContents(all);
  const documented = all.filter((q) => q.bookVerified).length;

  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } });

  wrap.append(
    topbar({ onBack: () => go('books'), title: 'الكتب المقرَّرة' }),

    el('div', { style: { padding: '18px 24px 4px', display: 'flex', gap: '14px', alignItems: 'flex-start' } }, [
      bookCover(subject, 66),
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', flex: '1' } }, [
        el('span', { style: { fontFamily: 'var(--serif)', fontSize: '27px', fontWeight: '700', lineHeight: '1.3' } }, book.title || subject),
        el('span.meta', `${book.note || subject}${book.pages ? ' — ' + ar(book.pages) + ' صفحة' : ''}`),
        el('span', { style: { fontSize: '12.5px', color: 'var(--green)' } },
          `${ar(all.length)} سؤالاً، منها ${ar(documented)} موثَّقاً على الكتاب`),
      ]),
    ]),

    el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', padding: '10px 24px 0' } }, [
      el('div.list', topics.map(({ topic, qs, range }) => {
        const done = qs.filter((q) => store.isCorrect(q.id)).length;
        const imamOnly = qs.every((q) => (q.tracks || []).length === 1 && q.tracks[0] === 'imam');

        return el('button.list-item', { onclick: () => openTopic(subject, topic) }, [
          el('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'start' } }, [
            el('span', { style: { fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' } }, [
              topic,
              imamOnly ? el('span.chip', { style: { fontSize: '11px', padding: '3px 9px' } }, 'للإمام') : null,
            ]),
            range ? el('span.fine', { class: 'num' }, range) : null,
          ]),
          el('span.num', done ? `${ar(done)}/${ar(qs.length)}` : ar(qs.length)),
        ]);
      })),

      el('div.card', { style: { marginTop: '20px' } }, [
        el('span', { style: { fontSize: '13px', fontWeight: '600', color: 'var(--green)' } }, 'وضع الدراسة'),
        el('span', { style: { fontSize: '13px', lineHeight: '1.8', color: 'var(--ink-3)' } },
          'يُعرَض الشرح والإجابة النموذجية فوراً مع كل سؤال، وتُصحّح لنفسك. '
          + 'فما أصبتَه رُفِع إلى صندوق المراجعة فلا يُعاد عليك، وما أخطأتَ فيه أُعيد حتى تُصيبه.'),
      ]),

      // التجويد وحده له محرّكٌ يطبّق أحكامه على المصحف كلمةً كلمة.
      subject === 'التجويد'
        ? el('button.card.card--green', { style: { margin: '12px 0 20px' }, onclick: () => go('tajweed') }, [
            el('div.row', [
              el('span', { style: { fontSize: '15.5px', fontWeight: '600' } }, 'محرّك التجويد'),
              el('span', { style: { fontSize: '18px', opacity: '0.7' } }, '‹'),
            ]),
            el('span', { style: { fontSize: '12.5px', lineHeight: '1.8', opacity: '0.88', textAlign: 'start' } },
              'أحكام جزء عمّ كلمةً كلمة، وكلُّ حكمٍ موصولٌ بسؤاله وشرحه في غاية المريد.'),
          ])
        : el('div', { style: { height: '20px' } }),
    ]),

    el('div', { style: { padding: '14px 24px 26px', flexShrink: '0' } },
      el('button.btn', { onclick: () => openTopic(subject, null) }, 'ابدأ الدراسة')),
  );

  return wrap;
}

/**
 * فهرسُ الكتاب — أبوابُه مرتَّبةً على صفحاتها لا على ترتيب دخولها البنوكَ.
 *
 * البنوك المكتوبة يدوياً سبقت المولَّدةَ من الصفحات، فكان بابُ البيع يسبق بابَ
 * الطهارة في القائمة. والآن يُرتَّب كلُّ بابٍ على أوّلِ صفحةٍ وُثِّق عليها،
 * ويُعرَض مداه — فتصير القائمةُ فهرساً يُشبه فهرسَ الكتاب المطبوع.
 * وما لا صفحةَ له يُؤخَّر إلى آخرها، لأنّه لا موضعَ له يُرتَّب عليه.
 */
function tableOfContents(all) {
  const map = new Map();
  for (const q of all) {
    const topic = q.topic || 'عامّ';
    if (!map.has(topic)) map.set(topic, []);
    map.get(topic).push(q);
  }

  return [...map.entries()]
    .map(([topic, qs]) => {
      const pages = qs.map((q) => data.firstPageOf(q.bookPage)).filter(Boolean);
      const from = pages.length ? Math.min(...pages) : null;
      const to = pages.length ? Math.max(...pages) : null;
      return {
        topic,
        qs,
        from,
        range: from === null ? null : (from === to ? `ص${ar(from)}` : `ص${ar(from)}–${ar(to)}`),
      };
    })
    .sort((a, b) => (a.from ?? Infinity) - (b.from ?? Infinity));
}

/**
 * دفعةُ الجلسة: ما أخطأ فيه أوّلاً — فالخطأ أحقُّ بالإعادة — ثمّ ما لم يمرَّ
 * عليه، بمقدار الوِرد اليوميّ.
 *
 * وما أصابه الطالبُ **لا يُعاد عليه** ههنا البتّة: يخرج من الدورةِ إلى صندوق
 * المراجعة، فلا يُعرَض إلا أن يفتحه بنفسِه. وإلا ضاع وقتُه في سؤالٍ يعرفه.
 */
function sessionBatch(questions) {
  const size = store.dailyGoal();
  const fresh = [];
  const wrong = [];
  for (const q of questions) {
    const s = store.scoreOf(q.id);
    if (s === null) fresh.push(q);
    else if (s < store.CORRECT) wrong.push(q);
  }
  // الأضعفُ درجةً أوّلَ الخطأ.
  wrong.sort((a, b) => store.scoreOf(a.id) - store.scoreOf(b.id));
  return [...wrong, ...fresh].slice(0, size);
}

export function openTopic(subject, topic) {
  const track = store.get().track;
  const questions = data.questionsIn(track, subject, topic);
  if (!questions.length) return;

  const batch = sessionBatch(questions);
  // فرغَ البابُ: كلُّ أسئلته أُصيبت. فيُفتَح صندوقُ المراجعة بدل شاشةٍ خالية.
  if (!batch.length) return go('mastered', { subject, topic });

  store.setResume({
    subject,
    topic: topic || 'الكتاب كاملاً',
    done: questions.filter((q) => store.isCorrect(q.id)).length,
    total: questions.length,
  });
  go('quiz', {
    questions: batch,
    mode: 'study',
    title: topic || subject,
    back: () => go('book', { subject }),
    // إعادةُ الجلسة تلتقط دفعةً جديدة، لا الدفعةَ نفسَها.
    again: () => openTopic(subject, topic),
    pool: questions,
  });
}
