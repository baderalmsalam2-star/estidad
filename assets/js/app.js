// نقطة الدخول: تحميل البيانات، وتسجيل الشاشات، وفتح أولّها.

import * as data from './data.js';
import * as store from './store.js';
import * as audio from './audio.js';
import * as sync from './sync.js';
import { defineRoutes, go, el, setDevMode, setPageRefResolver, setPageOpener, setNavigateHook, setOverlayProbe } from './ui.js';

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
// على الكتاب، و?dev=0 يُطفئها. لا يراها الطالب.
const devParam = new URLSearchParams(location.search).get('dev');
if (devParam !== null) setDevMode(devParam === '1');

const screen = document.getElementById('screen');
screen.append(el('div.empty', el('span.head', 'يُحمَّل المنهج…')));

setPageRefResolver(data.pageRefOf);
setPageOpener(openPage);
// أي انتقالٍ بين الشاشات يُغلق طبقة الصفحة إن كانت مفتوحة.
setNavigateHook(closePage);
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

data.load()
  .then(() => {
    // المسارُ يُقرَأ من تخزينِ المتصفّح، وما فيه ليس ممّا يُؤتمَن: يبقى من
    // نسخةٍ قديمةٍ، أو يُعدَّل بيد. وقيمةٌ لا يعرفها المنهجُ كانت تُسقِط الرئيسيةَ
    // بـ`TypeError` فلا شاشةَ تُرسَم ولا بابَ للخروجِ من العَطَب. فيُنسى ما لا
    // يُعرَف ههنا — قبل أن تُرسَم شاشةٌ واحدة.
    if (!data.isTrack(store.get().track)) store.setTrack(null);

    // أول شاشةٍ في التطبيق اختيارُ المسار، ولا يُتجاوَز إلا بعد اختياره.
    go(store.get().track ? 'home' : 'track');
    // ما بقي في طابور جلسةٍ سابقةٍ يُرسَل الآن — بعد ظهور الشاشة لا قبلها.
    sync.flush(store.get().track);
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
