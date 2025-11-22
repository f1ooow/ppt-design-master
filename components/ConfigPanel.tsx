'use client';

import { useState, useEffect } from 'react';
import { GeminiConfig } from '@/types';

interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: GeminiConfig) => void;
  initialConfig?: GeminiConfig | null;
}

export default function ConfigPanel({ isOpen, onClose, onSave, initialConfig }: ConfigPanelProps) {
  const [config, setConfig] = useState<GeminiConfig>({
    apiUrl: '',
    apiKey: '',
    modelPro: 'gemini-2.5-pro',
    modelImage: 'gemini-3-pro-image-preview',
    modelExtract: 'gemini-2.5-flash-image',
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  // 默认模型值
  const defaultModels = {
    modelPro: 'gemini-2.5-pro',
    modelImage: 'gemini-3-pro-image-preview',
    modelExtract: 'gemini-2.5-flash-image',
  };

  useEffect(() => {
    if (initialConfig) {
      setConfig({
        ...initialConfig,
        modelPro: initialConfig.modelPro || defaultModels.modelPro,
        modelImage: initialConfig.modelImage || defaultModels.modelImage,
        modelExtract: initialConfig.modelExtract || defaultModels.modelExtract,
      });
    }
  }, [initialConfig]);

  const handleSave = () => {
    // 验证配置
    if (!config.apiUrl || !config.apiKey) {
      alert('请填写完整的 API 地址和密钥');
      return;
    }

    onSave(config);
    onClose();
  };

  const testApiConnection = async () => {
    // 验证配置
    if (!config.apiUrl || !config.apiKey) {
      setTestResult({
        success: false,
        message: '请先填写完整的 API 地址和密钥',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const startTime = Date.now();

    try {
      const url = `${config.apiUrl.replace(/\/$/, '')}/chat/completions`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.modelPro,
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
          success: false,
          message: `连接失败 (${response.status})`,
          details: responseText.substring(0, 200),
        });
        return;
      }

      // 尝试解析响应
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        setTestResult({
          success: false,
          message: 'API 返回了无效的 JSON 格式',
          details: '请检查 API 地址是否正确，或服务商是否支持 OpenAI 兼容格式',
        });
        return;
      }

      // 检查响应格式
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        setTestResult({
          success: false,
          message: 'API 返回格式不符合预期',
          details: '服务商可能不支持 OpenAI 兼容格式',
        });
        return;
      }

      setTestResult({
        success: true,
        message: `连接成功！响应时间: ${responseTime}ms`,
        details: `模型: ${config.modelPro}`,
      });

    } catch (error: any) {
      setTestResult({
        success: false,
        message: '连接失败',
        details: error.message || '网络错误，请检查 API 地址和网络连接',
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Gemini API 配置
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
        <div className="p-6 space-y-6">
          {/* 说明 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
              配置说明
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>使用 <strong>OpenAI 兼容格式</strong>的 API（支持大部分第三方服务商）</li>
              <li>API 地址格式：https://your-api.com/v1（末尾不要加 /chat/completions）</li>
              <li>支持 Gemini、Claude、GPT 等模型（取决于您的服务商）</li>
              <li>配置将保存在浏览器本地，不会上传到服务器</li>
            </ul>
          </div>

          {/* API 地址 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API 地址 *
            </label>
            <input
              type="text"
              value={config.apiUrl}
              onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              填写您的第三方 API 地址（OpenAI 兼容格式）
            </p>
          </div>

          {/* API 密钥 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API 密钥 *
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="AIza..."
                className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                {showApiKey ? (
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

          {/* 模型配置 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                文本分析模型
              </label>
              <input
                type="text"
                value={config.modelPro}
                onChange={(e) => setConfig({ ...config, modelPro: e.target.value })}
                placeholder="gemini-2.5-pro"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                用于分析脚本，支持 vision
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                PPT参考图生成模型 *
              </label>
              <input
                type="text"
                value={config.modelImage}
                onChange={(e) => setConfig({ ...config, modelImage: e.target.value })}
                placeholder="gemini-3-pro-image-preview"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                用于生成PPT参考图
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                插画提取模型
              </label>
              <input
                type="text"
                value={config.modelExtract}
                onChange={(e) => setConfig({ ...config, modelExtract: e.target.value })}
                placeholder="gemini-2.5-flash-image"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                默认使用 gemini-2.5-flash-image 节省成本，但你可以改成 gemini-3-pro-image-preview，提取效果会变得爆炸清晰
              </p>
            </div>
          </div>

          {/* 测试连接 */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={testApiConnection}
              disabled={isTesting}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isTesting
                  ? 'bg-gray-300 text-gray-500 cursor-wait'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isTesting ? '测试中...' : '测试 API 连接'}
            </button>

            {/* 测试结果 */}
            {testResult && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}
              >
                <div
                  className={`font-medium mb-1 ${
                    testResult.success
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  {testResult.message}
                </div>
                {testResult.details && (
                  <div
                    className={`text-xs ${
                      testResult.success
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {testResult.details}
                  </div>
                )}
              </div>
            )}
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
