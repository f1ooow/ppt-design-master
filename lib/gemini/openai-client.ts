import { ApiConfig, GeminiConfig, ImageApiConfig } from '@/types';
import { loadPromptConfig } from '@/config/prompts';

/**
 * OpenAI 兼容格式的客户端
 * 支持新版 ApiConfig（分离的文本/图像配置）和旧版 GeminiConfig
 */
export class OpenAICompatibleClient {
  private imageConfig: ImageApiConfig;
  private textConfig?: { apiUrl: string; apiKey: string; model: string };

  constructor(config: ApiConfig | GeminiConfig) {
    // 判断是新版还是旧版配置
    if ('image' in config && 'text' in config) {
      // 新版 ApiConfig
      this.imageConfig = config.image;
      this.textConfig = config.text;
    } else {
      // 旧版 GeminiConfig - 转换为新格式
      const oldConfig = config as GeminiConfig;
      this.imageConfig = {
        apiUrl: oldConfig.apiUrl,
        apiKey: oldConfig.apiKey,
        model: oldConfig.modelImage,
        extractModel: oldConfig.modelExtract || oldConfig.modelImage,
      };
      this.textConfig = {
        apiUrl: oldConfig.apiUrl,
        apiKey: oldConfig.apiKey,
        model: oldConfig.modelPro,
      };
    }
  }

  /**
   * 调用 chat completions API
   */
  private async chatCompletion(
    apiUrl: string,
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string | any }>,
    options?: {
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: string };
    }
  ): Promise<string> {
    const url = `${apiUrl.replace(/\/$/, '')}/chat/completions`;

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

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log('[OpenAI Client] Response status:', response.status);

      if (!response.ok) {
        console.error('[OpenAI Client] Error response:', responseText.substring(0, 200));
        throw new Error(`API 请求失败 (${response.status}): ${responseText.substring(0, 200)}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`API 返回了无效的 JSON 格式`);
      }

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('API 返回格式不符合预期');
      }

      // 提取内容
      let content = data.choices[0].message?.content;
      if (!content) {
        throw new Error('API 返回了空内容');
      }

      console.log('[OpenAI Client] Content length:', content.length);
      return content;

    } catch (error: any) {
      console.error('[OpenAI Client] Request failed:', error);
      throw error;
    }
  }

  /**
   * 支持图像生成的 chat completion
   */
  private async chatCompletionWithImage(
    apiUrl: string,
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: any }>,
    options?: {
      temperature?: number;
      max_tokens?: number;
    }
  ): Promise<string> {
    const url = `${apiUrl.replace(/\/$/, '')}/chat/completions`;

    console.log('[OpenAI Client] ========== IMAGE REQUEST START ==========');
    console.log('[OpenAI Client] URL:', url);
    console.log('[OpenAI Client] Model:', model);

    const requestBody = {
      model,
      messages,
      temperature: options?.temperature ?? 0.9,
      max_tokens: options?.max_tokens ?? 8000,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log('[OpenAI Client] Response status:', response.status);

      if (!response.ok) {
        console.error('[OpenAI Client] Error response:', responseText.substring(0, 200));
        throw new Error(`API 请求失败 (${response.status}): ${responseText.substring(0, 200)}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`API 返回了无效的 JSON 格式`);
      }

      // 检查不同可能的图像返回格式
      if (data.choices && data.choices[0]) {
        const choice = data.choices[0];

        if (choice.message?.content) {
          let content = choice.message.content;

          // Markdown 格式: ![image](data:image/...)
          const markdownImageMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
          if (markdownImageMatch) {
            console.log('[OpenAI Client] Found markdown format image');
            return markdownImageMatch[1];
          }

          // 纯 base64 图像
          if (content.startsWith('data:image/')) {
            console.log('[OpenAI Client] Found base64 image');
            return content;
          }

          // URL 格式
          if (content.startsWith('http://') || content.startsWith('https://')) {
            console.log('[OpenAI Client] Found HTTP URL, downloading...');
            const imageResponse = await fetch(content);
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64 = Buffer.from(imageBuffer).toString('base64');
            return `data:image/png;base64,${base64}`;
          }
        }

        // parts 数组格式
        if (choice.message?.parts) {
          for (const part of choice.message.parts) {
            if (part.type === 'image' && part.data) {
              return `data:image/png;base64,${part.data}`;
            }
            if (part.inlineData) {
              return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
          }
        }

        // 直接 image 字段
        if (choice.image) {
          if (typeof choice.image === 'string') {
            return choice.image.startsWith('data:') ? choice.image : `data:image/png;base64,${choice.image}`;
          }
        }
      }

      console.error('[OpenAI Client] No image found in response');
      throw new Error('API 未返回图像数据');

    } catch (error: any) {
      console.error('[OpenAI Client] Image generation failed:', error);
      throw error;
    }
  }

  /**
   * 分析模板图片风格（使用文本 API）
   */
  async analyzeTemplateStyle(templateImageBase64: string): Promise<any> {
    if (!this.textConfig) {
      throw new Error('文本 API 未配置');
    }

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

请用 JSON 格式返回，只返回 JSON，不要其他文字。`,
            },
            {
              type: 'image_url',
              image_url: { url: templateImageBase64 },
            },
          ],
        },
      ];

      const content = await this.chatCompletion(
        this.textConfig.apiUrl,
        this.textConfig.apiKey,
        this.textConfig.model,
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
   * 生成参考预览图（使用图像 API）
   */
  async generatePreviewImage(scriptText: string, templateImage?: string): Promise<string> {
    console.log('[OpenAI Client] Generating preview image...');
    console.log('[OpenAI Client] Template provided:', !!templateImage);

    const prompts = loadPromptConfig();

    try {
      let messages;

      if (templateImage) {
        // 使用统一的图片生成提示词
        const prompt = prompts.generateImage.replace('{{description}}', scriptText);
        messages = [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: templateImage } },
            ],
          },
        ];
      } else {
        const prompt = prompts.generateImageNoTemplate.replace('{{description}}', scriptText);
        messages = [
          { role: 'user', content: prompt },
        ];
      }

      console.log('[OpenAI Client] Using image model:', this.imageConfig.model);

      const response = await this.chatCompletionWithImage(
        this.imageConfig.apiUrl,
        this.imageConfig.apiKey,
        this.imageConfig.model,
        messages,
        { temperature: 0.9, max_tokens: 8000 }
      );

      console.log('[OpenAI Client] Preview image generated successfully');
      return response;

    } catch (error) {
      console.error('[OpenAI Client] Failed to generate preview:', error);
      if (templateImage) {
        console.log('[OpenAI Client] Falling back to template image');
        return templateImage;
      }
      console.log('[OpenAI Client] Falling back to placeholder SVG');
      return this.generatePlaceholderSVG(scriptText);
    }
  }

  /**
   * 生成占位预览图
   */
  private generatePlaceholderSVG(scriptText: string): string {
    const svg = `
      <svg width="1792" height="1008" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f4f8"/>
        <text x="50%" y="20%" font-size="48" font-weight="bold" fill="#1e3a8a" text-anchor="middle" font-family="Arial, sans-serif">
          设计预览
        </text>
        <text x="50%" y="50%" font-size="24" fill="#64748b" text-anchor="middle" font-family="Arial, sans-serif">
          ${this.escapeXml(scriptText.substring(0, 50))}...
        </text>
        <text x="50%" y="95%" font-size="16" fill="#94a3b8" text-anchor="middle" font-family="Arial, sans-serif">
          这是参考预览图的占位符 - 配置图像生成模型以获得真实 AI 生成的效果图
        </text>
      </svg>
    `;

    if (typeof window !== 'undefined') {
      const base64 = btoa(unescape(encodeURIComponent(svg)));
      return `data:image/svg+xml;base64,${base64}`;
    } else {
      const base64 = Buffer.from(svg).toString('base64');
      return `data:image/svg+xml;base64,${base64}`;
    }
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * 从裁剪后的图片提取单个插画（使用图像 API）
   */
  async extractSingleImage(croppedImageBase64: string): Promise<any> {
    console.log('[OpenAI Client] Extracting single illustration from cropped image...');

    try {
      const prompts = loadPromptConfig();
      const prompt = prompts.extractImage;

      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: croppedImageBase64 } },
          ],
        },
      ];

      const extractModel = this.imageConfig.extractModel || this.imageConfig.model;
      console.log('[OpenAI Client] Using extract model:', extractModel);

      const illustrationBase64 = await this.chatCompletionWithImage(
        this.imageConfig.apiUrl,
        this.imageConfig.apiKey,
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

  /**
   * 提取配图信息（使用文本 API 识别 + 图像 API 生成）
   */
  async extractImages(previewImageBase64: string): Promise<any[]> {
    if (!this.textConfig) {
      throw new Error('文本 API 未配置');
    }

    console.log('[OpenAI Client] Extracting and generating individual illustrations...');

    try {
      // 第一步：使用文本 API 识别插画元素
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
            { type: 'image_url', image_url: { url: previewImageBase64 } },
          ],
        },
      ];

      const identificationText = await this.chatCompletion(
        this.textConfig.apiUrl,
        this.textConfig.apiKey,
        this.textConfig.model,
        identifyMessages,
        { temperature: 0.3, max_tokens: 1000 }
      );

      console.log('[OpenAI Client] Identified elements:', identificationText);

      // 第二步：使用图像 API 为每个元素生成单独的插画
      const elementsLines = identificationText.split('\n').filter(line => line.trim());
      const extractedImages = [];

      for (let i = 0; i < Math.min(elementsLines.length, 5); i++) {
        const elementDesc = elementsLines[i];

        try {
          console.log(`[OpenAI Client] Generating illustration ${i + 1}:`, elementDesc);

          const generatePrompt = `请根据这张 PPT 效果图，提取并重新生成其中的插画元素。

要提取的元素：${elementDesc}

请生成一张纯净的、独立的插画图片，要求：
1. 只包含这个插画元素本身
2. 背景透明或纯白色
3. 保持原有的风格和配色

直接生成图片，不要文字描述。`;

          const generateMessages = [
            {
              role: 'user',
              content: [
                { type: 'text', text: generatePrompt },
                { type: 'image_url', image_url: { url: previewImageBase64 } },
              ],
            },
          ];

          const extractModel = this.imageConfig.extractModel || this.imageConfig.model;
          const illustrationBase64 = await this.chatCompletionWithImage(
            this.imageConfig.apiUrl,
            this.imageConfig.apiKey,
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
}

/**
 * 创建客户端实例（支持新版和旧版配置）
 */
export const createOpenAIClient = (config: ApiConfig | GeminiConfig): OpenAICompatibleClient => {
  return new OpenAICompatibleClient(config);
};
