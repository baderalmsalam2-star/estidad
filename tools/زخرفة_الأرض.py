# -*- coding: utf-8 -*-
"""
يحسب زخرفةَ أرضِ الصفحةِ ويُثبِّتها في `assets/css/app.css`.

    python3 tools/زخرفة_الأرض.py

والزخرفةُ تُحسَب ولا تُخَطُّ بيدٍ: الرؤوسُ مواضعُها مثلَّثيّةٌ، فلو نُقِلت
أرقامُها نقلاً لانفصلت البلاطاتُ عند التكرار. وهي `data:` في الـCSS لا ملفَّ
صورة، فلا طلبَ شبكةٍ لها ولا سطرَ في عامل الخدمة.

ولتبديلِ الألوانِ أو الكثافةِ تُبدَّل الثوابتُ أدناه ويُعاد تشغيلُه.
"""

P = 150.0
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

stars = ''.join(star(cx, cy, RS, RIN, 8, 0)
                for cx, cy in ((0, 0), (P, 0), (0, P), (P, P)))
crosses = ''.join(star(cx, cy, RC, RCIN, 4, math.pi / 4)
                  for cx, cy in ((P / 2, P / 2),))

GROUND = '#e8e2d7'
STAR   = '#dcd4c3'
CROSS  = '#d3c9b4'

svg = (f"<svg xmlns='http://www.w3.org/2000/svg' width='{P:.0f}' height='{P:.0f}' "
       f"viewBox='0 0 {P:.0f} {P:.0f}'>"
       f"<rect width='{P:.0f}' height='{P:.0f}' fill='{GROUND}'/>"
       f"<path d='{stars}' fill='{STAR}'/>"
       f"<path d='{crosses}' fill='{CROSS}'/>"
       f"</svg>")
enc = quote(svg, safe="/:='<>()#.,-").replace('#', '%23')

p = Path('assets/css/app.css'); s = p.read_text(encoding='utf-8')
m = re.search(r'    background-image: url\("data:image/svg\+xml,.*?"\);\n    background-size: \d+px \d+px;\n', s, re.S)
s = s[:m.start()] + f'    background-image: url("data:image/svg+xml,{enc}");\n    background-size: {P:.0f}px {P:.0f}px;\n' + s[m.end():]
p.write_text(s, encoding='utf-8')
print('ok', len(enc))
