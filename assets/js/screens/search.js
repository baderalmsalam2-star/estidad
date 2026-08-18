// ٠٤ — البحث في المنهج كلِّه: نصُّ السؤال، والإجابة، والنقاط، والباب، والصفحة.
//
// البنك تجاوز ألفَي سؤالٍ، فصار التصفّح وحدَه لا يكفي. والبحث هنا يُجرَّد من
// التشكيل والهمزات (data.normalizeArabic) حتى يُصيب الطالبُ ولو كتب بلا ضبطٍ،
// ويُظلَّل موضعُ المطابقة في النصّ الأصليّ بضبطه كما هو في الكتاب.

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, go, topbar, pageCite, empty } from '../ui.js';

const MAX_RESULTS = 60;

// يبقى ما كتبه الطالب حتى إذا دخل سؤالاً ورجع، فلا يُعيد الكتابة.
let lastQuery = '';
let index = null;      // فهرسٌ يُبنى مرّةً لكلِّ مسار
let indexTrack = null;

/* ── التطبيع مع خريطة المواضع ────────────────────────────────────────── */

/**
 * مثل data.normalizeArabic، لكنه يُرجع مع النصِّ المطبَّع خريطةً تردّ كلَّ حرفٍ
 * فيه إلى موضعه في الأصل — وبها وحدَها يُمكن تظليلُ المطابقة على النصِّ المضبوط.
 */
function normalizeWithMap(src) {
  let out = '';
  const map = [];
  let pendingSpace = false;

  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (/[ً-ْٰـ]/.test(c)) continue;          // تشكيلٌ وتطويل: يُسقَط

    let n;
    if ('أإآٱ'.includes(c)) n = 'ا';
    else if (c === 'ى') n = 'ي';
    else if (c === 'ة') n = 'ه';
    else if (/[ء-ي]/.test(c)) n = c;
    else n = ' ';                                                  // كلُّ ما سوى الحروف فاصلٌ

    if (n === ' ') { if (out) pendingSpace = true; continue; }
    if (pendingSpace) { out += ' '; map.push(-1); pendingSpace = false; }
    out += n;
    map.push(i);
  }
  return { norm: out, map };
}

const norm = (s) => data.normalizeArabic(s);

/* ── الفهرس ──────────────────────────────────────────────────────────── */

function buildIndex(track) {
  if (index && indexTrack === track) return index;
  indexTrack = track;
  index = data.forTrack(track).map((q) => {
    const points = (q.keyPoints || []).join(' · ');
    const items = q.answer && Array.isArray(q.answer.items) ? q.answer.items.join(' · ') : '';
    return {
      q,
      qn: normalizeWithMap(q.question || ''),
      body: norm(`${q.modelAnswer || ''} ${points} ${items}`),
      meta: norm(`${q.subject || ''} ${q.topic || ''} ${q.reference || ''}`),
      // «ص١٣٢-١٣٣» → ['132','133'] ليُصيبها البحثُ برقم الصفحة كتبَهُ عربياً أو لاتينياً.
      pages: (String(q.bookPage || '')
        .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
        .match(/\d+/g) || []),
    };
  });
  return index;
}

/**
 * الترتيب مقصود: ما وقع في نصِّ السؤال أولى بالطالب مما وقع في شرحِ الإجابة،
 * وما وقع في اسم الباب بينهما.
 */
function search(track, raw) {
  const needle = norm(raw);
  // التطبيع يُسقط الأرقام، فيُلتقط رقمُ الصفحة قبلَه — وقد يُكتب وحدَه بلا حرف.
  const digits = raw.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).match(/\d+/);
  const word = needle.length >= 2 ? needle : null;
  if (!word && !digits) return [];

  const hits = [];
  for (const row of buildIndex(track)) {
    const at = word ? row.qn.norm.indexOf(word) : -1;
    let rank = null;
    if (at >= 0) rank = 0;
    else if (word && row.meta.includes(word)) rank = 1;
    else if (word && row.body.includes(word)) rank = 2;
    else if (digits && row.pages.includes(digits[0])) rank = 3;
    if (rank === null) continue;
    hits.push({ ...row, rank, at });
  }
  hits.sort((a, b) => a.rank - b.rank || a.at - b.at);
  return hits;
}

/* ── التظليل ─────────────────────────────────────────────────────────── */

/** يردّ موضعَ المطابقة المطبَّع إلى مَداهُ في النصِّ الأصليِّ، ثم يُظلِّله. */
function highlighted(src, { norm: n, map }, needle, at) {
  if (at < 0 || !needle) return el('span', src);
  const from = map[at];
  let end = at + needle.length - 1;
  while (end > at && map[end] < 0) end -= 1;                       // لا نقف على فاصلٍ مُقحَم
  const to = map[end];
  if (from == null || to == null || from < 0) return el('span', src);

  // نمدُّ آخرَ المدى ليشمل تشكيلَ الحرف الأخير، فلا تنقطع الكلمة بصرياً.
  let stop = to + 1;
  while (stop < src.length && /[ً-ْٰـ]/.test(src[stop])) stop += 1;

  return el('span', [
    src.slice(0, from),
    el('mark.hit', src.slice(from, stop)),
    src.slice(stop),
  ]);
}

/* ── الشاشة ──────────────────────────────────────────────────────────── */

export default function searchScreen({ q: preset } = {}) {
  const track = store.get().track;
  const total = data.forTrack(track).length;
  if (preset !== undefined) lastQuery = preset;

  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } });
  const results = el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', padding: '4px 24px 26px' } });

  const input = el('input.searchbar', {
    type: 'search',
    value: lastQuery,
    placeholder: `ابحث في ${ar(total)} سؤالاً…`,
    'aria-label': 'ابحث في المنهج',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
  });

  let timer = null;
  const schedule = () => {
    lastQuery = input.value;
    clearTimeout(timer);
    timer = setTimeout(render, 110);
  };
  input.addEventListener('input', schedule);

  function render() {
    const raw = input.value.trim();
    if (norm(raw).length < 2 && !/[0-9٠-٩]/.test(raw)) {
      results.replaceChildren(hints(input, schedule));
      return;
    }
    const hitsAll = search(track, raw);
    if (!hitsAll.length) {
      results.replaceChildren(empty('لا نتيجة', `لم يُطابِقْ «${raw}» شيئاً في مسارك. جرّب كلمةً واحدةً بلا تشكيل.`));
      return;
    }
    const hits = hitsAll.slice(0, MAX_RESULTS);
    const needle = norm(raw);

    results.replaceChildren(
      el('p.fine', { style: { padding: '8px 2px 4px' } },
        hitsAll.length > hits.length
          ? `${ar(hitsAll.length)} نتيجة — تُعرَض أولى ${ar(hits.length)}`
          : `${ar(hitsAll.length)} نتيجة`),
      el('div.stack-sm', hits.map((h) => resultCard(h, needle))),
    );
  }

  function resultCard(h, needle) {
    const q = h.q;
    return el('button.card', { style: { gap: '9px' }, onclick: () => open(q) }, [
      el('div.row-base', { style: { gap: '10px' } }, [
        el('span.meta', { style: { textAlign: 'start' } }, `${q.subject} · ${q.topic || 'عامّ'}`),
        pageCite(q) || el('span'),
      ]),
      el('span.hit-text', { style: { textAlign: 'start' } },
        highlighted(q.question || '', h.qn, needle, h.at)),
      h.rank === 2 ? el('span.fine', { style: { textAlign: 'start' } }, 'المطابقة في الإجابة أو نقاطها') : null,
      h.rank === 3 ? el('span.fine', { style: { textAlign: 'start' } }, 'المطابقة في رقم الصفحة') : null,
    ]);
  }

  function open(q) {
    go('quiz', {
      questions: [q],
      mode: 'study',
      title: q.topic || q.subject,
      back: () => go('search'),
    });
  }

  wrap.append(
    topbar({ onBack: () => go('home'), title: 'البحث في المنهج' }),
    el('div', { style: { padding: '10px 24px 6px', flexShrink: '0' } }, input),
    results,
  );

  render();
  // التركيز بعد الإلحاق، وإلا تجاهله المتصفّح.
  queueMicrotask(() => input.focus({ preventScroll: true }));
  return wrap;
}

/** حين يكون الحقل فارغاً: مداخلُ جاهزةٌ خيرٌ من فراغٍ أبيض. */
function hints(input, schedule) {
  const SEEDS = ['شروط الصلاة', 'نواقض الوضوء', 'الإخفاء', 'الربا', 'الخيار', 'خطبة الجمعة'];
  return el('div.stack', { style: { paddingTop: '14px' } }, [
    el('p.lede', 'اكتب كلمةً من السؤال أو من جوابه أو من اسم الباب — أو رقمَ صفحةٍ من الكتاب.'),
    el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
      SEEDS.map((s) => el('button.chip.chip--muted', {
        style: { cursor: 'pointer', border: 'none', font: 'inherit' },
        onclick: () => { input.value = s; schedule(); },
      }, s))),
  ]);
}
