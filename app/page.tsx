'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiConfig, GenerationResult, PPTDesign } from '@/types';
import ConfigPanel from '@/components/ConfigPanel';
import TemplateUpload from '@/components/TemplateUpload';
import ResultDisplay from '@/components/ResultDisplay';
import PromptSettings from '@/components/PromptSettings';
import BatchMode from '@/components/BatchMode';
import { loadPromptConfig } from '@/config/prompts';

// 单个图片的生成状态
type ImageSlot = {
  id: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  result?: GenerationResult;
  error?: string;
  startTime?: number;
};

// 模式类型
type AppMode = 'single' | 'batch';

// 生成步骤
type GenerationStep = 'idle' | 'analyzing' | 'analyzed' | 'generating';

// 默认配置（方便快速使用）
const defaultApiConfig: ApiConfig = {
  text: {
    apiUrl: 'https://cottonapi.cloud/v1',
    apiKey: 'sk-V5qeMJn0hTs1zr205WO6Zu0D29Y6VM1y4kGbZ9f31HFLj4i5',
    model: 'gemini-2.0-flash',
  },
  image: {
    apiUrl: 'https://privnode.com',
    apiKey: 'sk-oSyrVIvzQNs0A6XNpGhes2BNe8xNZgiZq6ZCJfHiO0jvMlkA',
    model: 'gemini-3-pro-image-preview-2k',
    extractModel: 'gemini-2.5-flash-image-preview',
  },
};

export default function Home() {
  const [mode, setMode] = useState<AppMode>('single');
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);

  // 表单状态
  const [script, setScript] = useState('');
  const [templateImage, setTemplateImage] = useState<string | null>(null);
  const [generateCount, setGenerateCount] = useState(2);

  // 图片槽位（支持流式显示）
  const [imageSlots, setImageSlots] = useState<ImageSlot[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // 画面描述（新增）
  const [description, setDescription] = useState('');
  const [generationStep, setGenerationStep] = useState<GenerationStep>('idle');

  // 选中查看的结果
  const [selectedResult, setSelectedResult] = useState<GenerationResult | null>(null);
  const [isExtractingImages, setIsExtractingImages] = useState(false);

  // 全局提取的插画
  const [globalExtractedImages, setGlobalExtractedImages] = useState<Array<{ imageBase64: string; description: string }>>([]);

  // 生成示例脚本
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);

  // 取消生成控制器
  const abortControllerRef = useRef<AbortController | null>(null);

  // 计时器
  const [elapsedTime, setElapsedTime] = useState<Record<string, number>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 从 localStorage 加载配置
  useEffect(() => {
    const savedConfig = localStorage.getItem('ppt-master-config-v2');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setApiConfig(parsed);
      } catch (error) {
        console.error('Failed to load config:', error);
        // 加载失败时使用默认配置
        setApiConfig(defaultApiConfig);
      }
    } else {
      // 没有保存的配置时使用默认配置
      setApiConfig(defaultApiConfig);
    }
  }, []);

  // 保存配置
  const handleSaveConfig = (config: ApiConfig) => {
    localStorage.setItem('ppt-master-config-v2', JSON.stringify(config));
    setApiConfig(config);
  };

  // 检查配置是否有效
  const isConfigured = apiConfig &&
    apiConfig.text?.apiUrl && apiConfig.text?.apiKey &&
    apiConfig.image?.apiUrl && apiConfig.image?.apiKey;

  // 更新单个槽位状态
  const updateSlot = useCallback((slotId: string, updates: Partial<ImageSlot>) => {
    setImageSlots(prev => prev.map(slot =>
      slot.id === slotId ? { ...slot, ...updates } : slot
    ));
  }, []);

  // 分析脚本生成描述
  const handleAnalyzeScript = async () => {
    if (!script.trim()) {
      alert('请输入脚本内容');
      return;
    }
    if (!isConfigured) {
      alert('请先配置 API');
      setShowConfigPanel(true);
      return;
    }

    setGenerationStep('analyzing');
    setDescription('');

    try {
      // 加载提示词配置
      const prompts = loadPromptConfig();
      const customPrompt = templateImage
        ? prompts.generateDescriptionWithTemplate
        : prompts.generateDescription;

      const response = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          custom_prompt: customPrompt,
          template_base64: templateImage,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || '分析失败');
      }

      const { description: desc } = await response.json();
      setDescription(desc);
      setGenerationStep('analyzed');
    } catch (error: any) {
      alert('分析失败：' + error.message);
      setGenerationStep('idle');
    }
  };

  // 生成单张图片（使用描述）
  const generateSingleImage = async (slotId: string, index: number, signal: AbortSignal, desc: string) => {
    updateSlot(slotId, { status: 'generating', startTime: Date.now() });

    try {
      // 加载提示词配置
      const prompts = loadPromptConfig();
      const customPrompt = templateImage
        ? prompts.generateImage
        : prompts.generateImageNoTemplate;

      const response = await fetch('/api/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          description: desc,
          templateImage,
          apiConfig,
          custom_prompt: customPrompt,
        }),
        signal,
      });

      if (!response.ok) throw new Error('生成失败');

      const { imageBase64 } = await response.json();

      const result: GenerationResult = {
        id: `${Date.now()}-${index}`,
        timestamp: Date.now(),
        script,
        design: {
          layout: 'title-content',
          title: '设计参考',
          content: { type: 'paragraph', items: [script] },
        } as PPTDesign,
        previewImage: imageBase64,
        extractedImages: [],
        status: 'completed',
      };

      updateSlot(slotId, { status: 'completed', result });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        updateSlot(slotId, { status: 'error', error: '已停止' });
      } else {
        updateSlot(slotId, { status: 'error', error: error.message });
      }
    }
  };

  // 开始生成图片
  const handleGenerate = async () => {
    if (!description.trim()) {
      alert('请先分析脚本生成画面描述');
      return;
    }
    if (!isConfigured) {
      alert('请先配置 API');
      setShowConfigPanel(true);
      return;
    }

    setIsGenerating(true);
    setGenerationStep('generating');
    setSelectedResult(null);
    setElapsedTime({});

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const slots: ImageSlot[] = Array.from({ length: generateCount }, (_, i) => ({
      id: `slot-${Date.now()}-${i}`,
      status: 'pending',
    }));
    setImageSlots(slots);

    timerRef.current = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = { ...prev };
        slots.forEach(slot => {
          const slotElement = document.querySelector(`[data-slot-id="${slot.id}"]`);
          if (slotElement) {
            const startTime = parseInt(slotElement.getAttribute('data-start-time') || '0');
            if (startTime > 0) {
              newTime[slot.id] = Math.floor((Date.now() - startTime) / 1000);
            }
          }
        });
        return newTime;
      });
    }, 1000);

    await Promise.allSettled(
      slots.map((slot, index) => generateSingleImage(slot.id, index, controller.signal, description))
    );

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    abortControllerRef.current = null;
    setIsGenerating(false);
    setGenerationStep('analyzed');
  };

  // 停止生成
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsGenerating(false);
    setGenerationStep('analyzed');
  };

  // 提取插画
  const handleExtractImages = async (croppedImageBase64: string) => {
    if (!apiConfig) return;

    setIsExtractingImages(true);
    try {
      const response = await fetch('/api/extract-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ croppedImageBase64, apiConfig }),
      });

      if (response.ok) {
        const { image } = await response.json();
        setGlobalExtractedImages(prev => [...prev, image]);
      } else {
        throw new Error('提取失败');
      }
    } catch (error: any) {
      alert('提取插画失败：' + error.message);
    } finally {
      setIsExtractingImages(false);
    }
  };

  // 下载
  const handleDownload = (type: 'preview' | 'ppt' | 'all') => {
    if (!selectedResult?.previewImage) return;
    const link = document.createElement('a');
    link.href = selectedResult.previewImage;
    link.download = `PPT参考图_${selectedResult.id}.png`;
    link.click();
  };

  // 生成示例脚本
  const handleGenerateSample = async () => {
    if (!apiConfig) {
      alert('请先配置 API');
      return;
    }

    setIsGeneratingSample(true);
    try {
      const response = await fetch('/api/generate-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiConfig }),
      });

      if (response.ok) {
        const { content } = await response.json();
        setScript(content);
      } else {
        const { error } = await response.json();
        throw new Error(error);
      }
    } catch (error: any) {
      alert('生成示例失败：' + error.message);
    } finally {
      setIsGeneratingSample(false);
    }
  };

  // 获取已完成的结果
  const completedResults = imageSlots.filter(s => s.status === 'completed' && s.result);

  // 批量模式
  if (mode === 'batch') {
    return <BatchMode onBack={() => setMode('single')} />;
  }

  // 单页模式
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a]">
      {/* 顶部导航 */}
      <nav className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-black/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              PPT 参考图生成
            </h1>
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setMode('single')}
                className="px-4 py-1.5 text-sm font-medium rounded-md transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              >
                单页模式
              </button>
              <button
                onClick={() => setMode('batch')}
                className="px-4 py-1.5 text-sm font-medium rounded-md transition-all text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                批量模式
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowPromptSettings(true)}
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              提示词
            </button>
            <button
              onClick={() => setShowConfigPanel(true)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-red-500'}`} />
              API 设置
            </button>
          </div>
        </div>
      </nav>

      {/* 弹窗 */}
      <ConfigPanel isOpen={showConfigPanel} onClose={() => setShowConfigPanel(false)} onSave={handleSaveConfig} initialConfig={apiConfig} />
      <PromptSettings isOpen={showPromptSettings} onClose={() => setShowPromptSettings(false)} />

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧输入区 */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-5">
              {/* 脚本输入 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    脚本内容
                  </label>
                  <button
                    onClick={handleGenerateSample}
                    disabled={isGeneratingSample || isGenerating || !isConfigured}
                    className="text-xs text-blue-500 hover:text-blue-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {isGeneratingSample ? '生成中...' : '随机生成试一下'}
                  </button>
                </div>
                <textarea
                  value={script}
                  onChange={(e) => {
                    setScript(e.target.value);
                    // 脚本变更时重置描述和状态
                    if (description) {
                      setDescription('');
                      setGenerationStep('idle');
                    }
                  }}
                  className="w-full h-40 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 resize-none transition-shadow"
                  placeholder="输入这一页PPT要讲的内容..."
                  disabled={isGenerating || generationStep === 'analyzing'}
                />
              </div>

              {/* 模板选择 */}
              <TemplateUpload
                onImageChange={setTemplateImage}
                className={isGenerating || generationStep === 'analyzing' ? 'pointer-events-none opacity-50' : ''}
              />

              {/* 生成数量 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  生成数量
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setGenerateCount(n)}
                      disabled={isGenerating || generationStep === 'analyzing'}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        generateCount === n
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      } ${isGenerating || generationStep === 'analyzing' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* 画面描述区域 */}
              {(generationStep !== 'idle' || description) && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      画面描述
                    </label>
                    <button
                      onClick={handleAnalyzeScript}
                      disabled={generationStep === 'analyzing' || isGenerating || !script.trim()}
                      className="text-xs text-blue-500 hover:text-blue-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {generationStep === 'analyzing' ? '分析中...' : '重新分析'}
                    </button>
                  </div>
                  {generationStep === 'analyzing' ? (
                    <div className="w-full h-32 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center">
                      <div className="flex items-center gap-3 text-gray-500">
                        <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                        <span className="text-sm">正在分析脚本内容...</span>
                      </div>
                    </div>
                  ) : (
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full h-32 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 resize-none transition-shadow text-sm"
                      placeholder="AI 分析后的画面描述会显示在这里，你也可以手动编辑..."
                      disabled={isGenerating}
                    />
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    这是 AI 对脚本内容的理解，将用于生成 PPT 画面。你可以编辑调整。
                  </p>
                </div>
              )}

              {/* 分析/生成按钮 */}
              {generationStep === 'idle' ? (
                <button
                  onClick={handleAnalyzeScript}
                  disabled={!script.trim() || !isConfigured}
                  className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium rounded-xl transition-colors disabled:cursor-not-allowed"
                >
                  分析脚本
                </button>
              ) : generationStep === 'analyzing' ? (
                <button
                  disabled
                  className="w-full py-3.5 bg-gray-300 dark:bg-gray-700 text-white font-medium rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  分析中...
                </button>
              ) : isGenerating ? (
                <button
                  onClick={handleStop}
                  className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors"
                >
                  停止生成
                </button>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={!description.trim()}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium rounded-xl transition-colors disabled:cursor-not-allowed"
                >
                  生成参考图
                </button>
              )}
          </div>

          {/* 右侧结果区 */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col">
              {imageSlots.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {imageSlots.map((slot, index) => (
                    <div
                      key={slot.id}
                      data-slot-id={slot.id}
                      data-start-time={slot.startTime || 0}
                      className={`relative aspect-video bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 transition-all ${
                        slot.status === 'completed' ? 'cursor-pointer hover:ring-2 hover:ring-blue-500' : ''
                      }`}
                      onClick={() => slot.result && setSelectedResult(slot.result)}
                    >
                      {/* 加载中 */}
                      {(slot.status === 'pending' || slot.status === 'generating') && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
                          <span className="mt-3 text-sm text-gray-400">
                            {slot.status === 'pending' ? '等待中...' : '生成中...'}
                          </span>
                          {slot.status === 'generating' && elapsedTime[slot.id] !== undefined && (
                            <span className="mt-1 text-xs text-gray-500">
                              {elapsedTime[slot.id]}s
                            </span>
                          )}
                        </div>
                      )}

                      {/* 完成 */}
                      {slot.status === 'completed' && slot.result?.previewImage && (
                        <>
                          <img
                            src={slot.result.previewImage}
                            alt={`方案 ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors" />
                          <span className="absolute top-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded-md">
                            方案 {index + 1}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const link = document.createElement('a');
                              link.href = slot.result!.previewImage!;
                              link.download = `方案${index + 1}.png`;
                              link.click();
                            }}
                            className="absolute bottom-2 right-2 px-3 py-1.5 bg-white/90 hover:bg-white text-gray-900 text-xs font-medium rounded-md transition-colors"
                          >
                            下载
                          </button>
                        </>
                      )}

                      {/* 错误 */}
                      {slot.status === 'error' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="mt-2 text-sm">生成失败</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <svg className="mx-auto w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">输入脚本后点击生成</p>
                  </div>
                </div>
              )}

            {/* 提示 */}
            {completedResults.length > 0 && !isGenerating && !selectedResult && (
              <p className="text-center text-sm text-gray-400 mt-4">
                点击图片查看详情和提取配图
              </p>
            )}

            {/* 选中图片的详情展示 */}
            {selectedResult && (
              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
                <ResultDisplay
                  result={selectedResult}
                  onDownload={handleDownload}
                  onExtractImages={handleExtractImages}
                  isExtractingImages={isExtractingImages}
                />
              </div>
            )}

            {/* 全局提取的插画 */}
            {globalExtractedImages.length > 0 && (
              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    已提取的插画 ({globalExtractedImages.length})
                  </span>
                  <button
                    onClick={() => setGlobalExtractedImages([])}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    清空
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {globalExtractedImages.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img.imageBase64}
                        alt={img.description || `插画 ${index + 1}`}
                        className="w-full aspect-square object-contain bg-gray-50 dark:bg-gray-800 rounded-lg"
                      />
                      <a
                        href={img.imageBase64}
                        download={`插画-${index + 1}.png`}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                      >
                        <span className="text-white text-xs">下载</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
