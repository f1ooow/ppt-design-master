// Gemini 配置类型
export interface GeminiConfig {
  apiUrl: string;
  apiKey: string;
  modelPro: string;
  modelImage: string;      // PPT参考图生成模型
  modelExtract: string;    // 插画提取模型
}

// 提示词配置类型
export interface PromptConfig {
  generatePreview: string;
  generatePreviewNoTemplate: string; // 无模板时的生成提示词
  extractImage: string;
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
  imageBase64: string;
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
