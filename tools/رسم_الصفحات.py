"""يرسم صفحات الكتب المستشهَد بها صوراً خفيفة، ليراها الطالب فوراً.

فتحُ الكتاب كاملاً يعني تنزيل ملفٍّ بالميغابايتات. أما صورة الصفحة الواحدة
فنحو ٥٠ كيلوبايت، فتظهر في لمح البصر — وهذا هو الفرق كلّه على شبكة الجوال.

    python3 tools/رسم_الصفحات.py
"""

import json, re, glob, pathlib, collections
import pymupdf

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'books' / 'pages'
DPI, QUALITY = 120, 55          # ٥٢ ك.ب للصفحة تقريباً، وواضحةٌ على الجوال

# العلم → مُعرِّف الكتاب. وما لا PDF له لا يُرسَم.
SUBJECT_BOOK = {
    'الفقه': 'daleel-altalib', 'التجويد': 'ghayat-almureed',
    'النحو': 'tuhfa-saniyya', 'ميثاق المسجد': 'meethaq-almasjid',
    'العقيدة': 'bareeq-aljuman', 'التفسير': 'zubdat-altafseer',
}
AR = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')


def pages_in(label):
    """«ص٢٨-٣١» → [28, 29, 30, 31]"""
    nums = [int(x.translate(AR)) for x in re.findall(r'[٠-٩]+', label)]
    if not nums:
        return []
    lo, hi = nums[0], (nums[1] if len(nums) > 1 else nums[0])
    return list(range(lo, hi + 1)) if hi >= lo else [lo]


def wanted():
    """كل صفحةٍ يشير إليها سؤالٌ — موثَّقةً كانت أو مرشَّحة."""
    need = collections.defaultdict(set)
    for f in sorted(glob.glob(str(ROOT / 'data' / 'banks' / '*.json'))):
        bank = json.load(open(f, encoding='utf-8'))
        for q in bank['questions']:
            book = SUBJECT_BOOK.get(q.get('subject') or bank.get('subject'))
            if book and q.get('bookPage'):
                need[book].update(pages_in(q['bookPage']))

    hints = ROOT / 'data' / 'page-hints.json'
    if hints.exists():
        for h in json.load(open(hints, encoding='utf-8')).values():
            need[h['book']].add(h['page'])
    return need


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    need = wanted()
    index, total_bytes, missing = {}, 0, []

    for book, pages in sorted(need.items()):
        pdf = ROOT / 'books' / f'{book}.pdf'
        if not pdf.exists():
            missing.append((book, len(pages)))
            continue
        doc = pymupdf.open(pdf)
        drawn = []
        for p in sorted(pages):
            if not (1 <= p <= doc.page_count):
                continue                      # استشهادٌ خارج حدود الكتاب
            pix = doc[p - 1].get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY)
            data = pix.tobytes('jpeg', jpg_quality=QUALITY)
            (OUT / f'{book}-{p}.jpg').write_bytes(data)
            total_bytes += len(data)
            drawn.append(p)
        index[book] = {'pages': drawn, 'count': doc.page_count}
        print(f"  {book}: رُسمت {len(drawn)} من {len(pages)} صفحة")

    (ROOT / 'books' / 'pages-index.json').write_text(
        json.dumps(index, ensure_ascii=False), encoding='utf-8')

    print(f"\nالمجموع: {sum(len(v['pages']) for v in index.values())} صورة، "
          f"{total_bytes // 1024} ك.ب")
    for book, n in missing:
        print(f"  ⚠ {book}: {n} صفحةً مطلوبةً بلا ملفّ PDF")


if __name__ == '__main__':
    main()
