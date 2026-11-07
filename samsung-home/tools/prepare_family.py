#!/usr/bin/env python3
"""Make the TV's grandchildren cards from a PRIVATE folder (never from this public repo).

The folder (default: ~/Pictures/Salam family) holds the original photos and family.json:
  [{"name": "Zahra", "born": "2025-03-14", "photo": "IMG_1234.HEIC"}, ...]
This writes <folder>/tv/: one square JPEG per child, cropped around the face, and family.js.
deploy.sh copies <folder>/tv/ into the app as family/ on the TV.

  python3 tools/prepare_family.py ["/path/to/folder"]
"""
import json, os, subprocess, sys, tempfile
import cv2
from PIL import Image, ImageOps

folder = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/Pictures/Salam family")
out = os.path.join(folder, "tv")
os.makedirs(out, exist_ok=True)
kids = json.load(open(os.path.join(folder, "family.json"), encoding="utf-8"))
cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
SIZE = 420

def load(path):
    if path.lower().endswith((".heic", ".heif")):          # iPhone photos: let macOS convert
        tmp = tempfile.mktemp(suffix=".jpg")
        subprocess.run(["sips", "-s", "format", "jpeg", path, "--out", tmp], check=True, capture_output=True)
        path = tmp
    return ImageOps.exif_transpose(Image.open(path)).convert("RGB")

def square_around_face(im):
    w, h = im.size
    gray = cv2.cvtColor(cv2.cvtColor(__import__("numpy").array(im), cv2.COLOR_RGB2BGR), cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(max(40, w // 20), max(40, w // 20)))
    if len(faces):
        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        cx, cy, side = x + fw / 2, y + fh / 2 + fh * 0.15, fh * 2.6   # head and shoulders
    else:
        cx, cy, side = w / 2, h * 0.4, min(w, h)                          # no face found: upper centre
    side = min(side, w, h)
    left = min(max(cx - side / 2, 0), w - side)
    top = min(max(cy - side / 2, 0), h - side)
    return im.crop((int(left), int(top), int(left + side), int(top + side))), bool(len(faces))

entries = []
for i, k in enumerate(kids):
    im, found = square_around_face(load(os.path.join(folder, k["photo"])))
    name = "kid%d.jpg" % (i + 1)
    im.resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(out, name), quality=86)
    entries.append({"name": k["name"], "born": k["born"], "photo": "family/" + name})
    print("%-12s born %s  %s  face %s" % (k["name"], k["born"], name, "found" if found else "NOT found, centre crop"))
with open(os.path.join(out, "family.js"), "w", encoding="utf-8") as f:
    f.write("// Private: made by tools/prepare_family.py. Do not commit.\n")
    f.write("window.SALAM_FAMILY = " + json.dumps(entries, ensure_ascii=False, indent=1) + ";\n")
print("->", out)
