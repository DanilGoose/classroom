import { useNavigate } from 'react-router-dom';

interface AccessDeniedProps {
  message?: string;
  type?: 'not_found' | 'access_denied';
}

export const AccessDenied = ({
  message = 'Страница не доступна',
  type = 'access_denied'
}: AccessDeniedProps) => {
  const navigate = useNavigate();

  const getDefaultMessage = () => {
    if (type === 'not_found') {
      return {
        title: 'Страница не найдена',
        description: message || 'Запрашиваемый ресурс не существует или был удален.',
      };
    }
    return {
      title: 'Доступ запрещен',
      description: message || 'У вас нет доступа к этой странице.',
    };
  };

  const { title, description } = getDefaultMessage();

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-bg-card rounded-lg p-6 sm:p-8 text-center">
        <div className="mb-6">
          <svg
            className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-red-500 mb-4"
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
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">{title}</h1>
          <p className="text-sm sm:text-base text-text-secondary">{description}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 btn-secondary text-sm sm:text-base"
          >
            Назад
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 btn-primary text-sm sm:text-base"
          >
            На главную
          </button>
        </div>
      </div>
    </div>
  );
};
