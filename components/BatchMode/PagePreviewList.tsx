'use client';

import { ScriptPage } from './types';

interface PagePreviewListProps {
  pages: ScriptPage[];
  onDelete?: (index: number) => void;
}

export default function PagePreviewList({ pages, onDelete }: PagePreviewListProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          页面预览
        </h2>
        <span className="text-xs text-gray-400">
          共 {pages.length} 页
        </span>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {pages.map((page, index) => (
          <div
            key={page.id || index}
            className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* 序号 */}
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-900 dark:bg-white flex items-center justify-center">
                <span className="text-white dark:text-gray-900 text-sm font-medium">
                  {page.shot_number || index + 1}
                </span>
              </div>

              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {page.segment && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs">
                      {page.segment}
                    </span>
                  )}
                  <StatusBadge status={page.status} />
                </div>

                <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-2">
                  {page.narration}
                </p>

                {page.description && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
                    <p className="text-emerald-600 dark:text-emerald-400 text-xs line-clamp-2">
                      {page.description}
                    </p>
                  </div>
                )}

                {page.error_message && (
                  <p className="mt-2 text-red-500 text-xs">
                    {page.error_message}
                  </p>
                )}
              </div>

              {/* 删除按钮 */}
              {onDelete && page.status === 'pending' && (
                <button
                  onClick={() => onDelete(index)}
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ScriptPage['status'] }) {
  const statusConfig = {
    pending: { text: '等待', color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' },
    generating_desc: { text: '生成描述', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
    generating_image: { text: '生成图片', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
    completed: { text: '完成', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
    error: { text: '失败', color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${config.color}`}>
      {config.text}
    </span>
  );
}
