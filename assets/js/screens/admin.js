// ١٢ — لوحةُ المشرف. أرقامُ هذا الجهاز وصحّةُ البنك، لا أرقامَ الطلاب.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, pct, go, topbar } from '../ui.js';

/**
 * لوحةُ المشرف — وحدُّها الذي لا تتجاوزه.
 *
 * التطبيقُ بلا خادمٍ ولا حساب، وتقدّمُ كلِّ طالبٍ محبوسٌ في جهازه، وهذا مكتوبٌ
 * له في «حسابي». فلا سبيلَ ههنا إلى «كم طالباً دخل» ولا «كم أصابوا» — تلك
 * تحتاج خادماً يجمعُ الإجابات، وهو قرارٌ آخَر.
 *
 * فما تعرضه هذه اللوحةُ صنفان لا ثالثَ لهما، وكلاهما صادقٌ اليوم:
 *   • **صحّةُ البنك** — عن الأسئلة نفسِها، لا عن أحد: توثيقُها، وتصحيحاتُها،
 *     وتوزيعُ صعوبتها، وثغراتُها. وهذه أرقامٌ عن عملك أنت، وهي التي تُصلِح.
 *   • **أرقامُ هذا الجهاز** — إجاباتُك أنت على هذا الجهاز وحدَه: أصعبُ ما
 *     أخطأتَ فيه، وأضعفُ الأبواب. وتُعنوَن بذلك صراحةً فلا تُقرأ إحصاءَ طلاب.
 */
export default function adminScreen() {
  const track = store.get().track;
  const pool = data.forTrack(track);
  const all = data.allQuestions();

  return el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } }, [
    topbar({ onBack: () => go('account'), title: 'لوحة المشرف' }),
    el('div.pane', { style: { gap: '18px' } }, [
      bankHealth(all),
      difficultySpread(all),
      measured(pool),
      gaps(all),
      deviceStats(pool),
      el('div.card.card--sand', { style: { gap: '8px' } }, [
        el('span', { style: { fontSize: '13.5px', fontWeight: '600', color: 'var(--sand-ink)' } },
          'لماذا لا ترى أرقام الطلاب'),
        el('span.fine', { style: { color: 'var(--sand-ink2)' } },
          'التطبيق بلا خادمٍ ولا حساب، وتقدّم كل طالبٍ محبوسٌ في جهازه — وهذا وعدٌ مكتوبٌ له في «حسابي». '
          + 'وجمعُ إجاباتهم في لوحةٍ واحدةٍ يحتاج خادماً ونقضَ ذلك الوعد صراحةً، لا في صمت.'),
      ]),
    ]),
  ]);
}

/* ── صحّةُ البنك ─────────────────────────────────────────────────────── */

function bankHealth(all) {
  const n = all.length;
  const verified = all.filter((q) => q.bookVerified).length;
  const fromPage = all.filter((q) => q.provenance === 'generated-from-page').length;
  const fromOcr = all.filter((q) => q.provenance === 'generated-from-ocr-text').length;
  const corrected = all.filter((q) => q.correctionNote).length;

  return el('div.stack', [
    el('span.section-title', 'صحّة البنك'),
    el('div.card.card--lg.card--green', { style: { gap: '14px' } }, [
      el('div.row-base', [
        el('span', { style: { fontSize: '14px', opacity: '0.85' } }, 'موثَّقٌ على الكتاب'),
        el('span.num', { style: { fontSize: '14px' } }, `${ar(verified)} / ${ar(n)}`),
      ]),
      el('span', { style: { fontFamily: 'var(--serif)', fontSize: '46px', fontWeight: '700', lineHeight: '1' } },
        pct(verified / n)),
      el('div.bar.bar--onGreen', el('i', { style: { width: `${Math.round((verified / n) * 100)}%` } })),
      el('span', { style: { fontSize: '12.5px', opacity: '0.85' } },
        `${ar(n - verified)} سؤالاً لم يُقابَل على صفحةٍ مطبوعةٍ بعدُ.`),
    ]),
    el('div.card', { style: { gap: '10px' } },
      [['مولَّدٌ من صورة الصفحة', fromPage, 'أوثقُ الأصناف'],
       ['مولَّدٌ من نصّ OCR', fromOcr, 'أضعفُ: لم يُقابَل على صورة'],
       ['مكتوبٌ يدوياً', n - fromPage - fromOcr, 'أكثرُه غيرُ موثَّق'],
       ['فيه تصحيحُ خطأٍ مطبعيّ', corrected, 'خطأٌ في الكتاب نُصَّ عليه']]
        .map(([label, v, note]) => el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
          el('div.row', { style: { fontSize: '13.5px' } }, [
            el('span', label),
            el('span.num', { style: { color: 'var(--ink-4)' } }, ar(v)),
          ]),
          el('span.fine', { style: { textAlign: 'start' } }, note),
        ]))),
  ]);
}

/* ── الصعوبة المعلنة ────────────────────────────────────────────────── */

/**
 * الصعوبةُ ههنا **معلنةٌ** في السؤال (١–٩)، لا مقيسةٌ من إجابات الطلاب — ولا
 * تُقاس إلا بخادمٍ يجمعها. فتُسمَّى باسمها كي لا تُقرأ ما ليست هي.
 */
function difficultySpread(all) {
  const by = new Map();
  for (const q of all) {
    const d = q.difficulty || 0;
    by.set(d, (by.get(d) || 0) + 1);
  }
  const rows = [...by.entries()].filter(([d]) => d).sort((a, b) => a[0] - b[0]);
  const max = Math.max(...rows.map(([, v]) => v));

  return el('div.stack', [
    el('span.section-title', 'الصعوبة المعلنة'),
    el('div.card', { style: { gap: '12px' } }, [
      el('span.fine', { style: { textAlign: 'start' } },
        'درجةٌ كُتبت مع كلِّ سؤالٍ حين وُلِّد. وليست مقيسةً من إجابات الطلاب — ذلك يحتاج خادماً.'),
      el('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '5px', height: '90px' } },
        rows.map(([d, v]) => el('div', {
          title: `${ar(v)} سؤالاً`,
          style: { flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' },
        }, [
          el('span', {
            style: {
              width: '100%', height: `${Math.max(3, Math.round((v / max) * 62))}px`,
              background: d >= 7 ? 'var(--wrong)' : d >= 5 ? 'var(--green)' : 'var(--ink-8)',
              borderRadius: '5px',
            },
          }),
          el('span.num', { style: { fontSize: '11px', color: 'var(--ink-5)' } }, ar(d)),
        ]))),
      el('div.row', { style: { fontSize: '12px', color: 'var(--ink-5)' } }, [
        el('span', 'أسهل'), el('span', 'أصعب'),
      ]),
    ]),
  ]);
}

/* ── الصعوبة المقيسة ────────────────────────────────────────────────── */

/**
 * الصعوبةُ المقيسةُ من الإجابات، تُقابَل بالمعلَنةِ فيَبِينُ ما أُخطئ تقديرُه.
 *
 * الصعوبةُ المعلنةُ (١–٩) حكمٌ كُتب مع السؤال، وقد يُخطئ. والمقيسةُ حكمُ
 * الواقع: `١ − متوسّطُ الدرجة`، مضروبةً في تسعةٍ لتُقابَل بها على سُلَّمها.
 *
 * وقياسُ سؤالٍ من إجابةٍ واحدةٍ ليس قياساً — لكنّ هذا الجهازَ لا يحمل غيرَها،
 * فيُقال ذلك صراحةً ويُعرَض أشدُّ التفاوتِ وحدَه، ولا يُبدَّل به المعلَن.
 */
function measured(pool) {
  const rows = [];
  for (const q of pool) {
    const s = store.scoreOf(q.id);
    if (s === null || !q.difficulty) continue;
    const seen = Math.round((1 - s) * 8) + 1;         // ١..٩
    rows.push({ q, seen, gap: seen - q.difficulty });
  }
  if (!rows.length) {
    return el('div.stack', [
      el('span.section-title', 'الصعوبة المقيسة'),
      el('div.card', el('span.fine',
        'تُقاس من إجاباتك على هذا الجهاز، وتُقابَل بالصعوبة المعلنة. أجِبْ عن أسئلةٍ ثمّ عُدْ.')),
    ]);
  }

  const off = rows.filter((r) => Math.abs(r.gap) >= 3)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 6);

  return el('div.stack', [
    el('span.section-title', 'الصعوبة المقيسة'),
    el('div.card', { style: { gap: '10px' } }, [
      el('div.row', { style: { fontSize: '13.5px' } }, [
        el('span', 'أسئلةٌ قِيست'), el('span.num', { style: { color: 'var(--ink-4)' } }, ar(rows.length)),
      ]),
      el('div.row', { style: { fontSize: '13.5px' } }, [
        el('span', 'تفاوتٌ بيّنٌ عن المعلَن'),
        el('span.num', { style: { color: off.length ? 'var(--wrong)' : 'var(--green)' } },
          ar(rows.filter((r) => Math.abs(r.gap) >= 3).length)),
      ]),
      el('span.fine', { style: { textAlign: 'start' } },
        'مقيسةٌ من إجابةٍ واحدةٍ لكلِّ سؤالٍ على هذا الجهاز — دلالةٌ لا حكم. '
        + 'والقياسُ الذي يُعتمَد عليه يحتاج إجاباتِ طلابٍ كثيرين، وذلك يحتاج خادماً.'),
    ]),
    off.length
      ? el('div.card', { style: { gap: '12px' } }, [
          el('span', { style: { fontSize: '13.5px', fontWeight: '600' } }, 'أبعدُها عن تقديرها'),
          ...off.map(({ q, seen, gap }) => el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
            el('span', { style: { fontSize: '13.5px', lineHeight: '1.7' } }, q.question),
            el('span.fine', { style: { textAlign: 'start' } },
              `أُعلِن ${ar(q.difficulty)} وقِيس ${ar(seen)} — ${gap > 0 ? 'أصعبُ' : 'أسهلُ'} ممّا قُدِّر`
              + `${q.bookPage ? ` · ${q.bookPage}` : ''}`),
          ])),
        ])
      : null,
  ]);
}

/* ── ثغراتٌ تُصلَح ───────────────────────────────────────────────────── */

/** ما ينقص البنكَ فعلاً — قائمةُ عملٍ لا زينةَ أرقام. */
function gaps(all) {
  const noPage = all.filter((q) => !q.bookPage).length;
  // المقاليُّ وحدَه يحتاج نقاطَ تصحيح؛ والموضوعيُّ يُصحَّح آلياً من جوابه،
  // فعَدُّه في النقص إنذارٌ كاذبٌ يُشغِل عن نقصٍ حقيقيّ.
  const noKeys = all.filter((q) => q.type === 'essay' && !(q.keyPoints || []).length).length;

  const bySubject = new Map();
  for (const q of all) {
    if (q.bookVerified) continue;
    bySubject.set(q.subject, (bySubject.get(q.subject) || 0) + 1);
  }
  const rows = [...bySubject.entries()].sort((a, b) => b[1] - a[1]);

  return el('div.stack', [
    el('span.section-title', 'ثغراتٌ تُصلَح'),
    el('div.card', { style: { gap: '10px' } }, [
      el('div.row', { style: { fontSize: '13.5px' } }, [
        el('span', 'بلا رقم صفحة'), el('span.num', { style: { color: 'var(--ink-4)' } }, ar(noPage)),
      ]),
      el('div.row', { style: { fontSize: '13.5px' } }, [
        el('span', 'مقاليٌّ بلا نقاط تصحيح'),
        el('span.num', { style: { color: noKeys ? 'var(--wrong)' : 'var(--green)' } }, ar(noKeys)),
      ]),
      el('span.fine', { style: { textAlign: 'start' } }, noKeys
        ? 'المقاليُّ بلا نقاطٍ تُحتسَب درجتُه كاملةً، وذلك يرفع درجةَ الطالب بلا وجه.'
        : 'كلُّ سؤالٍ مقاليٍّ في البنك له نقاطُ تصحيحٍ ذاتيّ. والموضوعيُّ يُصحَّح آلياً فلا يحتاجها.'),
    ]),
    rows.length
      ? el('div.card', { style: { gap: '10px' } }, [
          el('span', { style: { fontSize: '13.5px', fontWeight: '600' } }, 'غيرُ الموثَّق حسب العلم'),
          ...rows.map(([subject, v]) => el('div.row', { style: { fontSize: '13.5px' } }, [
            el('span', subject),
            el('span.num', { style: { color: 'var(--wrong)' } }, ar(v)),
          ])),
        ])
      : null,
  ]);
}

/* ── أرقامُ هذا الجهاز ───────────────────────────────────────────────── */

function deviceStats(pool) {
  const seen = pool.filter((q) => store.scoreOf(q.id) !== null);
  const right = pool.filter((q) => store.isCorrect(q.id));
  const wrong = store.mistakes(pool);
  const { streak } = store.daily();

  // أصعبُ ما مرَّ عليك: أدنى الدرجات، ومعها صعوبتُها المعلنة لتقابلَها بها.
  const hardest = [...wrong]
    .sort((a, b) => store.scoreOf(a.id) - store.scoreOf(b.id))
    .slice(0, 8);

  return el('div.stack', [
    el('span.section-title', 'أرقام هذا الجهاز'),
    el('div.card', { style: { gap: '10px' } }, [
      el('span.fine', { style: { textAlign: 'start' } },
        'إجاباتُك أنت على هذا الجهاز وحدَه — ليست إحصاءَ طلاب.'),
      ...[['أجبتَ عنه', seen.length], ['أصبتَه', right.length],
          ['أخطأتَ فيه', wrong.length], ['أيامٌ متَّصلة', streak]]
        .map(([label, v]) => el('div.row', { style: { fontSize: '13.5px' } }, [
          el('span', label), el('span.num', { style: { color: 'var(--ink-4)' } }, ar(v)),
        ])),
      seen.length
        ? el('div.row', { style: { fontSize: '13.5px' } }, [
            el('span', 'نسبة الإصابة'),
            el('span.num', { style: { color: 'var(--green)' } }, pct(right.length / seen.length)),
          ])
        : null,
    ]),

    hardest.length
      ? el('div.card', { style: { gap: '12px' } }, [
          el('span', { style: { fontSize: '13.5px', fontWeight: '600' } }, 'أصعبُ ما أخطأتَ فيه'),
          ...hardest.map((q) => el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
            el('span', { style: { fontSize: '13.5px', lineHeight: '1.7' } }, q.question),
            el('span.fine', { style: { textAlign: 'start' } },
              `${q.subject}${q.topic ? ' · ' + q.topic : ''} — درجتُك ${pct(store.scoreOf(q.id))}`
              + `${q.difficulty ? `، وصعوبتُه المعلنة ${ar(q.difficulty)}` : ''}`),
          ])),
        ])
      : el('div.card', el('span.fine', 'لم تُخطئ في شيءٍ بعدُ على هذا الجهاز.')),
  ]);
}
