# -*- coding: utf-8 -*-
"""
محرّك استخراج أحكام التجويد من الرسم العثماني (نصّ تنزيل المحقَّق)
المرجع المعتمد في تقرير الأحكام: غاية المريد في علم التجويد — عطية قابل نصر
(الكتاب المقرَّر من إدارة الشؤون الفنية بوزارة الأوقاف الكويتية)
"""
import re, json, unicodedata

# ===== الحركات والعلامات =====
FATHA, DAMMA, KASRA = '\u064E', '\u064F', '\u0650'
FATHATAN, DAMMATAN, KASRATAN = '\u064B', '\u064C', '\u064D'
SUKUN, SHADDA = '\u0652', '\u0651'
MADDAH = '\u0653'           # المدّة فوق الألف
SMALL_ALEF = '\u0670'        # ألف خنجرية
HAMZA_ABOVE, HAMZA_BELOW = '\u0654', '\u0655'
ALEF_WASLA = '\u0671'
TANWEEN = {FATHATAN, DAMMATAN, KASRATAN}
HARAKAT = {FATHA, DAMMA, KASRA} | TANWEEN
MARKS = HARAKAT | {SUKUN, SHADDA, MADDAH, SMALL_ALEF, HAMZA_ABOVE, HAMZA_BELOW,
                   '\u0656','\u0657','\u0658','\u0659','\u065A','\u065B','\u065C',
                   '\u06D6','\u06D7','\u06D8','\u06D9','\u06DA','\u06DB','\u06DC',
                   '\u06DD','\u06DE','\u06DF','\u06E0','\u06E1','\u06E2','\u06E3',
                   '\u06E4','\u06E5','\u06E6','\u06E7','\u06E8','\u06E9','\u06EA',
                   '\u06EB','\u06EC','\u06ED'}

HAMZAT = set('ءأإؤئٱآ')
SMALL_WAW, SMALL_YEH = '\u06E5', '\u06E6'
SMALL_ZERO, RECT_ZERO = '\u06DF', '\u06E0'
MEEM_IQLAB = {'\u06E2', '\u06ED'}
HAMZA_PLAIN = set('ءأإؤئ')

# ===== حروف الأحكام كما في غاية المريد =====
IDHHAR_HALQI = set('ءأإؤئهعحغخ')             # الإظهار الحلقي (ستة)
IDGHAM_GHUNNAH = set('ينمو')                  # الإدغام بغنة
IDGHAM_NO_GHUNNAH = set('لر')                 # الإدغام بغير غنة
IQLAB = set('ب')                              # الإقلاب
IKHFA = set('تثجدذزسشصضطظفقك')                # الإخفاء الحقيقي (خمسة عشر)
QALQALA = set('قطبجد')                        # قطب جد
ISTIALA = set('خصضغطقظ')                      # خص ضغط قظ
SHAMSIYYA = set('تثدذرزسشصضطظلن')             # اللام الشمسية
SUN_MOON_EXCL = set('ابجحخعغفقكموهيأإء')       # القمرية

MOON = SUN_MOON_EXCL


def strip_marks(s):
    return ''.join(c for c in s if c not in MARKS)


def tokenize(text):
    """يقسّم الآية كلماتٍ مع حفظ مواضعها."""
    words, i = [], 0
    for m in re.finditer(r'\S+', text):
        words.append({"w": m.group(0), "start": m.start(), "end": m.end()})
    return words


def letters_with_marks(word):
    """يرجع قائمة (حرف, [علاماته])"""
    out = []
    for ch in word:
        if ch in MARKS:
            if out:
                out[-1][1].append(ch)
        else:
            out.append([ch, []])
    return out


def is_madd_letter(letter, marks, prev_letter, prev_marks):
    """حرف مدّ: ألف ساكنة مفتوح ما قبلها، واو ساكنة مضموم ما قبلها، ياء ساكنة مكسور ما قبلها"""
    if letter == 'ا' and not (set(marks) & HARAKAT):
        return prev_marks and FATHA in prev_marks
    if letter == SMALL_ALEF:
        return True
    if letter == 'و' and SUKUN in marks or (letter == 'و' and not marks):
        return prev_marks and DAMMA in prev_marks
    if letter == 'ى' and not (set(marks) & HARAKAT):
        return prev_marks and KASRA in prev_marks
    if letter == 'ي' and (SUKUN in marks or not marks):
        return prev_marks and KASRA in prev_marks
    return False


def analyze_ayah(surah, ayah, text):
    rulings = []
    words = tokenize(text)

    for wi, wobj in enumerate(words):
        w = wobj['w']
        lm = letters_with_marks(w)
        nxt = words[wi+1]['w'] if wi+1 < len(words) else None
        nxt_lm = letters_with_marks(nxt) if nxt else []

        def add(rule, key, note, word=w, linked=None):
            rulings.append({
                "word": word, "wordIndex": wi, "rule": rule, "ruleKey": key,
                "note": note, "source": "auto",
                **({"linkedQuestion": linked} if linked else {})
            })

        for li, (ch, mk) in enumerate(lm):
            mks = set(mk)
            # تجاوز ألف التنوين الصامتة وألف الوصل عند طلب الحرف التالي
            j = li + 1
            while j < len(lm) and lm[j][0] in ('ا','ٱ') and not (set(lm[j][1]) & HARAKAT) and (mks & TANWEEN):
                j += 1
            if j < len(lm):
                nl, nmk, cross = lm[j][0], set(lm[j][1]), False
            elif nxt_lm:
                k = 0
                while k < len(nxt_lm) and nxt_lm[k][0] == 'ٱ':
                    k += 1
                if k < len(nxt_lm):
                    nl, nmk, cross = nxt_lm[k][0], set(nxt_lm[k][1]), True
                else:
                    nl, nmk, cross = None, set(), True
            else:
                nl, nmk, cross = None, set(), True
            prev_ch = lm[li-1][0] if li > 0 else None
            prev_mk = set(lm[li-1][1]) if li > 0 else set()

            # ---------- صلة هاء الضمير ----------
            if ch == 'ه' and (SMALL_WAW in mks or SMALL_YEH in mks):
                sw = "واو" if SMALL_WAW in mks else "ياء"
                if nl and nl in HAMZAT:
                    add("صلة كبرى", "silah_kubra",
                        f"هاء الضمير وُصِلت بـ{sw} وبعدها همزة — تُمدّ مدَّ المنفصل أربعاً أو خمساً",
                        linked="TJW-043")
                else:
                    add("صلة صغرى", "silah_sughra",
                        f"هاء الضمير وُصِلت بـ{sw} بين متحرّكين — تُمدّ حركتين، وهي من المدّ الأصلي",
                        linked="TJW-043")

            # ---------- الألف الزائدة ----------
            if SMALL_ZERO in mks:
                add("ألف زائدة", "alef_zaida",
                    "عليها دائرة صغيرة: ألف زائدة لا تُنطق وصلاً ولا وقفاً")
            if RECT_ZERO in mks:
                add("ألف تُنطق وقفاً", "alef_waqf_only",
                    "عليها مستطيل قائم: تُنطق عند الوقف دون الوصل")

            # ---------- الغنة المشدّدة ----------
            if ch in 'نم' and SHADDA in mks:
                add("غُنّة مشدّدة", "ghunnah_mushaddadah",
                    f"«{ch}» مشدّدة، تُغنّ بمقدار حركتين", linked="TJW-014")

            # ---------- النون الساكنة والتنوين ----------
            is_noon_sakin = (ch == 'ن' and SHADDA not in mks and not (mks & HARAKAT))
            has_tanween = bool(mks & TANWEEN)
            if (is_noon_sakin or has_tanween) and nl:
                base = "التنوين" if has_tanween else "النون الساكنة"
                if nl in IDHHAR_HALQI:
                    add("إظهار حلقي", "idhhar_halqi",
                        f"{base} وبعدها «{nl}» من حروف الحلق الستة", linked="TJW-007")
                elif nl in IDGHAM_GHUNNAH:
                    if not cross and is_noon_sakin:
                        add("إظهار مطلق", "idhhar_mutlaq",
                            f"اجتمعت النون الساكنة بـ«{nl}» في كلمة واحدة فوجب الإظهار",
                            linked="TJW-011")
                    else:
                        kind = "كامل" if nl in 'نم' else "ناقص"
                        add(f"إدغام بغنة ({kind})", "idgham_ghunnah",
                            f"{base} وبعدها «{nl}» من حروف (ينمو)", linked="TJW-042")
                elif nl in IDGHAM_NO_GHUNNAH:
                    add("إدغام بغير غنة", "idgham_no_ghunnah",
                        f"{base} وبعدها «{nl}»، إدغام كامل بذهاب الحرف والصفة", linked="TJW-042")
                elif nl in IQLAB:
                    add("إقلاب", "iqlab",
                        f"{base} وبعدها الباء، تُقلب ميماً مخفاة بغنة", linked="TJW-009")
                elif nl in IKHFA:
                    add("إخفاء حقيقي", "ikhfa_haqiqi",
                        f"{base} وبعدها «{nl}» من حروف الإخفاء الخمسة عشر", linked="TJW-041")

            # ---------- الميم الساكنة ----------
            if ch == 'م' and SHADDA not in mks and not (mks & HARAKAT) and nl:
                if nl == 'ب':
                    add("إخفاء شفوي", "ikhfa_shafawi",
                        "ميم ساكنة وبعدها الباء", linked="TJW-012")
                elif nl == 'م':
                    add("إدغام شفوي", "idgham_shafawi",
                        "ميم ساكنة وبعدها ميم، إدغام متماثلين بغنة", linked="TJW-012")
                else:
                    if nl in 'وف':
                        add("إظهار شفوي", "idhhar_shafawi",
                            f"ميم ساكنة وبعدها «{nl}» — يجب المبالغة في الإظهار", linked="TJW-013")

            # ---------- القلقلة ----------
            if ch in QALQALA and (SUKUN in mks or (not mks and li+1 >= len(lm))):
                kind = "كبرى" if (li+1 >= len(lm) and wi == len(words)-1) else "صغرى"
                add(f"قلقلة {kind}", "qalqala",
                    f"«{ch}» من حروف (قطب جد) ساكنة", linked="TJW-027")

            # ---------- الألف الخنجرية (ٰ) حرف مدّ محمول على الحرف ----------
            if SMALL_ALEF in mks:
                if li+1 >= len(lm) and wi == len(words)-1:
                    add("مدّ عارض للسكون", "madd_arid",
                        "ألف خنجرية آخر الآية — عند الوقف يجوز القصر والتوسط والطول",
                        linked="TJW-019")
                elif nl and nl in HAMZAT:
                    add("مدّ جائز منفصل" if cross else "مدّ واجب متصل",
                        "madd_munfasil" if cross else "madd_muttasil",
                        "ألف خنجرية بعدها همزة", linked="TJW-017" if cross else "TJW-016")
                else:
                    add("مدّ طبيعي", "madd_tabii",
                        "ألف خنجرية لا سبب بعدها — تُمدّ حركتين", linked="TJW-050")

            # ---------- المدود ----------
            if is_madd_letter(ch, mk, prev_ch, prev_mk):
                if nl and nl in HAMZAT:
                    if not cross:
                        add("مدّ واجب متصل", "madd_muttasil",
                            "حرف مدّ بعده همزة في كلمة واحدة — يُمدّ أربع أو خمس حركات",
                            linked="TJW-016")
                    else:
                        add("مدّ جائز منفصل", "madd_munfasil",
                            "حرف مدّ آخر الكلمة وهمزة أول التالية — يُمدّ أربع أو خمس حركات",
                            linked="TJW-017")
                elif nl and (SHADDA in nmk):
                    add("مدّ لازم كلمي مثقّل", "madd_lazim_muthaqqal",
                        "حرف مدّ بعده سكون أصلي مدغم — يُمدّ ستّ حركات لزوماً",
                        linked="TJW-018")
                elif nl and SUKUN in nmk and not cross:
                    add("مدّ لازم كلمي مخفّف", "madd_lazim_mukhaffaf",
                        "حرف مدّ بعده سكون أصلي غير مدغم — يُمدّ ستّ حركات",
                        linked="TJW-018")
                elif li+1 >= len(lm) and wi == len(words)-1:
                    add("مدّ عارض للسكون", "madd_arid",
                        "حرف مدّ آخر الآية — عند الوقف يجوز القصر والتوسط والطول",
                        linked="TJW-019")
                else:
                    add("مدّ طبيعي", "madd_tabii",
                        "لا سبب بعده من همز ولا سكون — يُمدّ حركتين", linked="TJW-050")

            # ---------- مدّ البدل ----------
            if ch in HAMZA_PLAIN or ch == 'ٱ':
                if li+1 < len(lm):
                    n2, n2m = lm[li+1][0], set(lm[li+1][1])
                    if MADDAH in mks or (n2 in 'اوى' and not (n2m & HARAKAT)):
                        add("مدّ بدل", "madd_badal",
                            "تقدّم الهمز على حرف المدّ في كلمة واحدة — يُمدّ حركتين",
                            linked="TJW-020")

            # ---------- مدّ اللين ----------
            if ch in 'وي' and (SUKUN in mks or not mks) and prev_mk and FATHA in prev_mk:
                if li+1 >= len(lm) and wi == len(words)-1:
                    add("مدّ لين", "madd_leen",
                        f"«{ch}» ساكنة مفتوح ما قبلها وبعدها سكون عارض بالوقف",
                        linked="TJW-044")

            # ---------- لام لفظ الجلالة ----------
            if ch == 'ل' and SHADDA in mks and li >= 2:
                seg = strip_marks(w)
                if seg.startswith('ٱلل') or seg.startswith('الل'):
                    if 'ه' in seg[:5]:
                        prevw = words[wi-1]['w'] if wi > 0 else None
                        prv = letters_with_marks(prevw)[-1][1] if prevw else []
                        if KASRA in prv or KASRATAN in prv:
                            add("ترقيق لام الجلالة", "lam_tarqeeq",
                                "سُبق لفظ الجلالة بكسر فتُرقَّق اللام", linked="TJW-035")
                        else:
                            add("تفخيم لام الجلالة", "lam_tafkheem",
                                "سُبق لفظ الجلالة بفتح أو ضم فتُفخَّم اللام", linked="TJW-035")

            # ---------- اللام الشمسية والقمرية ----------
            if ch in 'اٱ' and li+1 < len(lm) and lm[li+1][0] == 'ل' and li == 0:
                if li+2 < len(lm):
                    after = lm[li+2][0]
                    lmarks = set(lm[li+1][1])
                    if SHADDA in set(lm[li+2][1]) and after in SHAMSIYYA:
                        add("لام شمسية", "lam_shamsiyya",
                            f"«ال» وبعدها «{after}» فتُدغم اللام", linked="TJW-037")
                    elif SUKUN in lmarks and after in MOON:
                        add("لام قمرية", "lam_qamariyya",
                            f"«ال» وبعدها «{after}» فتُظهر اللام")

            # ---------- التفخيم (حروف الاستعلاء) ----------
            if ch in ISTIALA:
                add("تفخيم", "tafkheem_istiala",
                    f"«{ch}» من حروف الاستعلاء (خص ضغط قظ) فتُفخَّم")

    # إزالة التكرار المتطابق
    seen, out = set(), []
    for r in rulings:
        k = (r['wordIndex'], r['ruleKey'], r['word'])
        if k not in seen:
            seen.add(k); out.append(r)
    return out


# ===== جدول الاستثناءات المُعدّ يدوياً =====
# مستخرَج من: غاية المريد في علم التجويد — عطية قابل نصر
# (فصل "ما انفرد به حفص" ص١٠٠، وباب السكت، وباب الوقف والابتداء)
# ملاحظة: أكثر انفرادات حفص واقعةٌ خارج جزء عمّ، فلم تُدرَج هنا.

MANUAL = {
  # ── السكت ──
  # مواضع السكت لحفص أربعة، الواقع منها في جزء عمّ موضعٌ واحد.
  "83:14": [{
    "word": "بَلْ ۜ رَانَ", "rule": "سكتة لطيفة", "ruleKey": "sakt",
    "note": "من مواضع السكت الأربعة لحفص من طريق الشاطبية (عوجا، مرقدنا، من راق، بل ران) — "
            "سكتةٌ لطيفةٌ بلا تنفّس دفعاً لتوهُّم الإدغام. ونصّ غاية المريد على أن تركَ السكت "
            "في هذه المواضع الأربعة من انفرادات الطريق الآخر.",
    "source": "manual", "reference": "غاية المريد ص١٠٠", "linkedQuestion": "TJW-029"}],

  # ── الصاد والسين ──
  "88:22": [{
    "word": "بِمُصَۣيْطِرٍ", "rule": "جواز الصاد والسين", "ruleKey": "sad_seen",
    "note": "نصّ غاية المريد: «جواز قراءة ﴿مصيطر﴾ بالغاشية بالسين أو الصاد». "
            "والمرسوم صادٌ عليها سينٌ صغيرة. وقيّده الكتاب: إن قُرئ بالإظهار في ﴿يس ۝ وَالْقُرْآنِ﴾ "
            "و﴿ن﴾ تعيّنت الصادُ فقط، وإن قُرئ بالإدغام تعيّنت السينُ فقط.",
    "source": "manual", "reference": "غاية المريد ص١٠٠"}],
}

# ملاحظات عامة على جزء عمّ (لا تخصّ آيةً بعينها):
JUZ_AMMA_NOTES = [
  "لا توجد في جزء عمّ فواتحُ حروفيّةٌ، فلا مدَّ لازمٌ حرفيٌّ فيه البتّة.",
  "لا إمالةَ لحفص في جزء عمّ؛ إمالتُه الوحيدة في ﴿مَجْرَاهَا﴾ بهود.",
  "لا تسهيلَ في جزء عمّ؛ تسهيلُ حفص في ﴿ءَاأَعْجَمِيٌّ﴾ بفصّلت.",
  "من مواضع السكت الأربعة لا يقع في جزء عمّ إلا ﴿بَلْ ۜ رَانَ﴾ بالمطفّفين.",
  "الروم والإشمام جائزان عند الوقف على المضموم والمكسور في جزء عمّ كغيره.",
]
