'use client';

import { useCallback } from 'react';

interface ScriptUploaderProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
}

export default function ScriptUploader({ onUpload, isUploading }: ScriptUploaderProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        onUpload(file);
      }
    },
    [onUpload]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        上传脚本文件
      </label>
      <div
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-all
          ${isUploading
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }
        `}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600 dark:text-gray-400">正在解析文件...</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <svg
                className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>

            <label className="inline-block cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.txt,.md,.json"
                onChange={handleChange}
                className="hidden"
              />
              <span className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors inline-block">
                选择文件
              </span>
            </label>

            <p className="text-gray-400 dark:text-gray-500 text-xs mt-4">
              或将文件拖拽到此处
            </p>
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        支持 Excel、文本或 JSON 格式
      </p>
    </div>
  );
}
