import os
import json
import logging

logger = logging.getLogger(__name__)

_ocr_instance = None


def _get_ocr():
    global _ocr_instance
    if _ocr_instance is None:
        from paddleocr import PaddleOCR
        _ocr_instance = PaddleOCR(
            use_angle_cls=True,
            lang="ch",
            show_log=False,
            use_gpu=False,
            det_db_thresh=0.3,
            det_db_box_thresh=0.5,
            rec_batch_num=16,
        )
    return _ocr_instance


def _clean_ocr_text(text: str) -> str:
    import re
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[\u3000\xa0]+', ' ', text)
    text = re.sub(r'(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])', '', text)
    text = re.sub(r'(?<=[a-zA-Z])\s+(?=[a-zA-Z])', '', text)
    text = re.sub(r'([^\w\s])\1+', r'\1', text)
    text = text.strip()
    return text


def ocr_recognize(file_path: str) -> str:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Image not found: {file_path}")

    ocr = _get_ocr()
    result = ocr.ocr(file_path, cls=True)

    if not result or not result[0]:
        return ""

    lines = []
    for line in result[0]:
        text = line[1][0]
        confidence = line[1][1]
        if confidence > 0.7:
            cleaned_text = _clean_ocr_text(text)
            if cleaned_text:
                lines.append(cleaned_text)

    return "\n".join(lines)


def analyze_image_local(file_path: str) -> dict:
    ocr_text = ocr_recognize(file_path)

    summary = _generate_summary(ocr_text)
    tags = _generate_tags(ocr_text)

    return {
        "ocr_text": ocr_text,
        "ai_summary": summary,
        "tags": json.dumps(tags, ensure_ascii=False),
    }


def _generate_summary(ocr_text: str) -> str:
    if not ocr_text:
        return ""
    sentences = [s.strip() for s in ocr_text.replace("。", "。\n").split("\n") if s.strip()]
    if len(sentences) <= 2:
        return ocr_text[:200]
    return "。".join(sentences[:3]) + "。"


def _generate_tags(ocr_text: str) -> list[str]:
    tag_keywords = {
        "概念": ["定义", "概念", "是指", "是谓", "含义", "意思"],
        "公式": ["公式", "=", "∑", "∫", "√", "²", "²", "log", "sin", "cos"],
        "代码": ["代码", "function", "class", "import", "def ", "return", "if ", "for "],
        "示例": ["例如", "比如", "举例", "示例", "案例"],
        "定理": ["定理", "定律", "原理", "法则"],
        "图表": ["图", "表", "图表", "数据"],
    }
    tags = []
    for tag, keywords in tag_keywords.items():
        if any(kw in ocr_text for kw in keywords):
            tags.append(tag)
    if not tags:
        tags = ["笔记"]
    return tags
