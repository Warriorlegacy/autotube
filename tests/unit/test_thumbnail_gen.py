from pathlib import Path

import pytest
from PIL import Image

from modules.thumbnail_gen import generate_thumbnail


def test_generate_thumbnail_default_template(tmp_path):
    output_dir = str(tmp_path / "thumbnails")
    result = generate_thumbnail(
        title="Test Thumbnail Title",
        template="bold_text",
        output_dir=output_dir,
    )
    assert Path(result).exists()
    with Image.open(result) as img:
        assert img.size == (1280, 720)


def test_generate_thumbnail_split_layout(tmp_path):
    output_dir = str(tmp_path / "thumbnails")
    result = generate_thumbnail(
        title="Split Layout Test",
        template="split_layout",
        output_dir=output_dir,
    )
    assert Path(result).exists()


def test_generate_thumbnail_minimal(tmp_path):
    output_dir = str(tmp_path / "thumbnails")
    result = generate_thumbnail(
        title="Minimal Template",
        template="minimal",
        output_dir=output_dir,
    )
    assert Path(result).exists()


def test_generate_thumbnail_with_background(tmp_path):
    bg_path = tmp_path / "bg.jpg"
    Image.new("RGB", (1920, 1080), color=(100, 150, 200)).save(bg_path)

    output_dir = str(tmp_path / "thumbnails")
    result = generate_thumbnail(
        title="With Background",
        background_image_path=str(bg_path),
        output_dir=output_dir,
    )
    assert Path(result).exists()
