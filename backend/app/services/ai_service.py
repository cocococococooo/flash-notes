import os
import json
import base64
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

VISION_PROMPT = """Extract all text from this image. Then summarize the core knowledge in one sentence. Finally, give 1-3 category tags (e.g., 概念, 公式, 图表, 代码, 定义, 示例).

Return ONLY valid JSON:
{ "ocr_text": "...", "summary": "...", "tags": ["..."] }"""

NOTE_PROMPT = """Based on the following knowledge points extracted from multiple study screenshots, generate a complete structured note.

Requirements:
1. A general title and a one-sentence subtitle
2. Logically group the points into 2-4 sections, each with a subheading
3. Integrate related points in each section, annotate with associated image indices at the end (e.g., [图1])

Return in Markdown format.

Knowledge points:
{points_text}"""


def _encode_image(file_path: str) -> str:
    with open(file_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def analyze_image(file_path: str) -> dict:
    try:
        b64 = _encode_image(file_path)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": VISION_PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "low"}},
                    ],
                }
            ],
            max_tokens=1024,
            response_format={"type": "json_object"},
        )
        text = resp.choices[0].message.content.strip()
        data = json.loads(text)
        return {
            "ocr_text": data.get("ocr_text", ""),
            "ai_summary": data.get("summary", ""),
            "tags": json.dumps(data.get("tags", []), ensure_ascii=False),
        }
    except Exception as e:
        raise RuntimeError(f"AI analysis failed: {e}")


def generate_note(summaries: list[dict]) -> str:
    points_text = "\n\n".join(
        f"[图{i+1}]\n摘要: {s['summary']}\n标签: {s['tags']}" for i, s in enumerate(summaries)
    )
    if len(points_text) > 8000:
        points_text = points_text[:8000] + "\n[内容已截断]"

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "你是一个专业的笔记整理助手。请用中文输出。"},
                {"role": "user", "content": NOTE_PROMPT.format(points_text=points_text)},
            ],
            max_tokens=2048,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        raise RuntimeError(f"Note generation failed: {e}")
