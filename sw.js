/*
 * عاملُ الخدمة — ليعملَ التطبيقُ بلا شبكة.
 *
 * الإمامُ في مسجدِه قد لا تكونُ عنده شبكة، والمنهجُ كلُّه ملفاتٌ ساكنةٌ لا خادمَ
 * لها. فتُخزَّن عند أوّلِ زيارةٍ ثمّ يُقرَأ منها بعدُ.
 *
 * والسياسةُ سياستان:
 *   • الهيكلُ (index.html والكود والخطوط) — «من المخزن أوّلاً» ليُقلِع فوراً،
 *     ويُحدَّث في الخلفيةِ للزيارةِ التالية (stale-while-revalidate).
 *   • كتبُ PDF وصورُ الصفحات — لا تُخزَّن مسبقاً (٢٧ م.ب و١٢ م.ب)، بل ما فُتح
 *     منها فعلاً يُحفَظ.
 *
 * وكلُّ تغييرٍ في الملفاتِ يُوجِب رفعَ CACHE — وإلا بقي الطالبُ على نسخةٍ قديمة.
 *
 * ── مخزنان لا مخزنٌ واحد ─────────────────────────────────────────────────
 *
 * والمخزنُ مخزنان، لأنّ لهما عُمرَين مختلفَين:
 *
 *   • `CACHE` — الهيكل. اسمُه مرقَّمٌ، ويُرفَع رقمُه مع كلِّ نشر، فيُمحى القديمُ
 *     عند التنشيط. وهذا هو المقصود: الكودُ الجديدُ لا يُخالِطه قديم.
 *
 *   • `MEDIA` — ما جلبه الطالبُ بنفسِه: كتابٌ فتحه، وصفحةٌ قابلها. اسمُه **بلا
 *     رقم** فلا يُمحى عند النشر أبداً.
 *
 * وكانا مخزناً واحداً، فكان كلُّ نشرٍ يمحو ما حمَّله الطالبُ: إمامٌ فتح كتابَه
 * في بيته ليقرأه في مسجدٍ لا شبكةَ فيه، فأُصلِح في التطبيقِ خطأُ إملاءٍ، فوجد
 * الكتابَ ذاهباً ولا شبكةَ تُعيده. وذاك ثمنٌ لا يُدفَع عن تصحيحِ حرف.
 *
 * وملفاتُ الوسائطِ هذه لا تتغيّر لعنوانها: `daleel-altalib-16.jpg` صورةُ تلك
 * الصفحةِ اليومَ وبعدَ سنة. فلا تُراجَع على الشبكةِ بعدَ خزنها، بخلافِ الهيكل.
 */

const CACHE = 'awqaf-prep-v38';

/** مخزنُ ما جلبه الطالبُ بنفسِه — بلا رقمٍ فلا يُمحى مع النشر. */
const MEDIA = 'awqaf-prep-media';

/** أهذا الطلبُ من وسائطِ الطالبِ (كتابٌ أو صورةُ صفحة)؟ */
const isMedia = (path) => /\/books\/.*\.pdf$/i.test(path) || /\/books\/pages\//.test(path);

/** الهيكلُ الذي لا يقومُ التطبيقُ بدونه — يُجلَب كلُّه عند التنصيب. */
const SHELL = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'assets/css/app.css',
  'assets/css/fonts.css',
  'assets/js/app.js',
  // رسالةُ «متصفّحك أقدمُ…» — خارجَ الوحدات بقصد، وتُخزَّن كما يُخزَّن الهيكل.
  'assets/js/compat.js',
  'assets/js/ui.js',
  'assets/js/data.js',
  'assets/js/store.js',
  'assets/js/audio.js',
  'assets/js/screens/track.js',
  'assets/js/screens/home.js',
  'assets/js/screens/books.js',
  'assets/js/screens/quiz.js',
  'assets/js/screens/custom.js',
  'assets/js/screens/tajweed.js',
  'assets/js/screens/recite.js',
  'assets/js/screens/flashcards.js',
  'assets/js/screens/account.js',
  'assets/js/screens/page-view.js',
  'assets/js/screens/review.js',
  'assets/js/screens/search.js',
  'assets/js/screens/mastered.js',
  'assets/js/screens/admin.js',
  'assets/js/screens/sheet.js',
  'assets/js/screens/owner.js',
  'assets/js/owner.js',
  'assets/js/reminder.js',
  'assets/js/version.js',
  'assets/js/icons.js',
  'assets/js/share.js',
  'assets/js/sync.js',
  'assets/fonts/amiri-400-arabic.woff2',
  'assets/fonts/amiri-700-arabic.woff2',
  'assets/fonts/plex-arabic-400-arabic.woff2',
  'assets/fonts/plex-arabic-600-arabic.woff2',
  'assets/fonts/plex-arabic-700-arabic.woff2',
  'assets/fonts/plex-mono-400-latin.woff2',
  'assets/fonts/amiri-quran-400-arabic.woff2',
  'data/manifest.json',

  /*
   * أيقوناتُ التطبيق — كلُّها، لا `apple-touch-icon` وحدَها.
   *
   * وهي ٢٤ ك.ب جميعاً. وكانت خارجَ التخزين، فمن أضاف التطبيقَ إلى شاشتِه
   * الرئيسيةِ وهو بلا شبكة — وذلك أشبهُ الأحوالِ بحالِ الإمامِ في مسجده —
   * وجد أيقونةً فارغةً أو رمادَ النظام. والأيقونةُ أوّلُ ما يُرى، وفراغُها
   * يقول «هذا شيءٌ معطوب» قبل أن يُفتَح.
   */
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',

  /*
   * أحكامُ التجويد (٩٠٨ ك.ب) — ثقيلةٌ لكنّها في الهيكلِ لا في الوسائط.
   *
   * لأنّها ليست زينةً تُفقَد فتُحتمَل: شاشتا **التجويد** و**التسميع** كلتاهما
   * تستدعيان `data.loadTajweed()` أوّلَ ما تُفتَحان، فإن لم يصل الملفُّ لم
   * تُرسَم الشاشةُ أصلاً. وكان خارجَ التخزينِ فكانت الشاشتانِ ميّتتَين بلا
   * شبكةٍ — وهما من أنفعِ ما في التطبيقِ للإمامِ في مسجده.
   *
   * وثِقلُه يُدفَع مرّةً عند التنصيب، وهو دون ثُلثِ ملفِّ خطٍّ واحدٍ من خطوطنا.
   */
  'data/tajweed/juz-amma-rulings.json',
];

/**
 * بنوكُ الأسئلة تُخزَّن عند التنصيبِ أيضاً، ولا تُترَك لأوّلِ طلبٍ يمرُّ بالعامل.
 *
 * لأنّ العاملَ لا يسيطرُ على الزيارةِ الأولى، فبنوكُها تُجلَب من دونه فلا
 * تُخزَّن؛ ولو تُرِكت لكان التطبيقُ يعملُ بلا شبكةٍ من الزيارةِ الثالثةِ لا
 * الأولى. وقائمةُ البنوكِ تُقرَأ من `data/manifest.json` نفسِه كما يقرؤها
 * التطبيق، فلا تنفصلُ عنه إذا أُضيف بنكٌ جديد.
 */
async function bankUrls() {
  try {
    const res = await fetch('data/manifest.json', { cache: 'reload' });
    const md = await res.json();
    return (md.banks || []).map((b) => `data/banks/${b.file}`);
  } catch {
    return [];
  }
}

/**
 * أغلفةُ الكتب تُخزَّن مسبقاً أيضاً — وهي بضعُ عشراتٍ من الكيلوبايت لا أكثر،
 * وبقاؤها بلا تخزينٍ يجعل شاشةَ الكتبِ فارغةَ المواضع في مسجدٍ لا شبكةَ فيه.
 * وقائمتُها تُقرأ من `data/covers.json` كما يقرؤها التطبيق، فلا تنفصل عنه.
 */
async function coverUrls() {
  try {
    const res = await fetch('data/covers.json', { cache: 'reload' });
    return Object.values(await res.json());
  } catch {
    return [];
  }
}

/**
 * أيصلح هذا الردُّ للخزن؟
 *
 * و`res.ok` تقبل ٢٠٦ (Partial Content) — وهي تقع في ملفّاتِ الصوتِ وPDF حين
 * يطلب المتصفّحُ مدًى منها. فخزنُها يُخلِّف في المخزنِ قطعةً تُرَدُّ بعدُ
 * كأنّها الملفُّ كلُّه، فيُفتَح الكتابُ ناقصاً بلا شبكةٍ ولا يُعرَف السبب.
 * فيُشترَط ٢٠٠ حرفاً.
 */
const keepable = (res) => !!res && res.status === 200 && res.type === 'basic';

/**
 * خزنٌ لا يُخلِّف رفضاً غيرَ مُعالَج.
 *
 * و`cache.put` كانت تُنادى بلا `catch`: فإن امتلأ القرصُ (والوسائطُ ٢٧ م.ب
 * للكتابِ الواحد) أو أخرجَ المتصفّحُ المخزنَ في أثناءِ الكتابة، رُفِض الوعدُ
 * ولا مُلتَقِط — فيُسجَّل `unhandledrejection` في العامل، وقد يُنهيه المتصفّحُ
 * لأجله. والزيارةُ تمضي كأنّ شيئاً خُزِّن وهو لم يُخزَّن.
 *
 * و`waitUntil` عند المُنادي تُبقي العاملَ حيّاً حتى تتمَّ الكتابة: العاملُ
 * يُنهى بعد الردِّ مباشرةً، فكتابةٌ لم تتمَّ تُقطَع في منتصفها.
 */
const store = (cache, request, res) => cache.put(request, res).catch(() => {});

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const extra = ['data/page-hints.json', 'books/pages-index.json', 'data/book-links.json',
      'data/covers.json'];
    const all = [...SHELL, ...extra, ...(await bankUrls()), ...(await coverUrls())];
    // ملفٌّ واحدٌ يسقط لا يُبطِل التنصيبَ كلَّه — يُجلَب لاحقاً عند طلبه.
    await Promise.allSettled(all.map((u) => cache.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // يُمحى الهيكلُ القديمُ وحدَه. و`MEDIA` يُستثنى صريحاً: فيه كتبُ الطالبِ
    // وصفحاتُه، وليس لنا أن نمحوَها عنه كلَّما صحّحنا سطراً في الكود.
    for (const k of await caches.keys()) {
      if (k !== CACHE && k !== MEDIA) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // وسائطُ الطالبِ: من مخزنِها الدائم، ولا تُراجَع على الشبكةِ بعدَ خزنها —
  // فمحتوى `…-16.jpg` لا يتغيّر، ومراجعتُه إنفاقُ بياناتٍ في غير موضعه.
  if (isMedia(url.pathname)) {
    e.respondWith((async () => {
      const media = await caches.open(MEDIA);
      const hit = await media.match(request, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(request);
        if (keepable(res)) e.waitUntil(store(media, request, res.clone()));
        return res;
      } catch {
        return new Response('لا شبكةَ، ولم يُحمَّل هذا الملفُّ بعدُ.', {
          status: 504,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request, { ignoreSearch: true });

    const fromNet = fetch(request)
      .then((res) => {
        if (keepable(res)) e.waitUntil(store(cache, request, res.clone()));
        return res;
      })
      .catch(() => null);

    // المخزنُ أوّلاً ليُقلِع بلا انتظار، والشبكةُ تُحدِّثه للمرّةِ التالية.
    if (hit) { e.waitUntil(fromNet); return hit; }

    const res = await fromNet;
    if (res) return res;

    // لا مخزنَ ولا شبكة: تصفُّحُ صفحةٍ يُرَدُّ إلى الهيكل، وغيرُه يُعتذَر عنه.
    if (request.mode === 'navigate') {
      const shell = await cache.match('index.html') || await cache.match('.');
      if (shell) return shell;
    }
    return new Response('لا شبكةَ، ولم يُخزَّن هذا الملفُّ بعدُ.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  })());
});
