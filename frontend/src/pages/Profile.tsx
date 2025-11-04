import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { useAuthStore } from '../store/authStore';
import { updateProfile, updatePassword } from '../api/api';

export const Profile = () => {
  const { user, setUser } = useAuthStore();

  // Profile update states
  const [email, setEmail] = useState(user?.email || '');
  const [username, setUsername] = useState(user?.username || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

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
      const updatedUser = await updateProfile({ email, username });
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input w-full"
                  required
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
                  required
                  minLength={6}
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
                  required
                  minLength={6}
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
