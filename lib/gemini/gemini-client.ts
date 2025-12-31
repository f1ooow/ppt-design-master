import { ApiConfig, GeminiConfig, ImageApiConfig } from '@/types';
import { loadPromptConfig } from '@/config/prompts';

/**
 * Gemini 原生 API 客户端
 * 支持新版 ApiConfig（分离的文本/图像配置）和旧版 GeminiConfig
 */
export class GeminiNativeClient {
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
      };
      this.textConfig = {
        apiUrl: oldConfig.apiUrl,
        apiKey: oldConfig.apiKey,
        model: oldConfig.modelPro,
      };
    }
  }

  /**
   * 调用 Gemini 原生文本生成 API
   */
  private async generateText(
    apiUrl: string,
    apiKey: string,
    model: string,
    parts: any[],
    options?: {
      temperature?: number;
      maxOutputTokens?: number;
    }
  ): Promise<string> {
    const url = `${apiUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent`;

    console.log('[Gemini Client] ========== TEXT REQUEST START ==========');
    console.log('[Gemini Client] URL:', url);
    console.log('[Gemini Client] Model:', model);

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxOutputTokens ?? 2000
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log('[Gemini Client] Response status:', response.status);

      if (!response.ok) {
        console.error('[Gemini Client] Error response:', responseText.substring(0, 200));
        throw new Error(`API 请求失败 (${response.status}): ${responseText.substring(0, 200)}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`API 返回了无效的 JSON 格式`);
      }

      // 从 Gemini 响应中提取文本
      let content = '';
      if (data.candidates?.[0]?.content?.parts) {
        for (const part of data.candidates[0].content.parts) {
          if (part.text) {
            content += part.text;
          }
        }
      }

      if (!content) {
        throw new Error('API 返回了空内容');
      }

      console.log('[Gemini Client] Content length:', content.length);
      return content;

    } catch (error: any) {
      console.error('[Gemini Client] Request failed:', error);
      throw error;
    }
  }

  /**
   * 调用 Gemini 原生图像生成 API
   */
  private async generateImage(
    apiUrl: string,
    apiKey: string,
    model: string,
    parts: any[],
    options?: {
      temperature?: number;
      aspectRatio?: string;
    }
  ): Promise<string> {
    const url = `${apiUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent`;

    console.log('[Gemini Client] ========== IMAGE REQUEST START ==========');
    console.log('[Gemini Client] URL:', url);
    console.log('[Gemini Client] Model:', model);

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: options?.aspectRatio || '16:9',
          imageSize: '2K'
        }
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log('[Gemini Client] Response status:', response.status);

      if (!response.ok) {
        console.error('[Gemini Client] Error response:', responseText.substring(0, 200));
        throw new Error(`API 请求失败 (${response.status}): ${responseText.substring(0, 200)}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`API 返回了无效的 JSON 格式`);
      }

      // 从 Gemini 响应中提取图像
      if (data.candidates?.[0]?.content?.parts) {
        for (const part of data.candidates[0].content.parts) {
          if (part.inlineData) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            const imageData = part.inlineData.data;
            console.log('[Gemini Client] Found image, format:', mimeType);
            return `data:${mimeType};base64,${imageData}`;
          }
        }
      }

      console.error('[Gemini Client] No image found in response');
      throw new Error('API 未返回图像数据');

    } catch (error: any) {
      console.error('[Gemini Client] Image generation failed:', error);
      throw error;
    }
  }

  /**
   * 解析 base64 图片数据
   */
  private parseImageBase64(imageBase64: string): { mimeType: string; data: string } | null {
    if (!imageBase64.startsWith('data:')) return null;
    const match = imageBase64.match(/data:(image\/[^;]+);base64,(.+)/);
    if (match) {
      return { mimeType: match[1], data: match[2] };
    }
    return null;
  }

  /**
   * 分析模板图片风格（使用文本 API）
   */
  async analyzeTemplateStyle(templateImageBase64: string): Promise<any> {
    if (!this.textConfig) {
      throw new Error('文本 API 未配置');
    }

    console.log('[Gemini Client] Analyzing template style...');

    try {
      const parts: any[] = [
        {
          text: `请分析这张 PPT 模板图片，提取以下信息：
1. 主要配色方案（主色、辅色、背景色）
2. 整体风格（商务/科技/简约/创意等）
3. 排版特点
4. 装饰元素

请用 JSON 格式返回，只返回 JSON，不要其他文字。`,
        },
      ];

      const imageData = this.parseImageBase64(templateImageBase64);
      if (imageData) {
        parts.push({
          inline_data: {
            mime_type: imageData.mimeType,
            data: imageData.data
          }
        });
      }

      const content = await this.generateText(
        this.textConfig.apiUrl,
        this.textConfig.apiKey,
        this.textConfig.model,
        parts,
        { temperature: 0.3, maxOutputTokens: 1000 }
      );

      const jsonText = content.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      return JSON.parse(jsonText);
    } catch (error) {
      console.error('[Gemini Client] Failed to analyze template:', error);
      return null;
    }
  }

  /**
   * 生成参考预览图（使用图像 API）
   */
  async generatePreviewImage(scriptText: string, templateImage?: string): Promise<string> {
    console.log('[Gemini Client] Generating preview image...');
    console.log('[Gemini Client] Template provided:', !!templateImage);

    const prompts = loadPromptConfig();

    try {
      const parts: any[] = [];

      if (templateImage) {
        // 使用统一的图片生成提示词
        const prompt = prompts.generateImage.replace('{{description}}', scriptText);
        parts.push({ text: prompt });

        const imageData = this.parseImageBase64(templateImage);
        if (imageData) {
          parts.push({
            inline_data: {
              mime_type: imageData.mimeType,
              data: imageData.data
            }
          });
        }
      } else {
        const prompt = prompts.generateImageNoTemplate.replace('{{description}}', scriptText);
        parts.push({ text: prompt });
      }

      console.log('[Gemini Client] Using image model:', this.imageConfig.model);

      const response = await this.generateImage(
        this.imageConfig.apiUrl,
        this.imageConfig.apiKey,
        this.imageConfig.model,
        parts,
        { aspectRatio: '16:9' }
      );

      console.log('[Gemini Client] Preview image generated successfully');
      return response;

    } catch (error) {
      console.error('[Gemini Client] Failed to generate preview:', error);
      if (templateImage) {
        console.log('[Gemini Client] Falling back to template image');
        return templateImage;
      }
      console.log('[Gemini Client] Falling back to placeholder SVG');
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
    console.log('[Gemini Client] Extracting single illustration from cropped image...');

    try {
      const prompts = loadPromptConfig();
      const parts: any[] = [{ text: prompts.extractImage }];

      const imageData = this.parseImageBase64(croppedImageBase64);
      if (imageData) {
        parts.push({
          inline_data: {
            mime_type: imageData.mimeType,
            data: imageData.data
          }
        });
      }

      console.log('[Gemini Client] Using image model:', this.imageConfig.model);

      const illustrationBase64 = await this.generateImage(
        this.imageConfig.apiUrl,
        this.imageConfig.apiKey,
        this.imageConfig.model,
        parts
      );

      console.log('[Gemini Client] Successfully generated illustration from cropped image');

      return {
        description: '用户裁剪提取的插画',
        imageBase64: illustrationBase64,
      };

    } catch (error) {
      console.error('[Gemini Client] Failed to extract single image:', error);
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

    console.log('[Gemini Client] Extracting and generating individual illustrations...');

    try {
      // 第一步：使用文本 API 识别插画元素
      const identifyParts: any[] = [
        {
          text: `请仔细观察这张 PPT 效果图，识别其中的所有插画、图标和视觉元素。
列出每个元素，包括：
1. 元素的详细描述（外观、颜色、风格）
2. 元素的位置

用简洁的列表格式输出，每行一个元素。`,
        },
      ];

      const imageData = this.parseImageBase64(previewImageBase64);
      if (imageData) {
        identifyParts.push({
          inline_data: {
            mime_type: imageData.mimeType,
            data: imageData.data
          }
        });
      }

      const identificationText = await this.generateText(
        this.textConfig.apiUrl,
        this.textConfig.apiKey,
        this.textConfig.model,
        identifyParts,
        { temperature: 0.3, maxOutputTokens: 1000 }
      );

      console.log('[Gemini Client] Identified elements:', identificationText);

      // 第二步：使用图像 API 为每个元素生成单独的插画
      const elementsLines = identificationText.split('\n').filter(line => line.trim());
      const extractedImages = [];

      for (let i = 0; i < Math.min(elementsLines.length, 5); i++) {
        const elementDesc = elementsLines[i];

        try {
          console.log(`[Gemini Client] Generating illustration ${i + 1}:`, elementDesc);

          const generatePrompt = `请根据这张 PPT 效果图，提取并重新生成其中的插画元素。

要提取的元素：${elementDesc}

请生成一张纯净的、独立的插画图片，要求：
1. 只包含这个插画元素本身
2. 背景透明或纯白色
3. 保持原有的风格和配色

直接生成图片，不要文字描述。`;

          const generateParts: any[] = [{ text: generatePrompt }];
          if (imageData) {
            generateParts.push({
              inline_data: {
                mime_type: imageData.mimeType,
                data: imageData.data
              }
            });
          }

          const illustrationBase64 = await this.generateImage(
            this.imageConfig.apiUrl,
            this.imageConfig.apiKey,
            this.imageConfig.model,
            generateParts
          );

          extractedImages.push({
            description: elementDesc,
            imageBase64: illustrationBase64,
          });

          console.log(`[Gemini Client] Successfully generated illustration ${i + 1}`);

        } catch (error) {
          console.error(`[Gemini Client] Failed to generate illustration ${i + 1}:`, error);
        }
      }

      console.log('[Gemini Client] Extracted and generated', extractedImages.length, 'illustrations');
      return extractedImages;

    } catch (error) {
      console.error('[Gemini Client] Failed to extract images:', error);
      return [];
    }
  }
}

/**
 * 创建客户端实例（支持新版和旧版配置）
 */
export const createGeminiClient = (config: ApiConfig | GeminiConfig): GeminiNativeClient => {
  return new GeminiNativeClient(config);
};

// 兼容旧版导出
export const OpenAICompatibleClient = GeminiNativeClient;
export const createOpenAIClient = createGeminiClient;
