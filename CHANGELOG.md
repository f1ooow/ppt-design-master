# 更新日志

## v2.0.0 - 专注参考图生成 (2025-11-21)

### 🎯 重大定位调整

**项目重新定位**：从"PPT 生成工具"精简为"PPT 参考图生成器"

**原因**：
- AI 生成的 PPT 质量难以满足专业要求
- 参考图 + 人工制作的工作流程更实用
- 简化项目，专注核心价值

### ✨ 新增功能

#### 1. **模板持久化保存** ⭐⭐⭐
- ✅ 上传模板后可选择"记住此模板"
- ✅ 下次打开自动加载，无需重复上传
- ✅ 使用 localStorage 保存
- ✅ 支持清除保存的模板
- ✅ 存储失败自动提示（处理 QuotaExceededError）

#### 2. **批量并发生成** ⭐⭐⭐
- ✅ 支持一次输入多段脚本（每行一段）
- ✅ 使用 `Promise.all` 并发生成所有参考图
- ✅ 实时显示每张图片的生成进度
- ✅ 生成完成后显示结果网格
- ✅ 支持单张下载或批量下载全部
- ✅ 批量下载带延迟，避免浏览器阻止

### 🗑️ 移除功能

#### 移除 PPT 生成相关代码
- ❌ 删除 `/app/api/analyze-design/`
- ❌ 删除 `/app/api/generate-ppt/`
- ❌ 删除 `/lib/ppt/generator.ts`
- ❌ 移除 `pptxgenjs` 依赖
- ❌ 移除 `pptx-automizer` 依赖

### 🎨 界面更新

- ✅ 更新页面标题："PPT 设计参考图生成器"
- ✅ 更新副标题："AI 生成 PPT 参考图 - 支持单张和批量并发生成"
- ✅ 批量处理界面全新设计
- ✅ 添加脚本行数统计
- ✅ 添加结果网格展示

### 📦 依赖更新

**移除**：
- pptxgenjs
- pptx-automizer

**保留**：
- @google/generative-ai
- jszip
- react-image-crop
- sharp
- zustand

### 🔧 技术改进

- ✅ 优化批量生成性能（并发而非串行）
- ✅ 改进错误处理
- ✅ 优化 localStorage 使用
- ✅ 代码结构更清晰

---

## v1.1.0 - OpenAI 兼容格式支持 (2025-01-08)

### 🚀 重大更新

#### 改用 OpenAI 兼容 API 格式

**原因**：
- 原 Gemini SDK 与部分第三方服务商不兼容
- 用户报告 API Key 验证失败

**改进**：
- ✅ 现在使用标准的 OpenAI API 格式
- ✅ 支持绝大多数第三方 AI 服务提供商
- ✅ 兼容 OpenAI、Azure、Gemini、Claude 等
- ✅ 支持本地部署（Ollama、LocalAI）

### 📝 配置变更

#### API 配置格式更新

**旧格式**（不再使用）：
```
使用 @google/generative-ai SDK
仅支持 Google 官方和特定格式的代理
```

**新格式**（推荐）：
```
API 地址：https://api.your-provider.com/v1
API 密钥：sk-xxxxxxxxxx
文本模型：gemini-2.5-pro（或其他）
图像模型：none（或 dall-e-3）
```

#### 新增功能

1. **占位图功能**
   - 当图像生成模型设为 `none` 时
   - 自动生成 SVG 占位图作为参考
   - 避免因不支持图像生成而导致失败

2. **更友好的配置说明**
   - 配置面板新增详细提示
   - 支持填写 `none` 禁用图像生成
   - 提示 API 地址格式要求

### 🔧 技术变更

#### 新增文件

- `lib/gemini/openai-client.ts` - OpenAI 兼容客户端
- `API_CONFIG_GUIDE.md` - API 配置详细指南
- `CHANGELOG.md` - 本文件

#### 修改文件

- `app/api/analyze-design/route.ts` - 使用新客户端
- `app/api/generate-preview/route.ts` - 使用新客户端
- `app/api/extract-images/route.ts` - 使用新客户端
- `components/ConfigPanel.tsx` - 更新配置说明
- `.env.example` - 更新配置示例
- `config/gemini.ts` - 更新默认值

### 📖 文档更新

- ✅ 新增 `API_CONFIG_GUIDE.md` 详细配置指南
- ✅ 更新 `README.md` 快速开始部分
- ✅ 更新 `.env.example` 配置示例

### ⚠️ 破坏性变更

**无** - 仅内部实现变更，用户配置格式保持兼容

### 🐛 修复问题

- 修复：第三方服务商 API Key 验证失败
- 修复：Gemini SDK 兼容性问题
- 改进：错误提示更友好

---

## v1.0.0 - 初始版本 (2025-01-08)

### ✨ 核心功能

- ✅ AI 辅助 PPT 设计
- ✅ 双输出模式（参考图 + 可编辑 PPT）
- ✅ 支持粘贴截图上传模板
- ✅ 实时进度显示
- ✅ 配图智能提取
- ✅ 历史记录保存
- ✅ 页面级 API 配置

### 🏗️ 技术栈

- Next.js 15
- React 19
- TypeScript
- TailwindCSS
- PptxGenJS
- Zustand

### 📦 功能模块

1. **配置管理**
   - 页面级 API 配置
   - localStorage 持久化
   - 配置验证

2. **PPT 生成**
   - 5 种布局模板
   - 可编辑 .pptx 文件
   - 真实文本（不乱码）

3. **AI 集成**
   - 脚本分析
   - 参考图生成
   - 配图提取

4. **用户界面**
   - 响应式设计
   - 暗色模式支持
   - 实时进度反馈

---

**查看完整文档**：
- `README.md` - 项目说明
- `QUICK_START.md` - 快速开始
- `API_CONFIG_GUIDE.md` - API 配置指南
