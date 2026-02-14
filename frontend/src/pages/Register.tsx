import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import validator from 'validator';
import { confirmRegistration, register } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { ThemeToggle } from '../components/ThemeToggle';

export const Register = () => {
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validator.isEmail(email)) {
      setError('Некорректный формат email. Используйте формат: example@domain.com');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен быть минимум 6 символов');
      return;
    }

    setLoading(true);

    try {
      await register({ email, username, password });
      setStep('code');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError('Введите код из 6 цифр');
      return;
    }

    setLoading(true);
    try {
      const response = await confirmRegistration(email, trimmed);
      setAuth(response.access_token, response.user);

      await new Promise(resolve => setTimeout(resolve, 100));
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Не удалось подтвердить код');
    } finally {
      setLoading(false);
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
          <p className="text-sm sm:text-base text-text-secondary">Регистрация</p>
        </div>

        <div className="bg-bg-card border border-border-color rounded-lg p-6 sm:p-8">
          {step === 'form' ? (
            <form onSubmit={handleRequestCode} className="space-y-4 sm:space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-text-secondary mb-2">
                  Имя пользователя
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  placeholder="Иван Иванов"
                  maxLength={50}
                  required
                />
                {username.length >= 50 && (
                  <p className="text-xs text-warning mt-1">Достигнут лимит по имени (50 символов)</p>
                )}
              </div>

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
                {password.length >= 30 && (
                  <p className="text-xs text-warning mt-1">Достигнут лимит по паролю (30 символов)</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-2">
                  Подтвердите пароль
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                {loading ? 'Отправка...' : 'Получить код'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-4 sm:space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="text-sm text-text-secondary">
                Мы отправили код на <span className="text-text-primary font-medium">{email}</span>. Введите его ниже.
              </div>

              <div>
                <label htmlFor="code" className="block text-sm font-medium text-text-secondary mb-2">
                  Код из письма
                </label>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\\D/g, '').slice(0, 6))}
                  className="input"
                  placeholder="123456"
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Проверка...' : 'Зарегистрироваться'}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setError('');
                  setCode('');
                  setStep('form');
                }}
                className="btn-secondary w-full"
              >
                Назад
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-text-secondary">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-primary hover:text-primary-hover">
              Войти
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
