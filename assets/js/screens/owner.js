// ١٤ — لوحةُ الإدارة، وبابُ الدخول إليها.
//
// اللوحةُ فهرسٌ لا صفحةُ أرقام: كلُّ بطاقةٍ بابٌ يُفتَح وحدَه، فيُقصَد المطلوبُ
// رأساً بدل تصفُّحِ صفحةٍ طويلةٍ يُبحَث فيها عن الرقم.
//
// وتنقسم قسمين: **الإدارة** وهي عن الأسئلة والطلاب، و**خاصٌّ بك** وهي عن
// التطبيقِ نفسِه وعن جهازك — تُفصَل لئلّا يختلط تصفيرُ الجهازِ بقراءةِ رقم.

import * as store from '../store.js';
import * as sync from '../sync.js';
import * as owner from '../owner.js';
import { el, ar, go, topbar, devMode, setDevMode, MAGNIFIER } from '../ui.js';

/* ── بابُ الدخول ─────────────────────────────────────────────────────── */

export function signinScreen() {
  const msg = el('p.fine', { style: { color: 'var(--wrong)', minHeight: '20px' } }, '');
  const input = el('input.searchbar', {
    type: 'password', autocomplete: 'current-password',
    placeholder: 'كلمة الدخول', 'aria-label': 'كلمة الدخول',
    style: { textAlign: 'start', direction: 'ltr' },
  });

  let busy = false;
  const submit = async () => {
    if (busy) return;
    busy = true;
    msg.textContent = '';
    try {
      if (await owner.signIn(input.value)) { go('owner'); return; }
      msg.textContent = 'كلمةٌ غير صحيحة.';
    } catch (e) {
      msg.textContent = e.message;
    }
    busy = false;
  };

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  // بلا `minHeight: '0'` عن قصد: لا مُمَرِّرَ داخلَ هذه الشاشة، فالتمريرُ على
  // `#screen` كلِّه. ولو سُمِح للّوحِ أن ينكمشَ دون محتواه لخرج المحتوى من
  // صندوقه، ولَطُبِع سطرُ الاعتماد — وهو أخوه من بعده — فوقَه في وسط الصفحة.
  return el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1' } }, [
    topbar({ onBack: () => go('account'), title: 'دخول المشرف' }),
    el('div.pane', [
      el('h1.head', 'دخول المشرف'),
      el('p.lede', 'هذا البابُ لصاحب التطبيق. وليس للطالب فيه شيءٌ يُفيده.'),
      input,
      msg,
      el('button.btn', { onclick: submit }, 'ادخل'),
      el('p.fine', { style: { marginTop: 'auto' } },
        'وهو سِترٌ لا قُفل: التطبيقُ ملفّاتٌ ساكنةٌ تنزل إلى الأجهزة، فلا يُوضَع '
        + 'خلفه ما لا يُحتمَل انكشافُه. والذي يحرس أرقامَ الطلاب حقّاً مفتاحُ '
        + 'الخادم، فتلك لا تنزل إلى جهازٍ إلا بمطابقته عند الخادم.'),
    ]),
  ]);
}

/* ── اللوحة ──────────────────────────────────────────────────────────── */

/**
 * البطاقاتُ كلُّها تفتح شيئاً قائماً — لا بطاقةَ زينةٍ تَعِدُ بما ليس مبنيّاً.
 * فإذا بُني بابٌ جديدٌ أُضيف سطرُه ههنا وحدَه.
 */
function sections() {
  return [
    {
      group: 'الإدارة',
      items: [
        { icon: '👥', title: 'أرقام الطلاب', note: sync.available()
            ? 'كم دخل، وكم أصاب، وأصعبُ الأسئلة — مجاميعُ بلا أسماء'
            : 'تحتاج نشرَ خادم الإحصاء — وفيها بيانُ ذلك',
          go: () => go('admin', { section: 'students' }) },
        { icon: '📚', title: 'صحّة البنك', note: 'الموثَّقُ على الكتاب، والمصحَّح، وما بقي',
          go: () => go('admin', { section: 'bank' }) },
        { icon: '📊', title: 'توزيع الصعوبة', note: 'أين تتكدَّس الأسئلةُ الصعبةُ والسهلة',
          go: () => go('admin', { section: 'difficulty' }) },
        { icon: '🕳️', title: 'ما ينقص البنك', note: 'قائمةُ عملٍ لا زينةَ أرقام',
          go: () => go('admin', { section: 'gaps' }) },
        { icon: '📝', title: 'مراجعة البنك', note: 'سؤالاً سؤالاً — قبولٌ أو ردٌّ مع سببه',
          go: () => go('review') },
      ],
    },
    {
      group: 'خاصٌّ بك',
      locked: true,
      items: [
        { icon: '📱', title: 'أرقام هذا الجهاز', note: 'إجاباتُك أنت وحدَك — لا إحصاءَ طلاب',
          go: () => go('admin', { section: 'device' }) },
        { icon: '🔖', title: 'شارة «لم يُقابَل»',
          note: devMode() ? 'ظاهرةٌ الآن على الأسئلة غير الموثَّقة' : 'مطفأةٌ — لا يراها الطالب أصلاً',
          go: () => { setDevMode(!devMode()); go('owner'); } },
        { icon: '🔑', title: 'كلمة الدخول والخروج', note: 'تبديلُ الكلمة، والخروجُ من هذا الجهاز',
          go: () => go('ownerKey') },
      ],
    },
  ];
}

export function ownerScreen() {
  if (!owner.isOwner()) { go('signin'); return null; }

  const list = el('div.stack', { style: { gap: '18px' } });
  const search = el('input.searchbar', {
    type: 'search', placeholder: 'ابحث في أقسام الإدارة…', 'aria-label': 'بحث',
    style: { textAlign: 'start' },
  });

  const draw = () => {
    const q = search.value.trim();
    list.replaceChildren(
      owner.usingTempKey()
        ? el('div.card.card--sand', { style: { gap: '8px' } }, [
            el('span', { style: { fontSize: '13.5px', fontWeight: '600', color: 'var(--sand-ink)' } },
              'كلمةُ الدخول ما زالت المؤقّتة'),
            el('span.fine', { style: { color: 'var(--sand-ink2)' } },
              'وهي مكتوبةٌ في المستودع، فمن قرأها دخل. بدِّلها بـ'
              + '«كلمة الدخول والخروج» أدناه.'),
          ])
        : null,

      ...sections().map(({ group, items, locked }) => {
        const hit = items.filter((it) => !q || it.title.includes(q) || it.note.includes(q));
        if (!hit.length) return null;
        return el('div.stack', { style: { gap: '10px' } }, [
          el('div.row-base', { style: { borderBottom: '1px solid var(--line)', paddingBottom: '8px' } }, [
            el('span.section-title', { style: { color: locked ? 'var(--sand-ink)' : null } },
              `${locked ? '🔒 ' : ''}${group}`),
            el('span.fine', ar(hit.length)),
          ]),
          el('div.grid-cards', hit.map((it) =>
            el('button.card', { onclick: it.go, style: { gap: '6px' } }, [
              el('div.row', { style: { gap: '10px', alignItems: 'flex-start' } }, [
                el('span', { style: { fontSize: '15.5px', fontWeight: '600', textAlign: 'start' } }, it.title),
                el('span', { style: { fontSize: '20px', flexShrink: '0' }, 'aria-hidden': 'true' }, it.icon),
              ]),
              el('span.fine', { style: { textAlign: 'start' } }, it.note),
            ]))),
        ]);
      }),
    );
    if (!list.children.length) list.append(el('p.lede', 'لا قسمَ بهذا الاسم.'));
  };

  search.addEventListener('input', draw);
  draw();

  // بلا `minHeight: '0'` عن قصد: لا مُمَرِّرَ داخلَ هذه الشاشة، فالتمريرُ على
  // `#screen` كلِّه. ولو سُمِح للّوحِ أن ينكمشَ دون محتواه لخرج المحتوى من
  // صندوقه، ولَطُبِع سطرُ الاعتماد — وهو أخوه من بعده — فوقَه في وسط الصفحة.
  return el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1' } }, [
    topbar({ onBack: () => go('account'), title: 'حسابي' }),
    el('div.pane', [
      el('h1.title', 'لوحة الإدارة'),
      search,
      list,
    ]),
  ]);
}

/* ── الكلمةُ والخروج ─────────────────────────────────────────────────── */

export function ownerKeyScreen() {
  if (!owner.isOwner()) { go('signin'); return null; }

  // بلا `minHeight: '0'` عن قصد: لا مُمَرِّرَ داخلَ هذه الشاشة، فالتمريرُ على
  // `#screen` كلِّه. ولو سُمِح للّوحِ أن ينكمشَ دون محتواه لخرج المحتوى من
  // صندوقه، ولَطُبِع سطرُ الاعتماد — وهو أخوه من بعده — فوقَه في وسط الصفحة.
  return el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1' } }, [
    topbar({ onBack: () => go('owner'), title: 'لوحة الإدارة' }),
    el('div.pane', [
      el('h1.head', 'كلمة الدخول'),

      el('div.card', { style: { gap: '8px' } }, [
        el('span', { style: { fontSize: '13.5px', fontWeight: '600' } }, 'كيف تُبدَّل'),
        el('span.fine',
          'الكلمةُ ليست في التطبيق، وإنّما مُلخَّصُها. فتُبدَّل من المستودع بأمرٍ '
          + 'واحد، ثمّ يُرفَع:'),
        el('code.fine', {
          style: {
            direction: 'ltr', textAlign: 'left', background: 'var(--paper)',
            padding: '10px 12px', borderRadius: '12px', fontFamily: 'var(--mono)',
          },
        }, 'python3 tools/مفتاح_المشرف.py'),
        el('span.fine', owner.usingTempKey()
          ? 'وهي الآن الكلمةُ المؤقّتةُ المشحونةُ مع التطبيق — بدِّلها.'
          : 'وهي الآن كلمتُك أنت، لا المؤقّتة.'),
      ]),

      el('div.card', { style: { gap: '8px' } }, [
        el('span', { style: { fontSize: '13.5px', fontWeight: '600' } }, 'ما الذي يَحرُسه هذا الباب'),
        el('span.fine',
          'لا يحرس شيئاً من أسرار الطلاب: لا اسمَ في التطبيق ولا هاتفَ ولا بريد. '
          + 'وإنّما يمنع أن تُعرَض شاشاتُ الإدارةِ على طالبٍ يتصفّح. وأرقامُ '
          + 'الطلاب المجمَّعةُ لا تنزل إلى جهازٍ إلا بمفتاح الخادم، وذاك قُفلٌ '
          + 'حقيقيٌّ لأنّ المطابقةَ تقع عند الخادم لا في الجهاز.'),
      ]),

      el('button', {
        onclick: () => { owner.signOut(); go('account'); },
        style: {
          font: 'inherit', fontSize: '14px', fontWeight: '600', color: 'var(--ink-2)',
          background: 'var(--surface)', border: 'none', borderRadius: 'var(--r-pill)',
          padding: '15px', cursor: 'pointer',
        },
      }, 'اخرج من هذا الجهاز'),

      el('p.fine', 'الخروجُ لا يمسُّ تقدّمَ دراستك ولا أرقامَ الخادم؛ يُنسي هذا الجهازَ الصلاحيةَ لا غير.'),

      el('button', {
        onclick: () => {
          if (confirm('سيُمحى تقدّمك كلّه من هذا الجهاز. أمتأكّد؟')) { store.reset(); go('track'); }
        },
        style: {
          font: 'inherit', fontSize: '13.5px', color: 'var(--wrong)', background: 'none',
          border: 'none', cursor: 'pointer', padding: '10px', marginTop: 'auto',
        },
      }, 'تصفير تقدّمي في هذا الجهاز'),
    ]),
  ]);
}
