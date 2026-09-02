// ١١ — صندوق المراجعة. ما أصابه الطالبُ يُرفَع من دورةِ الأسئلة ويُحفَظ ههنا.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, go, topbar, empty, pageCite } from '../ui.js';

/**
 * صندوقُ المراجعة.
 *
 * السؤالُ إذا أصابه الطالبُ خرج من دورةِ الأسئلة فلا يُعرَض عليه ثانيةً في
 * جلسةٍ تلقائية — لا في الوِرد ولا في دراسةِ الباب — لأنّ إعادةَ المعلومِ ضياعُ
 * وقتٍ يستحقُّه المجهول. ويبقى محفوظاً ههنا، لا يُفتَح إلا أن يفتحه بنفسِه.
 *
 * وإن أخطأ في المراجعة عاد السؤالُ إلى الدورةِ من نفسِه — لأنّ الدرجةَ تُسجَّل
 * في المراجعة كما تُسجَّل في الدراسة، فينزل عن حدِّ الصواب فيُعاد.
 */
export default function masteredScreen({ subject = null, topic = null } = {}) {
  const track = store.get().track;
  const pool = subject ? data.questionsIn(track, subject, topic) : data.forTrack(track);
  const kept = store.correctOnes(pool);
  const title = topic || subject || 'صندوق المراجعة';

  const back = () => (subject ? go('book', { subject }) : go('home'));

  if (!kept.length) {
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } });
    wrap.append(
      topbar({ onBack: back, title }),
      empty('لم تُصِب سؤالاً بعدُ', 'ما تُصيبه يُرفَع من دورةِ الأسئلة ويُحفَظ ههنا، فلا يُعاد عليك إلا أن تطلبه.'),
    );
    return wrap;
  }

  // التوزيعُ على العلوم — ليختار الطالبُ ما يراجعه، لا أن يُساق إلى الكلّ.
  const lanes = new Map();
  for (const q of kept) {
    if (!lanes.has(q.subject)) lanes.set(q.subject, []);
    lanes.get(q.subject).push(q);
  }
  const rows = [...lanes.entries()].sort((a, b) => b[1].length - a[1].length);

  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } });

  wrap.append(
    topbar({ onBack: back, title: 'صندوق المراجعة' }),

    el('div', { style: { padding: '16px 24px 6px', display: 'flex', flexDirection: 'column', gap: '6px' } }, [
      el('span', { style: { fontFamily: 'var(--serif)', fontSize: '30px', fontWeight: '700' } },
        `${ar(kept.length)} سؤالاً أصبتَه`),
      el('span.fine', { style: { textAlign: 'start' } },
        `${subject ? `في ${title}. ` : ''}هذه لا تُعاد عليك في جلسةٍ تلقائية. وإن أخطأتَ في مراجعتها عادت إلى الدورة.`),
    ]),

    el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', padding: '12px 24px 0' } }, [
      subject
        ? el('div.list', kept.slice(0, 60).map((q) =>
            el('div.list-item', { style: { cursor: 'default' } }, [
              el('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'start' } }, [
                el('span', { style: { fontSize: '14.5px', lineHeight: '1.7' } }, q.question),
                pageCite(q),
              ]),
            ])))
        : el('div.list', rows.map(([name, qs]) =>
            el('button.list-item', { onclick: () => openReview(qs, name) }, [
              el('span', { style: { fontSize: '16px' } }, name),
              el('span.num', ar(qs.length)),
            ]))),

      el('div', { style: { height: '18px' } }),
    ]),

    el('div', { style: { padding: '14px 24px 26px', flexShrink: '0' } },
      el('button.btn', { onclick: () => openReview(kept, title) },
        `راجِعْ ${ar(Math.min(kept.length, store.dailyGoal()))} سؤالاً`)),
  );

  return wrap;
}

/** جلسةُ مراجعةٍ بمقدار الوِرد، الأقدمُ إصابةً أوّلاً — فهو أحوجُ ما يُراجَع. */
function openReview(questions, title) {
  const batch = [...questions].reverse().slice(0, store.dailyGoal());
  if (!batch.length) return;
  go('quiz', { questions: batch, mode: 'review', title: `مراجعة ${title}` });
}
