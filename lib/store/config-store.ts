import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiConfig } from '@/types';

interface ConfigState {
  apiConfig: ApiConfig | null;
  setApiConfig: (config: ApiConfig) => void;
  clearConfig: () => void;
  isConfigured: () => boolean;
}

/**
 * API 配置状态管理
 * 使用 localStorage 持久化存储
 */
export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      apiConfig: null,

      setApiConfig: (config: ApiConfig) => {
        set({ apiConfig: config });
      },

      clearConfig: () => {
        set({ apiConfig: null });
      },

      isConfigured: () => {
        const config = get().apiConfig;
        return !!(
          config &&
          config.text?.apiUrl &&
          config.text?.apiKey &&
          config.text?.model &&
          config.image?.apiUrl &&
          config.image?.apiKey &&
          config.image?.model
        );
      },
    }),
    {
      name: 'ppt-master-config', // localStorage key
    }
  )
);
