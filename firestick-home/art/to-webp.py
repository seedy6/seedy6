"""Convert the rendered layers in out/ to WebP in the app's assets (needs Pillow)."""
import pathlib
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
DEST = HERE.parent / "app/src/main/assets/web/art"

for png in sorted((HERE / "out").glob("fengwei-*.png")):
    img = Image.open(png)
    if png.stem == "fengwei-bg":
        img.convert("RGB").save(DEST / (png.stem + ".webp"), quality=82, method=6)
    else:
        img = img.crop(img.getbbox())  # keep only the drawn area; app.css positions it
        img.save(DEST / (png.stem + ".webp"), quality=88, alpha_quality=90, method=6)
    print(png.stem, img.size, img.getbbox() if png.stem != "fengwei-bg" else "")
