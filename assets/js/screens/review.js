// شاشة اعتماد التوثيق — للمطوّر والمراجع، لا للطالب.
//
// الغاية أن تُعتمد الأسئلة كلّها: يرى المراجع السؤال وإجابته وصفحته المرشَّحة
// في مكانٍ واحد، فيقرّ أو يردّ بضغطة. والتطبيق لا يقرّر عنه شيئاً — المطابقة
// الآلية أصابت ٨٧٪ في القياس، وهذه نسبةٌ تصلح ترشيحاً لا اعتماداً.
//
// وتُصدَّر القرارات ملفَّ JSON يُدمَج في البنوك بـ tools/دمج_الاعتماد.py

import * as data from '../data.js';
import * as store from '../store.js';
import { el, ar, pct, go, empty, hideTabs, devMode } from '../ui.js';
import { openPage, bookTitle } from './page-view.js';

export default function reviewScreen() {
  if (!devMode()) {
    return empty('هذه الشاشة للمراجعة', 'تُفتَح بـ ?dev=1 فقط.');
  }
  hideTabs();

  // كل سؤالٍ لم يُقابَل بعد — مرتَّباً: ما فيه عددٌ أولاً، فهو مكمن الخطأ.
  const pending = data.allQuestions()
    .filter((q) => !q.bookVerified)
    .map((q) => ({ q, ref: data.pageRefOf(q), decision: store.reviewOf(q.id) }))
    .sort((a, b) => {
      const rank = (x) => (x.decision ? 2 : 0) - (x.ref?.countWord ? 1 : 0);
      return rank(a) - rank(b);
    });

  let i = 0;
  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } });

  const paint = () => {
    const done = pending.filter((x) => store.reviewOf(x.q.id)).length;
    if (i >= pending.length) {
      wrap.replaceChildren(summary(done, pending.length));
      return;
    }

    const { q, ref } = pending[i];
    const decision = store.reviewOf(q.id);

    wrap.replaceChildren(
      el('div', { style: { padding: '16px 24px 0', display: 'flex', alignItems: 'center', gap: '14px', flexShrink: '0' } }, [
        el('button.iconbtn', { onclick: () => go('account'), 'aria-label': 'خروج' }, '✕'),
        el('div.bar', { style: { flex: '1' } }, el('i', { style: { width: `${(done / pending.length) * 100}%` } })),
        el('span.num', { style: { fontSize: '13px', color: 'var(--ink-5)' } }, `${ar(done)}/${ar(pending.length)}`),
      ]),

      el('div', { style: { flex: '1', minHeight: '0', overflowY: 'auto', padding: '16px 24px 0', display: 'flex', flexDirection: 'column', gap: '12px' } }, [
        el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, [
          el('span.chip', `${q.subject}${q.topic ? ' · ' + q.topic : ''}`),
          el('span.num', { style: { fontSize: '11.5px', color: 'var(--ink-6)' } }, q.id),
          decision ? el('span.chip', { style: { background: decision === 'approved' ? 'var(--green-tint)' : 'var(--wrong-tint)', color: decision === 'approved' ? 'var(--green)' : 'var(--wrong)' } },
            decision === 'approved' ? 'مُعتمَد' : 'مردود') : null,
        ]),

        el('h1', { style: { fontFamily: 'var(--serif)', fontSize: '26px', fontWeight: '700', lineHeight: '1.5' } }, q.question),

        el('div.card', [
          el('span', { style: { fontSize: '12.5px', fontWeight: '600', color: 'var(--green)' } }, 'الإجابة'),
          el('p', { style: { fontFamily: 'var(--serif)', fontSize: '17px', lineHeight: '1.9' } },
            q.modelAnswer || q.explanation || '—'),
        ]),

        ref
          ? el('button.card.card--paper', {
              style: { border: '1px dashed var(--line)' },
              onclick: () => openPage(ref),
            }, [
              el('div.row', [
                el('span', { style: { fontSize: '14px', fontWeight: '600' } },
                  `${bookTitle(ref.book)} — صفحة ${ar(ref.page)}`),
                el('span', { 'aria-hidden': 'true', style: { fontSize: '18px', color: 'var(--ink-8)' } }, '‹'),
              ]),
              el('span.fine', { style: { textAlign: 'start' } },
                `ثقة ${pct(ref.confidence ?? 1)}${ref.countWord ? ` · العدد «${ref.countWord}» ${ref.countAgrees ? 'موافقٌ للصفحة' : 'غيرُ موجودٍ فيها'}` : ''}`),
            ])
          : el('div.card.card--sand', [
              el('span.fine', { style: { color: 'var(--sand-ink2)' } },
                'لا صفحةَ مرشَّحة — لا نصَّ لكتاب هذا العلم، أو لم تتجاوز أي صفحةٍ العتبة.'),
            ]),

        // تحذيرٌ مركَّز حيث يقع الخطأ فعلاً
        ref?.countWord && !ref.countAgrees
          ? el('div.card.card--sand', [
              el('span', { style: { fontSize: '13px', fontWeight: '600', color: 'var(--sand-ink)' } }, 'انتبه للعدد'),
              el('span.fine', { style: { color: 'var(--sand-ink2)' } },
                `الإجابة تقول «${ref.countWord}» ولم يظهر هذا اللفظ في الصفحة المرشَّحة. وهذا بابُ أكثر ما صُحِّح.`),
            ])
          : null,
      ]),

      el('div', { style: { padding: '14px 24px 26px', display: 'flex', gap: '10px', flexShrink: '0' } }, [
        el('button.btn', {
          style: { flex: '1', fontSize: '15px', background: 'var(--green)' },
          onclick: () => { store.setReview(q.id, 'approved', ref?.page ?? null); i += 1; paint(); },
        }, 'اعتمد'),
        el('button.btn.btn--ghost', {
          onclick: () => { store.setReview(q.id, 'rejected', null); i += 1; paint(); },
        }, 'يحتاج تصحيحاً'),
        el('button.btn.btn--ghost', { onclick: () => { i += 1; paint(); } }, 'لاحقاً'),
      ]),
    );
  };

  function summary(done, total) {
    const decisions = store.allReviews();
    const approved = Object.values(decisions).filter((d) => d.status === 'approved').length;
    return el('div.pane', [
      el('h1.title', 'انتهت القائمة'),
      el('p.lede', `اعتمدتَ ${ar(approved)} من ${ar(total)} سؤالاً.`),
      el('div.card', [
        el('span', { style: { fontSize: '13px', fontWeight: '600', color: 'var(--green)' } }, 'تصدير القرارات'),
        el('span.fine', 'نزِّل الملفّ، ثم ادمجه في البنوك بـ tools/دمج_الاعتماد.py'),
      ]),
      el('div.push.stack', [
        el('button.btn', { onclick: exportReviews }, 'نزِّل ملفّ الاعتماد'),
        el('button.btn.btn--ghost', { style: { width: '100%' }, onclick: () => go('account') }, 'رجوع'),
      ]),
    ]);
  }

  paint();
  return wrap;
}

function exportReviews() {
  const blob = new Blob([JSON.stringify(store.allReviews(), null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: 'اعتماد-التوثيق.json' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
