import { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { getAllUsers, getAllCourses, deleteUser, deleteCourse } from '../api/api';
import { useAlertStore } from '../store/alertStore';
import { useConfirmStore } from '../store/confirmStore';
import type { User, Course } from '../types';

export const AdminPanel = () => {
  const { addAlert } = useAlertStore();
  const { confirm } = useConfirmStore();
  const [tab, setTab] = useState<'users' | 'courses'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab === 'users') {
      loadUsers();
    } else {
      loadCourses();
    }
  }, [tab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    setLoading(true);
    try {
      const data = await getAllCourses();
      setCourses(data);
    } catch (err) {
      console.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    const confirmed = await confirm('Удалить пользователя?');
    if (!confirmed) return;

    try {
      await deleteUser(userId);
      setUsers(users.filter((u) => u.id !== userId));
    } catch (err) {
      addAlert('Ошибка удаления пользователя', 'error');
    }
  };

  const handleDeleteCourse = async (courseId: number) => {
    const confirmed = await confirm('Удалить курс?');
    if (!confirmed) return;

    try {
      await deleteCourse(courseId);
      setCourses(courses.filter((c) => c.id !== courseId));
    } catch (err) {
      addAlert('Ошибка удаления курса', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-text-primary mb-8">Админ-панель</h1>

        <div className="border-b border-border-color mb-6">
          <div className="flex gap-6">
            <button
              onClick={() => setTab('users')}
              className={`pb-3 border-b-2 transition-colors ${
                tab === 'users'
                  ? 'border-primary text-white'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Пользователи ({users.length})
            </button>
            <button
              onClick={() => setTab('courses')}
              className={`pb-3 border-b-2 transition-colors ${
                tab === 'courses'
                  ? 'border-primary text-white'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Курсы ({courses.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-text-secondary">Загрузка...</div>
        ) : (
          <>
            {tab === 'users' && (
              <div className="space-y-2">
                {users.map((user) => (
                  <div key={user.id} className="card flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">{user.username}</p>
                      <p className="text-sm text-text-secondary">{user.email}</p>
                      <div className="flex gap-2 mt-1">
                        {user.is_admin && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                            Админ
                          </span>
                        )}
                        <span className="text-xs text-text-tertiary">
                          ID: {user.id}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="btn-secondary text-red-500 hover:bg-red-500/10"
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tab === 'courses' && (
              <div className="space-y-2">
                {courses.map((course) => (
                  <div key={course.id} className="card flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">{course.title}</p>
                      <p className="text-sm text-text-secondary">
                        {course.description || 'Нет описания'}
                      </p>
                      <div className="flex gap-3 mt-1 text-xs text-text-tertiary">
                        <span>Код: {course.code}</span>
                        <span>{course.member_count} участников</span>
                        <span>ID создателя: {course.creator_id}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCourse(course.id)}
                      className="btn-secondary text-red-500 hover:bg-red-500/10"
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
