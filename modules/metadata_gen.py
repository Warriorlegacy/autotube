import json
import os
from dataclasses import dataclass, field

import google.generativeai as genai

from modules.media_fetcher import MediaAsset
from modules.scripter import VideoScript

DESCRIPTION_TEMPLATE = """
{ai_description}

{ai_disclosure}

{attribution_block}
{hashtags}
"""


@dataclass
class VideoMetadata:
    title: str
    description: str
    tags: list[str]
    category_id: int = 27
    default_language: str = "en"
    made_for_kids: bool = False
    privacy_status: str = "public"


METADATA_PROMPT = """
Generate YouTube metadata for a video with this title suggestion: "{title}"
Topic: {topic}
Script sections: {sections}

Return ONLY valid JSON with this schema:
{{
  "title": "<SEO-optimized title, max 100 chars, engaging>",
  "description": "<2-3 paragraph engaging description, max 5000 chars>",
  "tags": ["<tag1>", "<tag2>", "<tag3>", "<tag4>", "<tag5>"],
  "hashtags": "#tag1 #tag2 #tag3"
}}

Rules:
- Title must be under 100 characters and include target keywords
- Description must be informative and include relevant keywords naturally
- Tags must be specific to the content (5-10 tags)
- No misleading or clickbait content
"""


def generate_metadata(
    script: VideoScript,
    media_assets: list[MediaAsset],
    music_source: str = "YouTube Audio Library",
    category_id: int = 27,
    privacy_status: str = "public",
    provider: str = "gemini",
) -> VideoMetadata:
    ai_data = _call_metadata_api(script, provider)

    title = ai_data.get("title", script.title_suggestion)[:100]
    if len(title) < 10:
        title = script.title_suggestion[:100]

    ai_description = ai_data.get("description", "")
    tags = ai_data.get("tags", [])
    hashtags = ai_data.get("hashtags", "")

    attribution_lines = (
        "\n".join(f"\ud83d\udcf7 {a.attribution}" for a in media_assets)
        if media_assets
        else ""
    )

    description = DESCRIPTION_TEMPLATE.format(
        ai_description=ai_description,
        ai_disclosure="\U0001f916 This video was created with the assistance of artificial intelligence.",
        attribution_block=f"\ud83d\udcf8 Stock footage & images from Pexels.com and Pixabay.com (CC0 License)\n\ud83c\udfb5 Background music from {music_source}\n{attribution_lines}"
        if attribution_lines
        else f"\ud83d\udcf8 Stock footage & images from Pexels.com and Pixabay.com (CC0 License)\n\ud83c\udfb5 Background music from {music_source}",
        hashtags=hashtags,
    ).strip()

    if len(description) > 5000:
        description = description[:4997] + "..."

    return VideoMetadata(
        title=title,
        description=description,
        tags=tags[:20],
        category_id=category_id,
        privacy_status=privacy_status,
    )


def _call_metadata_api(script: VideoScript, provider: str = "gemini") -> dict:
    sections_text = "; ".join(
        f"{s.heading}: {s.content[:100]}" for s in script.sections
    )
    prompt = METADATA_PROMPT.format(
        title=script.title_suggestion,
        topic=script.topic_id,
        sections=sections_text,
    )

    if provider == "gemini":
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.5,
                max_output_tokens=1024,
            ),
        )
        return json.loads(response.text)
    else:
        from groq import Groq

        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not set")
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model="llama-3.1-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.5,
        )
        return json.loads(response.choices[0].message.content)
