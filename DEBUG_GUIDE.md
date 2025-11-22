# 调试指南

## 错误："Unexpected token '<', "<!DOCTYPE "... is not valid JSON"

### 📋 问题说明

这个错误表明 API 返回了 HTML 页面而不是 JSON 数据。

**常见原因**：
1. API 地址配置错误
2. 服务器端代码出错，返回了错误页面
3. 网络请求被拦截或重定向

---

## 🔍 调试步骤

### 步骤 1：打开浏览器开发者工具

1. 按 **F12** 或右键 → "检查"
2. 切换到 **Console** 标签
3. 重新尝试生成

### 步骤 2：查看日志

查找以下日志信息：

```
[OpenAI Client] Requesting: https://...
[OpenAI Client] Model: gemini-2.5-pro
[OpenAI Client] Response status: 200/400/500
```

**如果看到**：
- `Response status: 200` - 请求成功，但返回格式不对
- `Response status: 400/401` - API 配置有误
- `Response status: 500` - 服务器错误
- `Failed to parse response` - 返回了非 JSON 内容

### 步骤 3：检查 Network 标签

1. 切换到 **Network** 标签
2. 筛选 **Fetch/XHR**
3. 重新点击"开始生成"
4. 找到失败的请求（通常是红色）
5. 点击查看详情

**检查以下信息**：

#### Request URL
```
应该是：http://localhost:3000/api/analyze-design
不应该是：http://localhost:3000/api/undefined
```

#### Request Headers
```
Content-Type: application/json
```

#### Request Payload
```json
{
  "script": "...",
  "geminiConfig": {
    "apiUrl": "https://...",
    "apiKey": "sk-...",
    ...
  }
}
```

#### Response
- 如果是 HTML（`<!DOCTYPE html>`）→ 服务器端错误
- 如果是 JSON 错误 → API 配置问题

---

## 💡 常见问题和解决方案

### 问题 1：API 地址配置错误

**症状**：
```
[OpenAI Client] Requesting: https://your-api.com/v1/chat/completions
Response status: 404
```

**解决**：
1. 检查 API 地址是否正确
2. 确认末尾是 `/v1`，不是 `/v1/chat/completions`
3. 确认服务商支持此路径

**正确示例**：
```
API 地址：https://api.example.com/v1
最终请求：https://api.example.com/v1/chat/completions
```

---

### 问题 2：API 密钥无效

**症状**：
```
Response status: 401
Error: Unauthorized
```

**解决**：
1. 检查 API 密钥是否正确
2. 确认没有多余的空格
3. 联系服务商确认密钥状态

---

### 问题 3：服务商不支持 OpenAI 格式

**症状**：
```
Response status: 200
Failed to parse response: <html>...
```

**解决**：
1. 确认服务商支持 OpenAI 兼容 API
2. 查看服务商文档，确认正确的调用格式
3. 联系服务商技术支持

---

### 问题 4：CORS 错误

**症状**：
```
Access to fetch at '...' has been blocked by CORS policy
```

**解决**：
这不应该发生在本地开发。如果出现：
1. 检查是否在使用代理
2. 清除浏览器缓存
3. 重启开发服务器

---

### 问题 5：返回格式不符合预期

**症状**：
```
API 返回格式不符合预期，请检查您的服务商是否支持 OpenAI 兼容格式
```

**解决**：
您的服务商可能使用了不同的响应格式。

**标准 OpenAI 格式**：
```json
{
  "choices": [
    {
      "message": {
        "content": "AI 生成的内容..."
      }
    }
  ]
}
```

**如果您的服务商格式不同**，需要修改 `lib/gemini/openai-client.ts`。

---

## 🛠️ 高级调试

### 使用 curl 测试 API

在终端运行：

```bash
curl -X POST "https://your-api.com/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gemini-2.5-pro",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

**预期响应**：
```json
{
  "choices": [
    {
      "message": {
        "content": "响应内容..."
      }
    }
  ]
}
```

**如果返回 HTML** → API 地址或格式错误

---

## 📞 获取帮助

### 1. 收集信息

请提供以下信息：

- 浏览器控制台的完整错误信息
- Network 标签中的请求详情
- 您的 API 配置（隐藏密钥）：
  ```
  API 地址：https://...
  文本模型：gemini-2.5-pro
  图像模型：none
  ```

### 2. 检查服务商文档

确认：
- 是否支持 OpenAI 兼容 API
- 正确的 API 地址格式
- 支持的模型列表
- 请求格式要求

### 3. 联系支持

- GitHub Issues: 提交问题报告
- 服务商支持：确认 API 格式

---

## 🔧 临时解决方案

如果您的服务商不支持标准 OpenAI 格式，您可以：

### 方案 1：使用测试模式

暂时跳过 AI 生成，使用占位数据测试 PPT 生成功能。

### 方案 2：切换服务商

使用已知兼容 OpenAI 格式的服务商：
- OpenAI 官方
- Azure OpenAI
- 其他已验证的第三方服务

### 方案 3：自定义适配

如果您了解服务商的 API 格式，可以修改 `lib/gemini/openai-client.ts` 中的 `chatCompletion` 方法以适配。

---

## ✅ 验证修复

修复后，您应该看到：

```
[OpenAI Client] Requesting: https://...
[OpenAI Client] Model: gemini-2.5-pro
[OpenAI Client] Response status: 200
[OpenAI Client] AI response received, length: 500
[OpenAI Client] Successfully parsed design: 您的标题
```

以及在右侧看到生成的结果。

---

**需要更多帮助？**
查看 `API_CONFIG_GUIDE.md` 获取详细的 API 配置说明。
