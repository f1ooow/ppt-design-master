'use client';

import { useState, useEffect } from 'react';
import { PromptConfig } from '@/types';
import { loadPromptConfig, savePromptConfig, resetPromptConfig, DEFAULT_PROMPTS } from '@/config/prompts';

interface PromptSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PromptSettings({ isOpen, onClose }: PromptSettingsProps) {
  const [prompts, setPrompts] = useState<PromptConfig>(DEFAULT_PROMPTS);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const loaded = loadPromptConfig();
      setPrompts(loaded);
      setHasChanges(false);
    }
  }, [isOpen]);

  const handleChange = (key: keyof PromptConfig, value: string) => {
    setPrompts((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    savePromptConfig(prompts);
    setHasChanges(false);
    alert('提示词已保存');
  };

  const handleReset = () => {
    if (confirm('确定要重置为默认提示词吗？')) {
      resetPromptConfig();
      setPrompts(DEFAULT_PROMPTS);
      setHasChanges(false);
      alert('已重置为默认提示词');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              提示词设置
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

          <div className="space-y-6">
            {/* 生成参考图提示词（有模板） */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  生成参考图提示词（有模板）
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  可用变量: {'{'}{'{'} script {'}'}{'}'}
                </span>
              </div>
              <textarea
                value={prompts.generatePreview}
                onChange={(e) => handleChange('generatePreview', e.target.value)}
                className="w-full h-48 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none font-mono text-sm"
                placeholder="输入生成参考图的提示词..."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                此提示词用于有模板图片时生成参考图。会同时发送模板图片给 AI。
              </p>
            </div>

            {/* 生成参考图提示词（无模板） */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  生成参考图提示词（无模板）
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  可用变量: {'{'}{'{'} script {'}'}{'}'}
                </span>
              </div>
              <textarea
                value={prompts.generatePreviewNoTemplate}
                onChange={(e) => handleChange('generatePreviewNoTemplate', e.target.value)}
                className="w-full h-48 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none font-mono text-sm"
                placeholder="输入无模板时生成参考图的提示词..."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                此提示词用于没有上传模板图片时生成参考图。AI 会自主选择设计风格。
              </p>
            </div>

            {/* 提取插画提示词 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  提取插画提示词
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  无可用变量（直接处理裁剪后的图片）
                </span>
              </div>
              <textarea
                value={prompts.extractImage}
                onChange={(e) => handleChange('extractImage', e.target.value)}
                className="w-full h-40 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none font-mono text-sm"
                placeholder="输入提取插画的提示词..."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                此提示词用于根据用户裁剪的区域重新生成独立的插画。
              </p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleReset}
              className="px-6 py-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              重置为默认
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
