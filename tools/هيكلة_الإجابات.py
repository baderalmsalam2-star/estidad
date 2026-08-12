"""يفصل بنود الجواب عن قيوده، ليصير الفحص الآليّ ممكناً.

العلّة: `keyPoints` يخلط المعدودَ بالقيد. فموجبات الغسل «سبعة» وبنودها تسعة،
لأن فيها «العدد: سبعة» و«لا يجب إلا على ابن عشرٍ وبنت تسع» — وهذا قيدٌ لا موجِب.
فأيُّ فحصٍ آليٍّ للعدد يفشل، وأيُّ ترقيمٍ للبطاقة يُعلّم الطالب عدداً خاطئاً.

المخرَج حقلٌ **مضاف** اسمه `answer` بجانب `keyPoints`، لا بديلٌ عنه:

    "answer": { "count": 7, "countWord": "سبعة", "items": [...], "caveats": [...] }

والقاعدة الحاكمة: **لا يُخمَّن.** لا يُفصَل قيدٌ إلا إذا استقام العدد بفصله
بالضبط. وما لم يستقم تُرِك بلا هيكلة وسُجِّل في التقرير.

    python3 tools/هيكلة_الإجابات.py            # عرضٌ فقط
    python3 tools/هيكلة_الإجابات.py --apply    # يكتب حقل answer
"""

import json, re, sys, glob, pathlib, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent

WORD2N = {
    'اثنان': 2, 'اثنين': 2, 'ثلاثة': 3, 'ثلاث': 3, 'أربعة': 4, 'أربع': 4,
    'خمسة': 5, 'خمس': 5, 'ستة': 6, 'ست': 6, 'سبعة': 7, 'سبع': 7,
    'ثمانية': 8, 'ثمان': 8, 'تسعة': 9, 'تسع': 9, 'عشرة': 10, 'عشر': 10,
    'أحد عشر': 11, 'اثنا عشر': 12, 'خمس عشرة': 15, 'سبع عشرة': 17,
}

# ما يبدأ به القيدُ غالباً: نفيٌ، أو اشتراط، أو استثناء.
CAVEAT_START = re.compile(
    r'^\s*(لا\s|ولا\s|لكن|ولكن|إلا\s|ويشترط|يشترط|بشرط|وبشرط|شرطه|ويُشترط|'
    r'ولو\s|وأما\s|أما\s|ويجوز|لا يجب|ولا يجب|ولا يصح|تنبيه|ملاحظة)')

TASH = re.compile(r'[ً-ْٰـ]')


def bare(s):
    return re.sub(r'\s+', ' ', TASH.sub('', str(s))).strip()


def stated_count(points):
    """يقرأ «العدد: سبعة» من أول بندٍ إن وُجد."""
    if not points:
        return None, None, False
    m = re.match(r'^\s*العدد\s*[:：]\s*(.+)$', bare(points[0]))
    if not m:
        return None, None, False
    text = m.group(1)
    for word, n in sorted(WORD2N.items(), key=lambda x: -len(x[0])):
        if word in text:
            return n, word, True
    return None, text, True       # ذُكر عددٌ بلفظٍ لا نعرفه


def structure(points):
    """يعيد (البنية، سببُ التعذُّر) — ولا يُخمِّن."""
    count, word, has_header = stated_count(points)
    body = points[1:] if has_header else list(points)

    if count is None:
        return None, ('بلا عددٍ مصرَّح' if not has_header else f'لفظُ عددٍ غير معروف: {word}')

    if len(body) == count:
        return {'count': count, 'countWord': word, 'items': body, 'caveats': []}, None

    if len(body) < count:
        return None, f'البنود {len(body)} أقلّ من العدد {count}'

    # الزائد يجب أن يكون قيوداً — ولا يُقبَل إلا إذا استقام العدد بالضبط.
    extra = len(body) - count
    caveats = [p for p in body if CAVEAT_START.match(bare(p))]
    if len(caveats) != extra:
        return None, f'الزائد {extra} والقيود المكتشَفة {len(caveats)}'

    items = [p for p in body if p not in caveats]
    if len(items) != count:
        return None, 'الفصل لم يستقم'
    return {'count': count, 'countWord': word, 'items': items, 'caveats': caveats}, None


def main():
    apply_changes = '--apply' in sys.argv
    stats = collections.Counter()
    touched, failures = {}, []

    for path in sorted(glob.glob(str(ROOT / 'data' / 'banks' / '*.json'))):
        bank = json.load(open(path, encoding='utf-8'))
        changed = False
        for q in bank['questions']:
            points = q.get('keyPoints') or []
            if len(points) < 2:
                stats['بلا نقاطٍ كافية'] += 1
                continue
            built, why = structure(points)
            if not built:
                stats['تعذّرت هيكلته'] += 1
                if why and 'بلا عددٍ' not in why:
                    failures.append((q['id'], why, q['question'][:44]))
                continue
            q['answer'] = built
            stats['هُيكل'] += 1
            stats['بقيود' if built['caveats'] else 'بلا قيود'] += 1
            changed = True
        if changed:
            touched[path] = bank

    print('— ما تعذّر لسببٍ يستحقّ النظر —')
    for i, why, t in failures[:20]:
        print(f"  {i:<13}{why:<34}{t}")
    if len(failures) > 20:
        print(f"  … و{len(failures) - 20} غيرها")

    print('\n— الخلاصة —')
    for k, v in stats.most_common():
        print(f"  {k}: {v}")

    if not apply_changes:
        print(f"\nعرضٌ فقط. أضف --apply للكتابة في {len(touched)} بنكاً.")
        return
    for path, bank in touched.items():
        pathlib.Path(path).write_text(
            json.dumps(bank, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f"\nكُتب في {len(touched)} بنكاً.")


if __name__ == '__main__':
    main()
