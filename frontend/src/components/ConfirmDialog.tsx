import { useConfirmStore } from '../store/confirmStore';

export const ConfirmDialog = () => {
  const { isOpen, isExiting, message, handleConfirm, handleCancel } = useConfirmStore();

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isExiting ? 'animate-fade-out' : ''}`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div className={`relative bg-bg-card border border-border-color rounded-lg shadow-xl max-w-md w-full p-6 ${
        isExiting ? 'animate-fade-out' : 'animate-slide-in'
      }`}>
        <div className="flex items-start gap-4">
          {/* Warning Icon */}
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-warning-bg flex items-center justify-center">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-warning"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Подтверждение действия
            </h3>
            <p className="text-sm sm:text-base text-text-secondary whitespace-pre-wrap">
              {message}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-6">
          <button
            onClick={handleCancel}
            className="btn-secondary w-full sm:flex-1"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors w-full sm:flex-1"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
};
