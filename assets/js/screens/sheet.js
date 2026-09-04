// ورقةُ اختيار — سؤالٌ واحدٌ وخياراتُه، بدل `confirm` و`prompt` المتصفّح.

import { el, go, topbar } from '../ui.js';

/**
 * شاشةُ اختيارٍ عامّةٌ: عنوانٌ، وبيانٌ، وخياراتٌ رأسية.
 *
 * تُستعمَل حيث يلزم قرارٌ قبل الدخول (مُهلةُ الاختبار مثلاً). وأُفرِدت شاشةً
 * لأنّ `confirm` المتصفّح لاتينيُّ الأزرارِ لا يُعرَّب، ويقطع الشاشةَ بمربَّعٍ
 * غريبٍ عن التطبيق — والقرارُ جزءٌ من التجربة لا مقاطعةٌ لها.
 */
export default function sheetScreen({ title = '', note = '', options = [], back = null }) {
  return el('div', { style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } }, [
    topbar({ onBack: back || (() => go('home')), title: '' }),
    el('div.pane', { style: { gap: '16px' } }, [
      el('div.stack', { style: { gap: '8px' } }, [
        el('h1.title', title),
        note ? el('p.lede', note) : null,
      ]),
      el('div.stack', { style: { marginTop: 'auto', gap: '10px' } },
        options.map(([label, onclick], i) =>
          el(i === 0 ? 'button.btn' : 'button.btn.btn--ghost', {
            onclick,
            style: { width: '100%', fontSize: '15.5px' },
          }, label))),
    ]),
  ]);
}
