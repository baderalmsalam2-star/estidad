# -*- coding: utf-8 -*-
"""
يحسب زخرفةَ الزَلِّيج ويُثبِّتها في `assets/css/app.css`.

    python3 tools/زخرفة_الأرض.py

ويُخرِج نمطَين من الشكلِ نفسِه:
  • **الأرض** — حولَ الورقةِ في اللوحيِّ والحاسوب، بنغماتٍ ظاهرةٍ تُعطي الطابع.
  • **الورق** — علامةً مائيّةً خلفَ ترويسةِ الرئيسية، بفرقٍ ضئيلٍ جدّاً: تُلمَح
    ولا تُقرَأ، فلا تُزاحم الحرفَ فوقها.

والزخرفةُ تُحسَب ولا تُخَطُّ بيدٍ: مواضعُ الرؤوسِ مثلَّثيّة، ولو نُقِلت أرقامُها
نقلاً لانفصلت البلاطاتُ عند التكرار. وهي `data:` في الـCSS لا ملفَّ صورة، فلا
طلبَ شبكةٍ لها ولا سطرَ في عامل الخدمة.

── النمط ────────────────────────────────────────────────────────────────
زَلِّيجٌ على أصله: **بلاطاتٌ مصمَتةٌ متلاصقة** لا خطوطٌ مرسومة. فالمعلّمُ يقطع
قطعَ الفخّار ويُلاصقها، فتُقرَأ أشكالاً ملوَّنةً يفصلها الجِبسُ، لا شبكةَ أسلاك.

وهو «الخاتَمُ والصليب»: نجومٌ ثمانيّةٌ على شبكةٍ مربّعة، تتلاقى رؤوسُها
المستقيمةُ عند منتصفِ ضلعِ الشبكةِ فتتماسّ، وما بقي بينها صليبٌ رباعيٌّ يملؤه.
فلا يبقى في السطحِ موضعٌ فارغ — وهذا هو الذي يُعطي الطابعَ، لا كثرةُ الخطوط.
"""

import math
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
CSS = ROOT / 'assets' / 'css' / 'app.css'

P = 150.0                  # دورةُ الشبكة
RS = P / 2                 # رأسُ النجمِ يبلغ منتصفَ ضلعِ الشبكةِ فيلتقي بجاره
RIN = RS * 0.54            # حِضنُ النجم
RC = P * 0.2071            # رأسُ الصليبِ يبلغ ما بين النجمين على القُطر
RCIN = RC * 0.42


def star(cx, cy, rout, rin, n, phase):
    ps = []
    for i in range(2 * n):
        r = rout if i % 2 == 0 else rin
        a = phase + i * math.pi / n
        ps.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in ps) + 'Z'


STARS = ''.join(star(cx, cy, RS, RIN, 8, 0)
                for cx, cy in ((0, 0), (P, 0), (0, P), (P, P)))
CROSSES = star(P / 2, P / 2, RC, RCIN, 4, math.pi / 4)


def tile(ground, star_c, cross_c):
    body = ''
    if ground:
        body += f"<rect width='{P:.0f}' height='{P:.0f}' fill='{ground}'/>"
    body += f"<path d='{STARS}' fill='{star_c}'/><path d='{CROSSES}' fill='{cross_c}'/>"
    svg = (f"<svg xmlns='http://www.w3.org/2000/svg' width='{P:.0f}' height='{P:.0f}' "
           f"viewBox='0 0 {P:.0f} {P:.0f}'>{body}</svg>")
    return quote(svg, safe="/:='<>()#.,-").replace('#', '%23')


GROUND = tile('#e8e2d7', '#dcd4c3', '#d3c9b4')
PAPER = tile(None, '#eee7d9', '#e8e0d0')

BEGIN = '/* @@زخرفة-الورق@@ */'
END = '/* @@نهاية@@ */'


def main():
    s = CSS.read_text(encoding='utf-8')

    m = re.search(r'    background-image: url\("data:image/svg\+xml,.*?"\);\n'
                  r'    background-size: [\d.]+px [\d.]+px;\n', s, re.S)
    if not m:
        raise SystemExit('لم أجد موضعَ زخرفةِ الأرضِ في app.css')
    s = (s[:m.start()]
         + f'    background-image: url("data:image/svg+xml,{GROUND}");\n'
         + f'    background-size: {P:.0f}px {P:.0f}px;\n'
         + s[m.end():])

    block = (f'{BEGIN}\n'
             ':root {\n'
             f'  --zellij: url("data:image/svg+xml,{PAPER}");\n'
             f'  --zellij-size: {P:.0f}px {P:.0f}px;\n'
             '}\n'
             f'{END}\n')
    old = re.search(re.escape(BEGIN) + r'.*?' + re.escape(END) + r'\n', s, re.S)
    if old:
        s = s[:old.start()] + block + s[old.end():]
    else:
        anchor = '* { margin: 0; padding: 0; box-sizing: border-box; }\n'
        s = s.replace(anchor, block + '\n' + anchor, 1)

    CSS.write_text(s, encoding='utf-8')
    print(f'أُثبِتت — الأرض {len(GROUND)} محرفاً · الورق {len(PAPER)}')


if __name__ == '__main__':
    main()
