import { ApiConfig, GeminiConfig } from '@/types';

// 默认 API 配置 (Gemini 原生 API)
// 注意：密钥需要用户自行配置，不要在代码中硬编码
export const defaultApiConfig: ApiConfig = {
  text: {
    apiUrl: '',
    apiKey: '',
    model: 'gemini-3-flash-preview',
  },
  image: {
    apiUrl: '',
    apiKey: '',
    model: 'gemini-3-pro-image-preview',
  },
};

// 从环境变量读取配置
export const getApiConfig = (): ApiConfig => {
  return {
    text: {
      apiUrl: process.env.TEXT_API_URL || defaultApiConfig.text.apiUrl,
      apiKey: process.env.TEXT_API_KEY || defaultApiConfig.text.apiKey,
      model: process.env.TEXT_MODEL || defaultApiConfig.text.model,
    },
    image: {
      apiUrl: process.env.IMAGE_API_URL || defaultApiConfig.image.apiUrl,
      apiKey: process.env.IMAGE_API_KEY || defaultApiConfig.image.apiKey,
      model: process.env.IMAGE_MODEL || defaultApiConfig.image.model,
    },
  };
};

// 验证配置是否有效
export const validateApiConfig = (config: ApiConfig): boolean => {
  const textValid = !!(config.text?.apiUrl && config.text?.apiKey && config.text?.model);
  const imageValid = !!(config.image?.apiUrl && config.image?.apiKey && config.image?.model);
  return textValid && imageValid;
};

// 验证文本 API 配置
export const validateTextApiConfig = (config: ApiConfig): boolean => {
  return !!(config.text?.apiUrl && config.text?.apiKey && config.text?.model);
};

// 验证图像 API 配置
export const validateImageApiConfig = (config: ApiConfig): boolean => {
  return !!(config.image?.apiUrl && config.image?.apiKey && config.image?.model);
};

// ===== 兼容旧版配置 =====

// 从环境变量读取旧版配置（保留用于迁移）
export const getGeminiConfig = (): GeminiConfig => {
  return {
    apiUrl: process.env.GEMINI_API_URL || '',
    apiKey: process.env.GEMINI_API_KEY || '',
    modelPro: process.env.GEMINI_MODEL_PRO || 'gemini-2.5-pro',
    modelImage: process.env.GEMINI_MODEL_IMAGE || 'gemini-3-pro-image-preview',
    modelExtract: process.env.GEMINI_MODEL_EXTRACT || 'gemini-2.5-flash-image-preview',
  };
};

// 验证旧版配置是否有效
export const validateGeminiConfig = (config: GeminiConfig): boolean => {
  return !!(config.apiUrl && config.apiKey && config.modelPro && config.modelImage);
};

// 将旧版配置转换为新版配置
export const migrateGeminiConfig = (oldConfig: GeminiConfig): ApiConfig => {
  return {
    text: {
      apiUrl: oldConfig.apiUrl,
      apiKey: oldConfig.apiKey,
      model: oldConfig.modelPro,
    },
    image: {
      apiUrl: oldConfig.apiUrl,
      apiKey: oldConfig.apiKey,
      model: oldConfig.modelImage,
    },
  };
};
