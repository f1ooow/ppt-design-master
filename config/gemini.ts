import { GeminiConfig } from '@/types';

// 从环境变量读取配置
export const getGeminiConfig = (): GeminiConfig => {
  return {
    apiUrl: process.env.GEMINI_API_URL || '',
    apiKey: process.env.GEMINI_API_KEY || '',
    modelPro: process.env.GEMINI_MODEL_PRO || 'gemini-2.5-pro',
    modelImage: process.env.GEMINI_MODEL_IMAGE || 'gemini-3-pro-image-preview',
    modelExtract: process.env.GEMINI_MODEL_EXTRACT || 'gemini-2.5-flash-image',
  };
};

// 验证配置是否有效
export const validateGeminiConfig = (config: GeminiConfig): boolean => {
  return !!(config.apiUrl && config.apiKey && config.modelPro && config.modelImage);
};

// 默认配置（用于客户端，需要用户输入）
export const defaultGeminiConfig: Partial<GeminiConfig> = {
  modelPro: 'gemini-2.5-pro',
  modelImage: 'none', // 默认不使用图像生成，避免兼容性问题
};
