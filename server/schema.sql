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
