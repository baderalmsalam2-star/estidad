# -*- coding: utf-8 -*-
"""
يبني بطاقتَي نشرٍ للتطبيق: واحدةً للستوري (١٠٨٠×١٩٢٠) وأخرى مربّعةً للحالة.

    python3 tools/بطاقة_النشر.py "https://example.github.io/estidad/"

والرابطُ يُرسَم رمزاً (QR) في الصورة، فمن رآها في ستوري صوّرها وفتحها بلا كتابة.

والأرقامُ في البطاقة تُقرأ من `data/manifest.json` لحظةَ البناء، فلا تُكتَب يداً
ولا تتقادم: إن وُثِّق مائةُ سؤالٍ جديدٍ غداً وبُنيت البطاقةُ تبدّل الرقمُ وحدَه.

ويُرسَم كلُّ شيءٍ بخطوطِ التطبيق نفسِها عبر Chromium، لا بخطِّ نظامٍ غريبٍ عنه.
"""

import base64
import json
import subprocess
import sys
from pathlib import Path

import qrcode

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'work' / 'نشر'

AR = '٠١٢٣٤٥٦٧٨٩'


def ar(n):
    return ''.join(AR[int(d)] if d.isdigit() else d for d in str(n))


def qr_svg(url, fg='#14655a'):
    """رمزُ الاستجابة مرسوماً متجهاً — لا صورةً نقطيّةً تتشقّق عند التكبير."""
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
    q.add_data(url)
    q.make(fit=True)
    m = q.get_matrix()
    n = len(m)
    cells = ''.join(
        f'<rect x="{x}" y="{y}" width="1.02" height="1.02"/>'
        for y, row in enumerate(m) for x, v in enumerate(row) if v
    )
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" '
            f'shape-rendering="crispEdges"><g fill="{fg}">{cells}</g></svg>')


def font(name):
    b64 = base64.b64encode((ROOT / 'assets' / 'fonts' / name).read_bytes()).decode()
    return f'url(data:font/woff2;base64,{b64}) format("woff2")'


def facts():
    md = json.loads((ROOT / 'data' / 'manifest.json').read_text(encoding='utf-8'))
    t = md['totals']
    return {
        'questions': t['questions'],
        'verified': t['verifiedAgainstSourceBook'],
        'tracks': len(md['tracks']),
    }


MARK = ('<svg viewBox="0 0 54 54" width="96" height="96" fill="none">'
        '<rect width="54" height="54" rx="18" fill="#14655a"/>'
        '<path d="M27 12.5c-5.6 0-10 4.3-10 9.8V39h20V22.3c0-5.5-4.4-9.8-10-9.8z" '
        'stroke="#faf7f1" stroke-width="2.3" stroke-linejoin="round"/>'
        '<path d="M27 25.2c-1.7 0-2.9 1.3-2.9 3V39h5.8v-10.8c0-1.7-1.2-3-2.9-3z" fill="#faf7f1"/>'
        '<path d="M13 42.5h28" stroke="#faf7f1" stroke-width="2.3" stroke-linecap="round"/></svg>')


def page(url, w, h, tall):
    f = facts()
    pad = 96 if tall else 72
    return f"""<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>
@font-face {{ font-family: Amiri; src: {font('amiri-700-arabic.woff2')}; font-weight: 700 }}
@font-face {{ font-family: Amiri; src: {font('amiri-400-arabic.woff2')}; font-weight: 400 }}
@font-face {{ font-family: Plex; src: {font('plex-arabic-400-arabic.woff2')}; font-weight: 400 }}
@font-face {{ font-family: Plex; src: {font('plex-arabic-600-arabic.woff2')}; font-weight: 600 }}
* {{ margin: 0; padding: 0; box-sizing: border-box }}
body {{ width: {w}px; height: {h}px; background: #faf7f1; font-family: Plex, sans-serif;
        color: #1c1917; padding: {pad}px; display: flex; flex-direction: column;
        gap: {'34' if tall else '26'}px; }}
.top {{ display: flex; align-items: center; gap: 22px }}
.name {{ font-family: Amiri; font-weight: 700; font-size: {56 if tall else 46}px; line-height: 1.2 }}
h1 {{ font-family: Amiri; font-weight: 700; font-size: {112 if tall else 92}px;
      line-height: 1.06; letter-spacing: -1px }}
.lede {{ font-size: {36 if tall else 30}px; line-height: 1.5; color: #6d6355; max-width: 24ch }}
ul {{ list-style: none; display: flex; flex-direction: column; gap: {18 if tall else 14}px }}
li {{ font-size: {34 if tall else 29}px; line-height: 1.4; display: flex; gap: 18px;
      align-items: baseline }}
li b {{ font-weight: 600 }}
li i {{ font-style: normal; color: #14655a; font-size: {30 if tall else 24}px; flex-shrink: 0 }}
.qrbox {{ margin-top: auto; display: flex; align-items: center; gap: {34 if tall else 28}px;
          background: #f2ece2; border-radius: 40px; padding: {36 if tall else 30}px }}
.qr {{ width: {268 if tall else 226}px; height: {268 if tall else 226}px; flex-shrink: 0;
       background: #faf7f1; border-radius: 22px; padding: 20px }}
.qr svg {{ width: 100%; height: 100% }}
.qrtext {{ display: flex; flex-direction: column; gap: 14px }}
.qrtext strong {{ font-family: Amiri; font-weight: 700; font-size: {52 if tall else 40}px }}
.qrtext span {{ font-size: {30 if tall else 25}px; color: #6d6355; line-height: 1.5 }}
.url {{ font-size: {26 if tall else 22}px; color: #8a8075; direction: ltr; text-align: left;
        word-break: break-all }}
.foot {{ display: flex; flex-direction: column; gap: 12px; border-top: 2px solid #ded5c7;
         padding-top: {22 if tall else 18}px }}
.foot .dev {{ font-size: {30 if tall else 25}px; font-weight: 600 }}
.foot .fine {{ font-size: {25 if tall else 21}px; color: #82724d; line-height: 1.55 }}
</style></head><body>

<div class="top">{MARK}<div class="name">منصة الاستعداد<br>لاختبارات الوظائف الدينية</div></div>

<h1>استعِدَّ<br>لاختبار الإمامة<br>والأذان</h1>

<p class="lede">على الكتب المقرَّرة نفسِها، صفحةً صفحة.</p>

<ul>
  <li><i>●</i><span><b>{ar(f['questions'])} سؤالاً</b> — منها <b>{ar(f['verified'])}</b> موثَّقٌ على صفحةِ الكتاب برقمِها</span></li>
  <li><i>●</i><span><b>{ar(f['tracks'])} مسارات:</b> الأئمة · المؤذنون · المتقاعدون</span></li>
  <li><i>●</i><span>محرّكُ التجويد: جزءُ عمَّ كلمةً كلمة</span></li>
  <li><i>●</i><span>التسميعُ الصوتيّ، وبطاقاتُ الحفظ، واختبارٌ بوقت</span></li>
  <li><i>●</i><span><b>يعمل بلا إنترنت</b>، ويُثبَّت على الشاشة الرئيسية</span></li>
  <li><i>●</i><span><b>مجاناً</b> — بلا حسابٍ ولا بياناتٍ شخصية</span></li>
</ul>

<div class="qrbox">
  <div class="qr">{qr_svg(url)}</div>
  <div class="qrtext">
    <strong>صوِّرِ الرمزَ وابدأ</strong>
    <span>أو افتحِ الرابطَ من المتصفّح</span>
    <span class="url">{url}</span>
  </div>
</div>

<div class="foot">
  <span class="dev">تم تطوير التطبيق بواسطة بدر المسلم</span>
  <span class="fine">الأسئلةُ اجتهادٌ تدريبيٌّ مبنيٌّ على الكتب المقرَّرة، وليست أسئلةَ اختباراتٍ رسمية،
  ولا يُنسَب هذا التطبيق إلى جهةٍ رسمية.</span>
</div>

</body></html>"""


def build(url):
    OUT.mkdir(parents=True, exist_ok=True)
    shots = []
    for name, w, h, tall in [('ستوري', 1080, 1920, True), ('مربّعة', 1080, 1080, False)]:
        html = OUT / f'{name}.html'
        html.write_text(page(url, w, h, tall), encoding='utf-8')
        shots.append((html, OUT / f'{name}.png', w, h))

    # الرسمُ بـChromium ليأتيَ الخطُّ العربيُّ بضبطه كما في التطبيق.
    script = OUT / 'ارسم.mjs'
    jobs = json.dumps([[str(h), str(p), w, hh] for h, p, w, hh in shots])
    script.write_text(f"""
import {{ execSync }} from 'node:child_process';
const root = execSync('npm root -g', {{ encoding: 'utf8' }}).trim();
const pw = await import(`${{root}}/playwright/index.js`);
const chromium = pw.chromium || pw.default.chromium;
const b = await chromium.launch({{ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }});
for (const [html, png, w, h] of {jobs}) {{
  const p = await b.newPage({{ viewport: {{ width: w, height: h }}, deviceScaleFactor: 1 }});
  await p.goto('file://' + html, {{ waitUntil: 'load' }});
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.screenshot({{ path: png }});
  await p.close();
}}
await b.close();
""", encoding='utf-8')
    subprocess.run(['node', str(script)], check=True)

    for _, png, _, _ in shots:
        print(f'{png.relative_to(ROOT)} — {png.stat().st_size // 1024} ك.ب')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit('استعمالُه: python3 tools/بطاقة_النشر.py "<الرابط>"')
    build(sys.argv[1])
