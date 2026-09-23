// نقطة الدخول: تحميل البيانات، وتسجيل الشاشات، وفتح أولّها.

import * as data from './data.js';
import * as store from './store.js';
import * as audio from './audio.js';
import * as sync from './sync.js';
import { defineRoutes, go, el, setDevMode, setPageRefResolver, setPageOpener, setNavigateHook, setOverlayProbe, currentRoute } from './ui.js';
import * as version from './version.js';

import trackScreen from './screens/track.js';
import homeScreen from './screens/home.js';
import { booksScreen, bookScreen } from './screens/books.js';
import quizScreen from './screens/quiz.js';
import customScreen from './screens/custom.js';
import tajweedScreen, { surahsScreen } from './screens/tajweed.js';
import reciteScreen from './screens/recite.js';
import flashcardsScreen from './screens/flashcards.js';
import accountScreen from './screens/account.js';
import { openPage, closePage, isPageOpen, libraryScreen } from './screens/page-view.js';
import reviewScreen from './screens/review.js';
import searchScreen from './screens/search.js';
import masteredScreen from './screens/mastered.js';
import adminScreen from './screens/admin.js';
import sheetScreen from './screens/sheet.js';
import { ownerScreen, signinScreen, ownerKeyScreen } from './screens/owner.js';

defineRoutes({
  track: trackScreen,
  home: homeScreen,
  books: booksScreen,
  book: bookScreen,
  quiz: quizScreen,
  custom: customScreen,
  tajweed: tajweedScreen,
  surahs: surahsScreen,
  recite: reciteScreen,
  flashcards: flashcardsScreen,
  account: accountScreen,
  library: libraryScreen,
  review: reviewScreen,
  search: searchScreen,
  mastered: masteredScreen,
  admin: adminScreen,
  sheet: sheetScreen,
  owner: ownerScreen,
  signin: signinScreen,
  ownerKey: ownerKeyScreen,
});

store.applyTextScale();
audio.sweep();

// وضع المطوّر: ?dev=1 يُظهر شارة «لم يُقابَل» على الأسئلة التي لم تُقابَل حرفياً
// على الكتاب، و?dev=0 يُطفئها. والشارةُ لا تظهر إلا لمن دخلَ بصفةِ المالك —
// فالمَسلَكُ مفتوحٌ للجميع والشارةُ ليست كذلك (انظر `devBadge` في `ui.js`).
const devParam = new URLSearchParams(location.search).get('dev');
if (devParam !== null) setDevMode(devParam === '1');

const screen = document.getElementById('screen');
/*
 * سطرُ التحميلِ يتحرّك — فالساكنُ يُقرَأ عُطلاً.
 *
 * والمنهجُ ٦٫٥ م.ب في أربعةَ عشرَ ملفاً، وعلى شبكةٍ ضعيفةٍ يطول الانتظارُ
 * نصفَ دقيقةٍ أو أكثر. وكان السطرُ ثابتاً لا يدلُّ على أنّ شيئاً يقع، فيحسبه
 * الإمامُ واقفاً فيُغلِق ويُعيد الفتحَ — فيبدأ من أوّله.
 */
const AR_D = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const arD = (n) => String(n).replace(/\d/g, (d) => AR_D[+d]);

const bootNote = el('p.lede', 'مرّةً واحدة، ثمّ يعمل بلا إنترنت.');
const bootBar = el('div.bar', { style: { width: '180px', marginTop: '4px' } },
  el('i', { style: { width: '4%' } }));
screen.append(el('div.empty', [
  el('span.head', 'يُحمَّل المنهج…'),
  bootNote,
  bootBar,
]));

const onProgress = (done, total) => {
  const pctDone = Math.max(4, Math.round((done / total) * 100));
  bootBar.firstChild.style.width = `${pctDone}%`;
  bootNote.textContent = done < total
    ? `${arD(done)} من ${arD(total)} ملفّاً — ثمّ يعمل بلا إنترنت.`
    : 'يُرتَّب المنهج…';
};

/*
 * التجديدُ التلقائيّ — فلا ينتظر الطالبُ فتحةً تاليةً ليصلَه الإصلاح.
 *
 * و`busy` تمنع إعادةَ الصفحةِ على من هو في ورقةٍ أو في تسجيل: الأولى تُذهِب
 * إجابةً كُتِبت ولم تُسجَّل بعد، والثانية تقطع الميكروفونَ في وسطِ تلاوة.
 * فيُؤجَّل إلى أن يخرج، و`setNavigateHook` أدناه هي التي تلتقط خروجَه.
 *
 * والشرحُ كلُّه في `watchForUpdate` في `version.js`.
 */
const BUSY = new Set(['quiz', 'recite']);
// و«المشغول» يُقاس على الشاشةِ المقصودةِ لا المتروكة: الخُطّافُ يُنادى قبل أن
// تتبدّلَ `currentRoute()`، فيُمرَّر إليه المقصِدُ ويُسأل عنه. وشرحُه في `go`.
let heading = null;
const whenFree = version.watchForUpdate({
  busy: () => BUSY.has(heading ?? currentRoute()),
});

setPageRefResolver(data.pageRefOf);
setPageOpener(openPage);
// أي انتقالٍ بين الشاشات يُغلق طبقة الصفحة إن كانت مفتوحة.
//
// و`true` تعني «قيدُ الطبقةِ مستهلَكٌ أو لا يُستهلَك ههنا»: هذا الخُطّافُ
// يُنادى من `popstate` (وقد استُهلِك القيدُ بالرجوعِ نفسِه) ومن `go` (ولا
// يقع مع طبقةٍ مفتوحةٍ إلا برمجياً، ومنازعةُ السجلِّ في أثناء الانتقالِ أسوأُ
// من قيدٍ يتيم). وأمّا ✕ وEscape فتُناديان `closePage()` بلا وسيط.
setNavigateHook((to) => {
  closePage(true);
  // وكلُّ انتقالٍ بين الشاشات فرصةٌ لتجديدٍ أُجِّل لانشغالِ الطالب.
  // و`heading` تُقرأ داخلَ `busy` أعلاه، ثمّ تُرَدُّ فلا تبقى بعد الانتقال.
  heading = to ?? null;
  try {
    if (whenFree) whenFree();
  } finally {
    heading = null;
  }
});
setOverlayProbe(isPageOpen);

/**
 * عاملُ الخدمة — يُسجَّل بعدَ إقلاعِ التطبيقِ لا قبلَه، فلا يزاحمُ أوّلَ رسمٍ على
 * شبكةٍ ضعيفة. ولا يُسجَّل على `file://` لأنّ المتصفّحَ يمنعه ثَمّ.
 */
function registerWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => {
    /* لا شبكةَ أو منعٌ من المتصفّح — التطبيقُ يعملُ بلا تخزينٍ للعمل بلا شبكة */
  });
}

data.load({ onProgress })
  .then(() => {
    /*
     * متصفّحٌ دون الأرضيّة: لا تُرسَم شاشةٌ فوق رسالتِه.
     *
     * `compat.js` يكتب رسالتَه في `#screen`، و`go()` تُنادي `replaceChildren`
     * فتمحوها — قِيسَ: ظهرت ٩٢ملّي ومُحِيت ٢٩١. فيُقرأ عَلَمُه ههنا، قبل أوّلِ
     * رسم. وشرحُه كلُّه في `compat.js`.
     *
     * ويُقرأ من `window` لأنّ `compat.js` ليس وحدةً — وهو كذلك عمداً: يُخاطِب
     * متصفّحاً لا يعرف الوحدات.
     */
    if (window.__estidadTooOld) return;

    // المسارُ يُقرَأ من تخزينِ المتصفّح، وما فيه ليس ممّا يُؤتمَن: يبقى من
    // نسخةٍ قديمةٍ، أو يُعدَّل بيد. وقيمةٌ لا يعرفها المنهجُ كانت تُسقِط الرئيسيةَ
    // بـ`TypeError` فلا شاشةَ تُرسَم ولا بابَ للخروجِ من العَطَب. فيُنسى ما لا
    // يُعرَف ههنا — قبل أن تُرسَم شاشةٌ واحدة.
    if (!data.isTrack(store.get().track)) store.setTrack(null);

    /*
     * ما لم يعد له سؤالٌ في البنكِ يُنظَّف — مرّةً، وبعد أن تصل البنوكُ كلُّها.
     *
     * فإجاباتُ أسئلةٍ حُذِفت أو طُويت كانت تبقى تُحسَب في النقاطِ وفي «أجبتَ
     * عن كذا سؤالاً» أبداً. والشرطُ `missingBanks` لازم: بنكٌ سقط في شبكةٍ
     * ضعيفةٍ يجعل أسئلتَه «غيرَ موجودة» فيُمحى بها تقدُّمُ شهر.
     */
    if (!data.missingBanks().length) {
      store.prune(new Set(data.allQuestions().map((q) => q.id)), data.aliases());
    }

    // أول شاشةٍ في التطبيق اختيارُ المسار، ولا يُتجاوَز إلا بعد اختياره.
    go(store.get().track ? 'home' : 'track');
    // ما بقي في طابور جلسةٍ سابقةٍ يُرسَل الآن — بعد ظهور الشاشة لا قبلها.
    sync.flush(store.get().track);

    /*
     * ولا يُنتظَر بالطابورِ إقلاعٌ تالٍ.
     *
     * فالإرسالُ كان لا يقع إلا عند الإقلاعِ وعند ختمِ جلسة، والطالبُ في المسجدِ
     * بلا شبكةٍ يُذاكر ثمّ يُغلِق — فيبقى ما عنده إلى أن يفتح التطبيقَ في موضعٍ
     * فيه شبكة، وقد لا يفتحه أياماً.
     *
     * فموضعان يُنادى فيهما: عودةُ الشبكة، وإخفاءُ الصفحة (وهي آخِرُ لحظةٍ
     * موثوقةٍ على الجوّال — `unload` لا يقع ثَمَّ، و`fetch` فيها `keepalive`).
     */
    const resend = () => { sync.flush(store.get().track); };
    window.addEventListener('online', resend);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') resend();
    });
  })
  .catch((err) => {
    // الرسالةُ تُخاطِب الطالبَ على جوّاله، لا مبرمِجاً على حاسوب. وكانت تقول
    // «شغّل المشروع عبر خادمٍ محليّ (npm start)» — وهذا لا يفعله إمامٌ في مسجد،
    // ولا هو السببُ في الغالب: السببُ انقطاعُ الشبكةِ في أوّلِ زيارة.
    screen.replaceChildren(el('div.empty', [
      el('span.head', 'لم تصلِ الأسئلةُ بعد'),
      el('p.lede', 'هذا يقع في أوّلِ فتحةٍ إن كانت الشبكةُ ضعيفة. تأكّدْ من '
        + 'اتصالك ثمّ أعِدْ فتحَ الصفحة — وبعد أوّلِ فتحةٍ تامّةٍ يعمل التطبيقُ '
        + 'بلا إنترنت.'),
      el('p.fine', { style: { direction: 'ltr' } }, String(err.message || err)),
    ]));
  })
  // العاملُ يُسجَّل على كلِّ حال: هو لا يحتاج البياناتَ حتى يُسجَّل، وتسجيلُه في
  // الزيارةِ الساقطةِ هو الذي يُنجي الزيارةَ التالية. وكان في `.then()` وحدَه،
  // فأوّلُ زيارةٍ تسقط لا تُخزِّن شيئاً، فتبدأ الثانيةُ من الصفرِ أيضاً — عَطَبٌ
  // يُغذّي نفسَه على الشبكةِ التي وُصِف التطبيقُ لها.
  .finally(registerWorker);
