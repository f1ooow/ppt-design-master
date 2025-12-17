'use client';

import { useState, useEffect } from 'react';
import { PromptConfig } from '@/types';
import { loadPromptConfig, savePromptConfig, resetPromptConfig, DEFAULT_PROMPTS, PROMPT_METADATA, PromptMeta } from '@/config/prompts';

interface PromptSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabCategory = 'analysis' | 'description' | 'image' | 'utility';

const TABS: { id: TabCategory; label: string; icon: string }[] = [
  { id: 'analysis', label: '脚本分析', icon: '📊' },
  { id: 'description', label: '描述生成', icon: '📝' },
  { id: 'image', label: '图片生成', icon: '🖼️' },
  { id: 'utility', label: '工具', icon: '🔧' },
];

export default function PromptSettings({ isOpen, onClose }: PromptSettingsProps) {
  const [prompts, setPrompts] = useState<PromptConfig>(DEFAULT_PROMPTS);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<TabCategory>('analysis');

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
    if (confirm('确定要重置为默认提示词吗？这将重置所有提示词。')) {
      resetPromptConfig();
      setPrompts(DEFAULT_PROMPTS);
      setHasChanges(false);
      alert('已重置为默认提示词');
    }
  };

  const handleResetSingle = (key: keyof PromptConfig) => {
    if (confirm('确定要重置这个提示词吗？')) {
      setPrompts((prev) => ({ ...prev, [key]: DEFAULT_PROMPTS[key] }));
      setHasChanges(true);
    }
  };

  // 获取当前 Tab 下的提示词
  const currentPrompts = PROMPT_METADATA.filter((p) => p.category === activeTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
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
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            自定义 AI 提示词以优化生成效果。修改后需要点击"保存设置"才会生效。
          </p>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          {TABS.map((tab) => {
            const count = PROMPT_METADATA.filter((p) => p.category === tab.id).length;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                  activeTab === tab.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-8">
            {currentPrompts.map((meta) => (
              <PromptEditor
                key={meta.key}
                meta={meta}
                value={prompts[meta.key]}
                defaultValue={DEFAULT_PROMPTS[meta.key]}
                onChange={(value) => handleChange(meta.key, value)}
                onReset={() => handleResetSingle(meta.key)}
              />
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={handleReset}
            className="px-6 py-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            重置全部提示词
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
  );
}

// 单个提示词编辑器组件
interface PromptEditorProps {
  meta: PromptMeta;
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  onReset: () => void;
}

function PromptEditor({ meta, value, defaultValue, onChange, onReset }: PromptEditorProps) {
  const isModified = value !== defaultValue;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* 提示词头部 */}
      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {meta.label}
            </h3>
            {isModified && (
              <span className="px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                已修改
              </span>
            )}
          </div>
          {isModified && (
            <button
              onClick={onReset}
              className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
            >
              重置此项
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {meta.description}
        </p>
        {meta.variables.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">可用变量:</span>
            {meta.variables.map((v) => (
              <code
                key={v}
                className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-mono"
              >
                {v}
              </code>
            ))}
          </div>
        )}
      </div>

      {/* 提示词编辑区 */}
      <div className="p-4">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-48 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none font-mono text-sm"
          placeholder="输入提示词..."
        />
      </div>
    </div>
  );
}
