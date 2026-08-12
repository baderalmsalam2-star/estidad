"""مُرشِّح صفحاتٍ للأسئلة غير الموثَّقة — لا حَكَم.

يبحث عن كل سؤالٍ في نصّ كتابه ويقترح أقرب صفحة، ويسجّل درجة الثقة.
لا يُثبِّت `bookVerified` ولا يعدّل البنوك البتّة: مخرَجُه ملفٌّ منفصل
(`data/page-hints.json`) يُعرَض في التطبيق بوصفه «صفحةً مرشَّحة» لا موثَّقة.

    python3 tools/مقابلة.py            # يكتب data/page-hints.json
    python3 tools/مقابلة.py --report   # يطبع تقريراً للمراجعة البشرية
"""

import json, re, sys, glob, pathlib, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent

# العلم → (ملفّ النصّ، مُعرِّف الكتاب في books/)
BOOKS = {
    'الفقه':        ('دليل_الطالب_نص_كامل.txt',      'daleel-altalib'),
    'التجويد':      ('غاية_المريد_نص_كامل.txt',       'ghayat-almureed'),
    'النحو':        ('التحفة_السنية_نص_كامل.txt',     'tuhfa-saniyya'),
    'ميثاق المسجد': ('ميثاق_المسجد_نص_كامل.txt',      'meethaq-almasjid'),
    'العقيدة':      ('بريق_الجمان_نص_كامل.txt',       'bareeq-aljuman'),
    'التفسير':      ('زبدة_التفسير_جزء_عم_نص.txt',    'zubdat-altafseer'),
}

# كلماتٌ شائعةٌ لا تميّز صفحةً عن أخرى
STOP = set('''ما هي وما هل من في على الذي التي كم عدد اذكر وكم او ثم عند بين ماذا
ذلك هذه هذا كان كانت يكون تكون قال قوله وهو وهي الله عليه وسلم عنه بها به له
مع عن كل بعض غير حتى إذا إن أن لا نعم عدد'''.split())

TASH = re.compile(r'[ً-ْٰـ]')


def norm(s):
    s = TASH.sub('', str(s))
    s = re.sub(r'[أإآٱ]', 'ا', s)
    s = re.sub(r'ى', 'ي', s).replace('ة', 'ه')
    s = re.sub(r'[^ء-ي\s]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def load_pages(name):
    """يقرأ ملفّ مصدرٍ ويعيد {رقم الصفحة المطبوع: نصّها مجرَّداً}."""
    path = ROOT / 'sources' / name
    if not path.exists():
        return None
    parts = re.split(r'==================== صفحة (\d+) ====================',
                     path.read_text(encoding='utf-8'))
    return {int(parts[i]): norm(parts[i + 1]) for i in range(1, len(parts) - 1, 2)}


def keywords(q):
    """كلماتٌ مميِّزة من السؤال وإجابته — الإجابة أدلّ على الصفحة من السؤال."""
    blob = norm(q.get('question', '') + ' ' + ' '.join(q.get('keyPoints', []) or []))
    seen, out = set(), []
    for w in blob.split():
        if len(w) > 3 and w not in STOP and w not in seen:
            seen.add(w)
            out.append(w)
    return out


def best_page(pages, words):
    """أعلى صفحةٍ مطابقةً، ودرجةُ الثقة، والفارق عن التالية (يميّز الحسم)."""
    if not words:
        return None
    scored = sorted(
        ((sum(1 for w in words if w in body) / len(words), p) for p, body in pages.items()),
        reverse=True,
    )
    top, second = scored[0], (scored[1] if len(scored) > 1 else (0, None))
    return {'page': top[1], 'confidence': round(top[0], 3), 'margin': round(top[0] - second[0], 3)}


def main():
    report = '--report' in sys.argv
    cache = {}
    hints, stats = {}, collections.Counter()

    for f in sorted(glob.glob(str(ROOT / 'data' / 'banks' / '*.json'))):
        bank = json.load(open(f, encoding='utf-8'))
        for q in bank['questions']:
            subject = q.get('subject') or bank.get('subject')
            entry = BOOKS.get(subject)
            if not entry:
                stats['بلا كتابٍ نصّي'] += 1
                continue
            if q.get('bookPage'):
                stats['موثَّقٌ سلفاً'] += 1
                continue

            src, book_id = entry
            if src not in cache:
                cache[src] = load_pages(src)
            pages = cache[src]
            if not pages:
                stats['نصٌّ مفقود'] += 1
                continue

            hit = best_page(pages, keywords(q))
            # عتبةٌ متحفّظة: ثقةٌ معقولة وفارقٌ يميّزها عن سواها
            if hit and hit['confidence'] >= 0.45 and hit['margin'] >= 0.05:
                hints[q['id']] = {'book': book_id, 'subject': subject, **hit}
                stats['مرشَّح'] += 1
            else:
                stats['دون العتبة'] += 1
            if report:
                c = hit['confidence'] if hit else 0
                mark = '✓' if q['id'] in hints else '—'
                print(f"{mark} {q['id']:<12} {subject:<14} ص{hit['page'] if hit else '?':<5} "
                      f"ثقة {c:<6} {q['question'][:44]}")

    out = ROOT / 'data' / 'page-hints.json'
    out.write_text(json.dumps(hints, ensure_ascii=False, indent=1), encoding='utf-8')
    print('\n— الخلاصة —')
    for k, v in stats.most_common():
        print(f"  {k}: {v}")
    print(f"  كُتب: {out.relative_to(ROOT)} ({len(hints)} ترشيحاً)")


if __name__ == '__main__':
    main()
