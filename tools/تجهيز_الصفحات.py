"""يُجهّز صفحات الكتب لوحاتٍ رباعيةً لتُقرأ بصرياً، ويتابع ما أُنجز.

توليد الأسئلة من صفحة الكتاب هو الطريق الوحيد الذي نجح: النصّ المستخرَج بالـOCR
ممسوخٌ فتنكسر عليه الأنماط، ورفعُ دقّة المسح لم يُجدِ. أما قراءة الصورة فدقيقة.

وقراءة صفحةٍ واحدةً في المرة بطيئة، فتُجمَع **أربع صفحاتٍ في لوحةٍ واحدة**
مرتَّبةً من اليمين — وقد جُرِّبت فقُرئت بتشكيلها وحواشيها.

    python3 tools/تجهيز_الصفحات.py daleel-altalib 33 48   # يُجهّز اللوحات
    python3 tools/تجهيز_الصفحات.py --حالة                  # يعرض ما أُنجز

المخرَج في `work/tiles/`، وهو مجلّدٌ مؤقّتٌ لا يُرفَع.
"""

import json, sys, pathlib
import pymupdf

ROOT = pathlib.Path(__file__).resolve().parent.parent
TILES = ROOT / 'work' / 'tiles'
PROGRESS = ROOT / 'data' / 'generation-progress.json'

PER_TILE, COLS, DPI = 4, 2, 110


def progress():
    if PROGRESS.exists():
        return json.loads(PROGRESS.read_text(encoding='utf-8'))
    return {'_note': 'الصفحات التي قُرئت وولِّدت منها أسئلة. يُحدَّث يدوياً عند كل دفعة.',
            'books': {}}


def save(p):
    PROGRESS.write_text(json.dumps(p, ensure_ascii=False, indent=1), encoding='utf-8')


def make_tiles(book, first, last):
    pdf = ROOT / 'books' / f'{book}.pdf'
    if not pdf.exists():
        print(f"لا ملفّ: {pdf.name}")
        return
    doc = pymupdf.open(pdf)
    last = min(last, doc.page_count)
    TILES.mkdir(parents=True, exist_ok=True)

    pages = list(range(first, last + 1))
    for i in range(0, len(pages), PER_TILE):
        chunk = pages[i:i + PER_TILE]
        pix = [doc[p - 1].get_pixmap(dpi=DPI) for p in chunk]
        w, h = pix[0].width, pix[0].height
        rows = (len(pix) + COLS - 1) // COLS
        canvas = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, w * COLS, h * rows))
        canvas.clear_with(255)
        for j, p in enumerate(pix):
            col = COLS - 1 - (j % COLS)      # من اليمين، كترتيب القراءة
            p.set_origin(col * w, (j // COLS) * h)
            canvas.copy(p, p.irect)
        out = TILES / f'{book}-{chunk[0]}-{chunk[-1]}.png'
        canvas.save(out)
        print(f"  {out.name}  {canvas.width}×{canvas.height}")


def show():
    p = progress()
    total_done = 0
    print(f"{'الكتاب':<20}{'صفحات':>8}{'أُنجز':>8}{'٪':>6}")
    for book, info in p['books'].items():
        pdf = ROOT / 'books' / f'{book}.pdf'
        n = pymupdf.open(pdf).page_count if pdf.exists() else info.get('pages', 0)
        done = len(info.get('done', []))
        total_done += done
        print(f"{book:<20}{n:>8}{done:>8}{(done * 100 // n if n else 0):>5}٪")
    print(f"\nالمجموع المنجَز: {total_done} صفحة")


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if '--حالة' in sys.argv or not args:
        show()
    else:
        make_tiles(args[0], int(args[1]), int(args[2]))
