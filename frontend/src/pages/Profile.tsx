import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { useAuthStore } from '../store/authStore';
import { updateProfile, updatePassword, requestEmailChangeOldCode, requestEmailChangeNewCode, confirmEmailChangeNew, verifyEmailChangeOldCode } from '../api/api';

type EmailChangeStep = 'old_code' | 'new_email' | 'new_code';

export const Profile = () => {
  const { user, setUser } = useAuthStore();

  // Profile update states
  const [username, setUsername] = useState(user?.username || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Email change states
  const [oldEmailCode, setOldEmailCode] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newEmailCode, setNewEmailCode] = useState('');
  const [emailChangeStep, setEmailChangeStep] = useState<EmailChangeStep>('old_code');
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState('');
  const [emailChangeSuccess, setEmailChangeSuccess] = useState('');

  // Password update states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);

    try {
      const updatedUser = await updateProfile({ username });
      // Обновляем пользователя в store
      setUser(updatedUser);
      setProfileSuccess('Профиль успешно обновлен');
    } catch (err: any) {
      setProfileError(err.response?.data?.detail || 'Ошибка обновления профиля');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // Validate passwords
    if (newPassword !== confirmPassword) {
      setPasswordError('Новые пароли не совпадают');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Новый пароль должен содержать минимум 6 символов');
      return;
    }

    setPasswordLoading(true);

    try {
      await updatePassword({ old_password: oldPassword, new_password: newPassword });
      setPasswordSuccess('Пароль успешно изменен');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.response?.data?.detail || 'Ошибка изменения пароля');
    } finally {
      setPasswordLoading(false);
    }
  };

  const resetEmailChangeMessages = () => {
    setEmailChangeError('');
    setEmailChangeSuccess('');
  };

  const handleSendOldEmailCode = async () => {
    resetEmailChangeMessages();
    setEmailChangeLoading(true);

    try {
      const response = await requestEmailChangeOldCode();
      setEmailChangeSuccess(response.message || 'Код отправлен на текущую почту');
    } catch (err: any) {
      setEmailChangeError(err.response?.data?.detail || 'Не удалось отправить код на текущую почту');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleGoToNewEmailStep = async () => {
    resetEmailChangeMessages();

    const oldCode = oldEmailCode.trim();
    if (!/^\d{6}$/.test(oldCode)) {
      setEmailChangeError('Введите корректный код из 6 цифр с текущей почты');
      return;
    }

    setEmailChangeLoading(true);
    try {
      const response = await verifyEmailChangeOldCode(oldCode);
      setEmailChangeSuccess(response.message || 'Код подтвержден');
      setEmailChangeStep('new_email');
    } catch (err: any) {
      setEmailChangeError(err.response?.data?.detail || 'Неверный код с текущей почты');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleSendNewEmailCode = async () => {
    resetEmailChangeMessages();

    const oldCode = oldEmailCode.trim();
    const nextEmail = newEmail.trim();
    if (!/^\d{6}$/.test(oldCode)) {
      setEmailChangeError('Введите корректный код из 6 цифр с текущей почты');
      return;
    }
    if (!nextEmail) {
      setEmailChangeError('Введите новую почту');
      return;
    }

    setEmailChangeLoading(true);
    try {
      const response = await requestEmailChangeNewCode(oldCode, nextEmail);
      setEmailChangeSuccess(response.message || 'Код отправлен на новую почту');
      setEmailChangeStep('new_code');
    } catch (err: any) {
      setEmailChangeError(err.response?.data?.detail || 'Не удалось отправить код на новую почту');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleConfirmNewEmail = async () => {
    resetEmailChangeMessages();

    const code = newEmailCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setEmailChangeError('Введите корректный код из 6 цифр с новой почты');
      return;
    }

    setEmailChangeLoading(true);
    try {
      const updatedUser = await confirmEmailChangeNew(code);
      setUser(updatedUser);
      setOldEmailCode('');
      setNewEmail('');
      setNewEmailCode('');
      setEmailChangeSuccess('Почта успешно изменена');
      setEmailChangeStep('old_code');
    } catch (err: any) {
      setEmailChangeError(err.response?.data?.detail || 'Не удалось подтвердить новую почту');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-6 sm:mb-8">Настройки профиля</h1>

        <div className="space-y-4 sm:space-y-6">
          {/* Profile Information Card */}
          <div className="bg-bg-card rounded-lg p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-text-primary mb-4 sm:mb-6">Личная информация</h2>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  className="input w-full"
                  maxLength={254}
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Имя пользователя
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input w-full"
                  maxLength={50}
                  required
                />
              </div>

              {profileError && (
                <div className="bg-red-900/20 border border-red-700 text-red-400 px-4 py-3 rounded">
                  {profileError}
                </div>
              )}

              {profileSuccess && (
                <div className="bg-green-900/20 border border-green-700 text-green-400 px-4 py-3 rounded">
                  {profileSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={profileLoading}
                className="btn-primary w-full"
              >
                {profileLoading ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </form>
          </div>

          {/* Email Change Card */}
          <div className="bg-bg-card rounded-lg p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-text-primary">Смена почты</h2>
              <span className="text-xs text-text-tertiary">
                {emailChangeStep === 'old_code' ? 'Шаг 1/3' : emailChangeStep === 'new_email' ? 'Шаг 2/3' : 'Шаг 3/3'}
              </span>
            </div>

            <div className="h-14 mb-4">
              {emailChangeError ? (
                <div className="h-full bg-red-900/20 border border-red-700 text-red-400 px-4 py-2 rounded flex items-center">
                  <p className="text-sm line-clamp-2">{emailChangeError}</p>
                </div>
              ) : emailChangeSuccess ? (
                <div className="h-full bg-green-900/20 border border-green-700 text-green-400 px-4 py-2 rounded flex items-center">
                  <p className="text-sm line-clamp-2">{emailChangeSuccess}</p>
                </div>
              ) : (
                <div className="h-full" />
              )}
            </div>

            <div className="min-h-[280px] flex flex-col justify-between">
              {emailChangeStep === 'old_code' && (
                <>
                  <div className="space-y-4">
                    <p className="text-sm text-text-secondary">
                      Введите код с текущей почты <span className="text-text-primary font-medium">{user?.email}</span>.
                    </p>

                    <div className="bg-bg-secondary rounded-lg p-4 border border-border-color">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-sm text-text-secondary">
                          Если кода нет, отправьте его на текущую почту.
                        </p>
                        <button
                          type="button"
                          onClick={handleSendOldEmailCode}
                          disabled={emailChangeLoading}
                          className="btn-secondary whitespace-nowrap"
                        >
                          {emailChangeLoading ? 'Отправка...' : 'Отправить код'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        Код с текущей почты
                      </label>
                      <input
                        type="text"
                        value={oldEmailCode}
                        onChange={(e) => setOldEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="input w-full"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        disabled={emailChangeLoading}
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={handleGoToNewEmailStep}
                      disabled={emailChangeLoading}
                      className="btn-primary w-full"
                    >
                      Далее
                    </button>
                  </div>
                </>
              )}

              {emailChangeStep === 'new_email' && (
                <>
                  <div className="space-y-4">
                    <p className="text-sm text-text-secondary">
                      Введите новую почту. Мы отправим на неё код подтверждения.
                    </p>

                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        Новая почта
                      </label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="input w-full"
                        maxLength={254}
                        placeholder="new@example.com"
                        disabled={emailChangeLoading}
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetEmailChangeMessages();
                        setEmailChangeStep('old_code');
                      }}
                      disabled={emailChangeLoading}
                      className="btn-secondary w-full"
                    >
                      Назад
                    </button>
                    <button
                      type="button"
                      onClick={handleSendNewEmailCode}
                      disabled={emailChangeLoading}
                      className="btn-primary w-full"
                    >
                      {emailChangeLoading ? 'Отправка...' : 'Отправить код на новую почту'}
                    </button>
                  </div>
                </>
              )}

              {emailChangeStep === 'new_code' && (
                <>
                  <div className="space-y-4">
                    <p className="text-sm text-text-secondary">
                      Введите код, который пришел на новую почту{' '}
                      <span className="text-text-primary font-medium">{newEmail || '...'}</span>.
                    </p>

                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        Код с новой почты
                      </label>
                      <input
                        type="text"
                        value={newEmailCode}
                        onChange={(e) => setNewEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="input w-full"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        disabled={emailChangeLoading}
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetEmailChangeMessages();
                        setEmailChangeStep('new_email');
                      }}
                      disabled={emailChangeLoading}
                      className="btn-secondary w-full"
                    >
                      Назад
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmNewEmail}
                      disabled={emailChangeLoading}
                      className="btn-primary w-full"
                    >
                      {emailChangeLoading ? 'Проверка...' : 'Подтвердить смену почты'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Password Change Card */}
          <div className="bg-bg-card rounded-lg p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-text-primary mb-4 sm:mb-6">Изменить пароль</h2>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Текущий пароль
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="input w-full"
                  maxLength={30}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Новый пароль
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input w-full"
                  minLength={6}
                  maxLength={30}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Подтвердите новый пароль
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input w-full"
                  minLength={6}
                  maxLength={30}
                  required
                />
              </div>

              {passwordError && (
                <div className="bg-red-900/20 border border-red-700 text-red-400 px-4 py-3 rounded">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="bg-green-900/20 border border-green-700 text-green-400 px-4 py-3 rounded">
                  {passwordSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={passwordLoading}
                className="btn-primary w-full"
              >
                {passwordLoading ? 'Изменение...' : 'Изменить пароль'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
