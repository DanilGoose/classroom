import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import validator from 'validator';
import { confirmPasswordReset, login, requestPasswordResetCode } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { ThemeToggle } from '../components/ThemeToggle';
import { Modal } from '../components/Modal';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<'email' | 'confirm' | 'success'>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetInfo, setResetInfo] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validator.isEmail(email)) {
      setError('Некорректный формат email. Используйте формат: example@domain.com');
      return;
    }

    setLoading(true);

    try {
      const response = await login({ email, password });
      setAuth(response.access_token, response.user);

      // Даём время на сохранение в localStorage
      await new Promise(resolve => setTimeout(resolve, 100));

      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const openResetModal = () => {
    setResetOpen(true);
    setResetStep('email');
    setResetEmail(email);
    setResetCode('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetError('');
    setResetInfo('');
    setResetLoading(false);
  };

  const closeResetModal = () => {
    if (resetLoading) return;
    setResetOpen(false);
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetInfo('');

    if (!validator.isEmail(resetEmail)) {
      setResetError('Некорректный формат email. Используйте формат: example@domain.com');
      return;
    }

    setResetLoading(true);
    try {
      const response = await requestPasswordResetCode(resetEmail);
      setResetInfo(response.message || 'Код отправлен на почту');
      setResetStep('confirm');
    } catch (err: any) {
      setResetError(err.response?.data?.detail || 'Не удалось отправить код');
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetInfo('');

    const trimmedCode = resetCode.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      setResetError('Введите код из 6 цифр');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('Пароли не совпадают');
      return;
    }

    if (resetNewPassword.length < 6) {
      setResetError('Пароль должен быть минимум 6 символов');
      return;
    }

    setResetLoading(true);
    try {
      const response = await confirmPasswordReset(resetEmail, trimmedCode, resetNewPassword);
      setResetInfo(response.message || 'Пароль обновлен');
      setResetStep('success');
      setEmail(resetEmail);
      setPassword('');
    } catch (err: any) {
      setResetError(err.response?.data?.detail || 'Не удалось сбросить пароль');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative">
      {/* Theme Toggle Button */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">Classroom</h1>
          <p className="text-sm sm:text-base text-text-secondary">Вход в систему</p>
        </div>

        <div className="bg-bg-card border border-border-color rounded-lg p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="email@example.com"
                maxLength={254}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-2">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                maxLength={30}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={openResetModal}
              className="text-primary hover:text-primary-hover"
            >
              Забыли пароль?
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-text-secondary">
            Нет аккаунта?{' '}
            <Link to="/register" className="text-primary hover:text-primary-hover">
              Зарегистрироваться
            </Link>
          </div>
        </div>
      </div>

      <Modal
        isOpen={resetOpen}
        onClose={closeResetModal}
        title="Сброс пароля"
      >
        <div className="min-h-[360px] flex flex-col">
          <div className="min-h-[56px]">
            {resetError && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
                {resetError}
              </div>
            )}
            {!resetError && resetInfo && (
              <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 px-4 py-3 rounded-lg text-sm">
                {resetInfo}
              </div>
            )}
          </div>

          {resetStep === 'email' && (
            <form onSubmit={handleRequestResetCode} className="space-y-4 sm:space-y-6 flex-1">
              <div className="text-sm text-text-secondary">
                Введите email аккаунта. Мы отправим код для сброса пароля.
              </div>

              <div>
                <label htmlFor="resetEmail" className="block text-sm font-medium text-text-secondary mb-2">
                  Email
                </label>
                <input
                  id="resetEmail"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="input"
                  placeholder="email@example.com"
                  maxLength={254}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="btn-primary w-full"
              >
                {resetLoading ? 'Отправка...' : 'Получить код'}
              </button>

              <button
                type="button"
                disabled={resetLoading}
                onClick={closeResetModal}
                className="btn-secondary w-full"
              >
                Отмена
              </button>
            </form>
          )}

          {resetStep === 'confirm' && (
            <form onSubmit={handleConfirmReset} className="space-y-4 sm:space-y-6 flex-1">
              <div className="text-sm text-text-secondary">
                Мы отправили код на <span className="text-text-primary font-medium">{resetEmail}</span>. Введите его и задайте новый пароль.
              </div>

              <div>
                <label htmlFor="resetCode" className="block text-sm font-medium text-text-secondary mb-2">
                  Код из письма
                </label>
                <input
                  id="resetCode"
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\\D/g, '').slice(0, 6))}
                  className="input"
                  placeholder="123456"
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
              </div>

              <div>
                <label htmlFor="resetNewPassword" className="block text-sm font-medium text-text-secondary mb-2">
                  Новый пароль
                </label>
                <input
                  id="resetNewPassword"
                  type="password"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  maxLength={30}
                  required
                />
              </div>

              <div>
                <label htmlFor="resetConfirmPassword" className="block text-sm font-medium text-text-secondary mb-2">
                  Подтвердите пароль
                </label>
                <input
                  id="resetConfirmPassword"
                  type="password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  maxLength={30}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="btn-primary w-full"
              >
                {resetLoading ? 'Проверка...' : 'Сбросить пароль'}
              </button>

              <button
                type="button"
                disabled={resetLoading}
                onClick={() => {
                  setResetError('');
                  setResetInfo('');
                  setResetCode('');
                  setResetNewPassword('');
                  setResetConfirmPassword('');
                  setResetStep('email');
                }}
                className="btn-secondary w-full"
              >
                Назад
              </button>
            </form>
          )}

          {resetStep === 'success' && (
            <div className="flex-1 flex flex-col justify-between space-y-4 sm:space-y-6">
              <div className="text-sm text-text-secondary">
                Пароль обновлен. Теперь вы можете войти с новым паролем.
              </div>

              <button
                type="button"
                onClick={() => {
                  closeResetModal();
                  setResetStep('email');
                  setResetCode('');
                  setResetNewPassword('');
                  setResetConfirmPassword('');
                  setResetError('');
                  setResetInfo('');
                }}
                className="btn-primary w-full"
              >
                Перейти ко входу
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
