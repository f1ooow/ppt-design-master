# PPT 设计参考图生成器

AI 生成 PPT 设计参考图 - 让 AI 提供灵感，你来完成创作

## 🎯 核心功能

- **AI 参考图生成**：使用 Gemini 2.5 Pro 根据脚本生成精美的 PPT 参考图
- **文字标注**：自动标注参考图中的文字内容和位置
- **智能配图提取**：从参考图中裁剪提取需要的插画元素
- **批量并发生成**：一次输入多段脚本，并发生成多张参考图，提高效率
- **模板持久化**：上传的模板可保存，下次自动加载
- **历史记录**：保存所有生成记录（本地存储）

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 3. 在页面上配置 API

**无需修改任何配置文件！**

首次打开应用时，会显示"API 未配置"状态：

1. 点击"立即配置"按钮
2. 在弹出的配置面板中填写：
   - **API 地址**：您的 Gemini API 地址（支持代理/中转服务）
   - **API 密钥**：您的 Gemini API Key
   - **模型名称**：默认值通常无需修改
3. 点击"保存配置"

配置会自动保存在浏览器本地，下次访问无需重新配置。

#### 获取 Gemini API Key

- 官方：访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
- 或使用您自己的代理/中转服务

## 📖 使用流程

### 单页面生成

1. 输入 PPT 页面的脚本内容
2. 可选：上传模板图片（支持直接粘贴截图）
3. 可选：勾选"记住此模板"，下次自动加载
4. 点击"开始生成"
5. 查看生成结果：
   - 参考图预览
   - 文字标注示意图
   - 可裁剪提取配图元素
6. 下载参考图

### 批量并发生成

1. 切换到"批量处理"模式
2. 输入多段脚本（每行一段）
3. 上传模板（可选，会应用到所有页面）
4. 点击"开始批量生成"
5. 系统会**并发**生成所有参考图，节省时间
6. 查看生成结果网格
7. 下载单张或全部下载

## 🏗️ 技术架构

### 前端
- **Next.js 15** - React 框架
- **React 19** - UI 组件
- **TypeScript** - 类型安全
- **TailwindCSS** - 样式框架
- **Zustand** - 状态管理

### 后端
- **Next.js API Routes** - API 服务
- **Gemini AI** - 图像生成和视觉分析
- **Sharp** - 图像处理

### 核心流程

```
脚本输入 + 模板（可选）
     ↓
Gemini 2.5 Pro 图像生成
     ↓
   参考图生成
     ↓
Gemini 视觉分析
     ↓
  文字标注
     ↓
配图裁剪提取（用户操作）
     ↓
  下载使用
```

### 批量并发流程

```
多段脚本输入
     ↓
  按行分割
     ↓
Promise.all 并发调用
     ↓
同时生成多张参考图
     ↓
  展示结果网格
     ↓
批量或单独下载
```

## 📁 项目结构

```
PPT设计参考图生成器/
├── app/                    # Next.js 应用目录
│   ├── api/               # API 路由
│   │   ├── generate-preview/    # 生成参考图
│   │   ├── annotate-text/       # 文字标注
│   │   └── extract-images/      # 提取配图
│   ├── page.tsx           # 主页面
│   └── globals.css        # 全局样式
├── lib/                   # 核心库
│   ├── gemini/           # Gemini 客户端
│   └── store/            # 状态管理
├── components/            # React 组件
│   ├── ConfigPanel.tsx          # API 配置
│   ├── TemplateUpload.tsx       # 模板上传
│   ├── ProcessingStatus.tsx     # 进度显示
│   ├── ResultDisplay.tsx        # 结果展示
│   ├── ImageCropper.tsx         # 图片裁剪
│   ├── AnnotationOverlay.tsx    # 标注叠加
│   └── PromptSettings.tsx       # 提示词设置
├── types/                 # TypeScript 类型
├── config/                # 配置文件
└── public/                # 静态资源
```

## 🔧 开发指南

### 自定义提示词

在页面上点击"提示词设置"可以自定义 AI 生成参考图的提示词，支持：
- 参考图生成提示词
- 文字标注提示词

### 扩展功能

想要添加新功能？以下是一些建议：
1. 添加更多图片处理功能（滤镜、调整等）
2. 集成其他 AI 模型（DALL-E、Midjourney 等）
3. 添加设计模板库
4. 实现云端存储

## ✨ 新增功能（v2.0）

- ✅ **模板持久化**：上传一次，自动保存，下次无需重新上传
- ✅ **批量并发生成**：一次输入多段脚本，并发生成多张参考图
- ✅ **精简项目**：移除复杂的 PPT 生成功能，专注于参考图生成

## 📝 未来计划

- [ ] 历史记录页面（查看和管理所有生成记录）
- [ ] 参考图编辑器（在线调整颜色、布局等）
- [ ] 样式模板库（预设多种设计风格）
- [ ] 导出为 PDF
- [ ] 用户认证和云端同步
- [ ] 团队协作功能

## ⚠️ 注意事项

1. **Gemini API 配置**：需要自行配置 API 地址和密钥
2. **图像生成**：依赖 Gemini 的图像生成能力，需要确保 API 支持
3. **模板图片**：建议使用清晰的截图或设计稿作为模板
4. **脚本长度**：建议单个页面脚本不超过 500 字，以获得最佳效果
5. **批量生成**：并发数量取决于 API 的速率限制，建议一次不超过 10 张
6. **浏览器存储**：模板和历史记录保存在浏览器本地，清除缓存会丢失数据

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [PptxGenJS](https://github.com/gitbrent/PptxGenJS)
- [pptx-automizer](https://github.com/sinfonier-project/pptx-automizer)
- [Google Generative AI](https://ai.google.dev/)
- [Next.js](https://nextjs.org/)

---

Made with ❤️ by PPT 设计大师团队
