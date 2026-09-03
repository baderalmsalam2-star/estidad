/*
 * عاملُ الخدمة — ليعملَ التطبيقُ بلا شبكة.
 *
 * الإمامُ في مسجدِه قد لا تكونُ عنده شبكة، والمنهجُ كلُّه ملفاتٌ ساكنةٌ لا خادمَ
 * لها. فتُخزَّن عند أوّلِ زيارةٍ ثمّ يُقرَأ منها بعدُ.
 *
 * والسياسةُ سياستان:
 *   • الهيكلُ (index.html والكود والخطوط) — «من المخزن أوّلاً» ليُقلِع فوراً،
 *     ويُحدَّث في الخلفيةِ للزيارةِ التالية (stale-while-revalidate).
 *   • كتبُ PDF — لا تُخزَّن مسبقاً (٢٧ م.ب)، بل ما فُتح منها فعلاً يُحفَظ.
 *
 * وكلُّ تغييرٍ في الملفاتِ يُوجِب رفعَ CACHE — وإلا بقي الطالبُ على نسخةٍ قديمة.
 */

const CACHE = 'awqaf-prep-v1';

/** الهيكلُ الذي لا يقومُ التطبيقُ بدونه — يُجلَب كلُّه عند التنصيب. */
const SHELL = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'assets/css/app.css',
  'assets/css/fonts.css',
  'assets/js/app.js',
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
  'assets/fonts/amiri-400-arabic.woff2',
  'assets/fonts/amiri-700-arabic.woff2',
  'assets/fonts/plex-arabic-400-arabic.woff2',
  'assets/fonts/plex-arabic-600-arabic.woff2',
  'assets/fonts/plex-arabic-700-arabic.woff2',
  'assets/fonts/plex-mono-400-latin.woff2',
  'assets/fonts/amiri-quran-400-arabic.woff2',
  'data/manifest.json',
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

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const extra = ['data/page-hints.json', 'books/pages-index.json', 'data/book-links.json'];
    const all = [...SHELL, ...extra, ...(await bankUrls())];
    // ملفٌّ واحدٌ يسقط لا يُبطِل التنصيبَ كلَّه — يُجلَب لاحقاً عند طلبه.
    await Promise.allSettled(all.map((u) => cache.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request, { ignoreSearch: true });

    const fromNet = fetch(request)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') cache.put(request, res.clone());
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
