import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiConfig } from '@/types';

/**
 * 创建 Gemini 客户端
 * 支持自定义 API 地址和密钥
 */
export class GeminiClient {
  private config: GeminiConfig;
  private ai: GoogleGenerativeAI;

  constructor(config: GeminiConfig) {
    this.config = config;

    // 初始化 Google Generative AI 客户端
    this.ai = new GoogleGenerativeAI(config.apiKey);

    // 如果有自定义 API URL，需要通过环境变量或其他方式配置
    // Note: @google/generative-ai 库默认使用 Google 的官方端点
    // 如果需要使用代理，可能需要配置 baseURL（具体看库版本支持）
  }

  /**
   * 获取 Pro 模型实例（用于文本分析和设计）
   */
  getProModel() {
    return this.ai.getGenerativeModel({ model: this.config.modelPro });
  }

  /**
   * 获取 Image 模型实例（用于图像生成）
   */
  getImageModel() {
    return this.ai.getGenerativeModel({ model: this.config.modelImage });
  }

  /**
   * 分析脚本并生成设计方案
   */
  async analyzeScript(script: string, templateInfo?: any): Promise<any> {
    const model = this.getProModel();

    const prompt = `
你是一位专业的 PPT 设计师。请分析以下课件脚本，为其设计一个精美的 PPT 页面。

脚本内容：
${script}

${templateInfo ? `模板信息：\n${JSON.stringify(templateInfo, null, 2)}` : ''}

请输出 JSON 格式的设计方案，包含以下字段：
{
  "layout": "布局类型（title-only, title-content, title-content-image, two-column, full-image）",
  "title": "提炼的页面标题（10字以内）",
  "subtitle": "副标题（可选）",
  "content": {
    "type": "内容类型（paragraph, bullet-list, numbered-list）",
    "items": ["要点1", "要点2", "要点3"]
  },
  "imageRequirement": {
    "description": "配图描述",
    "position": "位置（left, right, top, bottom, center）",
    "size": "大小（small, medium, large）"
  },
  "styleHints": {
    "colorScheme": "配色建议",
    "emphasis": "重点强调内容"
  },
  "designNotes": "设计说明"
}

要求：
1. 标题简洁有力，10字以内
2. 内容精简，每个要点不超过20字
3. 配图要求明确、具体
4. 充分考虑视觉层次和可读性

请直接返回 JSON，不要添加任何其他文字。
`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // 尝试解析 JSON
    try {
      // 移除可能的 markdown 代码块标记
      const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse JSON response:', text);
      throw new Error('Failed to parse design from AI response');
    }
  }

  /**
   * 生成参考预览图
   */
  async generatePreviewImage(design: any, templateInfo?: any): Promise<string> {
    const model = this.getImageModel();

    const prompt = `
创建一个精美的 PPT 页面设计图，要求如下：

标题：${design.title}
${design.subtitle ? `副标题：${design.subtitle}` : ''}

内容：
${design.content.items.join('\n')}

布局：${design.layout}
${design.imageRequirement ? `配图要求：${design.imageRequirement.description}，位置：${design.imageRequirement.position}` : ''}

${templateInfo ? `配色方案：${templateInfo.colors?.primary || '专业商务蓝'}` : '配色：专业商务风格'}

设计要求：
1. 专业、简洁、现代
2. 视觉层次清晰
3. 文字清晰可读（使用标准字体）
4. 符合商务演示风格
5. 16:9 横向布局

请生成高质量的 PPT 页面效果图。
`;

    const result = await model.generateContent(prompt);
    const response = result.response;

    // Note: 图像生成功能的具体实现取决于 Gemini API 的版本和功能
    // 这里假设返回 base64 编码的图像
    // 实际实现可能需要根据 API 文档调整

    // 临时返回占位符
    // TODO: 实现真实的图像生成逻辑
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }

  /**
   * 提取配图信息
   */
  async extractImages(imageBase64: string): Promise<any[]> {
    const model = this.getProModel();

    const prompt = `
请分析这张 PPT 参考图，识别其中需要的配图元素。

对于每个配图区域，请提供：
1. 配图的详细描述
2. 配图在页面中的位置
3. 建议的搜索关键词

请以 JSON 数组格式输出：
[
  {
    "description": "详细的配图描述",
    "position": "页面位置（如：右侧、居中、背景等）",
    "suggestedKeywords": ["关键词1", "关键词2", "关键词3"]
  }
]

如果没有配图需求，返回空数组 []。
请直接返回 JSON，不要添加任何其他文字。
`;

    // Note: 需要将 base64 图像作为输入
    // 具体实现取决于 Gemini API 的 vision 功能
    const result = await model.generateContent([
      prompt,
      // TODO: 添加图像输入
    ]);

    const response = result.response;
    const text = response.text();

    try {
      const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse image extraction response:', text);
      return [];
    }
  }
}

/**
 * 创建 Gemini 客户端实例
 */
export const createGeminiClient = (config: GeminiConfig): GeminiClient => {
  return new GeminiClient(config);
};
