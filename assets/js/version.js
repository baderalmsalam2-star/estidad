// نسخةُ التطبيقِ العاملةُ على هذا الجهاز، وتجديدُها بيدِ الطالب.

/**
 * ── لماذا هذا الملفّ ────────────────────────────────────────────────────
 *
 * عاملُ الخدمة يخدم «من المخزن أوّلاً» ليُقلِع التطبيقُ بلا شبكة. وثمنُ ذلك أنّ
 * الجهازَ قد يبقى على نسخةٍ قديمةٍ زيارةً أو زيارتين بعد النشر. وهذا مقبولٌ في
 * نفسه، لكنّه صار مصدرَ حيرةٍ: يُنشَر إصلاحٌ فلا يراه صاحبُ التطبيقِ في جهازه،
 * فلا يدري أالإصلاحُ لم يُنشَر أم جهازُه لم يُحدَّث.
 *
 * فيُقال له أيُّ نسخةٍ عنده. والاسمُ لا يُكتَب في الكود — وإلا كذب يوماً —
 * وإنّما يُقرَأ من **مخزنِ العاملِ نفسِه**، فهو الذي يخدمه فعلاً.
 */

/** اسمُ المخزنِ العاملِ على هذا الجهاز، أو `null` إن لم يُنصَّب عاملٌ بعد. */
export async function current() {
  try {
    if (!globalThis.caches) return null;
    const keys = await caches.keys();
    return keys.find((k) => k.startsWith('awqaf-prep-')) || null;
  } catch {
    return null;
  }
}

/**
 * تجديدٌ قاطع: يُنزَع العاملُ ويُمحى مخزنُه ثمّ تُعاد الصفحة.
 *
 * ولم يُكتفَ بـ`registration.update()`: هو يجلب العاملَ الجديدَ ثمّ ينتظر أن
 * تُغلَق كلُّ نوافذِ التطبيق قبل أن يتولّى، فقد لا يرى الطالبُ الجديدَ الآن —
 * وهو ضغط الزرَّ ليراه الآن.
 *
 * والثمنُ أنّ الملفاتَ تُجلَب من الشبكةِ مرّةً واحدةً بعد هذا، ثمّ يعود التطبيقُ
 * يعمل بلا شبكةٍ كما كان. فلذلك لا يُفعَل تلقائياً، ولا يُفعَل بلا شبكة.
 */
export async function refresh() {
  if (!navigator.onLine) throw new Error('يحتاج التجديدُ شبكةً — أعِدْه وأنت متّصل.');
  try {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (globalThis.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* ما أمكن محوُه مُحي، والإعادةُ تقع على أيِّ حال */ }
  // `reload` وحدَه قد يُخدَم من مخزنِ المتصفّح، فيُضاف طابعٌ زمنيٌّ يُبطِله.
  const u = new URL(location.href);
  u.searchParams.set('ت', String(Date.now()));
  location.replace(u.toString());
}
