// 文本处理 API 配置 (Cotton)
export interface TextApiConfig {
  apiUrl: string;        // API 地址 (如: https://cottonapi.cloud/v1)
  apiKey: string;        // API 密钥
  model: string;         // 快速模型 (如: gemini-2.0-flash)
  analysisModel?: string; // 复杂分析模型 (如: gemini-2.5-pro)，用于整体脚本分析
}

// 图像处理 API 配置 (Privnode)
export interface ImageApiConfig {
  apiUrl: string;        // API 地址 (如: https://privnode.com)
  apiKey: string;        // API 密钥
  model: string;         // 模型名称 (如: gemini-3-pro-image-preview-2k)
  extractModel: string;  // 插画提取模型 (如: gemini-2.5-flash-image-preview)
}

// 完整的 API 配置
export interface ApiConfig {
  text: TextApiConfig;   // 文本处理 API (Cotton)
  image: ImageApiConfig; // 图像处理 API (Privnode)
}

// 兼容旧版配置类型（保留用于迁移）
export interface GeminiConfig {
  apiUrl: string;
  apiKey: string;
  modelPro: string;
  modelImage: string;      // PPT参考图生成模型
  modelExtract: string;    // 插画提取模型
}

// 提示词配置类型
export interface PromptConfig {
  // 整体脚本分析
  analyzeFullScript: string;            // 分析整个脚本，拆分镜头+生成描述
  // 工具
  extractImage: string;                 // 提取插画
  // 描述生成
  generateDescription: string;          // 画面描述生成（无模板）
  generateDescriptionWithTemplate: string; // 画面描述生成（有模板）
  generateDescriptionCover: string;     // 片头/封面页描述生成
  generateDescriptionEnding: string;    // 片尾/结束页描述生成
  // 图片生成（单页和批量统一使用）
  generateImage: string;                // 内容页图片生成（有模板）
  generateImageNoTemplate: string;      // 内容页图片生成（无模板）
  generateImageCover: string;           // 封面页图片生成
  generateImageEnding: string;          // 片尾页图片生成
}

// 课程元信息（从Excel中提取）
export interface CourseMetadata {
  courseName?: string;      // 课程名称
  textbookName?: string;    // 教材名称
  chapterName?: string;     // 章节名称
  unitName?: string;        // 单元名称
  school?: string;          // 学校名称
  major?: string;           // 专业名称
  teacher?: string;         // 教师姓名
  extraInfo?: string;       // 其他信息
}

// PPT 设计方案类型
export interface PPTDesign {
  layout: LayoutType;
  title: string;
  subtitle?: string;
  content: ContentBlock;
  imageRequirement?: ImageRequirement;
  designNotes?: string;
  styleHints?: StyleHints;
}

// 布局类型
export type LayoutType =
  | 'title-only'
  | 'title-content'
  | 'title-content-image'
  | 'two-column'
  | 'full-image';

// 内容块类型
export interface ContentBlock {
  type: 'paragraph' | 'bullet-list' | 'numbered-list' | 'table';
  items: string[];
  formatting?: {
    bold?: boolean;
    fontSize?: number;
    color?: string;
  };
}

// 配图需求
export interface ImageRequirement {
  description: string;
  position: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'background';
  size: 'small' | 'medium' | 'large';
  style?: string;
}

// 样式提示
export interface StyleHints {
  colorScheme?: string;
  fontFamily?: string;
  emphasis?: string;
}

// 生成结果类型
export interface GenerationResult {
  id: string;
  timestamp: number;
  script: string;
  design: PPTDesign;
  previewImage?: string; // Base64 或 URL
  pptFile?: string; // 文件路径或 Base64
  extractedImages?: ExtractedImage[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

// 提取的配图信息
export interface ExtractedImage {
  description: string;
  position?: string;
  suggestedKeywords?: string[];
  imageBase64?: string; // 提取后的插画图片
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// 模板信息
export interface TemplateInfo {
  name: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
    background?: string;
  };
  fonts?: {
    title?: string;
    body?: string;
  };
  slideSize?: {
    width: number;
    height: number;
  };
}

// API 请求/响应类型
export interface AnalyzeDesignRequest {
  script: string;
  templateInfo?: TemplateInfo;
}

export interface AnalyzeDesignResponse {
  design: PPTDesign;
  error?: string;
}

export interface GeneratePreviewRequest {
  design: PPTDesign;
  templateInfo?: TemplateInfo;
}

export interface GeneratePreviewResponse {
  imageBase64?: string;
  description?: string;  // AI 生成的页面描述
  error?: string;
}

export interface GeneratePPTRequest {
  design: PPTDesign;
  templateFile?: string; // Base64 encoded template
}

export interface GeneratePPTResponse {
  pptBase64: string;
  error?: string;
}

export interface ExtractImagesRequest {
  previewImageBase64: string;
}

export interface ExtractImagesResponse {
  images: ExtractedImage[];
  error?: string;
}
