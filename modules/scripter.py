import json
import os
import re
from dataclasses import dataclass, field
from typing import Optional

import google.generativeai as genai
from groq import Groq

from modules.sourcer import TopicItem
from utils.config_loader import get_api_key

SCRIPT_PROMPT_TEMPLATE = """
You are an expert YouTube script writer. Write a {style} video script for:

Topic: {topic_title}
Keywords: {keywords}
Target Duration: {target_minutes} minutes
Audience: General / Educational

IMPORTANT RULES:
- The hook must grab attention in the first 10 seconds
- Each section must include a visual_cue (what footage/image to show)
- The outro MUST include this exact sentence: "This video was created with the assistance of artificial intelligence."
- Do NOT include any copyrighted material
- Keep language clear and engaging

Output ONLY valid JSON. No preamble. No markdown. No explanation.

Schema:
{{
  "title_suggestion": "<engaging title under 80 chars>",
  "hook": "<opening narration 30-40 words>",
  "sections": [
    {{
      "heading": "<section title>",
      "content": "<narration text 80-150 words>",
      "visual_cue": "<describe footage/image to show>",
      "estimated_duration_seconds": <integer>
    }}
  ],
  "outro": "<closing narration 30-50 words including AI disclosure>"
}}
"""


@dataclass
class ScriptSection:
    heading: str
    content: str
    visual_cue: str
    estimated_duration_seconds: int


@dataclass
class VideoScript:
    topic_id: str
    title_suggestion: str
    hook: str
    sections: list[ScriptSection]
    outro: str
    full_text: str
    total_words: int
    estimated_duration_seconds: int


def generate_script(
    topic: TopicItem,
    style: str = "educational",
    target_minutes: int = 5,
    provider: str = "gemini",
    fallback_providers: list[str] | None = None,
) -> VideoScript:
    prompt = SCRIPT_PROMPT_TEMPLATE.format(
        style=style,
        topic_title=_sanitize_topic_title(topic.title),
        keywords=", ".join(topic.keywords),
        target_minutes=target_minutes,
    )

    providers_to_try = [provider] + (fallback_providers or ["groq"])
    last_error = None
    for p in providers_to_try:
        try:
            if p == "gemini":
                script_data = _call_gemini(prompt)
            else:
                script_data = _call_groq(prompt)
            break
        except Exception as e:
            last_error = e
            continue
    else:
        raise RuntimeError(
            f"All AI providers failed. Last error: {last_error}"
        ) from last_error

    sections = [
        ScriptSection(
            heading=s.get("heading", ""),
            content=s.get("content", ""),
            visual_cue=s.get("visual_cue", ""),
            estimated_duration_seconds=s.get("estimated_duration_seconds", 30),
        )
        for s in script_data.get("sections", [])
    ]

    full_text_parts = [script_data.get("hook", "")]
    for s in sections:
        full_text_parts.append(s.content)
    full_text_parts.append(_strip_ai_disclosure(script_data.get("outro", "")))
    full_text_parts.append(
        "This video was created with the assistance of artificial intelligence."
    )
    full_text = " ".join(full_text_parts)

    total_words = len(full_text.split())
    estimated_duration = sum(s.estimated_duration_seconds for s in sections)
    estimated_duration += 15 + 20

    return VideoScript(
        topic_id=topic.id,
        title_suggestion=script_data.get("title_suggestion", topic.title),
        hook=script_data.get("hook", ""),
        sections=sections,
        outro=script_data.get("outro", ""),
        full_text=full_text,
        total_words=total_words,
        estimated_duration_seconds=estimated_duration,
    )


def _call_gemini(prompt: str) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        api_key = get_api_key("GEMINI_API_KEY")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.7,
            max_output_tokens=2048,
        ),
    )
    return json.loads(response.text)


def _call_groq(prompt: str) -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        api_key = get_api_key("GROQ_API_KEY")
    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model="llama-3.1-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.7,
    )
    return json.loads(response.choices[0].message.content)


def _sanitize_topic_title(title: str) -> str:
    title = title.strip()[:200]
    title = re.sub(r"[<>{}]", "", title)
    return title


def _strip_ai_disclosure(text: str) -> str:
    return re.sub(
        r"(?i)(this video was created with the assistance of artificial intelligence\.?)",
        "",
        text,
    ).strip()
