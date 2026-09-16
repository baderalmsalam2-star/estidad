// تسجيلات التسميع — على جهاز الطالب وحده، وتُحذف تلقائياً بعد ٣٠ يوماً.
// لا رفعَ إلى أي خادم إلا بفعلٍ صريحٍ من الطالب (SPEC §٧).

const DB_NAME = 'awqaf-prep-audio';
const STORE = 'recordings';
const TTL_DAYS = 30;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export async function save(key, blob) {
  const db = await open();
  await tx(db, 'readwrite', (s) => s.put({ key, blob, at: Date.now() }));
  db.close();
}

export async function load(key) {
  const db = await open();
  const row = await tx(db, 'readonly', (s) => s.get(key));
  db.close();
  return row?.blob || null;
}

/**
 * يُنادى عند الإقلاع: يمسح ما تجاوز ٣٠ يوماً.
 *
 * ── وحدُّ الثلاثين شرطُه أن يُفتَح التطبيق ──────────────────────────────
 *
 * وكان يُقال للطالبِ في «حسابي»: «تسجيلات التسميع تُحذف تلقائياً بعد ٣٠
 * يوماً» — مُطلَقاً بلا قيد. وليس كذلك: لا مُجدوِلَ في صفحةِ وِبّ، فالمحوُ
 * يقع عند **أوّلِ فتحةٍ بعد** مضيِّ المدّة. فمن سجّل ثمّ ترك التطبيقَ سنةً
 * بقي صوتُه في جهازه سنةً كاملة — والوعدُ يقول إنّه مُحي منذ أحدَ عشرَ شهراً.
 *
 * فصُحِّح الوعدُ في موضعه، وأُضيف `wipe()` يُنادى من زرٍّ صريحٍ في «حسابي»
 * لمن أراد المحوَ الآن. والقدرةُ على المحوِ في يدِه خيرٌ من وعدٍ بأجل.
 */
export async function sweep() {
  try {
    const db = await open();
    const cutoff = Date.now() - TTL_DAYS * 86_400_000;
    const rows = await tx(db, 'readonly', (s) => s.getAll());
    const stale = (rows || []).filter((r) => r.at < cutoff);
    if (stale.length) await tx(db, 'readwrite', (s) => { stale.forEach((r) => s.delete(r.key)); return null; });
    db.close();
  } catch {
    /* المتصفّح قد يمنع IndexedDB في التصفّح الخاص — التطبيق يعمل بلا تسجيل */
  }
}

/**
 * يمسح التسجيلاتِ كلَّها — يُنادى من `store.reset` عند «امسح تقدّمي».
 *
 * وكان «امسح تقدّمي» يمحو `localStorage` ومعرِّفَ الإحصاءِ ويترك هذه القاعدةَ
 * كما هي: صوتُ الطالبِ يقرأ القرآنَ باقٍ في جهازه بعدَ أن قيل له «سيُمحى
 * تقدّمك كلّه من هذا الجهاز» وأجاب «أمتأكّد؟» بنعم. وهو أخصُّ ما في التطبيقِ
 * من بياناته — لا درجةٌ ولا عدّادٌ، بل صوتُه — وأبقاه الذي وَعَد بمحوه.
 *
 * وتُمحى القاعدةُ كلُّها لا صفوفُها: `deleteDatabase` لا يُبقي أثراً ولا حجماً.
 */
export function wipe() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      // قاعدةٌ مفتوحةٌ في لسانٍ آخَر تحجُب الحذفَ ولا تُخفِقه، فلا يُنتظَر أبداً.
      req.onblocked = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** أفضل صيغة يدعمها المتصفّح — Opus مقدَّمٌ لأن الكلام لا يحتاج جودة موسيقية. */
export function pickMime() {
  const wanted = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return wanted.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
}

export const canRecord = () =>
  !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
