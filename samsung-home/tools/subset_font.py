"""Subset Amiri to the Arabic characters in app/data.js (keeps all OpenType features for shaping).
Usage: python3 tools/subset_font.py /path/to/Amiri-Regular.ttf"""
import os, sys
from fontTools import subset
here = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1]
s = open(os.path.join(here, "..", "app", "data.js"), encoding="utf-8").read()
text = "".join(sorted(set(c for c in s if "؀" <= c <= "ۿ"))) + ".,:()!؟،؛ 0123456789"
opts = subset.Options(); opts.layout_features = ["*"]; opts.name_IDs = ["*"]; opts.notdef_outline = True
font = subset.load_font(src, opts); sub = subset.Subsetter(opts); sub.populate(text=text); sub.subset(font)
out = os.path.join(here, "..", "app", "fonts", "amiri-subset.ttf")
subset.save_font(font, out, opts)
print(len(text), "characters ->", os.path.normpath(out), os.path.getsize(out), "bytes")
