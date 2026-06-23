#!/usr/bin/env python3
import os
from pathlib import Path
from zipfile import ZipFile

import requests

FONT_DIR = Path("assets/fonts")
FONT_DIR.mkdir(parents=True, exist_ok=True)
FONT_URL = "https://fonts.google.com/download?family=Montserrat"
FONT_ZIP = FONT_DIR / "montserrat.zip"


def download_montserrat() -> bool:
    if (FONT_DIR / "Montserrat-Bold.ttf").exists():
        print("Montserrat-Bold.ttf already exists. Skipping download.")
        return True

    print("Downloading Montserrat font from Google Fonts...")
    try:
        r = requests.get(FONT_URL, stream=True, timeout=30)
        r.raise_for_status()
        with open(FONT_ZIP, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

        with ZipFile(FONT_ZIP) as z:
            z.extractall(FONT_DIR)

        os.remove(FONT_ZIP)
        print(f"Font extracted to {FONT_DIR}")
        return True
    except Exception as e:
        print(f"Error downloading font: {e}")
        if FONT_ZIP.exists():
            os.remove(FONT_ZIP)
        return False


def download_from_github() -> bool:
    url = "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/static/Montserrat-Bold.ttf"
    try:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        with open(FONT_DIR / "Montserrat-Bold.ttf", "wb") as f:
            f.write(r.content)
        print(f"Downloaded Montserrat-Bold.ttf from GitHub")
        return True
    except Exception as e:
        print(f"GitHub download failed: {e}")
        return False


if __name__ == "__main__":
    if not download_montserrat():
        print("Trying alternative source...")
        download_from_github()
