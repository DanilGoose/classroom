import { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { getAllUsers, getAllCourses, deleteUser, deleteCourse, getCourseMembersAdmin, getCourseAssignmentsAdmin } from '../api/api';
import { useAlertStore } from '../store/alertStore';
import { useConfirmStore } from '../store/confirmStore';
import { AssignmentPopup } from '../components/AssignmentPopup';
import type { User, Course, CourseMember, Assignment } from '../types';

export const AdminPanel = () => {
  const { addAlert } = useAlertStore();
  const { confirm } = useConfirmStore();
  const [tab, setTab] = useState<'users' | 'courses'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourses, setExpandedCourses] = useState<Set<number>>(new Set());
  const [courseMembers, setCourseMembers] = useState<Map<number, CourseMember[]>>(new Map());
  const [courseAssignments, setCourseAssignments] = useState<Map<number, Assignment[]>>(new Map());
  const [selectedAssignment, setSelectedAssignment] = useState<number | null>(null);

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

  const loadCourseDetails = async (courseId: number) => {
    try {
      // Загружаем участников и задания курса через админские эндпоинты
      const [members, assignments] = await Promise.all([
        getCourseMembersAdmin(courseId),
        getCourseAssignmentsAdmin(courseId)
      ]);
      
      setCourseMembers(prev => new Map(prev.set(courseId, members)));
      setCourseAssignments(prev => new Map(prev.set(courseId, assignments)));
    } catch (err) {
      console.error('Failed to load course details:', err);
      addAlert('Ошибка загрузки деталей курса', 'error');
    }
  };

  const toggleCourseExpansion = async (courseId: number) => {
    const newExpanded = new Set(expandedCourses);
    
    if (expandedCourses.has(courseId)) {
      newExpanded.delete(courseId);
    } else {
      newExpanded.add(courseId);
      if (!courseMembers.has(courseId) || !courseAssignments.has(courseId)) {
        await loadCourseDetails(courseId);
      }
    }
    
    setExpandedCourses(newExpanded);
  };

  const closeAssignmentPopup = () => {
    setSelectedAssignment(null);
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
              <div className="space-y-4">
                {courses.map((course) => (
                  <div key={course.id} className="card">
                    {/* Заголовок курса */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <button
                            onClick={() => toggleCourseExpansion(course.id)}
                            className="text-text-secondary hover:text-white transition-colors flex-shrink-0"
                            title={expandedCourses.has(course.id) ? 'Свернуть' : 'Развернуть'}
                          >
                            <svg 
                              className={`w-5 h-5 transition-transform ${expandedCourses.has(course.id) ? 'rotate-90' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <h3 className="text-white font-medium text-lg truncate min-w-0 flex-1" title={course.title}>
                            {course.title}
                          </h3>
                        </div>
                        <p className="text-text-secondary text-sm mb-2 truncate" title={course.description || 'Нет описания'}>
                          {course.description || 'Нет описания'}
                        </p>
                        <div className="flex gap-3 text-xs text-text-tertiary flex-wrap">
                          <span>Код: {course.code}</span>
                          <span>{course.member_count} участников</span>
                          <span>ID: {course.creator_id}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteCourse(course.id)}
                        className="btn-secondary text-red-500 hover:bg-red-500/10 flex-shrink-0 whitespace-nowrap"
                      >
                        Удалить
                      </button>
                    </div>

                    {/* Раскрывающийся контент */}
                    {expandedCourses.has(course.id) && (
                      <div className="mt-4 pt-4 border-t border-border-color space-y-4">
                        {/* Участники курса */}
                        <div>
                          <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                            </svg>
                            Участники курса ({courseMembers.get(course.id)?.length || 0})
                          </h4>
                          <div className="bg-bg-secondary rounded-lg p-3 max-h-48 overflow-y-auto">
                            {courseMembers.get(course.id)?.length ? (
                              <div className="space-y-2">
                                {courseMembers.get(course.id)?.map((member) => (
                                  <div key={member.id} className="flex justify-between items-center text-sm">
                                    <div>
                                      <span className="text-white">{member.username}</span>
                                      <span className="text-text-secondary ml-2">({member.email})</span>
                                    </div>
                                    <span className="text-text-tertiary text-xs">
                                      ID: {member.user_id}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-text-secondary text-sm italic">Участники не найдены</p>
                            )}
                          </div>
                        </div>

                        {/* Задания курса */}
                        <div>
                          <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Задания курса ({courseAssignments.get(course.id)?.length || 0})
                          </h4>
                          <div className="bg-bg-secondary rounded-lg p-3 max-h-48 overflow-y-auto">
                            {courseAssignments.get(course.id)?.length ? (
                              <div className="space-y-2">
                                {courseAssignments.get(course.id)?.map((assignment) => (
                                  <div 
                                    key={assignment.id} 
                                    className="flex justify-between items-center text-sm p-2 hover:bg-bg-hover rounded cursor-pointer transition-colors"
                                    onClick={() => setSelectedAssignment(assignment.id)}
                                    title="Нажмите для просмотра детальной информации"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <span className="text-white truncate">{assignment.title}</span>
                                      {assignment.due_date && (
                                        <span className="text-text-tertiary ml-2">
                                          до {new Date(assignment.due_date).toLocaleDateString('ru-RU')}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                        {assignment.grading_type === 'numeric' ? 'Числовая' : 'Текстовая'}
                                      </span>
                                      <span className="text-text-tertiary text-xs">
                                        ID: {assignment.id}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-text-secondary text-sm italic">Задания не найдены</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* popup с детальной информацией о задании */}
      {selectedAssignment && (
        <AssignmentPopup
          assignmentId={selectedAssignment}
          isOpen={!!selectedAssignment}
          onClose={closeAssignmentPopup}
        />
      )}
    </div>
  );
};
