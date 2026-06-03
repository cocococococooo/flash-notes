import secrets
import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ShareLink, Note, Project, Image

router = APIRouter()


@router.post("/notes/{note_id}/share")
async def create_share_link(note_id: int, db: Session = Depends(get_db)):
    """创建分享链接"""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    
    token = secrets.token_urlsafe(32)
    share_link = ShareLink(
        noteId=note_id,
        token=token,
        createdAt=datetime.datetime.utcnow()
    )
    db.add(share_link)
    db.commit()
    db.refresh(share_link)
    
    return {
        "id": share_link.id,
        "token": token,
        "url": f"http://localhost:8000/share/{token}"
    }


@router.get("/share/{token}", response_class=HTMLResponse)
async def get_shared_note(token: str, db: Session = Depends(get_db)):
    """获取分享的笔记页面"""
    share_link = db.query(ShareLink).filter(ShareLink.token == token).first()
    if not share_link:
        raise HTTPException(status_code=404, detail="分享链接不存在或已过期")
    
    note = db.query(Note).filter(Note.id == share_link.noteId).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    
    project = db.query(Project).filter(Project.id == note.projectId).first()
    images = db.query(Image).filter(Image.projectId == note.projectId).all()
    
    # 生成HTML页面
    images_html = ""
    for img in images:
        if img.localUri:
            img_url = f"/uploads/{img.localUri.split('/')[-1]}" if "/" in img.localUri else f"/uploads/{img.localUri}"
            images_html += f'''
            <div class="image-card">
                <img src="{img_url}" alt="笔记图片" />
                <div class="ocr-text">{img.ocrText or ''}</div>
            </div>
            '''
    
    tags_html = ""
    if note.tags:
        import json
        try:
            tags = json.loads(note.tags)
            tags_html = "".join([f'<span class="tag">{tag}</span>' for tag in tags])
        except:
            pass
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{project.title if project else '笔记分享'} - 闪记</title>
        <meta property="og:title" content="{project.title if project else '笔记分享'}">
        <meta property="og:description" content="来自闪记的分享">
        <style>
            :root {{
                --accent: #18181B;
                --bg: #FAFAFA;
                --surface: #FFFFFF;
                --border: #ECECEE;
                --text-primary: #18181B;
                --text-secondary: #52525B;
                --text-tertiary: #A1A1AA;
            }}
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                background: var(--bg);
                color: var(--text-primary);
                line-height: 1.6;
            }}
            .container {{
                max-width: 480px;
                margin: 0 auto;
                padding: 20px;
            }}
            header {{
                text-align: center;
                padding: 20px 0;
            }}
            .logo {{
                font-size: 20px;
                font-weight: 700;
                color: var(--accent);
            }}
            .image-card {{
                margin-bottom: 16px;
                border-radius: 12px;
                overflow: hidden;
                background: var(--surface);
                border: 1px solid var(--border);
            }}
            .image-card img {{
                width: 100%;
                display: block;
            }}
            .ocr-text {{
                padding: 12px;
                font-size: 14px;
                color: var(--text-secondary);
                white-space: pre-wrap;
            }}
            .content {{
                background: var(--surface);
                border-radius: 12px;
                padding: 20px;
                margin-top: 16px;
                border: 1px solid var(--border);
            }}
            .title {{
                font-size: 22px;
                font-weight: 700;
                margin-bottom: 12px;
            }}
            .note-text {{
                font-size: 15px;
                color: var(--text-secondary);
                margin-bottom: 16px;
            }}
            .tags {{
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }}
            .tag {{
                background: #F4F4F5;
                padding: 6px 12px;
                border-radius: 100px;
                font-size: 13px;
                color: var(--accent);
            }}
            footer {{
                text-align: center;
                padding: 40px 0;
                color: var(--text-tertiary);
                font-size: 13px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <div class="logo">闪记</div>
            </header>
            
            {images_html}
            
            <div class="content">
                <h1 class="title">{project.title if project else '笔记'}</h1>
                <div class="note-text">{note.content}</div>
                <div class="tags">{tags_html}</div>
            </div>
            
            <footer>
                <p>由 闪记 生成分享链接</p>
            </footer>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)


@router.get("/api/share/{token}")
async def get_shared_note_api(token: str, db: Session = Depends(get_db)):
    """获取分享笔记的JSON数据"""
    share_link = db.query(ShareLink).filter(ShareLink.token == token).first()
    if not share_link:
        raise HTTPException(status_code=404, detail="分享链接不存在")
    
    note = db.query(Note).filter(Note.id == share_link.noteId).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    
    project = db.query(Project).filter(Project.id == note.projectId).first()
    images = db.query(Image).filter(Image.projectId == note.projectId).all()
    
    import json
    tags = []
    if note.tags:
        try:
            tags = json.loads(note.tags)
        except:
            pass
    
    return {
        "project": {
            "id": project.id if project else None,
            "title": project.title if project else "笔记",
            "createdAt": project.createdAt.isoformat() if project else None
        },
        "images": [
            {
                "id": img.id,
                "url": f"/uploads/{img.localUri.split('/')[-1]}" if img.localUri and "/" in img.localUri else f"/uploads/{img.localUri}" if img.localUri else None,
                "ocrText": img.ocrText or "",
                "aiSummary": img.aiSummary or "",
                "userSummary": img.userSummary or ""
            }
            for img in images
        ],
        "note": {
            "content": note.content,
            "tags": tags,
            "updatedAt": note.updatedAt.isoformat() if note.updatedAt else None
        }
    }


@router.delete("/share/{token}")
async def delete_share_link(token: str, db: Session = Depends(get_db)):
    """删除分享链接"""
    share_link = db.query(ShareLink).filter(ShareLink.token == token).first()
    if not share_link:
        raise HTTPException(status_code=404, detail="分享链接不存在")
    
    db.delete(share_link)
    db.commit()
    
    return {"message": "已删除"}
