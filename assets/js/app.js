// نقطة الدخول: تحميل البيانات، وتسجيل الشاشات، وفتح أولّها.

import * as data from './data.js';
import * as store from './store.js';
import * as audio from './audio.js';
import { defineRoutes, go, el, startClock, setDevMode, setPageRefResolver, setPageOpener, setNavigateHook } from './ui.js';

import trackScreen from './screens/track.js';
import homeScreen from './screens/home.js';
import { booksScreen, bookScreen } from './screens/books.js';
import quizScreen from './screens/quiz.js';
import customScreen from './screens/custom.js';
import tajweedScreen, { surahsScreen } from './screens/tajweed.js';
import reciteScreen from './screens/recite.js';
import flashcardsScreen from './screens/flashcards.js';
import accountScreen from './screens/account.js';
import { openPage, closePage, libraryScreen } from './screens/page-view.js';
import reviewScreen from './screens/review.js';
import searchScreen from './screens/search.js';
import masteredScreen from './screens/mastered.js';

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
});

startClock();
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

data.load()
  .then(() => {
    // أول شاشةٍ في التطبيق اختيارُ المسار، ولا يُتجاوَز إلا بعد اختياره.
    go(store.get().track ? 'home' : 'track');
  })
  .catch((err) => {
    screen.replaceChildren(el('div.empty', [
      el('span.head', 'تعذّر تحميل البيانات'),
      el('p.lede', String(err.message || err)),
      el('p.fine', 'شغّل المشروع عبر خادمٍ محليّ (npm start) لا بفتح الملف مباشرةً.'),
    ]));
  });
