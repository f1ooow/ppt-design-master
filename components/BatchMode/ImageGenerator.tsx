'use client';

import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { ScriptPage } from './types';
import { loadTemplates, TemplateItem } from '@/config/templates';
import { loadPromptConfig } from '@/config/prompts';
import { defaultApiConfig } from '@/config/gemini';
import { CourseMetadata, ApiConfig } from '@/types';
import ImageCropper from '../ImageCropper';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

// 并发控制：最多同时生成 3 张图片
const MAX_CONCURRENT = 3;

// 额外页面类型
interface ExtraPage {
  id: string;
  type: 'cover' | 'ending';
  title: string;
  subtitle?: string;
  image_base64?: string;
  image_versions?: string[];  // 所有版本的图片
  selected_version?: number;  // 当前选中的版本索引
  status: 'pending' | 'generating' | 'completed' | 'error';
  error_message?: string;
}

interface ImageGeneratorProps {
  pages: ScriptPage[];
  onUpdatePage: (index: number, updates: Partial<ScriptPage>) => void;
  onBack: () => void;
  initialTemplateBase64?: string | null; // 从上一步传来的模板
  courseMetadata?: CourseMetadata; // 课程信息
}

// 获取 API 配置（使用新版配置）
function getApiConfig(): ApiConfig {
  if (typeof window === 'undefined') return defaultApiConfig;
  const saved = localStorage.getItem('ppt-master-config-v2');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {}
  }
  return defaultApiConfig;
}

export default function ImageGenerator({
  pages,
  onUpdatePage,
  onBack,
  initialTemplateBase64,
  courseMetadata,
}: ImageGeneratorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingCount, setGeneratingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 停止标记 - 用于真正打断批次
  const shouldStopRef = useRef(false);

  // 模板相关
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateBase64, setTemplateBase64] = useState<string | null>(initialTemplateBase64 || null);

  // 封面页和结束页 - 默认不包含，用户需要的话自己单独生成
  const [includeCover, setIncludeCover] = useState(false);
  const [includeEnding, setIncludeEnding] = useState(false);
  const [coverPage, setCoverPage] = useState<ExtraPage>({
    id: 'cover',
    type: 'cover',
    title: '',
    subtitle: '',
    status: 'pending'
  });
  const [endingPage, setEndingPage] = useState<ExtraPage>({
    id: 'ending',
    type: 'ending',
    title: '感谢观看',
    subtitle: 'Thank You',
    status: 'pending'
  });

  // 导出状态
  const [isExporting, setIsExporting] = useState(false);
  // 重新生成描述状态
  const [isRegeneratingDesc, setIsRegeneratingDesc] = useState(false);
  // 裁剪提取插画相关状态
  const [showCropper, setShowCropper] = useState(false);
  const [isExtractingImages, setIsExtractingImages] = useState(false);
  const [extractedImages, setExtractedImages] = useState<string[]>([]);

  // 加载模板
  useEffect(() => {
    loadTemplates().then(setTemplates);
  }, []);

  // 从第一页提取标题
  useEffect(() => {
    if (pages.length > 0 && !coverPage.title) {
      const firstPage = pages[0];
      setCoverPage(prev => ({
        ...prev,
        title: firstPage.segment || '课程名称',
        subtitle: ''
      }));
    }
  }, [pages]);

  // 选择预设模板
  const handleSelectTemplate = async (template: TemplateItem) => {
    try {
      const response = await fetch(template.fullImage);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setSelectedTemplate(template.id);
        setTemplateBase64(base64);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('加载模板失败:', err);
    }
  };

  const handleClearTemplate = () => {
    setSelectedTemplate(null);
    setTemplateBase64(null);
  };

  // 构建所有页面列表
  const allPages = [
    ...(includeCover ? [{ type: 'cover' as const, data: coverPage }] : []),
    ...pages.map((p, i) => ({ type: 'content' as const, data: p, index: i })),
    ...(includeEnding ? [{ type: 'ending' as const, data: endingPage }] : [])
  ];

  const selectedPage = allPages[selectedIndex];
  const contentCompletedCount = pages.filter(p => p.image_base64).length;
  const coverCompleted = coverPage.image_base64 ? 1 : 0;
  const endingCompleted = endingPage.image_base64 ? 1 : 0;
  const totalCompleted = contentCompletedCount + (includeCover ? coverCompleted : 0) + (includeEnding ? endingCompleted : 0);
  const totalPages = pages.length + (includeCover ? 1 : 0) + (includeEnding ? 1 : 0);
  const pendingCount = totalPages - totalCompleted;

  // 格式化课程信息
  const formatCourseInfo = () => {
    if (!courseMetadata) return '';
    const parts: string[] = [];
    if (courseMetadata.courseName) parts.push(`课程：${courseMetadata.courseName}`);
    if (courseMetadata.textbookName) parts.push(`教材：${courseMetadata.textbookName}`);
    if (courseMetadata.chapterName) parts.push(`章节：${courseMetadata.chapterName}`);
    if (courseMetadata.unitName) parts.push(`单元：${courseMetadata.unitName}`);
    return parts.join('\n') || '（未提供课程信息）';
  };

  // 生成单页图片
  const generateSingleImage = async (
    pageType: 'cover' | 'content' | 'ending',
    contentIndex?: number,
    extraPage?: ExtraPage
  ): Promise<boolean> => {
    // 检查是否应该停止
    if (shouldStopRef.current) return false;

    const prompts = loadPromptConfig();
    let narration = '';
    let description = '';
    let customPrompt = '';

    if (pageType === 'cover' && extraPage) {
      narration = `封面：${extraPage.title}`;
      description = extraPage.subtitle || '';
      // 封面用专门的提示词
      customPrompt = prompts.generateImageCover.replace('{{courseInfo}}', formatCourseInfo());
    } else if (pageType === 'ending' && extraPage) {
      narration = extraPage.title;
      description = extraPage.subtitle || '';
      // 片尾用专门的提示词
      customPrompt = prompts.generateImageEnding;
    } else if (pageType === 'content' && contentIndex !== undefined) {
      const page = pages[contentIndex];
      narration = page.narration;
      description = page.description;
      // 内容页根据是否有模板选择提示词
      if (templateBase64) {
        customPrompt = prompts.generateImage.replace('{{description}}', description || narration);
      } else {
        customPrompt = prompts.generateImageNoTemplate.replace('{{description}}', description || narration);
      }
    }

    try {
      const response = await fetch(`${API_BASE}/api/batch/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narration,
          description,
          page_type: pageType,
          aspect_ratio: '16:9',
          template_base64: templateBase64,
          custom_prompt: customPrompt, // 使用前端提示词
        }),
      });

      // 请求完成后再次检查是否应该停止（不保存结果）
      if (shouldStopRef.current) return false;

      const result = await response.json();

      if (result.success && result.data?.image_base64) {
        const newImage = result.data.image_base64;
        if (pageType === 'cover') {
          setCoverPage(prev => {
            const versions = [...(prev.image_versions || []), newImage];
            return {
              ...prev,
              image_base64: newImage,
              image_versions: versions,
              selected_version: versions.length - 1,
              status: 'completed'
            };
          });
        } else if (pageType === 'ending') {
          setEndingPage(prev => {
            const versions = [...(prev.image_versions || []), newImage];
            return {
              ...prev,
              image_base64: newImage,
              image_versions: versions,
              selected_version: versions.length - 1,
              status: 'completed'
            };
          });
        } else if (contentIndex !== undefined) {
          const currentPage = pages[contentIndex];
          const versions = [...(currentPage.image_versions || []), newImage];
          onUpdatePage(contentIndex, {
            image_base64: newImage,
            image_versions: versions,
            selected_version: versions.length - 1,
            status: 'completed'
          });
        }
        return true;
      } else {
        const errorMsg = result.message || '生成失败';
        if (pageType === 'cover') {
          setCoverPage(prev => ({ ...prev, status: 'error', error_message: errorMsg }));
        } else if (pageType === 'ending') {
          setEndingPage(prev => ({ ...prev, status: 'error', error_message: errorMsg }));
        } else if (contentIndex !== undefined) {
          onUpdatePage(contentIndex, { status: 'error', error_message: errorMsg });
        }
        return false;
      }
    } catch (err: any) {
      if (shouldStopRef.current) return false;
      const errorMsg = err.message;
      if (pageType === 'cover') {
        setCoverPage(prev => ({ ...prev, status: 'error', error_message: errorMsg }));
      } else if (pageType === 'ending') {
        setEndingPage(prev => ({ ...prev, status: 'error', error_message: errorMsg }));
      } else if (contentIndex !== undefined) {
        onUpdatePage(contentIndex, { status: 'error', error_message: errorMsg });
      }
      return false;
    }
  };

  // 重新生成单页描述（基于当前选中的模板）
  const regenerateDescription = async (contentIndex: number): Promise<boolean> => {
    const page = pages[contentIndex];
    const prompts = loadPromptConfig();
    const courseInfo = formatCourseInfo();
    const apiConfig = getApiConfig();

    if (!apiConfig?.text?.apiUrl || !apiConfig?.text?.apiKey) {
      setError('请先在"API设置"中配置API');
      return false;
    }

    // 根据页面类型和是否有模板选择提示词
    let customPrompt = '';
    if (page.pageType === 'cover') {
      customPrompt = prompts.generateDescriptionCover
        .replace('{{courseInfo}}', courseInfo)
        .replace('{{segment}}', page.segment || '片头')
        .replace('{{narration}}', page.narration || '（无讲稿）');
    } else if (page.pageType === 'ending') {
      customPrompt = prompts.generateDescriptionEnding
        .replace('{{courseInfo}}', courseInfo)
        .replace('{{narration}}', page.narration || '（无讲稿）');
    } else {
      // 内容页：根据当前是否有模板选择提示词
      customPrompt = templateBase64
        ? prompts.generateDescriptionWithTemplate
        : prompts.generateDescription;
    }

    try {
      const response = await fetch(`${API_BASE}/api/batch/generate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narration: page.narration || courseInfo,
          visual_hint: page.visual_hint,
          full_context: pages.map((p, i) => `【第${i + 1}页】${p.segment ? `[${p.segment}] ` : ''}${p.narration}`).join('\n\n'),
          current_index: contentIndex + 1,
          custom_prompt: customPrompt,
          template_base64: templateBase64, // 使用当前选中的模板
        }),
      });

      const result = await response.json();

      if (result.success) {
        onUpdatePage(contentIndex, { description: result.data.description, status: 'pending' });
        return true;
      } else {
        onUpdatePage(contentIndex, { status: 'error', error_message: result.message });
        return false;
      }
    } catch (err: any) {
      onUpdatePage(contentIndex, { status: 'error', error_message: err.message });
      return false;
    }
  };

  // 处理重新生成解析
  const handleRegenerateDescription = async () => {
    if (!selectedPage || selectedPage.type !== 'content' || !('index' in selectedPage)) return;

    setIsRegeneratingDesc(true);
    setError(null);
    onUpdatePage(selectedPage.index, { status: 'generating_desc' });

    await regenerateDescription(selectedPage.index);

    setIsRegeneratingDesc(false);
  };

  // 提取插画
  const handleExtractImages = async (croppedImageBase64: string) => {
    setIsExtractingImages(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/batch/extract-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cropped_image_base64: croppedImageBase64 }),
      });

      const result = await response.json();

      if (result.success && result.data?.image) {
        setExtractedImages(prev => [...prev, result.data.image]);
      } else {
        throw new Error(result.message || '提取失败');
      }
    } catch (error: any) {
      setError('提取插画失败：' + error.message);
    } finally {
      setIsExtractingImages(false);
    }
  };

  // 停止生成
  const handleStop = () => {
    shouldStopRef.current = true;
    setIsGenerating(false); // 立即停止显示生成状态
    setGeneratingCount(0);  // 重置计数
    // 把所有 generating 状态的重置为 pending
    if (coverPage.status === 'generating') {
      setCoverPage(prev => ({ ...prev, status: 'pending' }));
    }
    if (endingPage.status === 'generating') {
      setEndingPage(prev => ({ ...prev, status: 'pending' }));
    }
    pages.forEach((page, idx) => {
      if (page.status === 'generating_image') {
        onUpdatePage(idx, { status: 'pending' });
      }
    });
  };

  // 并行批量生成图片
  const handleBatchGenerate = async () => {
    setIsGenerating(true);
    shouldStopRef.current = false;
    setError(null);

    type Task = { type: 'cover' | 'content' | 'ending'; contentIndex?: number };
    const tasks: Task[] = [];

    // 封面页
    if (includeCover && !coverPage.image_base64) {
      tasks.push({ type: 'cover' });
      setCoverPage(prev => ({ ...prev, status: 'generating' }));
    }

    // 内容页
    pages.forEach((page, index) => {
      if (!page.image_base64) {
        tasks.push({ type: 'content', contentIndex: index });
        onUpdatePage(index, { status: 'generating_image' });
      }
    });

    // 结束页
    if (includeEnding && !endingPage.image_base64) {
      tasks.push({ type: 'ending' });
      setEndingPage(prev => ({ ...prev, status: 'generating' }));
    }

    let failedCount = 0;
    const executeTask = async (task: Task) => {
      // 检查停止标记
      if (shouldStopRef.current) return;

      setGeneratingCount(prev => prev + 1);
      let success = false;
      if (task.type === 'cover') {
        success = await generateSingleImage('cover', undefined, coverPage);
      } else if (task.type === 'ending') {
        success = await generateSingleImage('ending', undefined, endingPage);
      } else {
        success = await generateSingleImage('content', task.contentIndex);
      }
      if (!success && !shouldStopRef.current) failedCount++;
      setGeneratingCount(prev => prev - 1);
    };

    // Promise 池控制并发
    const pool: Promise<void>[] = [];
    for (const task of tasks) {
      // 每次启动新任务前检查停止标记
      if (shouldStopRef.current) break;

      const promise = executeTask(task).then(() => {
        pool.splice(pool.indexOf(promise), 1);
      });
      pool.push(promise);

      if (pool.length >= MAX_CONCURRENT) {
        await Promise.race(pool);
      }
    }
    await Promise.all(pool);

    if (failedCount > 0 && !shouldStopRef.current) {
      setError(`${failedCount} 页生成失败`);
    }

    setIsGenerating(false);
    setGeneratingCount(0);
  };

  // 重新生成单页
  const handleRegenerateSingle = async () => {
    if (!selectedPage) return;
    setIsGenerating(true);
    setError(null);
    shouldStopRef.current = false;

    if (selectedPage.type === 'cover') {
      setCoverPage(prev => ({ ...prev, status: 'generating' }));
      await generateSingleImage('cover', undefined, coverPage);
    } else if (selectedPage.type === 'ending') {
      setEndingPage(prev => ({ ...prev, status: 'generating' }));
      await generateSingleImage('ending', undefined, endingPage);
    } else if (selectedPage.type === 'content' && 'index' in selectedPage) {
      onUpdatePage(selectedPage.index, { status: 'generating_image' });
      await generateSingleImage('content', selectedPage.index);
    }

    setIsGenerating(false);
  };

  // 导出 PPT（使用 JSZip 构建完整的 PPTX）
  const handleExportPPT = async () => {
    setIsExporting(true);
    setError(null);

    try {
      // 收集所有有图片的页面
      const imagesToExport: string[] = [];
      for (const page of allPages) {
        let imageBase64: string | undefined;
        if (page.type === 'cover') {
          imageBase64 = coverPage.image_base64;
        } else if (page.type === 'ending') {
          imageBase64 = endingPage.image_base64;
        } else {
          imageBase64 = (page.data as ScriptPage).image_base64;
        }
        if (imageBase64) {
          imagesToExport.push(imageBase64);
        }
      }

      if (imagesToExport.length === 0) {
        setError('没有可导出的图片，请先生成图片');
        return;
      }

      // 创建 PPTX（完整格式）
      const zip = new JSZip();
      const slideCount = imagesToExport.length;

      // [Content_Types].xml
      let contentTypesOverrides = '';
      for (let i = 1; i <= slideCount; i++) {
        contentTypesOverrides += `<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
      }

      zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Default Extension="jpg" ContentType="image/jpeg"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${contentTypesOverrides}
</Types>`);

      // _rels/.rels
      zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);

      // ppt/presentation.xml
      let slideIdList = '';
      for (let i = 1; i <= slideCount; i++) {
        slideIdList += `<p:sldId id="${255 + i}" r:id="rId${i + 1}"/>`;
      }

      zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>${slideIdList}</p:sldIdLst>
<p:sldSz cx="9144000" cy="5143500" type="screen16x9"/>
<p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`);

      // ppt/_rels/presentation.xml.rels
      let slideRels = '';
      for (let i = 1; i <= slideCount; i++) {
        slideRels += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`;
      }

      zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
${slideRels}
</Relationships>`);

      // ppt/slideMasters/slideMaster1.xml
      zip.file('ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`);

      // ppt/slideMasters/_rels/slideMaster1.xml.rels
      zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`);

      // ppt/slideLayouts/slideLayout1.xml
      zip.file('ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
<p:cSld name="Blank"><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`);

      // ppt/slideLayouts/_rels/slideLayout1.xml.rels
      zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);

      // ppt/theme/theme1.xml
      zip.file('ppt/theme/theme1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
<a:themeElements>
<a:clrScheme name="Office">
<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="44546A"/></a:dk2>
<a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
<a:accent1><a:srgbClr val="4472C4"/></a:accent1>
<a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>
<a:accent4><a:srgbClr val="FFC000"/></a:accent4>
<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
<a:accent6><a:srgbClr val="70AD47"/></a:accent6>
<a:hlink><a:srgbClr val="0563C1"/></a:hlink>
<a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
</a:clrScheme>
<a:fontScheme name="Office">
<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
</a:fontScheme>
<a:fmtScheme name="Office">
<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="35000"><a:schemeClr val="phClr"><a:tint val="37000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="15000"/><a:satMod val="350000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="1"/></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:shade val="51000"/><a:satMod val="130000"/></a:schemeClr></a:gs><a:gs pos="80000"><a:schemeClr val="phClr"><a:shade val="93000"/><a:satMod val="130000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="94000"/><a:satMod val="135000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill></a:fillStyleLst>
<a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln></a:lnStyleLst>
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst><a:outerShdw blurRad="57150" dist="19050" dir="5400000" algn="ctr" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="63000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/><a:satMod val="170000"/></a:schemeClr></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="93000"/><a:satMod val="150000"/><a:shade val="98000"/><a:lumMod val="102000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:tint val="98000"/><a:satMod val="130000"/><a:shade val="90000"/><a:lumMod val="103000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="63000"/><a:satMod val="120000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:bgFillStyleLst>
</a:fmtScheme>
</a:themeElements>
<a:objectDefaults/>
<a:extraClrSchemeLst/>
</a:theme>`);

      // 添加每张幻灯片
      for (let i = 0; i < slideCount; i++) {
        const imageBase64 = imagesToExport[i];
        const imageExt = imageBase64.includes('image/png') ? 'png' : 'jpeg';
        const imageData = imageBase64.split(',')[1];

        // ppt/media/imageX
        zip.file(`ppt/media/image${i + 1}.${imageExt}`, imageData, { base64: true });

        // ppt/slides/slideX.xml
        zip.file(`ppt/slides/slide${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:pic>
<p:nvPicPr><p:cNvPr id="2" name="Picture ${i + 1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="5143500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
</p:pic>
</p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`);

        // ppt/slides/_rels/slideX.xml.rels
        zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i + 1}.${imageExt}"/>
</Relationships>`);
      }

      // 生成并下载
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PPT_${new Date().toISOString().slice(0, 10)}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err: any) {
      setError('导出PPT失败: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // 获取当前页面信息
  const getCurrentImage = () => {
    if (!selectedPage) return null;
    if (selectedPage.type === 'cover') return coverPage.image_base64;
    if (selectedPage.type === 'ending') return endingPage.image_base64;
    return (selectedPage.data as ScriptPage).image_base64;
  };

  const getCurrentStatus = () => {
    if (!selectedPage) return 'pending';
    if (selectedPage.type === 'cover') return coverPage.status;
    if (selectedPage.type === 'ending') return endingPage.status;
    return (selectedPage.data as ScriptPage).status;
  };

  // 获取当前页面的所有版本
  const getCurrentVersions = () => {
    if (!selectedPage) return [];
    if (selectedPage.type === 'cover') return coverPage.image_versions || [];
    if (selectedPage.type === 'ending') return endingPage.image_versions || [];
    return (selectedPage.data as ScriptPage).image_versions || [];
  };

  // 获取当前选中的版本索引
  const getCurrentSelectedVersion = () => {
    if (!selectedPage) return 0;
    if (selectedPage.type === 'cover') return coverPage.selected_version ?? 0;
    if (selectedPage.type === 'ending') return endingPage.selected_version ?? 0;
    return (selectedPage.data as ScriptPage).selected_version ?? 0;
  };

  // 切换版本
  const handleVersionChange = (versionIndex: number) => {
    if (!selectedPage) return;
    const versions = getCurrentVersions();
    if (versionIndex < 0 || versionIndex >= versions.length) return;

    const newImage = versions[versionIndex];

    if (selectedPage.type === 'cover') {
      setCoverPage(prev => ({
        ...prev,
        image_base64: newImage,
        selected_version: versionIndex
      }));
    } else if (selectedPage.type === 'ending') {
      setEndingPage(prev => ({
        ...prev,
        image_base64: newImage,
        selected_version: versionIndex
      }));
    } else if ('index' in selectedPage) {
      onUpdatePage(selectedPage.index, {
        image_base64: newImage,
        selected_version: versionIndex
      });
    }
  };

  const getCurrentNarration = () => {
    if (!selectedPage) return '';
    if (selectedPage.type === 'cover') return `标题：${coverPage.title}\n副标题：${coverPage.subtitle || '无'}`;
    if (selectedPage.type === 'ending') return `${endingPage.title}\n${endingPage.subtitle || ''}`;
    return (selectedPage.data as ScriptPage).narration || '';
  };

  const currentImage = getCurrentImage();
  const currentStatus = getCurrentStatus();

  return (
    <div className="flex gap-4 h-[calc(100vh-160px)]">
      {/* 左栏：Slides 列表 */}
      <div className="w-48 flex-shrink-0 bg-gray-100 dark:bg-gray-900 rounded-xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {allPages.map((page, idx) => {
            const isSelected = selectedIndex === idx;
            const isCover = page.type === 'cover';
            const isEnding = page.type === 'ending';
            const hasImage = isCover
              ? coverPage.image_base64
              : isEnding
              ? endingPage.image_base64
              : (page.data as ScriptPage).image_base64;
            const status = isCover
              ? coverPage.status
              : isEnding
              ? endingPage.status
              : (page.data as ScriptPage).status;

            return (
              <button
                key={isCover ? 'cover' : isEnding ? 'ending' : (page.data as ScriptPage).id}
                onClick={() => setSelectedIndex(idx)}
                className={`w-full transition-all ${
                  isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:ring-2 hover:ring-gray-300'
                }`}
              >
                <div className="relative">
                  {/* 序号 */}
                  <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 -translate-x-full text-[10px] text-gray-400 w-4 text-right">
                    {idx + 1}
                  </div>
                  {/* 缩略图 */}
                  <div className="aspect-video rounded-md overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                    {hasImage ? (
                      <img src={hasImage} alt="" className="w-full h-full object-cover" />
                    ) : status === 'generating_image' || status === 'generating' ? (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 text-gray-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[9px] mt-0.5">
                          {isCover ? '封面' : isEnding ? '结束' : '待生成'}
                        </span>
                      </div>
                    )}
                    {/* 状态角标 */}
                    {hasImage && (
                      <div className="absolute bottom-1 right-1 bg-emerald-500 text-white rounded-full p-0.5">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {/* 特殊页面标记 */}
                    {(isCover || isEnding) && (
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-amber-500 text-white text-[8px] rounded font-medium">
                        {isCover ? '封面' : '结束'}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {/* 底部统计 */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-800 text-center">
          <span className="text-xs text-gray-500">{totalCompleted}/{totalPages}</span>
        </div>
      </div>

      {/* 中栏：预览区 + 讲稿 */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* 预览图 */}
        <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 flex flex-col overflow-hidden">
          <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl flex items-center justify-center overflow-hidden">
            {currentImage ? (
              <img
                src={currentImage}
                alt={`第 ${selectedIndex + 1} 页`}
                className="max-w-full max-h-full object-contain"
              />
            ) : currentStatus === 'generating_image' || currentStatus === 'generating' ? (
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500">图片生成中...</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">尚未生成图片</p>
                <button
                  onClick={handleRegenerateSingle}
                  disabled={isGenerating}
                  className="px-6 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-medium transition-colors disabled:cursor-not-allowed"
                >
                  生成此页
                </button>
              </div>
            )}
          </div>

          {/* 版本切换 - 当有多个版本时显示 */}
          {getCurrentVersions().length > 1 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  历史版本 ({getCurrentSelectedVersion() + 1}/{getCurrentVersions().length})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleVersionChange(getCurrentSelectedVersion() - 1)}
                    disabled={getCurrentSelectedVersion() === 0}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleVersionChange(getCurrentSelectedVersion() + 1)}
                    disabled={getCurrentSelectedVersion() === getCurrentVersions().length - 1}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {getCurrentVersions().map((version, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleVersionChange(idx)}
                    className={`flex-shrink-0 w-16 aspect-video rounded-md overflow-hidden border-2 transition-all ${
                      idx === getCurrentSelectedVersion()
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                    }`}
                  >
                    <img src={version} alt={`版本 ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 翻页和操作 */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                disabled={selectedIndex === 0}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 disabled:opacity-30 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400 min-w-[60px] text-center">
                {selectedIndex + 1} / {allPages.length}
              </span>
              <button
                onClick={() => setSelectedIndex(Math.min(allPages.length - 1, selectedIndex + 1))}
                disabled={selectedIndex === allPages.length - 1}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 disabled:opacity-30 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* 内容页显示重新生成解析按钮 */}
              {selectedPage?.type === 'content' && (
                <button
                  onClick={handleRegenerateDescription}
                  disabled={isGenerating || isRegeneratingDesc}
                  className="px-3 py-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
                  title="基于当前模板重新生成画面描述"
                >
                  {isRegeneratingDesc ? (
                    <>
                      <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      重新解析
                    </>
                  )}
                </button>
              )}
              {currentImage && (
                <>
                  <button
                    onClick={handleRegenerateSingle}
                    disabled={isGenerating || isRegeneratingDesc}
                    className="px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs transition-colors disabled:opacity-50"
                  >
                    重新生成
                  </button>
                  <a
                    href={currentImage}
                    download={`第${selectedIndex + 1}页.png`}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs transition-colors"
                  >
                    下载图片
                  </a>
                  <button
                    onClick={() => setShowCropper(true)}
                    disabled={isExtractingImages}
                    className="px-3 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-800/30 text-purple-700 dark:text-purple-300 text-xs transition-colors disabled:opacity-50"
                  >
                    {isExtractingImages ? '提取中...' : '裁剪提取插画'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 讲稿内容 */}
        <div className="h-36 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 overflow-y-auto flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {selectedPage?.type === 'cover' ? '封面信息' : selectedPage?.type === 'ending' ? '结束页信息' : '讲稿内容'}
            </span>
            {selectedPage?.type === 'content' && (selectedPage.data as ScriptPage).segment && (
              <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px]">
                {(selectedPage.data as ScriptPage).segment}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {getCurrentNarration() || '无内容'}
          </p>
          {selectedPage?.type === 'content' && (selectedPage.data as ScriptPage).description && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">AI 图片描述</span>
                {templateBase64 && (
                  <span className="text-[10px] text-gray-400">
                    切换模板后可点击"重新解析"
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-3">
                {(selectedPage.data as ScriptPage).description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 右栏：控制面板 */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        {/* 批量生成 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">批量生成</h3>
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleBatchGenerate}
              disabled={isGenerating || pendingCount === 0}
              className="flex-1 px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  生成中 ({generatingCount})
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  生成全部 ({pendingCount})
                </>
              )}
            </button>
            {isGenerating && (
              <button
                onClick={handleStop}
                className="px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors flex items-center justify-center"
                title="停止生成"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h12v12H6z" />
                </svg>
              </button>
            )}
          </div>

        </div>

        {/* 风格模板 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">风格模板</h3>
            {templateBase64 && (
              <button
                onClick={handleClearTemplate}
                className="text-xs text-red-500 hover:text-red-600"
              >
                清除
              </button>
            )}
          </div>

          {/* 当前使用的模板预览（用户上传的模板） */}
          {templateBase64 && !selectedTemplate && (
            <div className="mb-3">
              <span className="text-[10px] text-gray-400 mb-1 block">当前模板</span>
              <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-blue-500 ring-2 ring-blue-200">
                <img src={templateBase64} alt="当前模板" className="w-full h-full object-cover" />
                <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-0.5">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {templates.length > 0 && (
            <span className="text-[10px] text-gray-400 mb-1 block">预设模板</span>
          )}
          {templates.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                    selectedTemplate === template.id
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                  }`}
                >
                  <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover" />
                  {selectedTemplate === template.id && (
                    <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-0.5">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">暂无模板</p>
          )}
          {!templateBase64 && templates.length > 0 && (
            <p className="text-xs text-gray-400 mt-2 text-center">不选模板则 AI 自主设计</p>
          )}
        </div>

        {/* 导出 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">导出</h3>
          <button
            onClick={handleExportPPT}
            disabled={isExporting || totalCompleted === 0}
            className="w-full px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                导出 PPTX
              </>
            )}
          </button>
          {totalCompleted === 0 && (
            <p className="text-xs text-gray-400 mt-2 text-center">请先生成图片</p>
          )}
        </div>

        {/* 已提取的插画 */}
        {extractedImages.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                已提取插画 ({extractedImages.length})
              </h3>
              <button
                onClick={() => setExtractedImages([])}
                className="text-xs text-red-500 hover:text-red-600"
              >
                清空
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {extractedImages.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={img}
                    alt={`插画 ${idx + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                  />
                  <a
                    href={img}
                    download={`插画_${idx + 1}.png`}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* 返回按钮 */}
        <button
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回编辑
        </button>
      </div>

      {/* 裁剪器弹窗 */}
      {showCropper && currentImage && (
        <ImageCropper
          imageUrl={currentImage}
          onCropComplete={(croppedImageBase64) => {
            setShowCropper(false);
            handleExtractImages(croppedImageBase64);
          }}
          onCancel={() => setShowCropper(false)}
        />
      )}
    </div>
  );
}
