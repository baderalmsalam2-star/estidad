# -*- coding: utf-8 -*-
"""
يبني نسخةً في **ملفٍّ واحد** من التطبيق — لمعاينةٍ سريعةٍ على الجوّال.

النسخةُ المنشورةُ الحقيقيةُ هي المستودعُ كما هو على استضافةٍ ساكنة؛ وهذا الملفُّ
لا يُغني عنها، وإنّما يُريك التطبيقَ حيث لا يصلُ خادمٌ محلّيّ. وما لا يُحمَل فيه
هو الكتبُ PDF (٢٧ م.ب) وصورُ الصفحات (١٢ م.ب)، فيُعلَن ذلك في التطبيقِ نفسِه
بعَلَمِ `__PREVIEW` لا بحذفِ الأزرارِ في صمت.

    python3 tools/بناء_نسخة_واحدة.py            # ← نسخة-واحدة.html

الوحداتُ تُدمَج بمُحمِّلٍ صغيرٍ يُحاكي ES modules: كلُّ وحدةٍ دالّةٌ تُنفَّذ مرّةً،
والاستيرادُ يُترجَم إلى `__req('المسار')`. ويُشترَط ألّا يكون بين الوحداتِ دَور،
ويُفحَص ذلك ويُرفَع خطأً إن وُجد — فلا نُخرِج نسخةً تُقلِع عرَجاً.
"""

import base64
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JS = ROOT / 'assets' / 'js'
OUT = ROOT / 'نسخة-واحدة.html'

# ── البيانات التي يطلبها التطبيق بـfetch ────────────────────────────────
DATA_FILES = ['data/manifest.json', 'data/page-hints.json',
              'books/pages-index.json', 'data/book-links.json',
              'data/tajweed/juz-amma-rulings.json']


def data_map():
    md = json.loads((ROOT / 'data/manifest.json').read_text(encoding='utf-8'))
    paths = list(DATA_FILES) + [f"data/banks/{b['file']}" for b in md['banks']]
    out = {}
    for p in paths:
        f = ROOT / p
        if f.exists():
            out[p] = f.read_text(encoding='utf-8')

    # الأغلفةُ تُحمَل معها، بخلافِ صورِ الصفحاتِ والكتب: ثلاثُ صورٍ صغيرةٍ لا
    # تزيد الملفَّ إلا عُشرَ ميغابايت، وبدونها تظهر شاشةُ الكتبِ بصورٍ مكسورة.
    covers = ROOT / 'data/covers.json'
    if covers.exists():
        out['data/covers.json'] = json.dumps(
            {k: to_data_uri(ROOT / v) for k, v in
             json.loads(covers.read_text(encoding='utf-8')).items()
             if (ROOT / v).exists()},
            ensure_ascii=False)
    return out


def to_data_uri(path):
    b64 = base64.b64encode(path.read_bytes()).decode()
    return f'data:image/jpeg;base64,{b64}'


# ── الخطوط: تُحوَّل إلى data: داخل fonts.css ─────────────────────────────
def embed_font(m):
    rel = m.group(1).replace('../', '')
    f = ROOT / 'assets' / rel
    if not f.exists():
        return m.group(0)
    b64 = base64.b64encode(f.read_bytes()).decode()
    return f"url(data:font/woff2;base64,{b64})"


# الخطوطُ نفسُها على Google Fonts. تُستعمَل في نسخةِ الاستضافةِ وحدَها، لأنّ
# بعضَ المضيفينَ يمنع `data:` للخطوط فتسقط بلا إنذار. أمّا نسخةُ الملفِّ فتحمل
# خطوطَها معها لتعمل من قرصٍ بلا شبكة — وهو أصلُ المشروع.
GOOGLE = ('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700'
          '&family=Amiri+Quran&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700'
          '&family=IBM+Plex+Mono:wght@400;500&display=swap')


def css(google=False):
    app = (ROOT / 'assets/css/app.css').read_text(encoding='utf-8')
    if google:
        return app
    fonts = (ROOT / 'assets/css/fonts.css').read_text(encoding='utf-8')
    fonts = re.sub(r"""url\(['"]?((?:\.\./)?fonts/[^)'"]+)['"]?\)""", embed_font, fonts)
    return fonts + '\n' + app


# ── دمج الوحدات ─────────────────────────────────────────────────────────
IMPORT_RE = re.compile(r"^import\s+(.+?)\s+from\s+'([^']+)';\s*$", re.M)


def resolve(spec, base):
    """'../data.js' من 'screens/home.js' ← 'data.js'."""
    p = (JS / base).parent / spec
    return p.resolve().relative_to(JS).as_posix()


def transform(rel):
    src = (JS / rel).read_text(encoding='utf-8')
    deps = []

    def rep(m):
        clause, spec = m.group(1), m.group(2)
        target = resolve(spec, rel)
        deps.append(target)
        ns = re.match(r'^\*\s+as\s+(\w+)$', clause)
        if ns:
            return f"const {ns.group(1)} = __req('{target}');"
        named = re.match(r'^\{(.+)\}$', clause, re.S)
        if named:
            return f"const {{{named.group(1)}}} = __req('{target}');"
        both = re.match(r'^(\w+)\s*,\s*\{(.+)\}$', clause, re.S)
        if both:
            return (f"const __m = __req('{target}'); "
                    f"const {both.group(1)} = __m.default; const {{{both.group(2)}}} = __m;")
        return f"const {clause} = __req('{target}').default;"

    src = IMPORT_RE.sub(rep, src)

    names, default = [], None
    def strip(m):
        nonlocal default
        kind, name = m.group(1), m.group(2)
        if kind.startswith('export default'):
            default = name
        else:
            names.append(name)
        return kind.replace('export default ', '').replace('export ', '') + name

    src = re.sub(r'^(export default (?:async )?function |export (?:async )?function |export const )(\w+)',
                 strip, src, flags=re.M)

    tail = ''
    if names:
        tail += '\n  Object.assign(__x, { ' + ', '.join(names) + ' });'
    if default:
        tail += f'\n  __x.default = {default};'
    return src, tail, deps


def order(entry='app.js'):
    """ترتيبٌ طوبولوجيّ، ورفعُ خطأٍ عند أوّلِ دَور."""
    seen, stack, out = set(), [], []

    def walk(rel):
        if rel in out:
            return
        if rel in stack:
            raise SystemExit(f"دَورٌ بين الوحدات: {' → '.join(stack + [rel])}")
        stack.append(rel)
        _, _, deps = transform(rel)
        for d in deps:
            walk(d)
        stack.pop()
        out.append(rel)

    walk(entry)
    return out


def bundle():
    mods = order()
    parts = []
    for rel in mods:
        body, tail, _ = transform(rel)
        parts.append(
            f"__def('{rel}', function (__x) {{\n{body}{tail}\n}});")
    return '\n'.join(parts)


def build(google=False):
    body = re.search(r'<body>(.*)</body>', (ROOT / 'index.html').read_text(encoding='utf-8'),
                     re.S).group(1)
    body = re.sub(r'<script[^>]*></script>|<noscript>.*?</noscript>', '', body, flags=re.S)

    link = f'<link rel="stylesheet" href="{GOOGLE}">' if google else ''
    html = f"""<title>منصة الاستعداد لاختبارات الوظائف الدينية</title>
<meta name="theme-color" content="#faf7f1">
{link}
<style>{css(google)}</style>
<div dir="rtl" lang="ar">{body}</div>
<script>
window.__PREVIEW = true;
const __DATA = {json.dumps(data_map(), ensure_ascii=False)};
// شبكةٌ محلّيّة: التطبيقُ يطلب ملفّاته بـfetch كما هو، وتُخدَم من الداخل بلا تعديلِ مصدرِه.
const __fetch = window.fetch.bind(window);
window.fetch = (u, o) => {{
  const k = String(u).replace(/^\\.?\\//, '');
  if (k in __DATA) return Promise.resolve(new Response(__DATA[k], {{ status: 200 }}));
  return __fetch(u, o);
}};
</script>
<script type="module">
const __reg = new Map(), __cache = new Map();
const __def = (n, f) => __reg.set(n, f);
const __req = (n) => {{
  if (__cache.has(n)) return __cache.get(n);
  const x = {{}};
  __cache.set(n, x);
  __reg.get(n)(x);
  return x;
}};
{bundle()}
__req('app.js');
</script>
"""
    OUT.write_text(html, encoding='utf-8')
    print(f"كُتب: {OUT.name} — {OUT.stat().st_size / 1e6:.2f} م.ب، {len(order())} وحدة"
          f"{'، خطوطٌ من Google Fonts' if google else '، خطوطٌ محمولة'}")


if __name__ == '__main__':
    # `--google` يربط الخطوطَ بـGoogle Fonts بدل حملها — لنسخةِ الاستضافةِ وحدَها.
    build(google='--google' in sys.argv)
