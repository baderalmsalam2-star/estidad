-- بنيةُ قاعدةِ الإحصاء — لا اسمَ فيها ولا رقمَ هاتفٍ ولا بريد.
--
-- المعرِّفُ `device` رقمٌ عشوائيٌّ يولِّده الجهازُ لنفسه (UUID)، لا يُربَط بشخصٍ
-- ولا يُطلَب من أحد. وإن مسح الطالبُ بياناتِه وُلِّد غيرُه، فلا سبيلَ إلى تتبُّعِه.

-- كلُّ إجابةٍ مرّةً واحدة: آخِرُ درجةٍ لكلِّ (جهاز، سؤال).
-- الاستبدالُ عند التعارض يجعل الإرسالَ آمنَ التكرار: تُعاد الدفعةُ فلا تُضاعَف.
CREATE TABLE IF NOT EXISTS answers (
  device   TEXT    NOT NULL,
  question TEXT    NOT NULL,
  score    REAL    NOT NULL,
  track    TEXT    NOT NULL,
  at       INTEGER NOT NULL,
  PRIMARY KEY (device, question)
);

CREATE INDEX IF NOT EXISTS answers_question ON answers (question);
CREATE INDEX IF NOT EXISTS answers_at       ON answers (at);

-- أوّلُ ظهورٍ لكلِّ جهازٍ وآخِرُه — لعدِّ من دخل ومن واظب، لا لتتبُّعِ أحد.
CREATE TABLE IF NOT EXISTS devices (
  device TEXT    PRIMARY KEY,
  track  TEXT    NOT NULL,
  first  INTEGER NOT NULL,
  last   INTEGER NOT NULL
);

-- حدُّ التكرارِ اليوميّ — عدّادٌ لا سجلّ.
--
-- المشكلةُ التي يحلُّها: `/answers` مفتوحٌ بلا توثيق (ولا يمكن توثيقُه: التطبيقُ
-- ملفّاتٌ ساكنةٌ فأيُّ مفتاحٍ فيه مقروءٌ لمن فتحه). فحاسوبٌ واحدٌ يخترع UUID
-- جديداً في كلِّ طلبٍ فيُغرِق الجدولَ بصفوفٍ مصطنَعة، فتصير أرقامُ صاحبِ
-- التطبيقِ كلُّها من صنعِ المُرسِل — و`MAX_PER_DEVICE` لا يمنعه، لأنّ الجهازَ
-- عندَه جديدٌ كلَّ مرّة.
--
-- و`bucket` **ليس عنواناً ولا يُرَدُّ إلى عنوان**: هو تلخيصُ SHA-256 لعنوانِ
-- المُرسِلِ مقروناً بيومِه وبمِلحٍ سرّيٍّ في `env.IP_SALT`. فيتبدّل التلخيصُ
-- كلَّ يومٍ لنفسِ العنوان، ولا يُوصَل يومٌ بيومٍ ولا تُبنى منه سيرة. والصفوفُ
-- تُحذَف بعد يومَين فلا تتراكم.
CREATE TABLE IF NOT EXISTS quota (
  bucket TEXT    PRIMARY KEY,
  day    INTEGER NOT NULL,
  n      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS quota_day ON quota (day);
