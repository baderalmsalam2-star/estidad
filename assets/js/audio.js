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

/** يُنادى عند الإقلاع: يمسح ما تجاوز ٣٠ يوماً. */
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

/** أفضل صيغة يدعمها المتصفّح — Opus مقدَّمٌ لأن الكلام لا يحتاج جودة موسيقية. */
export function pickMime() {
  const wanted = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return wanted.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
}

export const canRecord = () =>
  !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
