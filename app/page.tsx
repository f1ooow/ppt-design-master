'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiConfig, GenerationResult, PPTDesign } from '@/types';
import ConfigPanel from '@/components/ConfigPanel';
import TemplateUpload from '@/components/TemplateUpload';
import ResultDisplay from '@/components/ResultDisplay';
import BatchMode from '@/components/BatchMode';
import CleanMode from '@/components/CleanMode';
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
type AppMode = 'single' | 'batch' | 'clean';

// 生成步骤
type GenerationStep = 'idle' | 'analyzing' | 'analyzed' | 'generating';

// 默认配置（空值，需要用户配置）
const defaultApiConfig: ApiConfig = {
  text: {
    apiUrl: '',
    apiKey: '',
    model: 'gemini-2.0-flash',
  },
  image: {
    apiUrl: '',
    apiKey: '',
    model: 'gemini-2.0-flash-exp-image-generation',
  },
};

export default function Home() {
  const [mode, setMode] = useState<AppMode>('single');
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);

  // 表单状态
  const [script, setScript] = useState('');
  const [templateImage, setTemplateImage] = useState<string | null>(null);
  const [generateCount, setGenerateCount] = useState(2);

  // 图片槽位（支持流式显示）
  const [imageSlots, setImageSlots] = useState<ImageSlot[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // 画面描述（批量模式使用，单页不需要）
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
    // 版本号变更，强制使用新配置
    const configVersion = 'v5-gemini-native';
    const savedVersion = localStorage.getItem('ppt-master-config-version');

    if (savedVersion !== configVersion) {
      // 版本不匹配，清除旧配置，使用新默认配置
      localStorage.removeItem('ppt-master-config-v2');
      localStorage.setItem('ppt-master-config-version', configVersion);
      setApiConfig(defaultApiConfig);
      return;
    }

    const savedConfig = localStorage.getItem('ppt-master-config-v2');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setApiConfig(parsed);
      } catch (error) {
        console.error('Failed to load config:', error);
        setApiConfig(defaultApiConfig);
      }
    } else {
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

  // 生成单张图片（两步流程：先生成描述，再生成图片）
  const generateSingleImage = async (slotId: string, index: number, signal: AbortSignal) => {
    updateSlot(slotId, { status: 'generating', startTime: Date.now() });

    try {
      const prompts = loadPromptConfig();

      // 第一步：生成画面描述
      const descPrompt = templateImage
        ? prompts.generateDescriptionWithTemplate
        : prompts.generateDescription;

      const descResponse = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          custom_prompt: descPrompt,
          template_base64: templateImage,
        }),
        signal,
      });

      if (!descResponse.ok) {
        const { error } = await descResponse.json();
        throw new Error(error || '描述生成失败');
      }

      const { description: pageDescription } = await descResponse.json();

      // 第二步：根据描述生成图片
      const imagePrompt = templateImage
        ? prompts.generateImage
        : prompts.generateImageNoTemplate;

      const response = await fetch('/api/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          description: pageDescription,
          templateImage,
          apiConfig,
          custom_prompt: imagePrompt,
        }),
        signal,
      });

      if (!response.ok) throw new Error('图片生成失败');

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
    if (!script.trim()) {
      alert('请输入脚本内容');
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
      slots.map((slot, index) => generateSingleImage(slot.id, index, controller.signal))
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

  // 素材清洗模式
  if (mode === 'clean') {
    return <CleanMode onBack={() => setMode('single')} />;
  }

  // 单页模式
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* 顶部导航 */}
      <nav className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              PPT Design
            </h1>
            <div className="flex gap-1 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl">
              <button
                onClick={() => setMode('single')}
                className="px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              >
                Single
              </button>
              <button
                onClick={() => setMode('batch')}
                className="px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 text-slate-500 hover:text-slate-800 hover:bg-white/50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50"
              >
                Batch
              </button>
              <button
                onClick={() => setMode('clean')}
                className="px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 text-slate-500 hover:text-slate-800 hover:bg-white/50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50"
              >
                Clean
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowConfigPanel(true)}
            className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 rounded-xl transition-all duration-200"
          >
            <span className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-rose-500'} ring-2 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-800 ${isConfigured ? 'ring-emerald-500/30' : 'ring-rose-500/30'}`} />
            API
          </button>
        </div>
      </nav>

      {/* 弹窗 */}
      <ConfigPanel isOpen={showConfigPanel} onClose={() => setShowConfigPanel(false)} onSave={handleSaveConfig} initialConfig={apiConfig} />

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

              {/* 生成按钮 */}
              {isGenerating ? (
                <button
                  onClick={handleStop}
                  className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors"
                >
                  停止生成
                </button>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={!script.trim() || !isConfigured}
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
