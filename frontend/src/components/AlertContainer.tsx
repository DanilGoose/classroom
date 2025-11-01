import { useAlertStore } from '../store/alertStore';

export const AlertContainer = () => {
  const { alerts, removeAlert } = useAlertStore();

  const getAlertStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-900/90 border-green-700 text-green-100';
      case 'error':
        return 'bg-red-900/90 border-red-700 text-red-100';
      case 'warning':
        return 'bg-yellow-900/90 border-warning-border text-yellow-100';
      case 'info':
      default:
        return 'bg-blue-900/90 border-blue-700 text-blue-100';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`${getAlertStyles(alert.type)} border-2 rounded-lg shadow-lg ${
            alert.isExiting ? 'animate-slide-out' : 'animate-slide-in'
          } flex flex-col overflow-hidden relative`}
        >
          {/* Progress bar */}
          {!alert.isExiting && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/20">
              <div
                className="h-full bg-white/60"
                style={{
                  animation: 'progress 5s linear forwards',
                }}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex items-start gap-3 p-4 pt-5">
            <div className="flex-shrink-0 mt-0.5">
              {getIcon(alert.type)}
            </div>
            <p className="flex-1 text-sm">{alert.message}</p>
            <button
              onClick={() => removeAlert(alert.id)}
              className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
