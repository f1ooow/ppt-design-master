import { GeminiConfig } from '@/types';
import { loadPromptConfig } from '@/config/prompts';

/**
 * OpenAI 兼容格式的 Gemini 客户端
 * 适用于支持 OpenAI API 格式的第三方服务
 */
export class OpenAICompatibleClient {
  private config: GeminiConfig;
  private baseURL: string;
  private apiKey: string;

  constructor(config: GeminiConfig) {
    this.config = config;
    this.baseURL = config.apiUrl.replace(/\/$/, ''); // 移除末尾斜杠
    this.apiKey = config.apiKey;
  }

  /**
   * 调用 chat completions API
   */
  private async chatCompletion(
    model: string,
    messages: Array<{ role: string; content: string | any }>,
    options?: {
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: string };
    }
  ): Promise<string> {
    const url = `${this.baseURL}/chat/completions`;

    console.log('[OpenAI Client] ========== REQUEST START ==========');
    console.log('[OpenAI Client] URL:', url);
    console.log('[OpenAI Client] Model:', model);

    const requestBody = {
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 2000,
      ...options,
    };

    console.log('[OpenAI Client] Full request body:', JSON.stringify(requestBody, null, 2));
    console.log('[OpenAI Client] API Key (first 10 chars):', this.apiKey.substring(0, 10) + '...');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      // 获取响应文本
      const responseText = await response.text();
      console.log('[OpenAI Client] Response status:', response.status);
      console.log('[OpenAI Client] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
      console.log('[OpenAI Client] Response body (first 1000 chars):', responseText.substring(0, 1000));

      if (!response.ok) {
        console.error('[OpenAI Client] ========== ERROR RESPONSE ==========');
        console.error('[OpenAI Client] Full error response:', responseText);
        throw new Error(`API 请求失败 (${response.status}): ${responseText.substring(0, 200)}`);
      }

      // 尝试解析 JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[OpenAI Client] ========== JSON PARSE ERROR ==========');
        console.error('[OpenAI Client] Failed to parse response:', responseText.substring(0, 500));
        throw new Error(`API 返回了无效的 JSON 格式。这可能是因为：1) API 地址配置错误 2) 服务商不支持此格式。请检查配置。`);
      }

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('[OpenAI Client] ========== INVALID STRUCTURE ==========');
        console.error('[OpenAI Client] Unexpected response structure:', JSON.stringify(data, null, 2));
        throw new Error('API 返回格式不符合预期，请检查您的服务商是否支持 OpenAI 兼容格式');
      }

      console.log('[OpenAI Client] ========== RESPONSE SUCCESS ==========');
      console.log('[OpenAI Client] Full response data:', JSON.stringify(data, null, 2));
      console.log('[OpenAI Client] Usage:', data.usage);

      // 尝试多种方式提取内容
      let content = null;

      // 方式1: 标准 OpenAI 格式 choices[0].message.content
      if (data.choices[0].message?.content) {
        content = data.choices[0].message.content;
        console.log('[OpenAI Client] ✓ Found content in message.content');
      }
      // 方式2: choices[0].text
      else if (data.choices[0].text) {
        content = data.choices[0].text;
        console.log('[OpenAI Client] ✓ Found content in choices[0].text');
      }
      // 方式3: choices[0].message.parts (Google Gemini 格式)
      else if (data.choices[0].message?.parts) {
        const textParts = data.choices[0].message.parts
          .filter((p: any) => p.text)
          .map((p: any) => p.text);
        if (textParts.length > 0) {
          content = textParts.join('\n');
          console.log('[OpenAI Client] ✓ Found content in message.parts');
        }
      }
      // 方式4: 直接在 message 字段
      else if (typeof data.choices[0].message === 'string') {
        content = data.choices[0].message;
        console.log('[OpenAI Client] ✓ Found content as direct message string');
      }

      if (!content || content.trim() === '') {
        console.error('[OpenAI Client] ========== EMPTY CONTENT ==========');
        console.error('[OpenAI Client] Full message object:', JSON.stringify(data.choices[0].message, null, 2));
        console.error('[OpenAI Client] Full choices[0]:', JSON.stringify(data.choices[0], null, 2));
        console.error('[OpenAI Client] 请检查你的中转站后台，看看实际返回的格式是什么');
        throw new Error('API 返回了空内容或者内容在未知字段中。请查看控制台日志，检查响应格式。');
      }

      console.log('[OpenAI Client] Content length:', content.length);
      console.log('[OpenAI Client] Content preview (first 200 chars):', content.substring(0, 200));
      console.log('[OpenAI Client] ========== REQUEST END ==========');
      return content;

    } catch (error: any) {
      console.error('[OpenAI Client] Request failed:', error);
      throw error;
    }
  }

  /**
   * 分析模板图片风格
   */
  async analyzeTemplateStyle(templateImageBase64: string): Promise<any> {
    console.log('[OpenAI Client] Analyzing template style...');

    try {
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `请分析这张 PPT 模板图片，提取以下信息：
1. 主要配色方案（主色、辅色、背景色）
2. 整体风格（商务/科技/简约/创意等）
3. 排版特点
4. 装饰元素

请用 JSON 格式返回：
{
  "colors": {
    "primary": "#主色",
    "secondary": "#辅色",
    "background": "#背景色",
    "text": "#文字色"
  },
  "style": "整体风格描述",
  "layout": "排版特点描述",
  "decorations": "装饰元素描述"
}

只返回 JSON，不要其他文字。`,
            },
            {
              type: 'image_url',
              image_url: {
                url: templateImageBase64,
              },
            },
          ],
        },
      ];

      const content = await this.chatCompletion(
        this.config.modelPro,
        messages,
        { temperature: 0.3, max_tokens: 1000 }
      );

      const jsonText = content.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      return JSON.parse(jsonText);
    } catch (error) {
      console.error('[OpenAI Client] Failed to analyze template:', error);
      return null;
    }
  }

  /**
   * 生成参考预览图
   * 使用图像生成模型基于模板图生成完整的设计效果图
   * 如果没有模板图，也会调用 AI 生成（使用独立的提示词）
   */
  async generatePreviewImage(scriptText: string, templateImage?: string): Promise<string> {
    console.log('[OpenAI Client] Generating preview image...');
    console.log('[OpenAI Client] Template provided:', !!templateImage);

    // 加载用户自定义的提示词
    const prompts = loadPromptConfig();

    try {
      let messages;

      if (templateImage) {
        // 有模板：使用带模板的提示词
        const prompt = prompts.generatePreview.replace('{{script}}', scriptText);
        messages = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: templateImage,
                },
              },
            ],
          },
        ];
      } else {
        // 无模板：使用无模板的提示词（纯文本）
        const prompt = prompts.generatePreviewNoTemplate.replace('{{script}}', scriptText);
        messages = [
          {
            role: 'user',
            content: prompt,
          },
        ];
      }

      console.log('[OpenAI Client] Using image generation model:', this.config.modelImage);

      // 使用图像生成模型
      const response = await this.chatCompletionWithImage(
        this.config.modelImage || this.config.modelPro,
        messages,
        { temperature: 0.9, max_tokens: 8000 }
      );

      console.log('[OpenAI Client] Preview image generated successfully');
      return response;

    } catch (error) {
      console.error('[OpenAI Client] Failed to generate preview:', error);
      // 如果有模板图且生成失败，返回模板图作为fallback
      if (templateImage) {
        console.log('[OpenAI Client] Falling back to template image');
        return templateImage;
      }
      // 如果没有模板图，生成失败时返回占位图
      console.log('[OpenAI Client] Falling back to placeholder SVG');
      return this.generatePlaceholderSVG(scriptText);
    }
  }

  /**
   * 支持图像生成的 chat completion
   * 某些模型（如 gemini-2.5-flash-image）可以直接生成图像
   */
  private async chatCompletionWithImage(
    model: string,
    messages: Array<{ role: string; content: any }>,
    options?: {
      temperature?: number;
      max_tokens?: number;
    }
  ): Promise<string> {
    const url = `${this.baseURL}/chat/completions`;

    console.log('[OpenAI Client] ========== IMAGE REQUEST START ==========');
    console.log('[OpenAI Client] URL:', url);
    console.log('[OpenAI Client] Model:', model);

    const requestBody = {
      model,
      messages,
      temperature: options?.temperature ?? 0.9,
      max_tokens: options?.max_tokens ?? 8000,
    };

    // Log messages structure without image data to keep logs readable
    const messagesPreview = messages.map(msg => {
      if (Array.isArray(msg.content)) {
        return {
          role: msg.role,
          content: msg.content.map(part => {
            if (part.type === 'image_url') {
              return { type: 'image_url', url: part.image_url?.url?.substring(0, 50) + '...' };
            }
            return part;
          })
        };
      }
      return msg;
    });
    console.log('[OpenAI Client] Messages preview:', JSON.stringify(messagesPreview, null, 2));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log('[OpenAI Client] Response status:', response.status);
      console.log('[OpenAI Client] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));

      if (!response.ok) {
        console.error('[OpenAI Client] ========== IMAGE ERROR RESPONSE ==========');
        console.error('[OpenAI Client] Full error response:', responseText);
        throw new Error(`API 请求失败 (${response.status}): ${responseText.substring(0, 200)}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[OpenAI Client] ========== IMAGE JSON PARSE ERROR ==========');
        console.error('[OpenAI Client] Failed to parse response:', responseText.substring(0, 500));
        throw new Error(`API 返回了无效的 JSON 格式`);
      }

      console.log('[OpenAI Client] ========== IMAGE RESPONSE SUCCESS ==========');
      console.log('[OpenAI Client] Response structure keys:', Object.keys(data));
      console.log('[OpenAI Client] Usage:', data.usage);
      if (data.choices && data.choices[0]) {
        console.log('[OpenAI Client] First choice keys:', Object.keys(data.choices[0]));
        console.log('[OpenAI Client] Message keys:', Object.keys(data.choices[0].message || {}));
      }

      // 检查不同可能的图像返回格式
      if (data.choices && data.choices[0]) {
        const choice = data.choices[0];

        // 格式1: content 中包含图像 URL 或 base64
        if (choice.message?.content) {
          let content = choice.message.content;

          console.log('[OpenAI Client] Content type:', typeof content);
          console.log('[OpenAI Client] Content preview (first 200 chars):', content.substring(0, 200));

          // 如果是 markdown 格式的图片：![image](data:image/...)
          const markdownImageMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
          if (markdownImageMatch) {
            console.log('[OpenAI Client] ✓ Found markdown format image');
            return markdownImageMatch[1]; // 返回括号中的 base64 数据
          }

          // 如果是纯 base64 图像
          if (content.startsWith('data:image/')) {
            console.log('[OpenAI Client] ✓ Found base64 image');
            return content;
          }

          // 如果是 URL
          if (content.startsWith('http://') || content.startsWith('https://')) {
            console.log('[OpenAI Client] ✓ Found HTTP URL, downloading...');
            // 下载图像并转换为 base64
            const imageResponse = await fetch(content);
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64 = Buffer.from(imageBuffer).toString('base64');
            return `data:image/png;base64,${base64}`;
          }
        }

        // 格式2: parts 数组中包含图像数据
        if (choice.message?.parts) {
          console.log('[OpenAI Client] Checking parts array...');
          for (const part of choice.message.parts) {
            if (part.type === 'image' && part.data) {
              console.log('[OpenAI Client] ✓ Found image in parts array');
              return `data:image/png;base64,${part.data}`;
            }
            if (part.inlineData) {
              console.log('[OpenAI Client] ✓ Found inlineData in parts array');
              return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
          }
        }

        // 格式3: 直接在 choice 中有 image 字段
        if (choice.image) {
          console.log('[OpenAI Client] ✓ Found image field in choice');
          if (typeof choice.image === 'string') {
            return choice.image.startsWith('data:') ? choice.image : `data:image/png;base64,${choice.image}`;
          }
        }
      }

      // 如果都没找到图像，抛出错误
      console.error('[OpenAI Client] ========== NO IMAGE FOUND ==========');
      console.error('[OpenAI Client] Full response data:', JSON.stringify(data, null, 2));
      console.error('[OpenAI Client] No image found in response structure');
      throw new Error('API 未返回图像数据。请确保使用支持图像生成的模型（如 gemini-3-pro-image-preview）');

    } catch (error: any) {
      console.error('[OpenAI Client] Image generation failed:', error);
      throw error;
    }
  }

  /**
   * 基于模板生成带说明的参考图
   * 直接返回模板图，因为我们希望外包人员在这个基础上工作
   */
  private generatePreviewWithTemplate(design: any, templateImage: string, suggestion: string): string {
    console.log('[OpenAI Client] Returning template as reference (suggestion saved)');

    // 设计建议保存在内存中（实际应用可以返回给前端显示）
    // 这个建议告诉外包人员如何在模板上添加内容

    // 直接返回模板图作为参考
    // 外包人员会看到原始模板，然后根据 AI 的建议在上面添加内容
    return templateImage;
  }

  /**
   * 生成占位预览图（当图像生成不可用时）
   */
  private generatePlaceholderSVG(scriptText: string): string {
    const design: { title: string; subtitle?: string; content: { items: string[] } } = {
      title: '设计预览',
      content: { items: [scriptText.substring(0, 100)] },
    };
    // 创建简单的 SVG 占位图
    const svg = `
      <svg width="1792" height="1008" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f4f8"/>

        <!-- 标题 -->
        <text x="50%" y="20%" font-size="48" font-weight="bold" fill="#1e3a8a" text-anchor="middle" font-family="Arial, sans-serif">
          ${this.escapeXml(design.title || '标题')}
        </text>

        <!-- 副标题 -->
        ${design.subtitle ? `
        <text x="50%" y="28%" font-size="24" fill="#64748b" text-anchor="middle" font-family="Arial, sans-serif">
          ${this.escapeXml(design.subtitle)}
        </text>
        ` : ''}

        <!-- 内容 -->
        ${design.content?.items ? design.content.items.map((item: string, index: number) => `
        <text x="15%" y="${40 + index * 8}%" font-size="20" fill="#334155" font-family="Arial, sans-serif">
          • ${this.escapeXml(item)}
        </text>
        `).join('') : ''}

        <!-- 占位符提示 -->
        <text x="50%" y="95%" font-size="16" fill="#94a3b8" text-anchor="middle" font-family="Arial, sans-serif">
          这是参考预览图的占位符 - 配置图像生成模型以获得真实 AI 生成的效果图
        </text>
      </svg>
    `;

    // 转换为 base64（兼容浏览器和 Node.js）
    if (typeof window !== 'undefined') {
      // 浏览器环境
      const base64 = btoa(unescape(encodeURIComponent(svg)));
      return `data:image/svg+xml;base64,${base64}`;
    } else {
      // Node.js 环境
      const base64 = Buffer.from(svg).toString('base64');
      return `data:image/svg+xml;base64,${base64}`;
    }
  }

  /**
   * XML 转义
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * 提取配图信息并生成单独的插画图片
   * 分析参考图中的插画元素，并让 AI 重新生成每个插画的单独图片
   */
  async extractImages(previewImageBase64: string): Promise<any[]> {
    console.log('[OpenAI Client] Extracting and generating individual illustrations...');

    try {
      // 第一步：识别参考图中的所有插画元素
      const identifyMessages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `请仔细观察这张 PPT 效果图，识别其中的所有插画、图标和视觉元素。

列出每个元素，包括：
1. 元素的详细描述（外观、颜色、风格）
2. 元素的位置

用简洁的列表格式输出，每行一个元素。`,
            },
            {
              type: 'image_url',
              image_url: {
                url: previewImageBase64,
              },
            },
          ],
        },
      ];

      const identificationText = await this.chatCompletion(
        this.config.modelPro,
        identifyMessages,
        { temperature: 0.3, max_tokens: 1000 }
      );

      console.log('[OpenAI Client] Identified elements:', identificationText);

      // 第二步：让 AI 为每个识别到的元素生成单独的插画图片
      const elementsLines = identificationText.split('\n').filter(line => line.trim());
      const extractedImages = [];

      for (let i = 0; i < Math.min(elementsLines.length, 5); i++) { // 最多处理5个元素
        const elementDesc = elementsLines[i];

        try {
          console.log(`[OpenAI Client] Generating illustration ${i + 1}:`, elementDesc);

          const generatePrompt = `请根据这张 PPT 效果图，提取并重新生成其中的插画元素。

要提取的元素：${elementDesc}

请生成一张纯净的、独立的插画图片，要求：
1. 只包含这个插画元素本身
2. 背景透明或纯白色
3. 保持原有的风格和配色
4. 图片尺寸适中（512x512 左右）

直接生成图片，不要文字描述。`;

          const generateMessages = [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: generatePrompt,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: previewImageBase64,
                  },
                },
              ],
            },
          ];

          const extractModel = this.config.modelExtract || this.config.modelImage || this.config.modelPro;
          const illustrationBase64 = await this.chatCompletionWithImage(
            extractModel,
            generateMessages,
            { temperature: 0.7, max_tokens: 4000 }
          );

          extractedImages.push({
            description: elementDesc,
            imageBase64: illustrationBase64,
          });

          console.log(`[OpenAI Client] Successfully generated illustration ${i + 1}`);

        } catch (error) {
          console.error(`[OpenAI Client] Failed to generate illustration ${i + 1}:`, error);
        }
      }

      console.log('[OpenAI Client] Extracted and generated', extractedImages.length, 'illustrations');
      return extractedImages;

    } catch (error) {
      console.error('[OpenAI Client] Failed to extract images:', error);
      return [];
    }
  }

  /**
   * 从裁剪后的图片提取单个插画
   * 使用用户自定义的 extractImage 提示词
   */
  async extractSingleImage(croppedImageBase64: string): Promise<any> {
    console.log('[OpenAI Client] Extracting single illustration from cropped image...');

    try {
      // 加载用户自定义的提示词
      const prompts = loadPromptConfig();
      const prompt = prompts.extractImage;

      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: croppedImageBase64,
              },
            },
          ],
        },
      ];

      // 使用插画提取专用模型
      const extractModel = this.config.modelExtract || this.config.modelImage || this.config.modelPro;
      console.log('[OpenAI Client] Using extract model:', extractModel);

      const illustrationBase64 = await this.chatCompletionWithImage(
        extractModel,
        messages,
        { temperature: 0.7, max_tokens: 4000 }
      );

      console.log('[OpenAI Client] Successfully generated illustration from cropped image');

      return {
        description: '用户裁剪提取的插画',
        imageBase64: illustrationBase64,
      };

    } catch (error) {
      console.error('[OpenAI Client] Failed to extract single image:', error);
      throw error;
    }
  }
}

/**
 * 创建客户端实例
 */
export const createOpenAIClient = (config: GeminiConfig): OpenAICompatibleClient => {
  return new OpenAICompatibleClient(config);
};
