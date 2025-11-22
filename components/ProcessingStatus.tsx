'use client';

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
}

interface ProcessingStatusProps {
  steps: Step[];
  currentStep?: string;
}

export default function ProcessingStatus({ steps, currentStep }: ProcessingStatusProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        处理进度
      </h3>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-3">
            {/* 状态图标 */}
            <div className="flex-shrink-0 mt-0.5">
              {step.status === 'completed' && (
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
              {step.status === 'processing' && (
                <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
              )}
              {step.status === 'error' && (
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
              {step.status === 'pending' && (
                <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600"></div>
              )}
            </div>

            {/* 步骤信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className={`text-sm font-medium ${
                    step.status === 'completed'
                      ? 'text-green-600 dark:text-green-400'
                      : step.status === 'processing'
                      ? 'text-blue-600 dark:text-blue-400'
                      : step.status === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {step.label}
                </p>
                {step.status === 'processing' && (
                  <span className="text-xs text-blue-500 dark:text-blue-400 animate-pulse">
                    进行中...
                  </span>
                )}
              </div>
              {step.message && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {step.message}
                </p>
              )}
            </div>

            {/* 连接线 */}
            {index < steps.length - 1 && (
              <div
                className={`absolute left-[11px] top-8 w-0.5 h-8 ${
                  step.status === 'completed'
                    ? 'bg-green-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
                style={{ marginLeft: '0.75rem' }}
              ></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
