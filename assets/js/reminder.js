// تنبيهُ الوِرد اليوميّ — عبر تقويم الجهاز، لا عبر التطبيق.

/**
 * ── لماذا التقويمُ لا إشعارُ المتصفّح ────────────────────────────────────
 *
 * صفحةُ الوِبّ لا تُوقِظ الجهازَ من نفسِها. والإشعارُ المجدوَل (Notification
 * Triggers) لم يُقرَّ في المتصفّحات، وإشعارُ الدفع (Web Push) يحتاج خادماً
 * يرسله ومفاتيحَ VAPID — ولا خادمَ لهذا التطبيق أصلاً.
 *
 * فلو صنعنا «تنبيهاً» في التطبيق لكان وعداً لا يُوفى به: يضبطه الطالبُ ثمّ
 * لا يأتيه شيءٌ أبداً وهو لا يدري لِمَ. والوعدُ الكاذبُ في الواجهة أسوأُ من
 * غيابِ المِيزة.
 *
 * وتقويمُ الجهازِ يُوقِظه فعلاً، كلَّ يومٍ في وقته، بلا شبكةٍ ولا خادم. فيُصنَع
 * حدثٌ متكرِّرٌ (‎.ics) يفتحه الطالبُ مرّةً فيدخل تقويمَه ويبقى.
 *
 * وإن نُشِر خادمُ الإحصاء يوماً أمكن بناءُ الدفعِ الحقيقيّ فوقه.
 */

const AR = '٠١٢٣٤٥٦٧٨٩';
const ar = (n) => String(n).replace(/\d/g, (d) => AR[+d]);

/** «١٩:٣٠» تُقرأ عربيةً: «٧:٣٠ مساءً». وما ليس على الصورةِ يُردُّ ولا يُخرِج NaN. */
export function readable(hhmm) {
  const [h, m] = safeTime(hhmm);
  const suffix = h < 12 ? 'صباحاً' : 'مساءً';
  const h12 = h % 12 || 12;
  return `${ar(h12)}:${ar(String(m).padStart(2, '0'))} ${suffix}`;
}

/** وقتٌ على صورةِ «سا:دق» لا غير — وما خالفَ رُدَّ إلى السابعةِ مساءً. */
function safeTime(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) return [19, 0];
  const h = Math.min(23, Math.max(0, +m[1]));
  const mi = Math.min(59, Math.max(0, +m[2]));
  return [h, mi];
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * ملفُّ تقويمٍ بحدثٍ يوميٍّ متكرّرٍ لا ينتهي.
 *
 * والوقتُ يُكتَب محليّاً بلا منطقةٍ زمنية (`DTSTART` بلا `Z`): فالمقصودُ
 * «السابعةُ مساءً حيث أنت» لا لحظةٌ عالميّةٌ بعينها، ولو كُتب بـUTC لانزاح
 * الموعدُ على من سافر.
 */
/**
 * تهريبُ نصٍّ في iCalendar — RFC 5545 §3.3.11.
 *
 * وحقولُ `SUMMARY` و`DESCRIPTION` نصوصٌ تُفصَل أسطُرُها بـCRLF، فسطرٌ جديدٌ
 * في قيمةٍ **يُنشئ حقلاً جديداً** في الملفّ. فمن كان في قيمةٍ منها فاصلةٌ أو
 * فاصلةٌ منقوطةٌ أو سطرٌ جديدٌ تبدّل معنى الحدثِ عمّا قُصِد.
 *
 * ووقتُ التنبيهِ يُقرَأ من `localStorage`، وهو ليس ممّا يُوثَق به (وقد صار
 * يُفحَص في `store.sane` أيضاً — والحرزانِ لا يُغني أحدُهما عن الآخَر: هذا
 * الملفُّ يُنادى من غيرِ موضع). فحدثٌ يوميٌّ يُزرَع في تقويمِ الإمامِ بنصٍّ
 * ليس من التطبيقِ أسوأُ من عدمِ التنبيه.
 */
const icsText = (v) => String(v ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

export function icsFor(hhmm, { title = 'وِرد الاستعداد', url = '' } = {}) {
  const [h, m] = safeTime(hhmm);
  const safeUrl = /^https?:\/\/[^\s;,]+$/.test(String(url || '')) ? url : '';
  const now = new Date();
  // أوّلُ موعدٍ اليومَ إن لم يمضِ، وإلا غداً — فلا يبدأ التكرارُ بموعدٍ فائت.
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  if (first <= now) first.setDate(first.getDate() + 1);

  const local = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
    + `T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  // السطورُ تُفصَل بـCRLF كما يوجب RFC 5545؛ وبعضُ التقاويم يرفض غيرَه.
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//estidad//reminder//AR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    // المعرِّفُ يُبنى من الوقتِ المُطهَّرِ لا من المكتوب.
    `UID:wird-${h}${String(m).padStart(2, '0')}-${Date.now()}@estidad`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local(first)}`,
    'DURATION:PT15M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${icsText(title)}`,
    // `URL` صنفُه URI لا TEXT، فلا يُهرَّب تهريبَ النصِّ — ويُفحَص بدلَ ذلك:
    // ما ليس http(s) لا يُكتَب أصلاً، ولا يُذكَر في الوصفِ نصّاً كذلك.
    `DESCRIPTION:${icsText(`وقتُ وِردك اليوم.${safeUrl ? ` ${safeUrl}` : ''}`)}`,
    ...(safeUrl ? [`URL:${safeUrl}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    `DESCRIPTION:${icsText(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

/**
 * يُسلِّم الملفَّ إلى الجهازِ ليدخل تقويمَه — ويُرجِع **ما وقع فعلاً**.
 *
 * ── لماذا لا يكفي `a.download` ──────────────────────────────────────────
 *
 * كان هذا كلَّ ما تفعله الدالّة: رابطٌ بـ`download` على عنوانِ blob. وذلك
 * يعمل على الحاسوبِ وأندرويد، **ولا يعمل على iOS**: سفاري ثَمَّ لا يُنزِّل
 * روابطَ blob بهذه الصورة، فيُعرِض عنها أو يفتح نصَّ الملفِّ خاماً على الشاشة.
 * فيضغط الإمامُ «أضِفْه إلى التقويم» فلا يقع شيءٌ — **ولا ردَّ على الشاشة
 * أصلاً**، لأنّ الدالّةَ لا تُرجِع خبراً — والوقتُ معروضٌ فوقَه مضبوطاً.
 *
 * فهو عينُ ما بُنِي هذا الملفُّ لتجنُّبه: «الوعدُ الكاذبُ في الواجهة أسوأُ من
 * غيابِ المِيزة» — مكتوبٌ في رأسِه، ثمّ وقع فيه.
 *
 * ── الطريقُ الذي يعمل ثَمَّ ──────────────────────────────────────────────
 *
 * ورقةُ المشاركةِ (`navigator.share` بالملفّات، وهي في iOS من ١٥) تُسلِّم
 * الملفَّ إلى التطبيقات، وفيها «التقويم» — فيصل الحدثُ إلى موضعه بضغطةٍ من
 * الطالب. فتُقدَّم على غيرها حيث وُجِدت، ويُرجَع `'shared'`.
 *
 * ثمّ `a.download` لمن يُنزِّل (الحاسوبُ وأندرويد) ← `'downloaded'`.
 * ثمّ فتحُ لسانٍ لمن لا يفعل أيّاً منهما ← `'opened'`، ويُقال للطالبِ ما
 * يفعله به. و`'blocked'` إن مُنِع اللسان.
 */
export async function download(hhmm, opts) {
  const text = icsFor(hhmm, opts);
  // اسمٌ لاتينيّ: الامتدادُ `.ics` هو الذي يدلُّ النظامَ أن يفتحه في التقويم،
  // والاسمُ العربيُّ يسقط في بعض المتصفّحات فيُحفَظ بلا امتدادٍ أصلاً فلا يُفتَح.
  const NAME = 'estidad-wird.ics';
  const TYPE = 'text/calendar;charset=utf-8';

  if (typeof File === 'function' && typeof navigator.share === 'function') {
    const file = new File([text], NAME, { type: 'text/calendar' });
    // `canShare` إنّما جاء في سفاري ١٦٫٤، فغيابُه لا يعني المنعَ — يُجرَّب.
    const allowed = navigator.canShare ? navigator.canShare({ files: [file] }) : true;
    if (allowed) {
      try {
        await navigator.share({ files: [file], title: 'وِرد الاستعداد' });
        return 'shared';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
        /* لا يقبل الملفّات — يُجرَّب ما بعدَه */
      }
    }
  }

  const href = URL.createObjectURL(new Blob([text], { type: TYPE }));
  const revoke = () => setTimeout(() => URL.revokeObjectURL(href), 8000);

  const ua = navigator.userAgent || '';
  const iosSafari = /iP(hone|ad|od)/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  const a = document.createElement('a');

  if ('download' in a && !iosSafari) {
    a.href = href;
    a.download = NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    revoke();
    return 'downloaded';
  }

  const win = window.open(href, '_blank');
  revoke();
  return win ? 'opened' : 'blocked';
}
