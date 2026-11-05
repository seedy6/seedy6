#!/usr/bin/env python3
"""Build app/data.js: the sayings and hadith shown on the TV, and the Hijri month table.

Texts come from the Thaqalayn API (thaqalayn.net), with its Arabic and English:
  - Nahj al-Balagha (Sayings), tr. Sayed Ali Raza
  - al-Kafi vol. 2, tr. Muhammad Sarwar; only hadith that al-Majlisi graded sahih, hasan
    or muwathaq (not "weak like ...", majhul or mursal)
NAHJ_IDS and KAFI_IDS are the hand-picked Thaqalayn ids. To change the set, edit them and run:
  python3 tools/build_data.py <cache-dir>
The cache dir gets the two book downloads (about 11 MB) on the first run.
"""
import json, os, re, subprocess, sys, urllib.request

NAHJ_IDS = [5, 12, 14, 42, 43, 44, 51, 60, 69, 71, 74, 79, 86, 98, 143, 169, 171, 190, 198, 203, 207, 215,
            217, 222, 234, 260, 271, 280, 296, 297, 299, 307, 309, 321, 339, 364, 376, 401, 417, 419, 425,
            433, 490, 495, 499, 511, 513, 547, 562, 579, 583, 598]
KAFI_IDS = [109, 120, 130, 180, 226, 234, 276, 296, 302, 303, 313, 329, 426, 440, 477, 510, 516, 629, 759,
            765, 865, 1074, 1156, 1638, 1621, 1707, 1742, 1775, 1776, 2031, 2168, 1247]
FIXES = {"beween": "between", "Allah,the": "Allah, the"}

B = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
for book in ("Nahj-al-Balagha-Radi", "Al-Kafi-Volume-2-Kulayni"):
    path = os.path.join(B, book + ".json")
    if not os.path.exists(path):
        urllib.request.urlretrieve("https://www.thaqalayn-api.net/api/v2/" + book, path)
B = B.rstrip("/")
num = r'^[\d٠-٩]+[\.ـ\s]*'
def clean_en(s):
    s = re.sub(r'\[\d+\]', '', s); s = re.sub(r'\s+', ' ', s).strip(); return s
def clean_ar(s):
    s = re.sub(r'\[[\d٠-٩]+\]', '', s); s = s.replace('‏', ''); s = re.sub(r'\s+', ' ', s).strip(); return s

# Nahj al-Balagha sayings
nahj = json.load(open(B + '/Nahj-al-Balagha-Radi.json'))
out_n = []
for h in nahj:
    if h['category'] != 'Sayings': continue
    en = clean_en(h['englishText']); ar = clean_ar(h['arabicText'])
    m = re.match(num + r'Am[īi]r al-mu.minīn, peace be upon him, said: (.*)$', en)
    a = re.match(num + r'(?:وَ)?قَالَ\s*\(علي[هـ]\s*‌?\s*ا?لسلام\)\s*:?\s*(.*)$', ar.replace('‌',''))
    if not (m and a): continue
    en, ar = m.group(1).strip(), a.group(1).strip()
    if len(en) > 170 or len(ar) > 130 or len(en) < 40: continue
    n = re.match(r'^(\d+)', clean_en(h['englishText'])).group(1)
    out_n.append({'id': h['id'], 'ar': ar, 'en': en, 'by': 'Imam Ali (a.s.)', 'src': 'Nahj al-Balagha, Saying ' + n, 'url': h['URL']})

# al-Kafi vol 2: speaker must be clear, graded sahih/hasan/muwathaq by al-Majlisi
SPEAKERS = [
    (r"abu .?abd(?:illah| allah)", 'Imam al-Sadiq (a.s.)'),
    (r"abu ja.far", 'Imam al-Baqir (a.s.)'),
    (r"al-rida", 'Imam al-Rida (a.s.)'),
    (r"amir al-mu.minin", 'Imam Ali (a.s.)'),
    (r"ali ibn al-husayn", 'Imam al-Sajjad (a.s.)'),
    (r"messenger of allah", 'The Prophet (s.a.w.)'),
]
kafi = json.load(open(B + '/Al-Kafi-Volume-2-Kulayni.json'))
out_k = []
for h in kafi:
    g = (h.get('majlisiGrading') or '').strip()
    if not any(x in g for x in ('صحيح', 'حسن', 'موثق')): continue
    sanad = (h.get('thaqalaynSanad') or '')
    tail = sanad[-140:].lower()
    if 'the second' in tail or 'the two' in tail or 'one of them' in tail: continue
    best = None
    for pat, name in SPEAKERS:
        for m in re.finditer(pat, tail):
            if best is None or m.start() > best[0]: best = (m.start(), name)
    if not best: continue
    by = best[1]
    matn = clean_en(h.get('thaqalaynMatn') or '').strip()
    matn = matn.strip('“”" ').strip().lstrip('‘').rstrip('’ ').strip()
    if any(c in matn for c in '“”‘?') or len(matn) > 170 or len(matn) < 40: continue
    if re.search(r"\b(I|you|he said|the Imam|Imam)\b", matn): continue
    ar = clean_ar(h['arabicText'])
    if 'عَلَيهِما' in ar: continue
    m = None
    H = '[\u064B-\u0652\u0670]*'
    said = '(?:' + H.join('قال') + '|' + H.join('يقول') + ')' + H
    for m in re.finditer(r'\(ع[^()]{0,30}\)\s*' + said + r'\s*', ar): pass
    if not m: continue
    arm = ar[m.end():].strip()
    if len(arm) > 130 or len(arm) < 15 or re.search(said, arm) or re.search(H.join('قلت'), arm): continue
    n = re.match(r'^(\d+)', clean_en(h['englishText']))
    out_k.append({'id': h['id'], 'ar': arm, 'en': matn, 'by': by, 'src': 'al-Kafi, vol. 2, ' + h['chapter'] + (', h. ' + n.group(1) if n else ''), 'grade': g, 'url': h['URL']})


by_id_n = {h['id']: h for h in out_n}
by_id_k = {h['id']: h for h in out_k}
missing = [i for i in NAHJ_IDS if i not in by_id_n] + [i for i in KAFI_IDS if i not in by_id_k]
if missing: sys.exit("ids no longer pass the filters: %s" % missing)
nahj = [by_id_n[i] for i in NAHJ_IDS]
kafi = [by_id_k[i] for i in KAFI_IDS]
mixed = []
while nahj or kafi:  # alternate, so Imam Ali's sayings and the hadith take turns
    if nahj: mixed.append(nahj.pop(0))
    if kafi: mixed.append(kafi.pop(0))
sayings = []
for h in mixed:
    en = h['en']
    for a, b in FIXES.items(): en = en.replace(a, b)
    sayings.append({'ar': h['ar'], 'en': en, 'by': h['by'], 'src': h['src']})
table = json.loads(subprocess.check_output(["node", os.path.join(here, "hijri_table.mjs"), "2025", "2032"]))
out = os.path.join(here, "..", "app", "data.js")
with open(out, "w") as f:
    f.write("// Generated by tools/build_data.py. Do not edit by hand.\n")
    f.write("// Sources: thaqalayn.net (Nahj al-Balagha, tr. Sayed Ali Raza; al-Kafi vol. 2, tr. Muhammad Sarwar).\n")
    f.write("window.SALAM_SAYINGS = " + json.dumps(sayings, ensure_ascii=False, indent=0) + ";\n")
    f.write("// Umm al-Qura month starts: [hijri year, hijri month, first day (Gregorian)].\n")
    f.write("window.HIJRI_MONTH_STARTS = " + json.dumps(table) + ";\n")
print(len(sayings), "sayings,", len(table), "Hijri months ->", os.path.normpath(out))
