# -*- coding: utf-8 -*-
"""
يبني بطاقتَي نشرٍ للتطبيق: واحدةً للستوري (١٠٨٠×١٩٢٠) وأخرى مربّعةً للحالة.

    python3 tools/بطاقة_النشر.py "https://estidad.github.io/"
    python3 tools/بطاقة_النشر.py "<الرابط>" ليلي      # نمطٌ آخَر
    python3 tools/بطاقة_النشر.py "<الرابط>" الكل      # كلُّ الأنماط للمقارنة

والرابطُ يُرسَم رمزاً (QR) في الصورة، فمن رآها في ستوري صوّرها وفتحها بلا كتابة.

والأرقامُ في البطاقة تُقرأ من `data/manifest.json` لحظةَ البناء، فلا تُكتَب يداً
ولا تتقادم: إن وُثِّق مائةُ سؤالٍ جديدٍ غداً وبُنيت البطاقةُ تبدّل الرقمُ وحدَه.

ويُرسَم كلُّ شيءٍ بخطوطِ التطبيق نفسِها عبر Chromium، لا بخطِّ نظامٍ غريبٍ عنه.

── في الخلفية ───────────────────────────────────────────────────────────
الصورةُ تُنشَر في ستوري بين عشراتِ الصور، فخلفيةٌ بيضاءُ ساكنةٌ تمرُّ ولا تُرى.
فجُعلت الخلفيةُ لونَ الهويةِ نفسَه متدرّجاً، وعليها زخرفةُ نجمٍ ثمانيٍّ باهتة،
والحبرُ عليها من لون الورق. ورمزُ QR وحدَه يبقى على بلاطةٍ فاتحةٍ لئلّا يمتنع
على قارئ الكاميرا — فالتباينُ في الرمزِ ليس زينةً بل شرطُ عمله.
"""

import base64
import json
import os
import subprocess
import sys
from pathlib import Path

import qrcode

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'work' / 'نشر'

AR = '٠١٢٣٤٥٦٧٨٩'


def ar(n):
    return ''.join(AR[int(d)] if d.isdigit() else d for d in str(n))


# ── الأنماط ──────────────────────────────────────────────────────────────
#
# كلُّ نمطٍ ألوانُه من لوحة التطبيق في `assets/css/app.css` لا من خارجها،
# حتى تكون الصورةُ والتطبيقُ شيئاً واحداً في عين من رآهما.

THEMES = {
    # أخضرُ الهوية متدرّجاً — الحبرُ ورقيٌّ عليه.
    'أخضر': {
        'bg': ('radial-gradient(120% 85% at 78% 2%, #1b8073 0%, #116055 42%, '
               '#0a3f39 100%)'),
        'ink': '#faf7f1', 'dim': '#a9c9c1', 'accent': '#7fd4bf',
        'rule': 'rgba(250,247,241,.22)', 'fine': '#93b6ae',
        'pattern': '#faf7f1', 'patop': '.075',
        'card': '#faf7f1', 'card_ink': '#12564c', 'card_dim': '#5b6f69',
        'card_url': '#7d8d88', 'qr': '#0f554b', 'qr_bg': '#ffffff',
        'mark_bg': '#faf7f1', 'mark_fg': '#12564c',
    },
    # ليليٌّ رمليّ — أهدأُ وأفخم، والذهبُ الرمليُّ يقوم مقامَ الأخضر.
    'ليلي': {
        'bg': ('radial-gradient(115% 80% at 22% 0%, #241f18 0%, #17130f 48%, '
               '#0d0b09 100%)'),
        'ink': '#f4ead6', 'dim': '#a99b7e', 'accent': '#d8b978',
        'rule': 'rgba(238,226,204,.18)', 'fine': '#8d8069',
        'pattern': '#eee2cc', 'patop': '.07',
        'card': '#f4ead6', 'card_ink': '#3a2f18', 'card_dim': '#6b5c3e',
        'card_url': '#8a7a58', 'qr': '#241f18', 'qr_bg': '#ffffff',
        'mark_bg': '#d8b978', 'mark_fg': '#17130f',
    },
    # الورقيُّ الأوّل — مُبقًى للمقارنةِ لا غير.
    'ورقي': {
        'bg': '#faf7f1',
        'ink': '#1c1917', 'dim': '#6d6355', 'accent': '#14655a',
        'rule': '#ded5c7', 'fine': '#82724d',
        'pattern': '#14655a', 'patop': '.05',
        'card': '#f2ece2', 'card_ink': '#1c1917', 'card_dim': '#6d6355',
        'card_url': '#8a8075', 'qr': '#14655a', 'qr_bg': '#faf7f1',
        'mark_bg': '#14655a', 'mark_fg': '#faf7f1',
    },
}


def qr_svg(url, fg):
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


def pattern_svg(colour, size):
    """نجمٌ ثمانيٌّ مكرَّر — مربّعان أحدُهما مائلٌ على الآخَر، كزخرفةِ المساجد.

    والميلُ يقع في `patternTransform` داخلَ الرمزِ نفسِه لا في `transform` بالـCSS:
    فالثاني يوسّع الصفحةَ أفقياً فتنزاح البطاقةُ كلُّها خارجَ الإطار عند التصوير.
    """
    s = size
    c = s / 2
    a = s * 0.28
    b = s * 0.72
    return (
        f'<svg class="pat" xmlns="http://www.w3.org/2000/svg">'
        f'<defs><pattern id="star" width="{s}" height="{s}" '
        f'patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">'
        f'<g fill="none" stroke="{colour}" stroke-width="2">'
        f'<rect x="{a}" y="{a}" width="{b - a}" height="{b - a}"/>'
        f'<rect x="{a}" y="{a}" width="{b - a}" height="{b - a}" '
        f'transform="rotate(45 {c} {c})"/>'
        f'<circle cx="{c}" cy="{c}" r="{s * 0.05}"/>'
        f'</g></pattern></defs>'
        f'<rect width="100%" height="100%" fill="url(#star)"/></svg>'
    )


def mark_svg(bg, fg, size=96):
    return (f'<svg viewBox="0 0 54 54" width="{size}" height="{size}" fill="none">'
            f'<rect width="54" height="54" rx="18" fill="{bg}"/>'
            '<path d="M27 12.5c-5.6 0-10 4.3-10 9.8V39h20V22.3c0-5.5-4.4-9.8-10-9.8z" '
            f'stroke="{fg}" stroke-width="2.3" stroke-linejoin="round"/>'
            '<path d="M27 25.2c-1.7 0-2.9 1.3-2.9 3V39h5.8v-10.8c0-1.7-1.2-3-2.9-3z" '
            f'fill="{fg}"/>'
            f'<path d="M13 42.5h28" stroke="{fg}" stroke-width="2.3" '
            'stroke-linecap="round"/></svg>')


def font(name):
    b64 = base64.b64encode((ROOT / 'assets' / 'fonts' / name).read_bytes()).decode()
    return f'url(data:font/woff2;base64,{b64}) format("woff2")'


def facts(base):
    """أرقامُ البطاقة — تُؤخَذ من **التطبيقِ العامل**، لا تُحسَب ههنا ثانيةً.

    ── لِمَ لا تُقرأ من البنوكِ رأساً ───────────────────────────────────────

    لأنّ التطبيقَ يطوي المكرَّرَ عند التحميل (`dedupe` في `data.js`): سؤالٌ
    بمعرِّفَين يُعَدُّ واحداً عنده. فالبنوكُ على القرصِ أربعةُ آلافٍ وعشرة،
    والتطبيقُ يُري الطالبَ أربعةَ آلافٍ وأربعة. فلو عدَّت البطاقةُ من القرصِ
    لقالت رقماً لا يجده في التطبيق.

    والفرقُ ستّةُ أسئلةٍ لا غير — لكنّ بطاقةً تُرسَل إلى الناسِ لا تُبنى على
    «الفرقُ يسير»: هي أوّلُ ما يُصدَّق فيه أو يُكذَّب.

    ── ولمَ لا يُنسَخ حسابُ الطيِّ ههنا ────────────────────────────────────

    لأنّه منطقٌ مكتوبٌ مرّةً في `data.js` (تطبيعُ النصِّ، ثمّ ترجيحُ أيِّ
    المكرَّرَين يبقى). ونسخُه في بايثون يعمل اليومَ ويكذب يومَ يُعدَّل هناك
    ولا يُعدَّل ههنا — ولا شيءَ يُنبِّه.

    فيُسأل التطبيقُ نفسُه: يُفتَح في Chromium ويُنادى `data.provenance()`.
    ويلزمه خادمُ التطويرِ عاملاً (`node tools/serve.js`)، وإن لم يكن قيلَ
    ذلك صريحاً ولم تُبنَ بطاقةٌ بأرقامٍ مظنونة.
    """
    md = json.loads((ROOT / 'data' / 'manifest.json').read_text(encoding='utf-8'))
    ask = OUT / 'اسأل.mjs'
    OUT.mkdir(parents=True, exist_ok=True)
    ask.write_text(f"""
import {{ execSync }} from 'node:child_process';
const root = execSync('npm root -g', {{ encoding: 'utf8' }}).trim();
const pw = await import(`${{root}}/playwright/index.js`);
const chromium = pw.chromium || pw.default.chromium;
const b = await chromium.launch({{ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }});
const p = await b.newPage();
await p.goto('{base}', {{ waitUntil: 'networkidle' }});
await p.waitForFunction(async () => {{
  const d = await import('/assets/js/data.js');
  return d.allQuestions().length > 0;
}}, {{ timeout: 40000 }});
const out = await p.evaluate(async () => {{
  const d = await import('/assets/js/data.js');
  return {{ ...d.provenance(), missing: d.missingBanks().length }};
}});
await b.close();
console.log(JSON.stringify(out));
""", encoding='utf-8')
    try:
        raw = subprocess.run(['node', str(ask)], check=True, capture_output=True,
                             text=True).stdout.strip().splitlines()[-1]
    except subprocess.CalledProcessError as e:
        sys.exit('تعذّر سؤالُ التطبيقِ عن أرقامه. شغّلِ الخادمَ أوّلاً:\n'
                 '    node tools/serve.js &\n'
                 f'ثمّ أعِدِ الأمر. (العنوان المُجرَّب: {base})\n' + (e.stderr or '')[-400:])
    f = json.loads(raw)
    if f['missing']:
        sys.exit(f"لم تصل {f['missing']} من البنوكِ إلى التطبيق، فأرقامُه ناقصة. "
                 'أصلِحِ الخادمَ ثمّ أعِدِ الأمر.')
    return {
        'questions': f['total'],
        'onPage': f['onPage'],
        'tracks': len(md['tracks']),
    }


def page(url, w, h, tall, t, f):
    pad = 96 if tall else 64

    # المربّعةُ نصفُ ارتفاعِ الستوري وفيها البطاقةُ والتذييلُ نفسُهما، فلا تسع
    # الستَّ. والحذفُ أولى من تصغيرِ الخطِّ حتى لا يُقرَأ في شاشةِ جوّال.
    bullets = [
        f"<b>{ar(f['questions'])} سؤالاً</b> — منها <b>{ar(f['onPage'])}</b> "
        'قوبِل على صورةِ صفحةِ الكتاب برقمِها',
        # بندٌ لا يُطوى في المربّعة: هو سببُ الإطلاقِ التجريبيِّ كلِّه.
        '<b>لم يُراجِعها عالِمٌ بعد</b> — فأبلِغْنا بأيِّ خطأ',
        f"<b>{ar(f['tracks'])} مسارات:</b> الأئمة · المؤذنون · المتقاعدون",
        'محرّكُ التجويد: جزءُ عمَّ كلمةً كلمة',
        'التسميعُ الصوتيّ، وبطاقاتُ الحفظ، واختبارٌ بوقت',
        '<b>يعمل بلا إنترنت</b>، ويُثبَّت على الشاشة الرئيسية',
        # كان «ولا بياناتٍ شخصية»، وقد صار في التطبيقِ اسمٌ يكتبه الطالبُ إن
        # شاء — يبقى على جهازه ولا يُرسَل. فلا يُقال ما ليس كذلك.
        '<b>مجاناً</b> — بلا حساب، وما تكتبه يبقى على جهازك',
    ]
    if not tall:
        # المربّعةُ نصفُ ارتفاعِ الستوري فلا تسع الكلّ. ويُختار بالمعنى لا
        # بالرقم — فترتيبُ القائمةِ يتبدّل، والرقمُ الثابتُ يكسر البناءَ أو
        # يُسقِط بنداً غيرَ الذي قُصِد (وقد وقع).
        keep = ('قوبِل على صورةِ صفحةِ الكتاب', 'لم يُراجِعها عالِمٌ بعد',
                'يعمل بلا إنترنت', 'مجاناً')
        bullets = [b for b in bullets if any(k in b for k in keep)]
        assert len(bullets) == len(keep), 'بندٌ في قائمةِ المربّعة لم يُوجَد'
    items = '\n  '.join(f'<li><i>●</i><span>{b}</span></li>' for b in bullets)

    # وتُطوى الشطرةُ التمهيديةُ في المربّعة أيضاً: معناها مكرَّرٌ في أوّل بند،
    # وبقاؤها يدفع التذييلَ — الاسمَ وإخلاءَ المسؤولية — خارجَ الصورة.
    # لمن هو؟ سطرٌ واحدٌ يجمع الثلاثة: المتقدِّمَ للإمامة، والمؤذِّن، ومن
    # أراد العلمَ لنفسه. ويُقال في الستوري وحدَها — المربّعةُ لا تسعه، ومعناه
    # حاضرٌ فيها في بندِ «٣ مسارات».
    lede = ('<p class="lede">للأئمة والمؤذنين، ولكلِّ من أحبَّ أن يتعلَّم.</p>'
            if tall else '')

    return f"""<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>
@font-face {{ font-family: Amiri; src: {font('amiri-700-arabic.woff2')}; font-weight: 700 }}
@font-face {{ font-family: Amiri; src: {font('amiri-400-arabic.woff2')}; font-weight: 400 }}
@font-face {{ font-family: Plex; src: {font('plex-arabic-400-arabic.woff2')}; font-weight: 400 }}
@font-face {{ font-family: Plex; src: {font('plex-arabic-600-arabic.woff2')}; font-weight: 600 }}
* {{ margin: 0; padding: 0; box-sizing: border-box }}
html {{ width: {w}px; height: {h}px; overflow: hidden }}
body {{ width: {w}px; height: {h}px; background: {t['bg']};
        font-family: Plex, sans-serif; color: {t['ink']}; position: relative;
        overflow: hidden }}
/* الزخرفةُ طبقةٌ تحت النصِّ لا خلفيةُ عنصر، ليُضبَط مقاسُها وشفافيّتُها وحدَها. */
.pat {{ position: absolute; inset: 0; width: 100%; height: 100%;
        opacity: {t['patop']} }}
.wrap {{ position: relative; width: 100%; height: 100%; padding: {pad}px;
         display: flex; flex-direction: column; gap: {'34' if tall else '22'}px }}
.top {{ display: flex; align-items: center; gap: 22px }}
/* شارةُ التجريبِ في الترويسةِ لا في الذيل: تُرى في أوّلِ نظرةٍ إلى الصورةِ
   وهي تمرُّ في ستوري، ولا تحتاج إلى أن يقرأ الناظرُ إلى آخرها. */
.beta {{ margin-inline-start: auto; flex-shrink: 0; text-align: center;
         font-size: {26 if tall else 20}px; font-weight: 600; line-height: 1.3;
         color: {t['accent']}; border: 2px solid {t['accent']};
         border-radius: 999px; padding: {'14px 22px' if tall else '10px 16px'} }}
.top svg {{ flex-shrink: 0 }}
.name {{ font-family: Amiri; font-weight: 700; font-size: {56 if tall else 40}px; line-height: 1.2 }}
/* أميري يرفع الشدّةَ والفتحةَ فوق حدِّ السطر، فسطرٌ ضيّقٌ يقذفها فوق العنوان
   كأنّها علامةٌ شاردة. فوُسِّع السطرُ حتى تسعَ الحركاتِ في موضعها. */
h1 {{ font-family: Amiri; font-weight: 700; font-size: {112 if tall else 72}px;
      line-height: 1.17; letter-spacing: -1px }}
.lede {{ font-size: {36 if tall else 28}px; line-height: 1.5; color: {t['dim']}; max-width: 24ch }}
ul {{ list-style: none; display: flex; flex-direction: column; gap: {18 if tall else 13}px }}
li {{ font-size: {34 if tall else 27}px; line-height: 1.4; display: flex; gap: 18px;
      align-items: baseline }}
li b {{ font-weight: 600 }}
li i {{ font-style: normal; color: {t['accent']}; font-size: {30 if tall else 24}px; flex-shrink: 0 }}
.qrbox {{ margin-top: auto; display: flex; align-items: center; gap: {34 if tall else 26}px;
          background: {t['card']}; border-radius: 40px; padding: {36 if tall else 26}px;
          color: {t['card_ink']}; flex-shrink: 0 }}
.qr {{ width: {268 if tall else 200}px; height: {268 if tall else 200}px; flex-shrink: 0;
       background: {t['qr_bg']}; border-radius: 22px; padding: {20 if tall else 16}px }}
.qr svg {{ width: 100%; height: 100% }}
.qrtext {{ display: flex; flex-direction: column; gap: {14 if tall else 10}px }}
.qrtext strong {{ font-family: Amiri; font-weight: 700; font-size: {52 if tall else 38}px }}
.qrtext span {{ font-size: {30 if tall else 23}px; color: {t['card_dim']}; line-height: 1.5 }}
.url {{ font-size: {26 if tall else 21}px; color: {t['card_url']}; direction: ltr;
        text-align: left; word-break: break-all }}
.foot {{ display: flex; flex-direction: column; gap: {12 if tall else 8}px;
         border-top: 2px solid {t['rule']}; padding-top: {22 if tall else 16}px;
         flex-shrink: 0 }}
.foot .dev {{ font-size: {30 if tall else 24}px; font-weight: 600 }}
.foot .fine {{ font-size: {25 if tall else 19}px; color: {t['fine']}; line-height: 1.5 }}
</style></head><body>

{pattern_svg(t['pattern'], 240 if tall else 205)}

<div class="wrap">

<div class="top">{mark_svg(t['mark_bg'], t['mark_fg'], 96 if tall else 80)}<div class="name">منصة الاستعداد<br>لاختبارات الوظائف الدينية</div><span class="beta">نسخة<br>تجريبية</span></div>

<!-- بلا حركاتٍ عن قصد: أميري يركّب الشدّةَ فوق الفتحةِ فترتفع فوق حدِّ السطر،
     فتبدو في القياس الكبير علامةً شاردةً معلّقةً فوق الكلمة. -->
<h1>استعد<br>لاختبار الإمامة<br>والأذان</h1>

{lede}

<ul>
  {items}
</ul>

<div class="qrbox">
  <div class="qr">{qr_svg(url, t['qr'])}</div>
  <div class="qrtext">
    <strong>صوِّرِ الرمزَ وابدأ</strong>
    <span>أو افتحِ الرابطَ من المتصفّح</span>
    <span class="url">{url}</span>
  </div>
</div>

<div class="foot">
  <span class="dev">تم تطوير التطبيق بواسطة بدر المسلم</span>
  <span class="fine">إطلاقٌ تجريبيّ: الأسئلةُ والأجوبةُ استُخرِجت من الكتب المقرَّرة آلياً ولم
  يُراجِعها عالِمٌ بعد — فالصوابُ ما في الكتاب. وليست أسئلةَ اختباراتٍ رسمية، ولا يُنسَب هذا
  التطبيق إلى جهةٍ رسمية.</span>
</div>

</div>
</body></html>"""


def build(url, themes, base):
    OUT.mkdir(parents=True, exist_ok=True)
    f = facts(base)
    print(f"أرقامُ التطبيق: {f['questions']} سؤالاً · {f['onPage']} على صورةِ صفحة")
    one = len(themes) == 1
    shots = []
    for theme in themes:
        t = THEMES[theme]
        for name, w, h, tall in [('ستوري', 1080, 1920, True), ('مربّعة', 1080, 1080, False)]:
            stem = name if one else f'{theme}-{name}'
            html = OUT / f'{stem}.html'
            html.write_text(page(url, w, h, tall, t, f), encoding='utf-8')
            shots.append((html, OUT / f'{stem}.png', w, h))

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
        sys.exit(f'استعمالُه: python3 tools/بطاقة_النشر.py "<الرابط>" [{" | ".join(THEMES)} | الكل]')
    want = sys.argv[2] if len(sys.argv) > 2 else 'أخضر'
    if want == 'الكل':
        picked = list(THEMES)
    elif want in THEMES:
        picked = [want]
    else:
        sys.exit(f'نمطٌ غيرُ معروف: {want} — المتاح: {" · ".join(THEMES)} · الكل')
    build(sys.argv[1], picked, os.environ.get('BASE', 'http://127.0.0.1:3000/'))
