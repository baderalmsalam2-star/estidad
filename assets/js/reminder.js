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

/** «١٩:٣٠» تُقرأ عربيةً: «٧:٣٠ مساءً». */
export function readable(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const suffix = h < 12 ? 'صباحاً' : 'مساءً';
  const h12 = h % 12 || 12;
  return `${ar(h12)}:${ar(String(m).padStart(2, '0'))} ${suffix}`;
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * ملفُّ تقويمٍ بحدثٍ يوميٍّ متكرّرٍ لا ينتهي.
 *
 * والوقتُ يُكتَب محليّاً بلا منطقةٍ زمنية (`DTSTART` بلا `Z`): فالمقصودُ
 * «السابعةُ مساءً حيث أنت» لا لحظةٌ عالميّةٌ بعينها، ولو كُتب بـUTC لانزاح
 * الموعدُ على من سافر.
 */
export function icsFor(hhmm, { title = 'وِرد الاستعداد', url = '' } = {}) {
  const [h, m] = String(hhmm).split(':').map(Number);
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
    `UID:wird-${hhmm.replace(':', '')}-${Date.now()}@estidad`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local(first)}`,
    'DURATION:PT15M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${title}`,
    `DESCRIPTION:وقتُ وِردك اليوم.${url ? ` ${url}` : ''}`,
    ...(url ? [`URL:${url}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    `DESCRIPTION:${title}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

/** يُنزِّل الملفَّ ليفتحه الجهازُ في تقويمه. */
export function download(hhmm, opts) {
  const blob = new Blob([icsFor(hhmm, opts)], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  // اسمٌ لاتينيّ: الامتدادُ `.ics` هو الذي يدلُّ النظامَ أن يفتحه في التقويم،
  // والاسمُ العربيُّ يسقط في بعض المتصفّحات فيُحفَظ بلا امتدادٍ أصلاً فلا يُفتَح.
  a.download = 'estidad-wird.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}
