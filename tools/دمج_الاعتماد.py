"""يدمج قرارات المراجع في بنوك الأسئلة.

الشاشة `review` تُصدِّر ملفَّ قراراتٍ من المتصفّح. هذه الأداة تأخذه فتضع
`bookVerified` و`bookPage` في البنوك نفسها — فيصير السؤال موثَّقاً حقاً، لا
مرشَّحاً. ولا يقع هذا إلا بقرار إنسانٍ نظر في الصفحة.

    python3 tools/دمج_الاعتماد.py اعتماد-التوثيق.json [--apply]

بلا `--apply` يعرض ما سيتغيّر ولا يكتب شيئاً.
"""

import json, sys, glob, pathlib, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
AR = '٠١٢٣٤٥٦٧٨٩'


def to_arabic(n):
    return ''.join(AR[int(d)] for d in str(n))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        print(__doc__)
        return 1
    apply_changes = '--apply' in sys.argv

    decisions = json.load(open(args[0], encoding='utf-8'))
    stats = collections.Counter()
    touched = {}

    for path in sorted(glob.glob(str(ROOT / 'data' / 'banks' / '*.json'))):
        bank = json.load(open(path, encoding='utf-8'))
        changed = False
        for q in bank['questions']:
            d = decisions.get(q['id'])
            if not d:
                continue
            if d['status'] == 'approved':
                if not d.get('page'):
                    stats['اعتمادٌ بلا صفحة'] += 1
                    continue
                page = f"ص{to_arabic(d['page'])}"
                if q.get('bookVerified') and q.get('bookPage') == page:
                    stats['موثَّقٌ سلفاً بنفس الصفحة'] += 1
                    continue
                print(f"  ✓ {q['id']:<12} → bookVerified، {page}   {q['question'][:40]}")
                q['bookVerified'] = True
                q['bookPage'] = page
                stats['اعتُمد'] += 1
                changed = True
            elif d['status'] == 'rejected':
                # الردّ لا يُثبَّت في البنك؛ يُسجَّل ليراجعه صاحب المشروع.
                stats['مردود'] += 1

        if changed:
            touched[path] = bank

    print('\n— الخلاصة —')
    for k, v in stats.most_common():
        print(f"  {k}: {v}")

    if not apply_changes:
        print(f"\nعرضٌ فقط. أضف --apply للكتابة في {len(touched)} بنكاً.")
        return 0

    for path, bank in touched.items():
        pathlib.Path(path).write_text(
            json.dumps(bank, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f"\nكُتب في {len(touched)} بنكاً.")
    print("ثم أعِد: python3 tools/مقابلة.py && python3 tools/رسم_الصفحات.py")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
