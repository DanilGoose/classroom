import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { isLightThemeDisabled } from '../config/theme';
import { resendVerificationCode, verifyEmail } from '../api/api';
import { useAlertStore } from '../store/alertStore';

export const Navbar = () => {
  const { user, logout, setUser } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { addAlert } = useAlertStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleGoBack = () => {
    if (location.pathname.startsWith('/courses/')) {
      navigate('/');
      return;
    }

    if (location.pathname.startsWith('/assignments/')) {
      const assignmentId = location.pathname.split('/')[2];
      const courseId = sessionStorage.getItem(`assignment_${assignmentId}_course`);

      if (courseId) {
        navigate(`/courses/${courseId}`);
      } else {
        navigate('/');
      }
      return;
    }

    navigate(-1);
  };

  const canGoBack = location.pathname !== '/' &&
                    location.pathname !== '/login' &&
                    location.pathname !== '/register';

  const handleVerifyEmail = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedCode = verificationCode.trim();

    if (!/^\d{6}$/.test(trimmedCode)) {
      addAlert('Введите корректный код из 6 цифр', 'warning');
      return;
    }

    setIsVerifyingEmail(true);
    try {
      const updatedUser = await verifyEmail(trimmedCode);
      setUser(updatedUser);
      setVerificationCode('');
      addAlert('Почта успешно подтверждена', 'success');
    } catch (err: any) {
      addAlert(err.response?.data?.detail || 'Не удалось подтвердить почту', 'error');
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  const handleResendCode = async () => {
    setIsResendingCode(true);
    try {
      const response = await resendVerificationCode();
      addAlert(response.message || 'Код подтверждения отправлен', 'info');
    } catch (err: any) {
      addAlert(err.response?.data?.detail || 'Не удалось отправить код', 'error');
    } finally {
      setIsResendingCode(false);
    }
  };

  return (
    <div>
      <nav className="bg-bg-card border-b border-border-color">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4">
              {canGoBack && (
                <button
                  onClick={handleGoBack}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                  title="Назад"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-5 h-5 sm:w-6 sm:h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                    />
                  </svg>
                </button>
              )}
              <Link to="/" className="text-lg sm:text-xl font-bold text-primary">
                Classroom
              </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {!isLightThemeDisabled && (
                <button
                  onClick={toggleTheme}
                  className="text-text-secondary hover:text-text-primary transition-all duration-300 hover:rotate-180"
                  title={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
                >
                  {theme === 'dark' ? (
                    // Иконка солнца (светлая тема)
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-5 h-5 sm:w-6 sm:h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                      />
                    </svg>
                  ) : (
                    // Иконка луны (темная тема)
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-5 h-5 sm:w-6 sm:h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                      />
                    </svg>
                  )}
                </button>
              )}

              {user?.is_admin && (
                <Link
                  to="/admin"
                  className="text-xs sm:text-sm text-text-secondary hover:text-text-primary transition-colors hidden sm:inline"
                >
                  Admin
                </Link>
              )}
              <Link
                to="/profile"
                className="text-xs sm:text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <span className="hidden sm:inline">Профиль</span>
                <span className="sm:hidden">👤</span>
              </Link>
              <span className="text-xs sm:text-sm text-text-secondary hidden md:inline">{user?.username}</span>
              <button onClick={handleLogout} className="btn-secondary text-xs sm:text-sm py-1.5 px-2 sm:py-2 sm:px-4">
                Выйти
              </button>
            </div>
          </div>
        </div>
      </nav>

      {user && !user.is_email_verified && (
        <div className="bg-yellow-500/10 border-b border-warning-border">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-yellow-100">
                Подтвердите почту <span className="font-semibold">{user.email}</span>, чтобы завершить регистрацию.
              </p>

              <form onSubmit={handleVerifyEmail} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input h-9 text-sm w-full sm:w-36"
                  placeholder="Код из письма"
                  inputMode="numeric"
                  maxLength={6}
                  disabled={isVerifyingEmail}
                />
                <button
                  type="submit"
                  className="btn-primary text-xs sm:text-sm py-2 px-3"
                  disabled={isVerifyingEmail}
                >
                  {isVerifyingEmail ? 'Проверка...' : 'Подтвердить'}
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  className="btn-secondary text-xs sm:text-sm py-2 px-3"
                  disabled={isResendingCode}
                >
                  {isResendingCode ? 'Отправка...' : 'Отправить код'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
