import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { CourseCard } from '../components/CourseCard';
import { Modal } from '../components/Modal';
import { getCourses, createCourse, joinCourse, getMyAssignments } from '../api/api';
import { useAuthStore } from '../store/authStore';
import type { Course } from '../types';

export const Home = () => {
  const [tab, setTab] = useState<'courses' | 'assignments' | 'archived'>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [archivedCourses, setArchivedCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      loadCourses();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (tab === 'assignments' && assignments.length === 0) {
      loadAssignments();
    } else if (tab === 'archived' && archivedCourses.length === 0) {
      loadArchivedCourses();
    }
  }, [tab]);

  const loadCourses = async () => {
    try {
      const data = await getCourses(false); // Только активные курсы
      setCourses(data);
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadArchivedCourses = async () => {
    setArchivedLoading(true);
    try {
      const data = await getCourses(true); // Только архивные курсы
      setArchivedCourses(data);
    } catch (err) {
      console.error('Failed to load archived courses:', err);
    } finally {
      setArchivedLoading(false);
    }
  };

  const loadAssignments = async () => {
    setAssignmentsLoading(true);
    try {
      const data = await getMyAssignments();
      setAssignments(data);
    } catch (err) {
      console.error('Failed to load assignments:', err);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const newCourse = await createCourse({ title, description });
      setCourses([...courses, newCourse]);
      setCreateModalOpen(false);
      setTitle('');
      setDescription('');
      navigate(`/courses/${newCourse.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка создания курса');
    }
  };

  const handleJoinCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const course = await joinCourse({ code });
      setCourses([...courses, course]);
      setJoinModalOpen(false);
      setCode('');
      navigate(`/courses/${course.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Курс не найден');
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-6">Classroom</h1>

        {/* Tabs */}
        <div className="border-b border-border-color mb-6">
          <div className="flex gap-6">
            <button
              onClick={() => setTab('courses')}
              className={`pb-3 border-b-2 transition-colors font-medium ${
                tab === 'courses'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Курсы
            </button>
            <button
              onClick={() => setTab('assignments')}
              className={`pb-3 border-b-2 transition-colors font-medium ${
                tab === 'assignments'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Задания
            </button>
            <button
              onClick={() => setTab('archived')}
              className={`pb-3 border-b-2 transition-colors font-medium ${
                tab === 'archived'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Архивные
            </button>
          </div>
        </div>

        {/* Кнопки управления курсами */}
        {tab === 'courses' && (
          <div className="flex gap-2 sm:gap-3 mb-6">
            <button onClick={() => setJoinModalOpen(true)} className="btn-secondary flex-1 sm:flex-none text-sm">
              Присоединиться
            </button>
            <button onClick={() => setCreateModalOpen(true)} className="btn-primary flex-1 sm:flex-none text-sm">
              Создать курс
            </button>
          </div>
        )}

        {/* Courses Tab */}
        {tab === 'courses' && (
          loading ? (
            <div className="text-center text-text-secondary py-12">Загрузка...</div>
          ) : courses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary mb-4">У вас пока нет активных курсов</p>
              <button onClick={() => setCreateModalOpen(true)} className="btn-primary">
                Создать первый курс
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} onUpdate={loadCourses} />
              ))}
            </div>
          )
        )}

        {/* Archived Courses Tab */}
        {tab === 'archived' && (
          archivedLoading ? (
            <div className="text-center text-text-secondary py-12">Загрузка...</div>
          ) : archivedCourses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary mb-4">У вас пока нет архивных курсов</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr">
              {archivedCourses.map((course) => (
                <CourseCard key={course.id} course={course} onUpdate={() => { loadCourses(); loadArchivedCourses(); }} />
              ))}
            </div>
          )
        )}

        {/* Assignments Tab */}
        {tab === 'assignments' && (
          assignmentsLoading ? (
            <div className="text-center text-text-secondary py-12">Загрузка...</div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary mb-4">У вас пока нет заданий</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Невыполненные задания */}
              {assignments.filter(a => !a.is_submitted && a.course_is_archived !== 1).length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-text-primary mb-4">Невыполненные ({assignments.filter(a => !a.is_submitted && a.course_is_archived !== 1).length})</h2>
                  <div className="space-y-3">
                    {assignments
                      .filter(a => !a.is_submitted && a.course_is_archived !== 1)
                      .map((assignment) => (
                        <Link
                          key={assignment.id}
                          to={`/assignments/${assignment.id}`}
                          className="block card hover:bg-bg-hover"
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-semibold text-text-primary mb-1">{assignment.title}</h3>
                              <p className="text-sm text-text-secondary mb-2">{assignment.course_title}</p>
                              <p className="text-sm text-text-tertiary line-clamp-2">{assignment.description}</p>
                            </div>
                            <span className="flex-shrink-0 bg-warning-bg text-warning text-xs px-3 py-1 rounded-full">
                              Не сдано
                            </span>
                          </div>
                        </Link>
                      ))}
                  </div>
                </div>
              )}

              {/* Выполненные задания */}
              {assignments.filter(a => a.is_submitted).length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-text-primary mb-4">Выполненные ({assignments.filter(a => a.is_submitted).length})</h2>
                  <div className="space-y-3">
                    {assignments
                      .filter(a => a.is_submitted)
                      .map((assignment) => (
                        <Link
                          key={assignment.id}
                          to={`/assignments/${assignment.id}`}
                          className="block card hover:bg-bg-hover"
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-semibold text-text-primary mb-1">{assignment.title}</h3>
                              <p className="text-sm text-text-secondary mb-2">{assignment.course_title}</p>
                              <p className="text-sm text-text-tertiary line-clamp-2">{assignment.description}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`flex-shrink-0 text-xs px-3 py-1 rounded-full ${
                                assignment.is_graded
                                  ? 'bg-green-900/30 text-green-400'
                                  : 'bg-blue-900/30 text-blue-400'
                              }`}>
                                {assignment.is_graded ? `Оценка: ${assignment.score}` : 'Проверяется'}
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Create Course Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Создать курс"
      >
        <form onSubmit={handleCreateCourse} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Название курса
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="Математика 10 класс"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              rows={3}
              maxLength={5000}
              placeholder="Описание курса..."
            />
          </div>

          <button type="submit" className="btn-primary w-full">
            Создать
          </button>
        </form>
      </Modal>

      {/* Join Course Modal */}
      <Modal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        title="Присоединиться к курсу"
      >
        <form onSubmit={handleJoinCourse} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Код курса
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="input font-mono"
              placeholder="ABCDEFGHI"
              maxLength={9}
              required
            />
            <p className="text-xs text-text-tertiary mt-1">
              Введите 9-значный код курса
            </p>
          </div>

          <button type="submit" className="btn-primary w-full">
            Присоединиться
          </button>
        </form>
      </Modal>
    </div>
  );
};
