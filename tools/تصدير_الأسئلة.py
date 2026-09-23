"""يُصدِّر بنك الأسئلة كلَّه في ملفٍّ واحدٍ يُقرأ ويُطبَع.

    python3 tools/تصدير_الأسئلة.py            # كل الأسئلة
    python3 tools/تصدير_الأسئلة.py --موثق     # الموثَّق على الكتاب فقط
    python3 tools/تصدير_الأسئلة.py --مسار imam

المخرَج مرتَّبٌ على العلوم ثم الأبواب، وفيه لكل سؤال جوابُهُ وصفحتُه ومصدرُ
توثيقه — فيصلح للمذاكرة على الورق ولمراجعة مختصٍّ.

واسمُ الملفِّ يتبع ما رُشِّح: `الأسئلة-كاملة.md` للبنك كلِّه، و`الأسئلة-الموثقة.md`
لـ`--موثق`، و`الأسئلة-<المسار>.md` لـ`--مسار`. وكان الثلاثةُ يكتبون في
`الأسئلة-كاملة.md` نفسِه، فـ`--موثق` يدهس الملفَّ المُلتزَمَ في المستودعِ بنسخةٍ
منقوصةٍ (٣٦٥٢ من ٤٠١٠) وترويستُها لا تقول إنّها مُرشَّحة.
"""

import json, sys, glob, pathlib, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
AR = '٠١٢٣٤٥٦٧٨٩'
ar = lambda n: ''.join(AR[int(c)] if c.isdigit() else c for c in str(n))

TYPE_NAME = {'essay': 'مقاليّ', 'mcq': 'اختيار من متعدد',
             'truefalse': 'صح أو خطأ', 'fill': 'إكمال'}

ON_PAGE = ('generated-from-page', 'collated-on-page')


def disclaimer(qs):
    """نصُّ التحذيرِ كما يقوله التطبيق — نظيرُ `data.disclaimer()` حرفاً بحرف.

    ولو تبدّل هناك وجبَ تبديلُه ههنا: هما نصٌّ واحدٌ يُقال للطالبِ وللمختصِّ
    الذي يُراجِع، فافتراقُهما افتراقُ ما يُقال عن البنكِ في موضعَين.
    """
    on_page = sum(1 for q in qs if q.get('provenance') in ON_PAGE)
    ocr = sum(1 for q in qs if q.get('provenance') == 'generated-from-ocr-text')
    rest = len(qs) - on_page - ocr
    return ('الأسئلةُ والأجوبةُ استُخرِجت من الكتب المقرَّرة آلياً: '
            f'{ar(on_page)} منها قوبِل على صورةِ صفحتِه في الكتاب، '
            f'و{ar(ocr)} على نصٍّ مقروءٍ آلياً، و{ar(rest)} لم يُقابَل بعد. '
            'ولم يُراجِعها عالِمٌ بعد — فالصوابُ ما في الكتاب، وإن رأيتَ خطأً فأبلِغْنا. '
            'وليست أسئلةَ اختباراتٍ رسمية: الوزارة لا تنشر نماذجَ أسئلة.')


def load():
    out = []
    for f in sorted(glob.glob(str(ROOT / 'data' / 'banks' / '*.json'))):
        bank = json.load(open(f, encoding='utf-8'))
        for q in bank['questions']:
            q = dict(q)
            q['subject'] = q.get('subject') or bank.get('subject')
            q['_bank'] = pathlib.Path(f).name
            out.append(q)
    return out


def answer_block(q):
    """جوابُ السؤال بحسب نوعه — مقاليًّا كان أو موضوعيًّا."""
    lines = []
    t = q.get('type')
    if t == 'mcq':
        for i, opt in enumerate(q.get('options', [])):
            mark = '**✓**' if i == q.get('answer') else '○'
            lines.append(f"{mark} {opt}")
        lines.append('')
    elif t == 'truefalse':
        lines.append(f"**الجواب:** {'صحيح' if q.get('answer') else 'خطأ'}\n")
    elif t == 'fill':
        acc = q.get('answer') if isinstance(q.get('answer'), list) else [q.get('answer')]
        lines.append(f"**الجواب:** {' / '.join(str(a) for a in acc)}\n")

    if q.get('modelAnswer'):
        lines.append(q['modelAnswer'] + '\n')
    if q.get('explanation'):
        lines.append(q['explanation'] + '\n')

    ans = q.get('answer') if isinstance(q.get('answer'), dict) else None
    if ans and ans.get('items'):
        if ans.get('countWord'):
            lines.append(f"**العدد: {ans['countWord']}**\n")
        lines += [f"{ar(i + 1)}. {x}" for i, x in enumerate(ans['items'])]
        lines.append('')
        if ans.get('caveats'):
            lines.append('**قيود:**')
            lines += [f"- {c}" for c in ans['caveats']]
            lines.append('')
    elif q.get('keyPoints'):
        lines.append('**نقاط التصحيح الذاتيّ:**')
        lines += [f"- {k}" for k in q['keyPoints']]
        lines.append('')

    if q.get('correctionNote'):
        lines.append(f"> ⚠️ {q['correctionNote']}\n")
    return '\n'.join(lines)


def main():
    only_verified = '--موثق' in sys.argv
    track = None
    if '--مسار' in sys.argv:
        track = sys.argv[sys.argv.index('--مسار') + 1]

    qs = load()
    if track:
        qs = [q for q in qs if track in (q.get('tracks') or [])]
    if only_verified:
        qs = [q for q in qs if q.get('bookVerified')]

    by_subject = collections.defaultdict(lambda: collections.defaultdict(list))
    for q in qs:
        by_subject[q['subject']][q.get('topic') or 'عامّ'].append(q)

    verified = sum(1 for q in qs if q.get('bookVerified'))
    generated = sum(1 for q in qs if q.get('provenance') == 'generated-from-page')

    out = ['# بنك أسئلة منصة الاستعداد لاختبارات الوظائف الدينية', '',
           '### وزارة الأوقاف والشؤون الإسلامية — دولة الكويت', '',
           f"**{ar(len(qs))} سؤالاً** · موثَّقٌ على الكتاب: **{ar(verified)}** · "
           f"مولَّدٌ من صفحة الكتاب: **{ar(generated)}**", '',
           # التحذيرُ هو نصُّ `data.disclaimer()` بعينه: يُبنى من أرقامِ البنكِ
           # الحيّةِ ويُقال فيه إنّه لم يُراجِعها عالِمٌ بعد. وكان ههنا النصُّ
           # القديمُ الذي بُدِّل في التطبيقِ لأنّه «صادقٌ فيما نفى، ساكتٌ عمّا
           # هو أهمُّ منه» — وهذا الملفُّ أشدُّ المواضعِ حاجةً إليه، فهو الذي
           # يُعرَض على المختصِّ للمراجعة.
           f'> {disclaimer(qs)}',
           '> والفقه على المذهب الحنبليّ: الصواب ما في دليل الطالب.', '',
           'تم تطوير التطبيق بواسطة بدر المسلم', '', '---', '']

    for subject in sorted(by_subject, key=lambda s: -sum(len(v) for v in by_subject[s].values())):
        topics = by_subject[subject]
        n = sum(len(v) for v in topics.values())
        out += [f'## {subject} — {ar(n)} سؤالاً', '']
        for topic in topics:
            out += [f'### {topic}', '']
            for q in topics[topic]:
                badge = f" · {q['bookPage']}" if q.get('bookPage') else ''
                seal = ' ✅' if q.get('bookVerified') else ''
                out += [f"**{q['id']}** — {TYPE_NAME.get(q.get('type'), '')}{badge}{seal}", '',
                        f"**{q['question']}**", '', answer_block(q), '---', '']

    # يُختم التصديرُ بالتوقيعِ كما يُفتَح به — لا صفحةَ ولا تصديرَ بلا اسمِ صاحبه.
    out += ['---', '', 'تم تطوير التطبيق بواسطة بدر المسلم', '']

    # واسمُ الملفِّ يتبع المُرشِّح، فلا تدهس نسخةٌ منقوصةٌ الملفَّ المُلتزَم.
    name = ('الأسئلة-الموثقة.md' if only_verified
            else f'الأسئلة-{track}.md' if track
            else 'الأسئلة-كاملة.md')
    path = ROOT / name
    path.write_text('\n'.join(out), encoding='utf-8')
    print(f"كُتب: {path.name} — {ar(len(qs))} سؤالاً، {path.stat().st_size // 1024} ك.ب")


if __name__ == '__main__':
    main()
