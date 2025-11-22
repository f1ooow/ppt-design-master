'use client';

import { useState, useRef, useEffect } from 'react';
import { loadTemplates, TemplateItem } from '@/config/templates';

interface TemplateUploadProps {
  onImageChange: (imageBase64: string | null) => void;
  className?: string;
}

export default function TemplateUpload({ onImageChange, className = '' }: TemplateUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [isLoadingPreset, setIsLoadingPreset] = useState(false);
  const [presetTemplates, setPresetTemplates] = useState<TemplateItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载预设模板列表
  useEffect(() => {
    loadTemplates().then(setPresetTemplates);
  }, []);

  // 处理图片文件
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件（支持 PNG, JPG, JPEG 等格式）');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPreview(base64);
      setSelectedPresetId(null); // 清除预设选择
      onImageChange(base64);
    };
    reader.readAsDataURL(file);
  };

  // 选择预设模板
  const handleSelectPreset = async (template: TemplateItem) => {
    setIsLoadingPreset(true);
    try {
      // 从 public 目录加载图片并转换为 base64
      const response = await fetch(template.fullImage);
      const blob = await response.blob();
      const reader = new FileReader();

      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setPreview(base64);
        setSelectedPresetId(template.id);
        onImageChange(base64);
        setIsLoadingPreset(false);
      };

      reader.onerror = () => {
        alert('加载模板失败，请重试');
        setIsLoadingPreset(false);
      };

      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Failed to load preset template:', error);
      alert('加载模板失败，请重试');
      setIsLoadingPreset(false);
    }
  };

  // 文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  // 拖拽上传
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageFile(file);
    }
  };

  // 清除图片
  const handleClear = () => {
    setPreview(null);
    setSelectedPresetId(null);
    onImageChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 点击上传
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const hasPresets = presetTemplates.length > 0;

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        选择 PPT 模板（可选）
      </label>

      {/* 预设模板库 */}
      {hasPresets && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">预设模板：</p>
          <div className="grid grid-cols-3 gap-2">
            {presetTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelectPreset(template)}
                disabled={isLoadingPreset}
                className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                  selectedPresetId === template.id
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                } ${isLoadingPreset ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
              >
                <img
                  src={template.thumbnail}
                  alt={template.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs px-2 py-1 truncate">
                  {template.name}
                </div>
                {selectedPresetId === template.id && (
                  <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-0.5">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 分隔线 */}
      {hasPresets && (
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              或自定义上传
            </span>
          </div>
        </div>
      )}

      {/* 自定义上传区域 */}
      <div
        ref={containerRef}
        tabIndex={0}
        className={`relative rounded-lg transition-all ${
          isDragging
            ? 'border-2 border-dashed border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : preview
            ? 'border border-solid border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
            : 'border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
        } ${!preview ? 'cursor-pointer hover:border-blue-500' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!preview ? handleClick : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {preview ? (
          // 预览模式 - 16:9 裁切显示
          <div className="relative aspect-video">
            <img
              src={preview}
              alt="模板预览"
              className="w-full h-full object-cover rounded-lg"
            />
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
                className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
              >
                更换
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
              >
                删除
              </button>
            </div>
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
              {selectedPresetId ? '预设模板' : '自定义模板'}
            </div>
          </div>
        ) : (
          // 上传提示
          <div className="p-6 text-center">
            <div className="mb-3">
              <svg
                className="mx-auto h-10 w-10 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="text-gray-600 dark:text-gray-400 space-y-1">
              <p className="text-sm font-medium">
                点击上传或拖拽上传
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                支持 PNG、JPG、JPEG 等格式
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 无模板提示 */}
      {!preview && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          不选择模板也可以生成，AI 会自主设计风格
        </p>
      )}
    </div>
  );
}
