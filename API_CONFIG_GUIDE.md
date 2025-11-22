# API 配置指南（OpenAI 兼容格式）

## 🎯 概述

本应用现在使用 **OpenAI 兼容格式** 的 API，支持绝大多数第三方 AI 服务提供商。

---

## ✅ 支持的服务商

只要您的服务商支持 OpenAI API 格式，就可以使用！常见的有：

- ✅ **第三方中转服务**（如您提到的服务商）
- ✅ **OpenAI 官方**
- ✅ **Azure OpenAI**
- ✅ **本地部署**（如 Ollama、LocalAI）
- ✅ **其他支持 OpenAI 格式的服务**

---

## 📝 配置示例

### 第三方中转服务（推荐）

```
API 地址：https://api.your-provider.com/v1
API 密钥：sk-xxxxxxxxxxxxxxxx
文本模型：gemini-2.5-pro (或您服务商支持的模型)
图像模型：none (如果不支持图像生成)
```

### OpenAI 官方

```
API 地址：https://api.openai.com/v1
API 密钥：sk-xxxxxxxxxxxxxxxx
文本模型：gpt-4
图像模型：dall-e-3
```

### Azure OpenAI

```
API 地址：https://your-resource.openai.azure.com/openai/deployments/v1
API 密钥：your-azure-api-key
文本模型：gpt-4
图像模型：dall-e-3
```

### 本地 Ollama

```
API 地址：http://localhost:11434/v1
API 密钥：ollama (填任意值)
文本模型：llama3
图像模型：none
```

---

## 🔧 配置字段说明

### 1. API 地址

**格式**：`https://your-api.com/v1`

**注意事项**：
- ✅ 末尾是 `/v1`
- ❌ 不要加 `/chat/completions`
- ✅ 示例：`https://api.example.com/v1`

### 2. API 密钥

**格式**：通常以 `sk-` 开头

**注意事项**：
- 从您的服务商处获取
- 保密存储，不要分享给他人
- 配置保存在浏览器本地，不会上传服务器

### 3. 文本分析模型

**作用**：用于分析脚本、设计方案、提取配图

**要求**：
- 必须支持 **文本对话**
- 建议支持 **Vision**（识别图片）
- 推荐使用较强的模型

**常见选项**：
- `gemini-2.5-pro` - Gemini 最新模型
- `gpt-4` - OpenAI GPT-4
- `gpt-4-vision-preview` - 支持视觉的 GPT-4
- `claude-3-opus` - Anthropic Claude
- `llama3` - 本地 Llama3

### 4. 图像生成模型

**作用**：生成参考预览图

**要求**：
- 支持图像生成（可选）
- 如果不支持，填 `none`

**常见选项**：
- `dall-e-3` - OpenAI 图像生成
- `none` - 不使用图像生成（使用占位图）

---

## 🚀 快速开始

### 步骤 1：获取 API 信息

联系您的服务商，获取：
1. API 基础地址
2. API 密钥
3. 支持的模型列表

### 步骤 2：在页面配置

1. 打开应用
2. 点击 "立即配置"
3. 填写以下信息：

```
API 地址：https://api.your-provider.com/v1
API 密钥：sk-xxxxxxxxxx
文本模型：gemini-2.5-pro
图像模型：none
```

4. 点击 "保存配置"

### 步骤 3：测试

输入测试脚本：
```
这是一个测试脚本。
主要内容包括：
1. 第一点
2. 第二点
3. 第三点
```

点击 "开始生成"，查看是否正常工作。

---

## ⚠️ 常见问题

### Q1: 提示 "API key not valid"

**原因**：
- API 密钥错误
- API 地址不正确
- 服务商 API 格式不兼容

**解决**：
1. 检查 API 密钥是否正确
2. 确认 API 地址格式：`https://xxx/v1`
3. 咨询服务商是否支持 OpenAI 兼容格式

### Q2: 图像生成失败

**原因**：
- 您的服务商不支持图像生成
- 图像模型名称错误

**解决**：
1. 将图像模型改为 `none`
2. 系统会自动使用占位图

### Q3: Vision 功能不可用（配图提取失败）

**原因**：
- 文本模型不支持 Vision

**解决**：
- 使用支持 Vision 的模型（如 `gpt-4-vision-preview`）
- 或接受配图提取功能不可用

### Q4: 请求超时

**原因**：
- 网络问题
- API 服务繁忙

**解决**：
1. 检查网络连接
2. 稍后重试
3. 联系服务商

---

## 🔐 安全提示

1. **API 密钥保密**
   - 不要分享给他人
   - 不要提交到代码仓库
   - 定期更换密钥

2. **本地存储**
   - 配置保存在浏览器 localStorage
   - 仅在您的电脑上可见
   - 清除浏览器数据会丢失配置

3. **HTTPS**
   - 确保 API 地址使用 HTTPS
   - 避免使用 HTTP（不安全）

---

## 📊 API 调用说明

### 使用的 API 端点

1. **文本分析** (必需)
   ```
   POST /v1/chat/completions
   ```
   - 分析脚本
   - 生成设计方案
   - 提取配图信息

2. **图像生成** (可选)
   ```
   POST /v1/images/generations
   ```
   - 生成参考预览图

### 请求示例

**文本分析**：
```json
{
  "model": "gemini-2.5-pro",
  "messages": [
    {
      "role": "user",
      "content": "分析这段脚本..."
    }
  ]
}
```

**图像生成**：
```json
{
  "model": "dall-e-3",
  "prompt": "创建一个PPT页面...",
  "size": "1792x1024"
}
```

---

## 💡 优化建议

### 1. 选择合适的模型

- **质量优先**：使用 `gpt-4` 或 `gemini-2.5-pro`
- **成本优先**：使用 `gpt-3.5-turbo` 或本地模型
- **平衡选择**：根据实际需求选择

### 2. 控制成本

- 图像生成较贵，如果预算有限，设为 `none`
- 使用文本模型的占位图功能
- 批量处理时注意控制频率

### 3. 提高成功率

- 使用稳定的 API 服务商
- 配置合理的超时时间
- 网络不稳定时减少并发请求

---

## 📞 获取帮助

如果遇到问题：

1. 检查本指南的"常见问题"部分
2. 查看浏览器控制台错误信息
3. 联系您的 API 服务商
4. 提交 GitHub Issue

---

**祝您使用愉快！** 🎉
