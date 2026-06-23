from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFont, ImageFilter

THUMBNAIL_SPECS = {
    "width": 1280,
    "height": 720,
    "format": "JPEG",
    "quality": 95,
}

THUMBNAIL_TEMPLATES_DIR = Path("assets/thumbnail_templates")


def generate_thumbnail(
    title: str,
    background_image_path: Optional[str] = None,
    template: str = "bold_text",
    output_dir: str = "./output/thumbnails",
    font_path: str = "./assets/fonts/Montserrat-Bold.ttf",
    overlay_opacity: float = 0.55,
    output_quality: int = 95,
) -> str:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    if background_image_path and Path(background_image_path).exists():
        try:
            base_img = Image.open(background_image_path).convert("RGB")
        except Exception:
            base_img = _create_fallback_bg()
    else:
        base_img = _create_fallback_bg()

    base_img = base_img.resize(
        (THUMBNAIL_SPECS["width"], THUMBNAIL_SPECS["height"]),
        Image.LANCZOS,
    )

    if template == "split_layout":
        thumbnail = _split_layout_template(base_img, title, font_path)
    elif template == "minimal":
        thumbnail = _minimal_template(base_img, title, font_path)
    else:
        thumbnail = _bold_text_template(base_img, title, font_path, overlay_opacity)

    out_file = output_path / f"thumbnail_{len(list(output_path.glob('*.jpg'))) + 1}.jpg"
    thumbnail.save(str(out_file), THUMBNAIL_SPECS["format"], quality=output_quality)
    return str(out_file)


def _bold_text_template(
    base_img: Image.Image,
    title: str,
    font_path: str,
    overlay_opacity: float = 0.55,
) -> Image.Image:
    overlay = Image.new("RGBA", base_img.size, (0, 0, 0, int(255 * overlay_opacity)))
    base_img = base_img.convert("RGBA")
    base_img = Image.alpha_composite(base_img, overlay).convert("RGB")

    draw = ImageDraw.Draw(base_img)
    font = _load_font(font_path, 72)
    w, h = base_img.size

    wrapped = _wrap_text(title, font, w - 100)
    lines = wrapped.split("\n")[:3]
    line_height = 80
    total_text_height = len(lines) * line_height
    text_y = (h - total_text_height) // 2

    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        line_w = bbox[2] - bbox[0]
        text_x = (w - line_w) // 2
        shadow_offset = 4
        draw.text(
            (text_x + shadow_offset, text_y + shadow_offset),
            line,
            font=font,
            fill=(0, 0, 0, 180),
        )
        draw.text((text_x, text_y), line, font=font, fill=(255, 255, 255))
        text_y += line_height

    accent_y = h - 8
    draw.rectangle([0, accent_y, w, h], fill=(255, 200, 0))

    return base_img


def _split_layout_template(
    base_img: Image.Image, title: str, font_path: str
) -> Image.Image:
    w, h = base_img.size

    right_img = base_img.crop((w // 2, 0, w, h))
    left_panel = Image.new("RGB", (w // 2, h), (30, 30, 50))

    thumbnail = Image.new("RGB", (w, h))
    thumbnail.paste(left_panel, (0, 0))
    thumbnail.paste(right_img, (w // 2, 0))

    draw = ImageDraw.Draw(thumbnail)
    font = _load_font(font_path, 64)

    wrapped = _wrap_text(title, font, w // 2 - 60)
    lines = wrapped.split("\n")[:4]
    text_y = (h - len(lines) * 64) // 2

    for line in lines:
        draw.text((30, text_y), line, font=font, fill=(255, 255, 255))
        text_y += 70

    return thumbnail


def _minimal_template(base_img: Image.Image, title: str, font_path: str) -> Image.Image:
    draw = ImageDraw.Draw(base_img)
    font = _load_font(font_path, 48)

    overlay = Image.new("RGBA", base_img.size, (0, 0, 0, int(255 * 0.3)))
    base_img = base_img.convert("RGBA")
    base_img = Image.alpha_composite(base_img, overlay).convert("RGB")
    draw = ImageDraw.Draw(base_img)

    w, h = base_img.size
    bar_height = 140
    draw.rectangle([0, h - bar_height, w, h], fill=(0, 0, 0, 200))

    wrapped = _wrap_text(title, font, w - 60)
    lines = wrapped.split("\n")[:2]

    text_y = h - bar_height + 20
    for line in lines:
        draw.text((30, text_y), line, font=font, fill=(255, 255, 255))
        text_y += 52

    return base_img


def _create_fallback_bg() -> Image.Image:
    return Image.new(
        "RGB", (THUMBNAIL_SPECS["width"], THUMBNAIL_SPECS["height"]), (20, 30, 50)
    )


def _load_font(font_path: str, default_size: int) -> ImageFont.FreeTypeFont:
    path = Path(font_path)
    if path.exists():
        try:
            return ImageFont.truetype(str(path), default_size)
        except Exception:
            pass
    return ImageFont.load_default()


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> str:
    words = text.split()
    if not words:
        return ""
    lines = []
    current_line = words[0]
    draw = ImageDraw.Draw(Image.new("RGB", (1, 1)))

    for word in words[1:]:
        test_line = current_line + " " + word
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if (bbox[2] - bbox[0]) <= max_width:
            current_line = test_line
        else:
            lines.append(current_line)
            current_line = word
    lines.append(current_line)
    return "\n".join(lines)
