'use client';

import { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import ScriptUploader from './ScriptUploader';
import DescriptionEditor from './DescriptionEditor';
import ImageGenerator from './ImageGenerator';
import { ScriptPage, BatchStep, ParsedExcelResult } from './types';
import { loadPromptConfig } from '@/config/prompts';
import { defaultApiConfig } from '@/config/gemini';
import TemplateUpload from '@/components/TemplateUpload';
import { CourseMetadata, ApiConfig } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

interface BatchModeProps {
  onBack?: () => void;
}

// 判断页面类型（片头、片尾、正文）
function detectPageType(segment: string, narration: string, index: number, totalPages: number): 'cover' | 'ending' | 'content' {
  const segmentLower = segment.toLowerCase();
  const narrationLower = narration.toLowerCase();

  // 片头/封面的关键词
  const coverKeywords = ['片头', '封面', '开场', '开头', '首页', 'cover', 'intro', 'opening'];
  if (coverKeywords.some(k => segmentLower.includes(k) || narrationLower.includes(k))) {
    return 'cover';
  }

  // 片尾/结束的关键词
  const endingKeywords = ['片尾', '结尾', '结束', '结语', '谢谢', '感谢', '再见', 'ending', 'outro', 'thanks'];
  if (endingKeywords.some(k => segmentLower.includes(k) || narrationLower.includes(k))) {
    return 'ending';
  }

  // 第一页通常是封面（如果讲稿内容很短或为空）
  if (index === 0 && (!narration || narration.length < 50)) {
    return 'cover';
  }

  // 最后一页如果讲稿很短，可能是片尾
  if (index === totalPages - 1 && narration.length < 50) {
    return 'ending';
  }

  return 'content';
}

// 用AI整体分析脚本（拆分镜头 + 生成描述，一步到位）
async function parseExcelWithAI(
  data: ArrayBuffer,
  apiConfig: ApiConfig,
  templateImage?: string | null
): Promise<ParsedExcelResult> {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });

  if (jsonData.length < 2) {
    throw new Error('文件内容为空');
  }

  // 全部数据发给AI
  const allRowsText = jsonData.map((row: any[], i: number) =>
    `第${i}行: ${JSON.stringify(row)}`
  ).join('\n');

  // 加载提示词配置
  const prompts = loadPromptConfig();

  // 使用整体分析提示词
  const basePrompt = prompts.analyzeFullScript || '';
  const prompt = basePrompt.replace('{{scriptContent}}', allRowsText);

  // 使用复杂分析模型（如果配置了的话）
  const analysisModel = apiConfig.text.analysisModel || apiConfig.text.model || 'gemini-2.0-flash';

  console.log('[脚本分析] 使用模型:', analysisModel, '有模板:', !!templateImage);

  // 构建消息（支持多模态）
  let messages: any[];
  if (templateImage) {
    // 有模板：使用多模态消息，AI 需要分析模板的布局结构
    messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: templateImage } }
        ]
      }
    ];
  } else {
    // 无模板：纯文本
    messages = [{ role: 'user', content: prompt }];
  }

  const response = await fetch(`${apiConfig.text.apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiConfig.text.apiKey}`,
    },
    body: JSON.stringify({
      model: analysisModel,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[脚本分析] API错误:', errorText);
    throw new Error('AI分析失败，请检查API配置');
  }

  const result = await response.json();
  const aiText = result.choices?.[0]?.message?.content || '';

  // 提取JSON
  const jsonMatch = aiText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[脚本分析] AI返回内容:', aiText);
    throw new Error('AI返回格式错误');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (!parsed.pages || parsed.pages.length === 0) {
    throw new Error('未能解析出有效内容');
  }

  // 提取课程元信息
  const courseMetadata: CourseMetadata = {
    courseName: parsed.courseMetadata?.courseName || '',
    textbookName: parsed.courseMetadata?.textbookName || '',
    chapterName: parsed.courseMetadata?.chapterName || '',
    unitName: parsed.courseMetadata?.unitName || '',
    school: parsed.courseMetadata?.school || '',
    major: parsed.courseMetadata?.major || '',
    teacher: parsed.courseMetadata?.teacher || '',
    extraInfo: parsed.courseMetadata?.extraInfo || '',
  };

  const totalPages = parsed.pages.length;

  // 转换为ScriptPage格式（现在直接包含 description）
  const pages: ScriptPage[] = parsed.pages.map((p: any, i: number) => {
    const segment = p.segment || '';
    const narration = p.narration || '';
    // 优先使用AI返回的pageType，否则用启发式检测
    const pageType = p.pageType || detectPageType(segment, narration, i, totalPages);

    return {
      id: `page-${i + 1}`,
      index: i,
      shot_number: String(i + 1),
      segment,
      narration,
      visual_hint: p.visual_hint || '',
      description: p.description || '', // 现在直接从AI返回中获取描述
      image_path: '',
      status: p.description ? 'pending' as const : 'pending' as const,
      error_message: '',
      pageType,
    };
  }).filter((p: ScriptPage) => p.narration || p.pageType === 'cover' || p.pageType === 'ending');

  console.log('[脚本分析] 完成，共', pages.length, '页，描述已生成:', pages.filter(p => p.description).length, '页');

  return { pages, courseMetadata };
}

export default function BatchMode({ onBack }: BatchModeProps) {
  const [step, setStep] = useState<BatchStep>('upload');
  const [pages, setPages] = useState<ScriptPage[]>([]);
  const [courseMetadata, setCourseMetadata] = useState<CourseMetadata>({}); // 课程元信息
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [templateImage, setTemplateImage] = useState<string | null>(null); // 模板图片
  const [uploadedFile, setUploadedFile] = useState<File | null>(null); // 已上传的文件（未解析）

  // 加载API配置（使用新版配置 ppt-master-config-v2）
  useEffect(() => {
    const saved = localStorage.getItem('ppt-master-config-v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setApiConfig(parsed);
      } catch (e) {
        // 加载失败时使用默认配置
        setApiConfig(defaultApiConfig);
      }
    } else {
      // 没有保存的配置时使用默认配置
      setApiConfig(defaultApiConfig);
    }
  }, []);

  // 文件上传处理（只保存文件，不解析）
  const handleFileUpload = (file: File) => {
    setUploadedFile(file);
    setError(null);
  };

  // 开始解析文件（AI整体分析）
  const handleStartParsing = async () => {
    if (!uploadedFile) {
      setError('请先上传文件');
      return;
    }

    if (!apiConfig?.text?.apiUrl || !apiConfig?.text?.apiKey) {
      setError('请先在"API设置"中配置API');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const arrayBuffer = await uploadedFile.arrayBuffer();
      // 传递模板图片给AI，一次性完成拆分和描述生成
      const { pages: parsedPages, courseMetadata: metadata } = await parseExcelWithAI(arrayBuffer, apiConfig, templateImage);
      setPages(parsedPages);
      setCourseMetadata(metadata);

      // 打印提取的课程信息
      console.log('[批量模式] 提取的课程信息:', metadata);
      console.log('[批量模式] 已生成描述的页面数:', parsedPages.filter(p => p.description).length, '/', parsedPages.length);

      setStep('description');
    } catch (err: any) {
      setError(err.message || '文件解析失败');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  // 更新单页数据
  const handleUpdatePage = (index: number, updates: Partial<ScriptPage>) => {
    setPages(prev => prev.map((p, i) => i === index ? { ...p, ...updates } : p));
  };

  // 构建完整上下文
  const buildFullContext = useCallback(() => {
    return pages.map((p, i) =>
      `【第${i + 1}页】${p.segment ? `[${p.segment}] ` : ''}${p.narration}`
    ).join('\n\n');
  }, [pages]);

  // 格式化课程信息为字符串
  const formatCourseInfo = useCallback(() => {
    const parts: string[] = [];
    if (courseMetadata.courseName) parts.push(`课程：${courseMetadata.courseName}`);
    if (courseMetadata.textbookName) parts.push(`教材：${courseMetadata.textbookName}`);
    if (courseMetadata.chapterName) parts.push(`章节：${courseMetadata.chapterName}`);
    if (courseMetadata.unitName) parts.push(`单元：${courseMetadata.unitName}`);
    if (courseMetadata.school) parts.push(`院校：${courseMetadata.school}`);
    if (courseMetadata.major) parts.push(`专业：${courseMetadata.major}`);
    if (courseMetadata.teacher) parts.push(`教师：${courseMetadata.teacher}`);
    if (courseMetadata.extraInfo) parts.push(`其他：${courseMetadata.extraInfo}`);
    return parts.length > 0 ? parts.join('\n') : '（未提取到课程信息）';
  }, [courseMetadata]);

  // 根据页面类型选择合适的提示词
  const getPromptForPage = useCallback((page: ScriptPage, prompts: ReturnType<typeof loadPromptConfig>) => {
    const courseInfo = formatCourseInfo();

    if (page.pageType === 'cover') {
      // 封面页使用专用提示词
      return prompts.generateDescriptionCover
        .replace('{{courseInfo}}', courseInfo)
        .replace('{{segment}}', page.segment || '片头')
        .replace('{{narration}}', page.narration || '（无讲稿）');
    }

    if (page.pageType === 'ending') {
      // 片尾页使用专用提示词
      return prompts.generateDescriptionEnding
        .replace('{{courseInfo}}', courseInfo)
        .replace('{{narration}}', page.narration || '（无讲稿）');
    }

    // 正文页使用通用提示词
    return templateImage
      ? prompts.generateDescriptionWithTemplate
      : prompts.generateDescription;
  }, [formatCourseInfo, templateImage]);

  // 生成单页描述
  const handleRegenerateDesc = async (index: number) => {
    const page = pages[index];
    handleUpdatePage(index, { status: 'generating_desc', description: '' });
    setIsGeneratingDesc(true);

    try {
      const fullContext = buildFullContext();
      const prompts = loadPromptConfig();
      // 根据页面类型选择提示词
      const customPrompt = getPromptForPage(page, prompts);

      console.log(`[描述生成] 页面 ${index + 1} 类型: ${page.pageType || 'content'}`);

      // 封面/片尾页如果讲稿为空，用课程信息代替
      let narrationToSend = page.narration;
      if (!narrationToSend && (page.pageType === 'cover' || page.pageType === 'ending')) {
        narrationToSend = formatCourseInfo();
      }

      const response = await fetch(`${API_BASE}/api/batch/generate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narration: narrationToSend,
          visual_hint: page.visual_hint,
          full_context: fullContext,
          current_index: index + 1,
          custom_prompt: customPrompt,
          template_base64: templateImage,
        }),
      });

      const result = await response.json();

      if (result.success) {
        handleUpdatePage(index, { description: result.data.description, status: 'pending' });
      } else {
        handleUpdatePage(index, { status: 'error', error_message: result.message });
      }
    } catch (err: any) {
      handleUpdatePage(index, { status: 'error', error_message: err.message });
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  // 批量并发生成描述
  const handleBatchGenerateDesc = async () => {
    setIsGeneratingDesc(true);
    setError(null);

    // 调试日志
    console.log('[批量生成] templateImage:', templateImage ? `有模板 (${templateImage.length} 字符)` : '无模板');
    console.log('[批量生成] 课程信息:', formatCourseInfo());

    // 找出没有描述的页面
    const pendingPages = pages.map((p, i) => ({ page: p, index: i })).filter(({ page }) => !page.description);

    // 标记为生成中
    pendingPages.forEach(({ index }) => {
      handleUpdatePage(index, { status: 'generating_desc' });
    });

    // 构建完整上下文（只构建一次）
    const fullContext = buildFullContext();
    // 加载提示词配置
    const prompts = loadPromptConfig();

    // 并发生成，控制并发数
    const MAX_CONCURRENT = 5;
    const generateDesc = async (page: typeof pages[0], index: number) => {
      try {
        // 根据页面类型选择提示词
        const customPrompt = getPromptForPage(page, prompts);
        console.log(`[批量生成] 页面 ${index + 1} 类型: ${page.pageType || 'content'}`);

        // 封面/片尾页如果讲稿为空，用课程信息代替
        let narrationToSend = page.narration;
        if (!narrationToSend && (page.pageType === 'cover' || page.pageType === 'ending')) {
          narrationToSend = formatCourseInfo();
        }

        const response = await fetch(`${API_BASE}/api/batch/generate-description`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            narration: narrationToSend,
            visual_hint: page.visual_hint,
            full_context: fullContext,
            current_index: index + 1,
            custom_prompt: customPrompt,
            template_base64: templateImage,
          }),
        });

        const result = await response.json();

        if (result.success) {
          handleUpdatePage(index, { description: result.data.description, status: 'pending' });
        } else {
          handleUpdatePage(index, { status: 'error', error_message: result.message });
        }
      } catch (err: any) {
        handleUpdatePage(index, { status: 'error', error_message: err.message });
      }
    };

    // Promise 池控制并发
    const pool: Promise<void>[] = [];
    for (const { page, index } of pendingPages) {
      const promise = generateDesc(page, index).then(() => {
        pool.splice(pool.indexOf(promise), 1);
      });
      pool.push(promise);

      if (pool.length >= MAX_CONCURRENT) {
        await Promise.race(pool);
      }
    }
    await Promise.all(pool);

    setIsGeneratingDesc(false);
  };

  // 步骤标题
  const stepTitles: Record<BatchStep, string> = {
    upload: '上传脚本',
    description: '编辑页面描述',
    image: '生成图片',
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a]">
      {/* 顶部导航 */}
      <nav className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-black/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              批量生成
            </h1>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {stepTitles[step]}
            </span>
          </div>

          {/* 步骤指示器 */}
          <div className="flex items-center gap-2">
            {(['upload', 'description', 'image'] as BatchStep[]).map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    s === step
                      ? 'bg-blue-500 text-white'
                      : pages.length > 0 && i < ['upload', 'description', 'image'].indexOf(step)
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {pages.length > 0 && i < ['upload', 'description', 'image'].indexOf(step) ? '✓' : i + 1}
                </div>
                {i < 2 && (
                  <div className={`w-8 h-0.5 mx-1 ${
                    i < ['upload', 'description', 'image'].indexOf(step)
                      ? 'bg-emerald-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* 步骤 1: 上传文件 */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 左侧：上传脚本 */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                {!uploadedFile ? (
                  <ScriptUploader onUpload={handleFileUpload} isUploading={false} />
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      上传脚本文件
                    </label>
                    <div className="border-2 border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-6 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                        文件已上传
                      </p>
                      <p className="text-emerald-600 dark:text-emerald-400 text-sm mt-1 truncate max-w-xs mx-auto">
                        {uploadedFile.name}
                      </p>
                      <button
                        onClick={() => setUploadedFile(null)}
                        className="mt-4 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                      >
                        重新选择
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 右侧：模板选择 */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                <TemplateUpload
                  onImageChange={setTemplateImage}
                  className=""
                />
                {templateImage && (
                  <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">
                    已选择模板，画面分析时会参考模板风格
                  </p>
                )}
              </div>
            </div>

            {/* 下一步按钮 */}
            {uploadedFile && (
              <div className="flex justify-end">
                <button
                  onClick={handleStartParsing}
                  disabled={isUploading}
                  className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      正在解析...
                    </>
                  ) : (
                    <>
                      下一步
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 步骤 2: 编辑描述 */}
        {step === 'description' && (
          <DescriptionEditor
            pages={pages}
            courseMetadata={courseMetadata}
            onUpdatePage={handleUpdatePage}
            onRegenerateDesc={handleRegenerateDesc}
            onBatchGenerateDesc={handleBatchGenerateDesc}
            onNext={() => setStep('image')}
            onBack={() => {
              setPages([]);
              setCourseMetadata({});
              setUploadedFile(null);
              setStep('upload');
            }}
            isGenerating={isGeneratingDesc}
          />
        )}

        {/* 步骤 3: 生成图片 */}
        {step === 'image' && (
          <ImageGenerator
            pages={pages}
            onUpdatePage={handleUpdatePage}
            onBack={() => setStep('description')}
            initialTemplateBase64={templateImage}
            courseMetadata={courseMetadata}
          />
        )}
      </main>
    </div>
  );
}
