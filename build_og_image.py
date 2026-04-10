#!/usr/bin/env python3
"""Memoji 흰 배경 제거 후 1200x630 OG 캔버스(메인 초록)에 합성."""
from pathlib import Path

from PIL import Image

OG_W, OG_H = 1200, 630
# styles.css --accent
BG = (0x18, 0xA9, 0x6A, 255)

# 기본 소스: 프로젝트 루트의 memoji-source.png 가 있으면 사용
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = ROOT / "memoji-source.png"
FALLBACK_SRC = Path(
    "/Users/cj/.cursor/projects/Users-cj-Desktop/assets/"
    "Image_-_2026-04-10T222804.408-613eac1a-337d-48cd-8f40-9051a28bd5cd.png"
)


def _saturation(r: int, g: int, b: int) -> float:
    mx, mn = max(r, g, b), min(r, g, b)
    return 0.0 if mx == 0 else (mx - mn) / mx


def _luminance(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


def remove_white_bg(im: Image.Image) -> Image.Image:
    """흰 배경·밝은 프린지 제거(저채도+고휘도는 배경으로 간주)."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = _luminance(r, g, b)
            sat = _saturation(r, g, b)
            m = min(r, g, b)
            # 순백에 가까움
            if m >= 250:
                px[x, y] = (r, g, b, 0)
                continue
            # 회백색 프린지(채도 낮고 밝음)
            if sat < 0.12 and lum >= 185:
                t = min(1.0, (lum - 185) / 70.0)
                px[x, y] = (r, g, b, int(255 * (1 - t)))
            elif m >= 238 and sat < 0.2:
                t = (m - 230) / 22.0
                px[x, y] = (r, g, b, int(255 * max(0.0, 1.0 - t)))
    return im


def main() -> None:
    src_path = DEFAULT_SRC if DEFAULT_SRC.exists() else FALLBACK_SRC
    if not src_path.exists():
        raise SystemExit(f"소스 이미지 없음: {src_path}")

    cut = remove_white_bg(Image.open(src_path))
    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)

    max_w, max_h = OG_W - 220, OG_H - 100
    cw, ch = cut.size
    scale = min(max_w / cw, max_h / ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    cut = cut.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (OG_W, OG_H), BG)
    x = (OG_W - nw) // 2
    y = (OG_H - nh) // 2
    canvas.paste(cut, (x, y), cut)

    out_png = ROOT / "profile.png"
    canvas.convert("RGB").save(out_png, "PNG", optimize=True)
    print(f"Wrote {out_png} ({OG_W}x{OG_H})")


if __name__ == "__main__":
    main()
