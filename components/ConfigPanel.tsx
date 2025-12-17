'use client';

import { useState, useEffect } from 'react';
import { ApiConfig } from '@/types';

interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ApiConfig) => void;
  initialConfig?: ApiConfig | null;
}

// 默认配置（包含默认 API 密钥方便快速使用）
const defaultConfig: ApiConfig = {
  text: {
    apiUrl: 'https://cottonapi.cloud/v1',
    apiKey: 'sk-V5qeMJn0hTs1zr205WO6Zu0D29Y6VM1y4kGbZ9f31HFLj4i5',
    model: 'gemini-2.0-flash',
    analysisModel: 'gemini-2.5-pro-preview-06-05',
  },
  image: {
    apiUrl: 'https://privnode.com/v1',
    apiKey: 'sk-oSyrVIvzQNs0A6XNpGhes2BNe8xNZgiZq6ZCJfHiO0jvMlkA',
    model: 'gemini-3-pro-image-preview-2k',
    extractModel: 'gemini-2.5-flash-image-preview',
  },
};

export default function ConfigPanel({ isOpen, onClose, onSave, initialConfig }: ConfigPanelProps) {
  const [config, setConfig] = useState<ApiConfig>(defaultConfig);
  const [showTextApiKey, setShowTextApiKey] = useState(false);
  const [showImageApiKey, setShowImageApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState<'text' | 'image' | null>(null);
  const [testResult, setTestResult] = useState<{
    type: 'text' | 'image';
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  useEffect(() => {
    if (initialConfig) {
      setConfig({
        text: {
          apiUrl: initialConfig.text?.apiUrl || defaultConfig.text.apiUrl,
          apiKey: initialConfig.text?.apiKey || '',
          model: initialConfig.text?.model || defaultConfig.text.model,
          analysisModel: initialConfig.text?.analysisModel || defaultConfig.text.analysisModel,
        },
        image: {
          apiUrl: initialConfig.image?.apiUrl || defaultConfig.image.apiUrl,
          apiKey: initialConfig.image?.apiKey || '',
          model: initialConfig.image?.model || defaultConfig.image.model,
          extractModel: initialConfig.image?.extractModel || defaultConfig.image.extractModel,
        },
      });
    }
  }, [initialConfig]);

  const handleSave = () => {
    if (!config.text.apiUrl || !config.text.apiKey) {
      alert('请填写完整的文本 API 配置');
      return;
    }
    if (!config.image.apiUrl || !config.image.apiKey) {
      alert('请填写完整的图像 API 配置');
      return;
    }

    onSave(config);
    onClose();
  };

  const testApiConnection = async (type: 'text' | 'image') => {
    const apiConfig = type === 'text' ? config.text : config.image;

    if (!apiConfig.apiUrl || !apiConfig.apiKey) {
      setTestResult({
        type,
        success: false,
        message: '请先填写完整的 API 地址和密钥',
      });
      return;
    }

    setIsTesting(type);
    setTestResult(null);

    const startTime = Date.now();

    try {
      const url = `${apiConfig.apiUrl.replace(/\/$/, '')}/chat/completions`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: apiConfig.model,
          messages: [
            {
              role: 'user',
              content: 'Hi, please respond with "OK" to confirm the connection.',
            },
          ],
          max_tokens: 10,
          temperature: 0,
        }),
      });

      const responseTime = Date.now() - startTime;
      const responseText = await response.text();

      if (!response.ok) {
        setTestResult({
          type,
          success: false,
          message: `连接失败 (${response.status})`,
          details: responseText.substring(0, 200),
        });
        return;
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        setTestResult({
          type,
          success: false,
          message: 'API 返回了无效的 JSON 格式',
          details: '请检查 API 地址是否正确',
        });
        return;
      }

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        setTestResult({
          type,
          success: false,
          message: 'API 返回格式不符合预期',
          details: '服务商可能不支持 OpenAI 兼容格式',
        });
        return;
      }

      setTestResult({
        type,
        success: true,
        message: `连接成功！响应时间: ${responseTime}ms`,
        details: `模型: ${apiConfig.model}`,
      });

    } catch (error: any) {
      setTestResult({
        type,
        success: false,
        message: '连接失败',
        details: error.message || '网络错误，请检查 API 地址',
      });
    } finally {
      setIsTesting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            API 配置
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-8">
          {/* 说明 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
              配置说明
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li><strong>文本 API (Cotton)</strong>：用于脚本分析、内容生成等文本处理</li>
              <li><strong>图像 API (Privnode)</strong>：用于 PPT 参考图生成、插画提取</li>
              <li>两套 API 独立配置，可以使用不同的服务商</li>
              <li>配置将保存在浏览器本地，不会上传到服务器</li>
            </ul>
          </div>

          {/* 文本 API 配置 (Cotton) */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                文本 API (Cotton)
              </h3>
              <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                用于文本处理
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 pl-4 border-l-2 border-green-500">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API 地址 *
                </label>
                <input
                  type="text"
                  value={config.text.apiUrl}
                  onChange={(e) => setConfig({
                    ...config,
                    text: { ...config.text, apiUrl: e.target.value }
                  })}
                  placeholder="https://cottonapi.cloud/v1"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API 密钥 *
                </label>
                <div className="relative">
                  <input
                    type={showTextApiKey ? 'text' : 'password'}
                    value={config.text.apiKey}
                    onChange={(e) => setConfig({
                      ...config,
                      text: { ...config.text, apiKey: e.target.value }
                    })}
                    placeholder="sk-..."
                    className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTextApiKey(!showTextApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  >
                    {showTextApiKey ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  快速模型
                </label>
                <input
                  type="text"
                  value={config.text.model}
                  onChange={(e) => setConfig({
                    ...config,
                    text: { ...config.text, model: e.target.value }
                  })}
                  placeholder="gemini-2.0-flash"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  用于单页重新生成描述
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  脚本分析模型
                </label>
                <input
                  type="text"
                  value={config.text.analysisModel || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    text: { ...config.text, analysisModel: e.target.value }
                  })}
                  placeholder="gemini-2.5-pro-preview-06-05"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  用于整体脚本分析，默认 Gemini 2.5 Pro
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => testApiConnection('text')}
                  disabled={isTesting === 'text'}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isTesting === 'text'
                      ? 'bg-gray-300 text-gray-500 cursor-wait'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  }`}
                >
                  {isTesting === 'text' ? '测试中...' : '测试连接'}
                </button>

                {testResult && testResult.type === 'text' && (
                  <div
                    className={`mt-2 p-3 rounded-lg text-sm ${
                      testResult.success
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className={`font-medium ${testResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {testResult.message}
                    </div>
                    {testResult.details && (
                      <div className={`text-xs mt-1 ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {testResult.details}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 图像 API 配置 (Privnode) */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                图像 API (Privnode)
              </h3>
              <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                用于图像生成
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 pl-4 border-l-2 border-purple-500">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API 地址 *
                </label>
                <input
                  type="text"
                  value={config.image.apiUrl}
                  onChange={(e) => setConfig({
                    ...config,
                    image: { ...config.image, apiUrl: e.target.value }
                  })}
                  placeholder="https://privnode.com"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API 密钥 *
                </label>
                <div className="relative">
                  <input
                    type={showImageApiKey ? 'text' : 'password'}
                    value={config.image.apiKey}
                    onChange={(e) => setConfig({
                      ...config,
                      image: { ...config.image, apiKey: e.target.value }
                    })}
                    placeholder="sk-..."
                    className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowImageApiKey(!showImageApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  >
                    {showImageApiKey ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  图像生成模型
                </label>
                <input
                  type="text"
                  value={config.image.model}
                  onChange={(e) => setConfig({
                    ...config,
                    image: { ...config.image, model: e.target.value }
                  })}
                  placeholder="gemini-3-pro-image-preview-2k"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  用于生成 PPT 参考图
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  插画提取模型
                </label>
                <input
                  type="text"
                  value={config.image.extractModel}
                  onChange={(e) => setConfig({
                    ...config,
                    image: { ...config.image, extractModel: e.target.value }
                  })}
                  placeholder="gemini-2.5-flash-image"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  默认使用 flash 版本节省成本，可改为 gemini-3-pro-image-preview 获得更清晰效果
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => testApiConnection('image')}
                  disabled={isTesting === 'image'}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isTesting === 'image'
                      ? 'bg-gray-300 text-gray-500 cursor-wait'
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                >
                  {isTesting === 'image' ? '测试中...' : '测试连接'}
                </button>

                {testResult && testResult.type === 'image' && (
                  <div
                    className={`mt-2 p-3 rounded-lg text-sm ${
                      testResult.success
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className={`font-medium ${testResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {testResult.message}
                    </div>
                    {testResult.details && (
                      <div className={`text-xs mt-1 ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {testResult.details}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
}
