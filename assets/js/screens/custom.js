// اختبارٌ مخصّص — الطالب يختار العلوم والعدد والصعوبة.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, go, topbar } from '../ui.js';

const COUNTS = [10, 15, 25, 34];
// المُدَياتُ في `data.LEVEL_RANGES` — والسببُ مشروحٌ عندها. والعددُ يُكتَب على
// الزرِّ نفسِه، فلا يختار الطالبُ صعوبةً ثمّ يجد «المتاح: ٠».
const LEVELS = [
  { v: null, label: 'الكلّ' },
  { v: 'easy', label: 'سهل' },
  { v: 'mid', label: 'متوسط' },
  { v: 'hard', label: 'صعب' },
];

export default function customScreen() {
  const track = store.get().track;
  const subjects = data.subjectsOf(track);

  const picked = new Set(subjects.map((s) => s.subject));
  let count = 15;
  let difficulty = null;

  /*
   * ── الأبوابُ داخلَ الكتاب ────────────────────────────────────────────────
   *
   * الكتابُ في هذا التطبيقِ عِلمٌ (الفقه ← دليل الطالب، والتجويد ← غاية المريد)،
   * وفي العلمِ أبوابٌ: الفقه تسعةٌ وثمانون باباً، والتجويد خمسون. والطالبُ
   * يُذاكر باباً بعينه — «الطهارة» هذا الأسبوع — فيريد ورقتَه منه لا من الكتابِ
   * كلِّه.
   *
   * ولا تُعرَض الأبوابُ إلا إذا اختار **علماً واحداً**، ولذلك سببان:
   *
   *   • أسماءُ الأبوابِ تتكرّر بين العلوم — و«عامّ» في كلِّها — فقائمةٌ مسطَّحةٌ
   *     عبرَ العلومِ تُصفّي في علمٍ ما قُصِد في غيره.
   *   • وثلاثُمائةٍ وسبعةٌ وخمسون باباً في شاشةِ اختيارٍ ليست اختياراً.
   *
   * وهو موافقٌ لِما يطلبه الطالبُ لفظاً: البابُ **داخلَ** الكتاب — فيُختار
   * الكتابُ أوّلاً ثمّ يُفتَح ما فيه.
   *
   * و`chosen` خاليةٌ ⇐ الأبوابُ كلُّها، كما أنّ `subjects` خاليةٌ ⇐ العلومُ
   * كلُّها. فلا يُشترَط على الطالبِ اختيارُ بابٍ ليبدأ.
   */
  let chosen = new Set();
  let topicFilter = '';
  // العلمُ الذي بُنيت عليه `chosen` — فإن تبدّل سقطت، وإلا صفّى بابَ علمٍ في غيره.
  let topicsFor = null;

  const onlySubject = () => (picked.size === 1 ? [...picked][0] : null);

  /** تُنسى الأبوابُ إذا تبدّل العلمُ المختار — فلا تبقى تصفيةٌ لا محلَّ لها. */
  const syncTopics = () => {
    const only = onlySubject();
    if (only !== topicsFor) { chosen = new Set(); topicFilter = ''; topicsFor = only; }
  };

  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } });

  /**
   * ── التركيزُ يبقى على الزرِّ المضغوطِ بعد إعادةِ الرسم ────────────────────
   *
   * `paint()` تُعيد بناءَ الشجرةِ كلِّها، ومنها الزرُّ المضغوطُ نفسُه. فكان
   * التركيزُ يسقط إلى `<main id="screen">`، ويلزم **١٦ ضغطةَ Tab** للرجوعِ إلى
   * البابِ الذي يليه. والاختيارُ ههنا متعدِّدٌ بقصد — تسعةٌ وثمانون باباً تُضَمُّ
   * بالضغط — فاختيارُ خمسةِ أبوابٍ بلوحةِ المفاتيحِ ثمانون ضغطة.
   *
   * فيُحفَظ `data-key` قبل الرسمِ ويُرَدُّ التركيزُ إلى صاحبِه بعدَه. و`focus`
   * بـ`preventScroll` كما في سائرِ المشروع، فلا تقفز الصفحةُ مع كلِّ ضغطة.
   */
  const keepFocus = (draw) => {
    const key = document.activeElement?.getAttribute?.('data-key') || null;
    draw();
    if (!key) return;
    const back = wrap.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (back) back.focus({ preventScroll: true });
  };

  const paint = () => keepFocus(() => {
    syncTopics();
    const only = onlySubject();
    const topics = only
      ? [...(subjects.find((s) => s.subject === only)?.topics || new Map())]
        .sort((a, b) => b[1] - a[1])
      : [];

    // عدٌّ بلا سحب — السحبُ الموزونُ كان يُعاد في كلِّ نقرةٍ ثمّ تُرمى نتيجتُه.
    const query = { subjects: [...picked], topics: [...chosen], difficulty };
    const available = data.countCustom(track, query);

    wrap.replaceChildren(
      topbar({ onBack: () => go('home'), title: 'اختبار مخصّص' }),

      el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', padding: '18px 24px 0', display: 'flex', flexDirection: 'column', gap: '22px' } }, [
        group('العلوم', el('div', { role: 'group', 'aria-label': 'العلوم', style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
          subjects.map((s) => toggle(`s:${s.subject}`, `${s.subject} — ${ar(s.total)}`, picked.has(s.subject), () => {
            if (picked.has(s.subject)) picked.delete(s.subject); else picked.add(s.subject);
            if (!picked.size) picked.add(s.subject);
            paint();
          })))),

        // الأبوابُ — لا تظهر إلا على علمٍ واحد، والسببُ عند `chosen` أعلاه.
        only
          ? topicsGroup(only, topics)
          : el('div.stack', [
              el('span.section-title', 'الأبواب'),
              el('p.fine', { style: { textAlign: 'start' } },
                'اختَرْ علماً واحداً لتظهر أبوابُه، فتأخذ ورقتَك من بابٍ بعينه.'),
            ]),

        group('عدد الأسئلة', el('div', { role: 'group', 'aria-label': 'عدد الأسئلة', style: { display: 'flex', gap: '8px' } },
          COUNTS.map((c) => toggle(`n:${c}`, ar(c), c === count, () => { count = c; paint(); })))),

        group('الصعوبة', el('div', { role: 'group', 'aria-label': 'الصعوبة', style: { display: 'flex', gap: '8px' } },
          LEVELS.map((l) => {
            // عددُ كلِّ صعوبةٍ يُحسَب على الأبوابِ المختارةِ أيضاً، وإلا وعد
            // الزرُّ بأسئلةٍ من أبوابٍ استبعدها الطالبُ.
            const n = data.countCustom(track, { ...query, difficulty: l.v });
            return toggle(`d:${l.v}`, `${l.label} — ${ar(n)}`, l.v === difficulty,
              () => { difficulty = l.v; paint(); });
          }))),

        el('p.fine', `المتاح بهذه الشروط: ${ar(available)} سؤالاً.`),
      ]),

      el('div', { style: { padding: '14px 24px 26px' } },
        el('button.btn', {
          disabled: !available,
          onclick: () => go('quiz', {
            questions: data.buildCustomExam(track, { ...query, count }),
            mode: 'custom',
            // ويُسمّى البابُ في عنوانِ الورقة، فيُعرَف في «أكمِلْ ما بدأت»
            // وفي سجلِّ الاختباراتِ ما كانت ورقةً فيه.
            title: chosen.size === 1 ? `اختبار — ${[...chosen][0]}`
              : `اختبار مخصّص${only ? ` — ${only}` : ''}`,
          }),
        }, available ? `ابدأ — ${ar(Math.min(count, available))} سؤالاً` : 'لا أسئلة بهذه الشروط')),
    );
  });

  /**
   * قائمةُ الأبواب — مع مُرشِّحٍ إذا كثُرت.
   *
   * والفقهُ تسعةٌ وثمانون باباً: قائمةٌ بهذا الطولِ يُبحَث فيها بالإصبعِ لا
   * بالعين. فإذا جاوزت اثنَي عشرَ باباً وُضِع فوقها حقلُ ترشيحٍ يكتب فيه
   * الطالبُ أوّلَ الاسم.
   *
   * والحقلُ خارجَ `paint()` بقصد: تلك تُعاد مع كلِّ ضغطةِ باب، فلو بُني فيها
   * لَذهبَ التركيزُ من الحقلِ ومحيَ ما كُتِب فيه عند أوّلِ اختيار.
   */
  const filterBox = el('input.searchbar', {
    type: 'search',
    placeholder: 'رشِّح الأبواب…',
    'aria-label': 'رشِّح الأبواب بالاسم',
    style: { textAlign: 'start', fontSize: '14px' },
  });
  filterBox.addEventListener('input', () => {
    topicFilter = filterBox.value.trim();
    paintTopics();
  });

  const topicsBody = el('div', {
    role: 'group',
    'aria-label': 'أبواب الكتاب',
    style: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  });

  /** تُعاد رسمَ الشاراتِ وحدَها — فلا يُمَسُّ حقلُ الترشيحِ ولا يُفقَد تركيزُه. */
  const paintTopics = () => {
    const only = onlySubject();
    if (!only) return;
    const all = [...(subjects.find((s) => s.subject === only)?.topics || new Map())]
      .sort((a, b) => b[1] - a[1]);
    const norm = (x) => String(x).replace(/[ًٌٍَُِّْٰ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
    const shown = topicFilter
      ? all.filter(([t]) => norm(t).includes(norm(topicFilter)))
      : all;

    topicsBody.replaceChildren(...(shown.length
      ? shown.map(([t, n]) => toggle(`t:${t}`, `${t} — ${ar(n)}`, chosen.has(t), () => {
          if (chosen.has(t)) chosen.delete(t); else chosen.add(t);
          paint();
        }))
      : [el('p.fine', 'لا بابَ بهذا الاسم.')]));
  };

  function topicsGroup(subject, topics) {
    paintTopics();
    return el('div.stack', [
      el('div.row-base', [
        el('span.section-title', `أبواب ${subject}`),
        el('button', {
          onclick: () => { chosen = new Set(); topicFilter = ''; filterBox.value = ''; paint(); },
          style: {
            font: 'inherit', fontSize: '13px', color: chosen.size ? 'var(--green)' : 'var(--ink-5)',
            background: 'none', border: 'none', cursor: 'pointer', fontWeight: chosen.size ? '600' : '400',
          },
        }, chosen.size ? `المختار ${ar(chosen.size)} — امسحْه` : `الكلّ (${ar(topics.length)} باباً)`),
      ]),
      topics.length > 12 ? filterBox : null,
      topicsBody,
    ]);
  }

  paint();
  return wrap;
}

const group = (title, body) =>
  el('div.stack', [el('span.section-title', title), body]);

/**
 * و`key` تُكتَب `data-key` ليُعرَف الزرُّ بعد إعادةِ الرسم — انظر `keepFocus`.
 * وهي مُنَسَّقةٌ ببادئةٍ عند المُنادي (`s:` للعلوم، `t:` للأبواب…) لأنّ الأسماءَ
 * تتكرّر بين المجموعات.
 */
function toggle(key, label, on, onclick) {
  return el('button', {
    onclick,
    'data-key': key,
    'aria-pressed': on,
    style: {
      font: 'inherit', fontSize: '13.5px', cursor: 'pointer', borderRadius: 'var(--r-chip)',
      padding: '9px 15px', border: 'none',
      background: on ? 'var(--green)' : 'var(--surface)',
      color: on ? 'var(--paper)' : 'var(--ink-3)',
      fontWeight: on ? '600' : '400',
    },
  }, label);
}
