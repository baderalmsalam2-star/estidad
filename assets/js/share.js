// بطاقةُ النتيجة صورةً — تُشارَك في مجموعةِ الطلاب.

import { ar, pct, CONTACT } from './ui.js';

/**
 * ترسم نتيجةَ الجلسة بطاقةً مربّعةً وتُعيدها `Blob`.
 *
 * تُرسَم على `canvas` لا تُلتقَط من الشاشة: الالتقاطُ يحتاج مكتبةً خارجيةً
 * والتطبيقُ بلا اعتماديات، والرسمُ يُخرِج بطاقةً مقصودةً لا صورةَ شاشةٍ فيها
 * أزرارٌ لا معنى لها في صورة.
 *
 * ولا يُكتَب فيها اسمُ الطالبِ ولا شيءٌ عنه — التطبيقُ لا يعرف عنه شيئاً أصلاً.
 */
/**
 * مستطيلٌ مستديرُ الأركان.
 *
 * `ctx.roundRect` لا تعرفه سفاري قبل ١٦٫٤، ولو نوديت هناك سقطت البطاقةُ كلُّها
 * بخطأٍ غامضٍ في جهازٍ لا نراه. فتُرسَم بالأقواس، وهي في كلِّ متصفّح.
 */
function roundedRect(x, left, top, w, h, r) {
  x.beginPath();
  if (typeof x.roundRect === 'function') {
    x.roundRect(left, top, w, h, r);
    return;
  }
  x.moveTo(left + r, top);
  x.arcTo(left + w, top, left + w, top + h, r);
  x.arcTo(left + w, top + h, left, top + h, r);
  x.arcTo(left, top + h, left, top, r);
  x.arcTo(left, top, left + w, top, r);
  x.closePath();
}

export function resultCard({ title, score, right, total, seconds, rank }) {
  const S = 1080;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const x = c.getContext('2d');

  const PAPER = '#faf7f1';
  const GREEN = '#14655a';
  const INK = '#1c1917';
  const MUTED = '#7d7367';

  x.fillStyle = PAPER;
  x.fillRect(0, 0, S, S);

  // إطارٌ أخضرُ رفيعٌ يُميّزها في سيلِ الصور
  x.strokeStyle = GREEN;
  x.lineWidth = 10;
  x.strokeRect(34, 34, S - 68, S - 68);

  x.textAlign = 'center';
  x.direction = 'rtl';

  const serif = (n, w = '700') => `${w} ${n}px Amiri, serif`;
  const sans = (n, w = '400') => `${w} ${n}px "IBM Plex Sans Arabic", system-ui, sans-serif`;

  x.fillStyle = MUTED;
  x.font = sans(34);
  x.fillText('منصة الاستعداد لاختبارات الوظائف الدينية', S / 2, 150);

  x.fillStyle = INK;
  x.font = serif(56);
  x.fillText(title, S / 2, 250);

  x.fillStyle = GREEN;
  x.font = serif(230);
  x.fillText(pct(score), S / 2, 500);

  x.fillStyle = INK;
  x.font = sans(40);
  x.fillText(`أصبتُ ${ar(right)} من ${ar(total)}`, S / 2, 590);

  x.fillStyle = MUTED;
  x.font = sans(32);
  const mins = Math.floor(seconds / 60);
  x.fillText(`في ${mins ? `${ar(mins)} دقيقة و` : ''}${ar(seconds % 60)} ثانية`, S / 2, 650);

  if (rank) {
    // الحوضُ أوسعُ من سطرَيه: خطُّ أميري له نزولاتٌ تُقطَع إن ضُيِّق عليها.
    x.fillStyle = GREEN;
    roundedRect(x, S / 2 - 260, 706, 520, 132, 26);
    x.fill();
    x.fillStyle = PAPER;
    x.font = sans(30);
    x.fillText('رتبتي', S / 2, 754);
    x.font = serif(46);
    x.fillText(rank, S / 2, 812);
  }

  x.fillStyle = MUTED;
  x.font = sans(28);
  x.fillText('تم تطوير التطبيق بواسطة بدر المسلم', S / 2, S - 96);

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

/**
 * يُشارك البطاقة.
 *
 * المشاركةُ أوّلاً (`navigator.share`) لأنّها المقصودة: يبعثها في مجموعته من
 * غير أن تمرَّ بمجلّد التنزيلات. فإن لم تكن فالتنزيل. وبعض المضيفين يمنع
 * التنزيلَ من داخل الصفحة، فتُفتَح الصورةُ في لسانٍ جديدٍ ليحفظها بنفسه.
 *
 * ويُعاد ما وقع فعلاً — لا يُقال «شُورِكت» وما شُورِكت.
 */
export async function shareCard(blob, text) {
  const file = new File([blob], 'نتيجتي.png', { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'نتيجتي.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'downloaded';
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/** نصٌّ يُرافق الصورة عند المشاركة، وفيه دعوةٌ للتطبيق لا رابطٌ لأحد. */
export const shareText = (title, score) =>
  `${title} — ${pct(score)}\nمنصة الاستعداد لاختبارات الوظائف الدينية`
  + (CONTACT.whatsapp ? '' : '');
