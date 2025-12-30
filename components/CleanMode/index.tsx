'use client';

import { useState } from 'react';
import FileUploader from './FileUploader';
import PagePreview from './PagePreview';
import type { CleanModeProps, SlideImage } from './types';

export default function CleanMode({ onBack }: CleanModeProps) {
  const [images, setImages] = useState<SlideImage[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  const handleImagesExtracted = (extractedImages: SlideImage[]) => {
    setImages(extractedImages);
    setStep('preview');
  };

  const handleBack = () => {
    if (step === 'preview') {
      setStep('upload');
      setImages([]);
    } else {
      onBack();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* 头部 */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={onBack}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                素材清洗
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                上传 PPT/PDF，AI 自动去除文字和模板，只保留插图素材
              </p>
            </div>
          </div>

          {/* 步骤指示器 */}
          <div className="flex items-center gap-4 mt-6">
            <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
              }`}>
                1
              </div>
              <span className="text-sm font-medium">上传文件</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-700" />
            <div className={`flex items-center gap-2 ${step === 'preview' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
              }`}>
                2
              </div>
              <span className="text-sm font-medium">清洗素材</span>
            </div>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
          {step === 'upload' ? (
            <FileUploader onImagesExtracted={handleImagesExtracted} />
          ) : (
            <PagePreview
              images={images}
              onImagesUpdate={setImages}
              onBack={handleBack}
            />
          )}
        </div>
      </div>
    </div>
  );
}
