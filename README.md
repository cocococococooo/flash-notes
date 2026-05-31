# 闪记 (Flash Notes)

AI 驱动的移动端学习笔记应用 MVP。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React Native (Expo) + Expo Router |
| 后端 | Python FastAPI + SQLAlchemy |
| 数据库 | SQLite |
| AI | OpenAI GPT-4o-mini (Vision) |

## 快速启动

### 1. 后端

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
# 复制环境变量并填写 OpenAI Key
cp .env.example .env

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API 文档自动生成于 http://localhost:8000/docs

### 2. 前端

```bash
cd mobile
npm install
npx expo start
```

- Android 模拟器: 按 `a`
- iOS 模拟器: 按 `i`
- 真机: 用 Expo Go 扫码

> **注意**: 如果使用真机测试，需将 `mobile/constants/config.ts` 中的 `API_BASE_URL` 改为电脑的局域网 IP。

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/projects` | 创建项目 |
| GET | `/projects` | 项目列表 |
| DELETE | `/projects/:id` | 删除项目 |
| POST | `/projects/:id/images` | 批量上传图片 |
| GET | `/projects/:id/images` | 获取图片列表及 AI 分析 |
| PUT | `/images/:id` | 更新图片要点/标签 |
| POST | `/projects/:id/generate-note` | 生成结构化笔记 |
| GET | `/projects/:id/note` | 获取笔记 |
| PUT | `/projects/:id/note` | 保存笔记编辑 |

## 项目结构

```
flash-notes/
├── backend/
│   └── app/
│       ├── main.py           # FastAPI 入口
│       ├── database.py       # SQLite 连接
│       ├── models.py         # ORM 模型
│       ├── schemas.py        # Pydantic 校验
│       ├── routes/
│       │   ├── projects.py   # 项目 CRUD + 图片上传
│       │   ├── images.py     # 图片分析结果
│       │   └── notes.py      # 笔记生成与编辑
│       └── services/
│           └── ai_service.py # OpenAI Vision 调用
├── mobile/
│   ├── app/
│   │   ├── _layout.tsx       # 路由布局
│   │   ├── index.tsx         # 项目列表页
│   │   ├── project/[id].tsx  # 项目详情页
│   │   └── note/[id].tsx     # 笔记查看/编辑页
│   ├── components/
│   │   └── ImageCard.tsx     # 图片卡片组件
│   ├── services/
│   │   ├── api.ts            # API 客户端
│   │   └── imageUtils.ts     # 图片选择与压缩
│   └── constants/
│       └── config.ts         # 配置常量
└── README.md
```

## 关键设计

- **图片压缩**: 上传前前端压缩至最长边 ≤1024px，quality 0.7
- **异步 AI**: 上传后后端立即返回，后台线程调用 OpenAI，前端每 3 秒轮询状态
- **成本控制**: 使用 gpt-4o-mini + `detail: low` 降低 Token 消耗；笔记生成时摘要裁剪至 8000 字符
- **内联编辑**: 要点和标签点击即可编辑，失焦自动保存
