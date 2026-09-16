// ٠٩ — التسميع الصوتيّ.
//
// المبدأ الحاكم: التطبيق لا يحكم على التلاوة. يوقظ الأذن ويوجّه الانتباه،
// والحكم للطالب أو لشيخه. فلا تصحيحَ آليّاً للتجويد البتّة (SPEC §١ و§٩).
//
// والشرط الحاسم في التصميم: زرّ إعادة السماع ثابتٌ مرئيٌّ طوال أسئلة التدقيق،
// فالطالب يسمع ويجيب في آنٍ واحد — وهذا جوهر الفائدة (SPEC §٢).

import * as data from '../data.js';
import * as audio from '../audio.js';
import { el, ar, arTime, go, empty, hideTabs, onLeave } from '../ui.js';

/* عائلات الأحكام — منها تُبنى المشتّتات، قريبةً لا بعيدة (SPEC §٦). */
const FAMILIES = [
  ['مدّ طبيعي', 'مدّ واجب متصل', 'مدّ جائز منفصل', 'مدّ لازم كلمي مثقّل', 'مدّ عارض للسكون', 'مدّ بدل'],
  ['إظهار حلقي', 'إدغام بغنة (كامل)', 'إدغام بغنة (ناقص)', 'إدغام بغير غنة', 'إقلاب', 'إخفاء حقيقي', 'إظهار مطلق'],
  ['إخفاء شفوي', 'إدغام شفوي', 'إظهار شفوي', 'غُنّة مشدّدة'],
  ['تفخيم لام الجلالة', 'ترقيق لام الجلالة'],
  ['لام شمسية', 'لام قمرية'],
  ['قلقلة صغرى', 'قلقلة كبرى'],
  ['صلة صغرى', 'صلة كبرى'],
];

const familyOf = (rule) => FAMILIES.find((f) => f.includes(rule)) || null;

let db = null;

export default function reciteScreen({ index = null } = {}) {
  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } });

  const start = () => (index === null ? pickAyah(wrap) : session(wrap, index));

  if (db) start();
  else {
    wrap.append(empty('يُحمَّل جزء عمّ…', 'مرةً واحدة، ثم يعمل بلا اتصال.'));
    data.loadTajweed().then((x) => { db = x; start(); })
      .catch(() => wrap.replaceChildren(empty('تعذّر تحميل النصّ', 'تأكّد من وجود ملف data/tajweed.')));
  }

  return wrap;
}

/* ── اختيار الآية ───────────────────────────────────────────────────── */

function pickAyah(wrap) {
  // لا تُعرَض إلا الآيات التي فيها أحكامٌ صالحةٌ لتوليد سؤال.
  const usable = db.ayat
    .map((a, i) => ({ a, i, n: a.rulings.filter((r) => familyOf(r.rule)).length }))
    .filter((x) => x.n >= 2);

  const surahs = [];
  usable.forEach((x) => {
    const last = surahs[surahs.length - 1];
    if (!last || last.surah !== x.a.surah) surahs.push({ surah: x.a.surah, name: x.a.surahName, items: [x] });
    else last.items.push(x);
  });

  let open = surahs[0]?.surah ?? null;

  const body = el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '10px' } });

  const paint = () => {
    body.replaceChildren(...surahs.map((s) => {
      const isOpen = s.surah === open;
      const card = el('div.card', { style: { gap: '10px', padding: '18px 20px' } }, [
        el('button', {
          onclick: () => { open = isOpen ? null : s.surah; paint(); },
          style: { font: 'inherit', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
        }, [
          el('span', { style: { fontFamily: 'var(--serif)', fontSize: '24px', fontWeight: '700' } }, `سورة ${s.name}`),
          el('span.num', { style: { fontSize: '12.5px', color: 'var(--ink-5)' } }, `${ar(s.items.length)} آية`),
        ]),
      ]);

      if (isOpen) {
        card.append(el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '7px' } },
          s.items.map((x) =>
            el('button', {
              onclick: () => session(wrap, x.i),
              style: {
                font: 'inherit', fontFamily: 'var(--mono)', fontSize: '13px', cursor: 'pointer',
                background: 'var(--paper)', border: 'none', borderRadius: 'var(--r-chip)',
                padding: '7px 13px', color: 'var(--ink)',
              },
            }, ar(x.a.ayah)))));
      }
      return card;
    }));
  };
  paint();

  wrap.replaceChildren(
    el('div', { style: { padding: '22px 24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' } }, [
      el('h1.title', 'التسميع'),
      el('p.lede', 'اختر آيةً، سمّعها بصوتك، ثم أجب عن أحكامها وأنت تسمع نفسك.'),
    ]),
    body,
    el('div', { style: { padding: '14px 24px 26px' } },
      el('p.fine', 'التطبيق لا يحكم على تلاوتك؛ يوجّه أذنك، والحكم لك أو لشيخك.')),
  );
}

/* ── جلسة التسميع ───────────────────────────────────────────────────── */

function session(wrap, index) {
  hideTabs();
  const a = db.ayat[index];
  const key = `${a.surah}:${a.ayah}`;
  const questions = buildQuestions(a);

  const st = {
    blob: null, url: null, recorder: null, stream: null,
    seconds: 0, timer: null, verified: new Set(), actx: null,
  };

  /*
   * الميكروفونُ يُغلَق بتركِ الشاشةِ كما يُغلَق بزرِّ «أوقِف».
   *
   * وكان إغلاقُه في `recorder.onstop` وحدَه، وهو لا يقع إلا بضغطةٍ صريحة. فمن
   * سحب سحبةَ الرجوعِ وهو يسجِّل، أو لمس تبويباً، بقي الميكروفونُ مفتوحاً على
   * شاشةٍ أخرى — والتطبيقُ لا يُظهِر ذلك، والنظامُ وحدَه يُظهِره بنقطةٍ حمراء.
   *
   * ويُطفَأ ثلاثةُ أشياءٍ لا واحد: مسارُ الصوتِ (وهو الذي يُبقي النقطةَ)، وعدّادُ
   * الثواني، وسياقُ الصوتِ الذي تُرسَم منه الموجة — فبقاؤه يستنزف البطّارية.
   * ويُحرَّر الرابطُ المؤقّتُ أيضاً، وإلّا تراكمت في الذاكرةِ نُسخُ التسجيلات.
   */
  onLeave(() => {
    try { if (st.recorder?.state === 'recording') st.recorder.stop(); } catch { /* لا شيء */ }
    st.stream?.getTracks().forEach((t) => t.stop());
    clearInterval(st.timer);
    try { st.actx?.close(); } catch { /* لا شيء */ }
    if (st.url) URL.revokeObjectURL(st.url);
  });

  /* ملاحظة: كل شيءٍ يُعاد رسمه إلا مشغّل الصوت — يبقى هو نفسه حياً
     طوال الأسئلة، لأنّ إعادة إنشائه تقطع التشغيل على الطالب. */
  const player = el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } });
  const audioEl = el('audio', { preload: 'metadata' });
  const bars = Array.from({ length: 14 }, () => el('span', { style: { height: '30%' } }));
  const wave = el('div.wave', bars);
  const clock = el('span.num', { style: { fontSize: '12.5px', color: 'var(--ink-4)' } }, '٠:٠٠');
  const playBtn = el('button.iconbtn.iconbtn--lg', { 'aria-label': 'تشغيل' }, '▶');
  player.append(playBtn, wave, clock);

  const setWave = (fn) => bars.forEach((b, i) => {
    const v = fn(i);
    b.style.height = `${Math.max(12, Math.min(100, v))}%`;
    b.dataset.on = v > 70 ? '1' : '0';
  });
  setWave(() => 22);

  /* ── التسجيل ── */

  async function startRecording() {
    try {
      st.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert('تعذّر الوصول إلى الميكروفون. يمكنك المتابعة والإجابة عن الأحكام بلا تسجيل.');
      return;
    }
    const mime = audio.pickMime();
    st.recorder = new MediaRecorder(st.stream, mime ? { mimeType: mime, audioBitsPerSecond: 24_000 } : undefined);

    const chunks = [];
    st.recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    st.recorder.onstop = async () => {
      st.blob = new Blob(chunks, { type: mime || 'audio/webm' });
      st.url = URL.createObjectURL(st.blob);
      audioEl.src = st.url;
      audio.save(key, st.blob).catch(() => {});
      st.stream.getTracks().forEach((t) => t.stop());
      clearInterval(st.timer);
      paint();
    };

    // موجةٌ حيّةٌ من مستوى الصوت — عرضٌ فقط، لا حكمَ على التلاوة.
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    st.actx = ctx;
    const an = ctx.createAnalyser();
    an.fftSize = 64;
    ctx.createMediaStreamSource(st.stream).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    const tick = () => {
      if (st.recorder?.state !== 'recording') { ctx.close(); return; }
      an.getByteFrequencyData(buf);
      setWave((i) => (buf[i % buf.length] / 255) * 100);
      requestAnimationFrame(tick);
    };

    st.recorder.start();
    st.seconds = 0;
    st.timer = setInterval(() => { st.seconds += 1; clock.textContent = arTime(st.seconds); }, 1000);
    tick();
    paint();
  }

  const stopRecording = () => st.recorder?.state === 'recording' && st.recorder.stop();

  playBtn.addEventListener('click', () => {
    if (!st.url) return;
    if (audioEl.paused) { audioEl.play(); playBtn.textContent = '▮▮'; }
    else { audioEl.pause(); playBtn.textContent = '▶'; }
  });
  audioEl.addEventListener('ended', () => { playBtn.textContent = '▶'; });
  audioEl.addEventListener('timeupdate', () => {
    if (!audioEl.duration) return;
    const p = audioEl.currentTime / audioEl.duration;
    clock.textContent = arTime(audioEl.currentTime);
    setWave((i) => (i / bars.length <= p ? 85 : 30));
  });

  /* ── الرسم ── */

  function paint() {
    const recording = st.recorder?.state === 'recording';
    const recorded = st.blob instanceof Blob;      // تسجيلٌ حقيقيّ
    const done = !!st.blob;                        // أو تخطٍّ صريح

    wrap.replaceChildren(
      el('div.topbar', { style: { justifyContent: 'space-between' } }, [
        el('button.iconbtn', { onclick: () => { stopRecording(); go('recite'); }, 'aria-label': 'رجوع' }, '→'),
        el('span.topbar-title', `تسميع — سورة ${a.surahName} آية ${ar(a.ayah)}`),
        el('button.iconbtn', {
          onclick: () => { st.blob = null; st.url = null; st.verified.clear(); clock.textContent = '٠:٠٠'; setWave(() => 22); paint(); },
          'aria-label': 'إعادة',
          style: { fontSize: '13px' },
        }, '↺'),
      ]),

      // الآية — بالرسم العثمانيّ من تنزيل، لا مستخرجةً ولا مكتوبةً يدوياً.
      el('div', { style: { padding: '22px 24px 20px', display: 'flex', flexDirection: 'column', gap: '18px', flexShrink: '0' } }, [
        el('div.ayah.ayah--sm', [a.uthmani, el('span.ayah-no', ` ۝${ar(a.ayah)}`)]),
        recorded || recording ? player : null,
        recorded
          ? el('div.row', { style: { fontSize: '12px', color: 'var(--ink-6)' } }, [
              el('span', 'محفوظٌ على جهازك فقط'),
              el('span', 'يُحذَف تلقائياً بعد ٣٠ يوماً'),
            ])
          : null,
      ]),

      done ? auditSheet() : recordSheet(recording),
      audioEl,
    );
  }

  function recordSheet(recording) {
    const can = audio.canRecord();
    return el('div.sheet', [
      el('div.stack', { style: { gap: '6px' } }, [
        el('span.section-title', recording ? 'يسجّل الآن…' : 'سمّع الآية بصوتك'),
        el('span.meta', 'التطبيق لا يحكم على تلاوتك؛ يوجّه أذنك، والحكم لك أو لشيخك.'),
      ]),
      el('div.push.stack', [
        can
          ? el('button.btn', {
              class: recording ? '' : 'btn--green',
              onclick: () => (recording ? stopRecording() : startRecording()),
            }, recording ? `إيقاف ${arTime(st.seconds)}` : '● ابدأ التسجيل')
          : el('p.note-sand', 'التسجيل يحتاج إذن الميكروفون واتصالاً آمناً (https). يمكنك المتابعة إلى الأحكام بلا تسجيل.'),
        el('button.btn.btn--ghost', {
          style: { width: '100%' },
          onclick: () => { st.blob = st.blob || 'skip'; paint(); },
        }, 'تخطَّ التسجيل وأجب عن الأحكام'),
      ]),
    ]);
  }

  /* ── شاشة التدقيق: المشغّل ثابتٌ أعلاها، والأسئلة تحته ── */

  function auditSheet() {
    const sheet = el('div.sheet');

    if (!questions.length) {
      sheet.append(empty('لا أحكامَ صالحةً لسؤالٍ هنا', 'جرّب آيةً أخرى.'));
      return sheet;
    }

    sheet.append(el('div.row-base', [
      el('span.section-title', 'أحكام هذه الآية'),
      el('span.num', { style: { fontSize: '12.5px', color: 'var(--ink-5)' } },
        `تحقّقتَ من ${ar(st.verified.size)} / ${ar(questions.length)}`),
    ]));

    const body = el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' } });

    questions.forEach((q, qi) => {
      const card = el('div.card.card--paper', { style: { gap: '13px' } }, [
        el('span', { style: { fontFamily: 'var(--serif)', fontSize: '20px', lineHeight: '1.6' } },
          ['في قوله ', el('span', { style: { fontFamily: 'var(--quran)' } }, `﴿${q.word}﴾`), ` — ${q.prompt}`]),
      ]);

      const opts = q.options.map((text) =>
        el('button.choice', {
          style: { padding: '13px 16px', fontSize: '14.5px' },
          onclick: () => {
            if (card.dataset.answered) return;
            card.dataset.answered = '1';
            opts.forEach((b, i) => {
              if (q.options[i] === q.answer) { b.dataset.state = 'right'; b.append(el('span.mark', '✓')); }
              else if (q.options[i] === text) { b.dataset.state = 'wrong'; b.append(el('span.mark', '✕')); }
              else b.dataset.state = 'dim';
            });
            st.verified.add(qi);
            card.append(el('p.fine', { style: { color: 'var(--ink-3)' } }, q.note));
            if (q.linked) {
              card.append(el('button', {
                onclick: () => go('quiz', { questions: [q.linked], mode: 'study', title: 'سؤال التجويد المرتبط' }),
                style: { font: 'inherit', fontSize: '12.5px', fontWeight: '600', color: 'var(--green)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'start', padding: '0' },
              }, 'افتح الشرح في غاية المريد ←'));
            }
            sheet.querySelector('.num').textContent = `تحقّقتَ من ${ar(st.verified.size)} / ${ar(questions.length)}`;
          },
        }, el('span', text)));

      card.append(el('div.stack-sm', opts));
      body.append(card);
    });

    sheet.append(body, el('div.btn-row', { style: { paddingTop: '4px' } }, [
      el('button.btn', { onclick: () => go('recite') }, 'آيةٌ أخرى'),
      el('button.btn.btn--ghost', { onclick: sendToSheikh }, 'أرسل لشيخ'),
    ]));

    return sheet;
  }

  function sendToSheikh() {
    if (!st.blob || st.blob === 'skip') {
      alert('لا يوجد تسجيلٌ لإرساله.');
      return;
    }
    const file = new File([st.blob], `تسميع-${a.surahName}-${a.ayah}.ogg`, { type: st.blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: `تسميع سورة ${a.surahName} آية ${a.ayah}` }).catch(() => {});
    } else {
      // بلا خادم: نُنزّل الملف ليرسله الطالب بنفسه. الرفع لا يقع إلا بفعله.
      const url = URL.createObjectURL(st.blob);
      const link = el('a', { href: url, download: file.name });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  paint();
}

/* ── توليد السؤال من الحكم ──────────────────────────────────────────── */

function buildQuestions(a) {
  const PROMPT = {
    'مدّ': 'ما نوع المدّ؟',
    'لام': 'ما نوع اللام؟',
    'قلقلة': 'ما نوع القلقلة؟',
    'صلة': 'ما نوع الصلة؟',
  };

  return a.rulings.flatMap((r) => {
    const fam = familyOf(r.rule);
    if (!fam) return [];

    const key = Object.keys(PROMPT).find((k) => r.rule.startsWith(k));
    const prompt = key ? PROMPT[key] : 'ما الحكم هنا؟';

    // ثلاثة مشتّتاتٍ من العائلة نفسها — قريبةٌ لا بعيدة.
    const others = fam.filter((x) => x !== r.rule).slice(0, 3);
    const options = [r.rule, ...others].sort(() => (r.wordIndex % 2 ? 1 : -1));

    return [{
      word: r.word,
      prompt,
      options,
      answer: r.rule,
      note: r.note || '',
      linked: r.linkedQuestion ? data.questionById(r.linkedQuestion) : null,
    }];
  });
}
