'use client';

import { ScriptPage, BatchTask } from './types';
import PagePreviewList from './PagePreviewList';

interface BatchProgressProps {
  task: BatchTask | null;
  pages: ScriptPage[];
  isGenerating: boolean;
}

export default function BatchProgress({ task, pages, isGenerating }: BatchProgressProps) {
  const progress = task?.progress || 0;
  const phase = task?.current_phase || '准备中...';
  const status = task?.status || 'pending';

  const completedCount = pages.filter(p => p.status === 'completed').length;
  const errorCount = pages.filter(p => p.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* 进度卡片 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            生成进度
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {completedCount}/{pages.length} 完成
            {errorCount > 0 && <span className="text-red-500 ml-1">({errorCount} 失败)</span>}
          </span>
        </div>

        {/* 进度条 */}
        <div className="relative h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-4">
          <div
            className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
          {isGenerating && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          )}
        </div>

        {/* 状态 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isGenerating && (
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            <span className="text-sm text-gray-600 dark:text-gray-400">{phase}</span>
          </div>
          <StatusTag status={status} />
        </div>
      </div>

      {/* 页面列表 */}
      <PagePreviewList pages={pages} />

      {/* 完成后的操作 */}
      {status === 'completed' && (
        <div className="flex justify-center gap-3">
          <button
            className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
            onClick={() => window.location.reload()}
          >
            新建任务
          </button>
          <button
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled
          >
            导出 PPTX (开发中)
          </button>
        </div>
      )}
    </div>
  );
}

function StatusTag({ status }: { status: BatchTask['status'] }) {
  const statusConfig = {
    pending: { text: '等待中', color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' },
    parsing: { text: '解析中', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
    generating_descriptions: { text: '生成描述', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
    generating_images: { text: '生成图片', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
    completed: { text: '已完成', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
    error: { text: '失败', color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
    cancelled: { text: '已取消', color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.text}
    </span>
  );
}
