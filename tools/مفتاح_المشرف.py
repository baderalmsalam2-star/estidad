# -*- coding: utf-8 -*-
"""
يبدّل كلمةَ دخولِ المشرف في `assets/js/owner.js`.

    python3 tools/مفتاح_المشرف.py "كلمتك الجديدة"
    python3 tools/مفتاح_المشرف.py            # تُطلَب منك ولا تظهر على الشاشة

والكلمةُ لا تُكتَب في الكود، وإنّما يُكتَب مُلخَّصُها (SHA-256). وهذا **سِترٌ لا
قُفل**: التطبيقُ ملفّاتٌ ساكنةٌ تنزل إلى جهاز الطالب، ومن فتح الكودَ رأى
المُلخَّص وجرَّب عليه ما شاء. وإنّما يمنع أن تُفتَح شاشاتُ الإدارةِ بنقرةٍ
عابرة. والذي يَحرُس حقّاً مفتاحُ خادم الإحصاء في `server/`.

فاختر كلمةً لا تستعملها في شيءٍ آخَر، ولا تكتبها في رسالةٍ ولا في المستودع.
"""

import getpass
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OWNER = ROOT / 'assets' / 'js' / 'owner.js'

# الكلمةُ المؤقّتةُ المشحونةُ مع التطبيق. مكتوبةٌ ههنا عن قصد: هي معروفةٌ لا
# سرَّ فيها، وإنّما وُضِعت ليعمل البابُ قبل أن يختار صاحبُه كلمتَه. واللوحةُ
# تُنبِّه ما دامت هي.
TEMP = 'estidad-admin'


def sha(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def main():
    if len(sys.argv) > 1:
        new = sys.argv[1]
    else:
        new = getpass.getpass('الكلمة الجديدة: ')
        if new != getpass.getpass('أعِدْها للتأكيد: '):
            sys.exit('لم تتطابق الكلمتان — لم يُبدَّل شيء.')

    if len(new) < 8:
        sys.exit('اجعلها ثمانيةَ محارفَ فأكثر.')
    if new == TEMP:
        sys.exit('هذه هي الكلمةُ المؤقّتةُ نفسُها — اخترْ غيرها.')

    src = OWNER.read_text(encoding='utf-8')
    digest = sha(new)
    src, n = re.subn(r"(export const PASS_SHA = ')[0-9a-f]{64}(')",
                     rf'\g<1>{digest}\g<2>', src)
    if n != 1:
        sys.exit('لم أجد سطرَ PASS_SHA في owner.js — لم يُبدَّل شيء.')
    OWNER.write_text(src, encoding='utf-8')

    print(f'بُدِّلت. المُلخَّص: {digest[:16]}…')
    print('وبقي أن تُعيد بناءَ النسخةِ الواحدةِ وترفعَ CACHE في sw.js، ثمّ تدفع.')


if __name__ == '__main__':
    if '--مؤقتة' in sys.argv:
        print(sha(TEMP))
    else:
        main()
