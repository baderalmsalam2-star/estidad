"""استخراج نصّ ميثاق المسجد بالـOCR، بنفس صيغة فواصل الصفحات في sources/."""
import pymupdf, subprocess, tempfile, os, sys

SRC, OUT = 'meethaq.pdf', 'ميثاق_المسجد_نص_كامل.txt'
doc = pymupdf.open(SRC)
parts = []
for i in range(doc.page_count):
    png = tempfile.NamedTemporaryFile(suffix='.png', delete=False).name
    doc[i].get_pixmap(dpi=300).save(png)
    r = subprocess.run(['tesseract', png, '-', '-l', 'ara', '--psm', '3'],
                       capture_output=True, text=True)
    os.unlink(png)
    body = '\n'.join(l for l in r.stdout.splitlines() if l.strip())
    parts.append(f"==================== صفحة {i+1} ====================\n{body}\n")
    print(f"ص{i+1}/{doc.page_count} — {len(body)} حرف", flush=True)

open(OUT, 'w', encoding='utf-8').write('\n'.join(parts))
print("تمّ:", OUT, os.path.getsize(OUT), "بايت")
