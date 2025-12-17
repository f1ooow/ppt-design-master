'use client';

import { ScriptPage } from './types';
import { CourseMetadata } from '@/types';

interface DescriptionEditorProps {
  pages: ScriptPage[];
  courseMetadata?: CourseMetadata;
  onUpdatePage: (index: number, updates: Partial<ScriptPage>) => void;
  onRegenerateDesc: (index: number) => void;
  onBatchGenerateDesc: () => void;
  onNext: () => void;
  onBack: () => void;
  isGenerating: boolean;
}

export default function DescriptionEditor({
  pages,
  courseMetadata,
  onUpdatePage,
  onRegenerateDesc,
  onBatchGenerateDesc,
  onNext,
  onBack,
  isGenerating,
}: DescriptionEditorProps) {
  const completedCount = pages.filter(p => p.description).length;
  const allCompleted = completedCount === pages.length;

  // 检查是否有课程信息
  const hasCourseInfo = courseMetadata && Object.values(courseMetadata).some(v => v);

  return (
    <div className="space-y-6">
      {/* 课程信息卡片 */}
      {hasCourseInfo && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                识别到的课程信息
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                {courseMetadata?.courseName && (
                  <div><span className="text-gray-500 dark:text-gray-400">课程：</span><span className="text-gray-700 dark:text-gray-300">{courseMetadata.courseName}</span></div>
                )}
                {courseMetadata?.textbookName && (
                  <div><span className="text-gray-500 dark:text-gray-400">教材：</span><span className="text-gray-700 dark:text-gray-300">{courseMetadata.textbookName}</span></div>
                )}
                {courseMetadata?.chapterName && (
                  <div><span className="text-gray-500 dark:text-gray-400">章节：</span><span className="text-gray-700 dark:text-gray-300">{courseMetadata.chapterName}</span></div>
                )}
                {courseMetadata?.unitName && (
                  <div><span className="text-gray-500 dark:text-gray-400">单元：</span><span className="text-gray-700 dark:text-gray-300">{courseMetadata.unitName}</span></div>
                )}
                {courseMetadata?.school && (
                  <div><span className="text-gray-500 dark:text-gray-400">院校：</span><span className="text-gray-700 dark:text-gray-300">{courseMetadata.school}</span></div>
                )}
                {courseMetadata?.major && (
                  <div><span className="text-gray-500 dark:text-gray-400">专业：</span><span className="text-gray-700 dark:text-gray-300">{courseMetadata.major}</span></div>
                )}
                {courseMetadata?.teacher && (
                  <div><span className="text-gray-500 dark:text-gray-400">教师：</span><span className="text-gray-700 dark:text-gray-300">{courseMetadata.teacher}</span></div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 顶部操作栏 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBatchGenerateDesc}
              disabled={isGenerating || allCompleted}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  批量生成描述
                </>
              )}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {completedCount} / {pages.length} 页已完成
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
            >
              上一步
            </button>
            <button
              onClick={onNext}
              disabled={!allCompleted}
              className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
            >
              下一步
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 页面卡片列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pages.map((page, index) => (
          <PageCard
            key={page.id}
            page={page}
            index={index}
            onUpdate={(updates) => onUpdatePage(index, updates)}
            onRegenerate={() => onRegenerateDesc(index)}
            isGenerating={isGenerating && page.status === 'generating_desc'}
          />
        ))}
      </div>
    </div>
  );
}

interface PageCardProps {
  page: ScriptPage;
  index: number;
  onUpdate: (updates: Partial<ScriptPage>) => void;
  onRegenerate: () => void;
  isGenerating: boolean;
}

// 页面类型标签配置
const pageTypeLabels: Record<string, { label: string; color: string }> = {
  cover: { label: '封面', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
  ending: { label: '片尾', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' },
  content: { label: '正文', color: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' },
};

function PageCard({ page, index, onUpdate, onRegenerate, isGenerating }: PageCardProps) {
  const hasDescription = !!page.description;
  const pageType = page.pageType || 'content';
  const typeConfig = pageTypeLabels[pageType] || pageTypeLabels.content;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium text-gray-900 dark:text-white">
            第 {page.shot_number || index + 1} 页
          </h3>
          {/* 页面类型标签 */}
          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${typeConfig.color}`}>
            {typeConfig.label}
          </span>
        </div>
        {hasDescription && (
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
            已生成描述
          </span>
        )}
      </div>

      {/* 页面内容 */}
      <div className="space-y-3">
        {page.segment && (
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">环节</label>
            <p className="text-sm text-gray-700 dark:text-gray-300">{page.segment}</p>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">讲稿内容</label>
          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">{page.narration}</p>
        </div>

        {page.description && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
            <label className="text-xs text-amber-600 dark:text-amber-400 font-medium">页面描述</label>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{page.description}</p>
          </div>
        )}

        {page.error_message && (
          <p className="text-xs text-red-500">{page.error_message}</p>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={onRegenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          重新生成
        </button>
      </div>
    </div>
  );
}
