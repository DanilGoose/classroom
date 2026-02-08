import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AlertContainer } from './components/AlertContainer';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Home } from './pages/Home';
import { CoursePage } from './pages/CoursePage';
import { AssignmentPage } from './pages/AssignmentPage';
import { AdminPanel } from './pages/AdminPanel';
import { Profile } from './pages/Profile';
import { useWebSocketInit } from './hooks/useWebSocketInit';
import { isLightThemeDisabled } from './config/theme';

function App() {
  const { initAuth, isAuthenticated, isLoading } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  // Инициализация WebSocket
  useWebSocketInit();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Инициализация темы при загрузке приложения
  useEffect(() => {
    if (isLightThemeDisabled && theme !== 'dark') {
      setTheme('dark');
      return;
    }

    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(isLightThemeDisabled ? 'dark' : theme);
  }, [theme, setTheme]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-secondary text-lg">Загрузка...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AlertContainer />
      <ConfirmDialog />
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Register />}
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        <Route
          path="/courses/:id"
          element={
            <ProtectedRoute>
              <CoursePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assignments/:id"
          element={
            <ProtectedRoute>
              <AssignmentPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminPanel />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
