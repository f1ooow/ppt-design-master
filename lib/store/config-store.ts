import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GeminiConfig } from '@/types';

interface ConfigState {
  geminiConfig: GeminiConfig | null;
  setGeminiConfig: (config: GeminiConfig) => void;
  clearConfig: () => void;
  isConfigured: () => boolean;
}

/**
 * Gemini 配置状态管理
 * 使用 localStorage 持久化存储
 */
export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      geminiConfig: null,

      setGeminiConfig: (config: GeminiConfig) => {
        set({ geminiConfig: config });
      },

      clearConfig: () => {
        set({ geminiConfig: null });
      },

      isConfigured: () => {
        const config = get().geminiConfig;
        return !!(
          config &&
          config.apiUrl &&
          config.apiKey &&
          config.modelPro &&
          config.modelImage
        );
      },
    }),
    {
      name: 'ppt-master-config', // localStorage key
    }
  )
);
