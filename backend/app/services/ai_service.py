import os
import json
from app.services.local_ocr_service import analyze_image_local


def analyze_image(file_path: str) -> dict:
    try:
        return analyze_image_local(file_path)
    except Exception as e:
        raise RuntimeError(f"OCR analysis failed: {e}")


def generate_note(summaries: list[dict]) -> str:
    points = []
    for i, s in enumerate(summaries):
        summary = s.get("summary", "")
        tags = s.get("tags", "[]")
        points.append(f"[图{i+1}]\n摘要: {summary}\n标签: {tags}")

    points_text = "\n\n".join(points)
    if len(points_text) > 8000:
        points_text = points_text[:8000] + "\n[内容已截断]"

    sections = []
    for i, s in enumerate(summaries):
        summary = s.get("summary", "")
        if summary:
            sections.append(f"### 第{i+1}部分\n\n{summary}")

    title = "学习笔记"
    body = "\n\n".join(sections) if sections else "暂无内容"

    return f"# {title}\n\n{body}"
