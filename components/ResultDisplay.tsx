'use client';

import { useState } from 'react';
import { GenerationResult } from '@/types';
import ImageCropper from './ImageCropper';

interface ResultDisplayProps {
  result: GenerationResult;
  onDownload: (type: 'preview' | 'ppt' | 'all') => void;
  onExtractImages?: (croppedImageBase64: string) => void;
  isExtractingImages?: boolean;
}

export default function ResultDisplay({ result, onDownload, onExtractImages, isExtractingImages }: ResultDisplayProps) {
  const [showCropper, setShowCropper] = useState(false);

  if (result.status !== 'completed') {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {/* 参考预览图 */}
        {result.previewImage && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                设计参考图
              </h4>
              <button
                onClick={() => onDownload('preview')}
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                下载
              </button>
            </div>
            <div className="rounded-lg overflow-hidden">
              <img
                src={result.previewImage}
                alt="参考预览图"
                className="w-full h-auto"
              />
            </div>
          </div>
        )}

        {/* 可编辑 PPT */}
        {result.pptFile && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                可编辑 PPT
              </h4>
              <button
                onClick={() => onDownload('ppt')}
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                下载
              </button>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-orange-500 rounded-lg flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                    <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  {result.design.title}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  PowerPoint 文件 (.pptx)
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  可直接编辑，文字不乱码
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              在 PowerPoint/WPS 中打开即可编辑
            </p>
          </div>
        )}
      </div>

      {/* 裁剪提取按钮 */}
      {onExtractImages && (
        <div className="pt-3">
          <button
            onClick={() => setShowCropper(true)}
            disabled={isExtractingImages}
            className="w-full py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm"
          >
            {isExtractingImages ? '提取中...' : '裁剪提取插画'}
          </button>
        </div>
      )}

      {/* 裁剪器弹窗 */}
      {showCropper && result.previewImage && onExtractImages && (
        <ImageCropper
          imageUrl={result.previewImage}
          onCropComplete={(croppedImageBase64) => {
            setShowCropper(false);
            onExtractImages(croppedImageBase64);
          }}
          onCancel={() => setShowCropper(false)}
        />
      )}
    </div>
  );
}
