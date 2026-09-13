# -*- coding: utf-8 -*-
"""
يرسم غلافَ كلِّ كتابٍ مرفوعٍ في `books/` — أي صفحتَه الأولى — صورةً صغيرة.

    python3 tools/أغلفة_الكتب.py

والمخرَجُ صورةٌ لكلِّ كتابٍ في `books/covers/`، وفهرسٌ في `data/covers.json`
يقرؤه التطبيقُ ليعرفَ أيُّ كتابٍ له غلافٌ وأيُّها ليس له.

ولمَ الفهرسُ ولا يُجرَّب الرابطُ رأساً؟ لأنّ ثلاثةً من الكتب السبعةِ لم تُرفَع
ملفّاتُها بعدُ، فطلبُ غلافٍ لها يرجع ٤٠٤ في كلِّ فتحة، ويُخزَّن الخطأُ في عامل
الخدمة. والفهرسُ يُجنِّب ذلك: ما ليس فيه يُرسَم له غلافٌ مكتوبٌ بالخطِّ في
التطبيق نفسِه، بلا طلبِ شبكةٍ أصلاً.

والصورةُ تُصغَّر عمداً (عرضُها ٣٠٠ بكسل): أكبرُ ما تُعرَض فيه ٩٦ بكسلاً على
شاشةٍ مضاعَفةِ الكثافة، وكلُّ زيادةٍ بعد ذلك وزنٌ يحمله الطالبُ بلا فائدة.
"""

import json
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
BOOKS = ROOT / 'books'
OUT = BOOKS / 'covers'
INDEX = ROOT / 'data' / 'covers.json'

WIDTH = 300          # عرضُ الصورة بالبكسل
QUALITY = 80

# ملفّاتٌ صُوِّرت من نسخةٍ بلا غلاف، فأوّلُ صفحةٍ فيها متنٌ لا غلاف. نُظِرَ في
# أوائلها صفحةً صفحةً فلم يوجد. وغلافٌ كاذبٌ أسوأُ من لا غلاف: يظنُّه الطالبُ
# غلافَ الكتابِ فيطلبه بهذا الشكلِ عند الوكيل.
NO_COVER = {
    'daleel-altalib': 'الملفُّ يبدأ بمتن المقدّمة — لا غلافَ في النسخة',
}


def render(pdf):
    slug = pdf.stem
    if slug in NO_COVER:
        print(f'{slug}: {NO_COVER[slug]} — يُكتَب غلافُه في التطبيق')
        return None
    doc = fitz.open(pdf)
    if not doc.page_count:
        print(f'{slug}: ملفٌّ بلا صفحات — تُخُطِّي')
        return None
    page = doc.load_page(0)
    zoom = WIDTH / page.rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), colorspace=fitz.csRGB)
    dst = OUT / f'{slug}.jpg'
    pix.pil_save(dst, format='JPEG', quality=QUALITY, optimize=True)
    doc.close()
    print(f'{slug}: {pix.width}×{pix.height} — {dst.stat().st_size // 1024} ك.ب')
    return f'books/covers/{slug}.jpg'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    covers = {}
    for pdf in sorted(BOOKS.glob('*.pdf')):
        path = render(pdf)
        if path:
            covers[pdf.stem] = path

    INDEX.write_text(json.dumps(covers, ensure_ascii=False, indent=2) + '\n',
                     encoding='utf-8')
    print(f'\n{INDEX.relative_to(ROOT)}: {len(covers)} غلافاً')


if __name__ == '__main__':
    main()
