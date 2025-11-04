import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { AccessDenied } from '../components/AccessDenied';
import { AssignmentCard } from '../components/AssignmentCard';
import { getCourse, getAssignments, createAssignment, getCourseMembers, removeMember, updateCourse, getCourseGradebook, getCourseUngradedSubmissions, uploadFile, leaveCourse, archiveCourse } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { useAlertStore } from '../store/alertStore';
import { useConfirmStore } from '../store/confirmStore';
import type { Course, Assignment, CourseMember } from '../types';
import { Modal } from '../components/Modal';
import { FileUploadZone } from '../components/FileUploadZone';
import { useWebSocket, useCourseSubscription } from '../hooks/useWebSocket';

export const CoursePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { addAlert } = useAlertStore();
  const { confirm } = useConfirmStore();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers] = useState<CourseMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [tab, setTab] = useState<'assignments' | 'members' | 'gradebook' | 'ungraded'>('assignments');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editCourseModalOpen, setEditCourseModalOpen] = useState(false);
  const [gradebookData, setGradebookData] = useState<any>(null);
  const [ungradedSubmissions, setUngradedSubmissions] = useState<any[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Новые поля для гибкого оценивания
  const [gradingType, setGradingType] = useState<'numeric' | 'text'>('numeric');
  const [gradeMin, setGradeMin] = useState(2);
  const [gradeMax, setGradeMax] = useState(5);
  const [gradeOptions, setGradeOptions] = useState<string[]>(['Отлично', 'Хорошо']);
  const [textGradeInput, setTextGradeInput] = useState('');
  const [assignmentFiles, setAssignmentFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [maxAttemptsEnabled, setMaxAttemptsEnabled] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState(1);

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    if (id) {
      loadCourse();
      loadAssignments();
    }
  }, [id]);

  const loadCourse = async () => {
    try {
      const data = await getCourse(Number(id));
      setCourse(data);
    } catch (err) {
      console.error('Failed to load course');
      setAccessDenied(true);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    try {
      const data = await getAssignments(Number(id));
      setAssignments(data);
    } catch (err) {
      console.error('Failed to load assignments');
    }
  };

  const loadMembers = async () => {
    if (!course?.is_creator) return;
    try {
      const data = await getCourseMembers(Number(id));
      setMembers(data);
    } catch (err) {
      console.error('Failed to load members');
    }
  };

  const loadGradebook = async () => {
    if (!course?.is_creator) return;
    try {
      const data = await getCourseGradebook(Number(id));
      setGradebookData(data);
    } catch (err) {
      console.error('Failed to load gradebook');
    }
  };

  const loadUngradedSubmissions = async () => {
    if (!course?.is_creator) return;
    try {
      const data = await getCourseUngradedSubmissions(Number(id));
      setUngradedSubmissions(data);
    } catch (err) {
      console.error('Failed to load ungraded submissions');
    }
  };

  useEffect(() => {
    if (tab === 'members' && course?.is_creator && members.length === 0) {
      loadMembers();
    }
    if (tab === 'gradebook' && course?.is_creator && !gradebookData) {
      loadGradebook();
    }
    if (tab === 'ungraded' && course?.is_creator) {
      loadUngradedSubmissions();
    }
  }, [tab]);

  // Подписываемся на WebSocket обновления курса
  useCourseSubscription(id ? Number(id) : null);

  // Обработчик создания задания
  const handleAssignmentCreated = useCallback((data: Assignment) => {
    console.log('Assignment created:', data);
    setAssignments((prev) => [data, ...prev]);
    addAlert('Новое задание создано', 'success');
  }, [addAlert]);

  // Обработчик обновления задания
  const handleAssignmentUpdated = useCallback((data: Assignment) => {
    console.log('Assignment updated:', data);
    setAssignments((prev) =>
      prev.map((a) => a.id === data.id ? data : a)
    );
    addAlert('Задание обновлено', 'info');
  }, [addAlert]);

  // Обработчик удаления задания
  const handleAssignmentDeleted = useCallback((data: { assignment_id: number }) => {
    console.log('Assignment deleted:', data);
    setAssignments((prev) => prev.filter((a) => a.id !== data.assignment_id));
    addAlert('Задание удалено', 'info');
  }, [addAlert]);

  // Подписываемся на WebSocket события
  useWebSocket('assignment_created', handleAssignmentCreated, [handleAssignmentCreated]);
  useWebSocket('assignment_updated', handleAssignmentUpdated, [handleAssignmentUpdated]);
  useWebSocket('assignment_deleted', handleAssignmentDeleted, [handleAssignmentDeleted]);

  // Слушаем событие посещения задания для обновления плашек
  useEffect(() => {
    const handleAssignmentVisited = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.courseId === Number(id)) {
        loadAssignments();
      }
    };

    window.addEventListener('assignment-visited', handleAssignmentVisited);

    return () => {
      window.removeEventListener('assignment-visited', handleAssignmentVisited);
    };
  }, [id]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Валидация для текстового типа оценки
    if (gradingType === 'text' && gradeOptions.length < 2) {
      setError('Для текстовой оценки нужно минимум 2 варианта');
      return;
    }

    try {
      const newAssignment = await createAssignment(Number(id), {
        title,
        description,
        grading_type: gradingType,
        grade_min: gradingType === 'numeric' ? gradeMin : undefined,
        grade_max: gradingType === 'numeric' ? gradeMax : undefined,
        grade_options: gradingType === 'text' ? gradeOptions : undefined,
        max_attempts: maxAttemptsEnabled ? maxAttempts : null,
      });

      // Загрузка файлов, если они есть
      if (assignmentFiles.length > 0) {
        setUploadingFiles(true);
        try {
          for (const file of assignmentFiles) {
            await uploadFile(newAssignment.id, file);
          }
        } catch (err) {
          console.error('Error uploading files:', err);
          addAlert('Задание создано, но не все файлы загружены', 'warning');
        } finally {
          setUploadingFiles(false);
        }
      }

      setCreateModalOpen(false);
      setTitle('');
      setDescription('');
      setGradingType('numeric');
      setGradeMin(2);
      setGradeMax(5);
      setGradeOptions(['Отлично', 'Хорошо']);
      setTextGradeInput('');
      setAssignmentFiles([]);
      setMaxAttemptsEnabled(false);
      setMaxAttempts(1);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка создания задания');
    }
  };

  const handleRemoveMember = async (memberId: number, userId: number) => {
    const confirmed = await confirm('Удалить участника?');
    if (!confirmed) return;

    try {
      await removeMember(Number(id), userId);
      setMembers(members.filter((m) => m.id !== memberId));
    } catch (err) {
      addAlert('Ошибка удаления участника', 'error');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(course?.code || '');
    addAlert('Код скопирован!', 'success');
  };

  const openEditCourseModal = () => {
    setEditTitle(course?.title || '');
    setEditDescription(course?.description || '');
    setEditCourseModalOpen(true);
  };

  const handleEditCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const updatedCourse = await updateCourse(Number(id), {
        title: editTitle,
        description: editDescription,
      });
      setCourse(updatedCourse);
      setEditCourseModalOpen(false);
      addAlert('Курс обновлён', 'success');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка обновления курса');
    }
  };

  const handleLeaveCourse = async () => {
    const confirmed = await confirm('Вы уверены, что хотите покинуть курс?');
    if (!confirmed) return;

    try {
      await leaveCourse(Number(id));
      addAlert('Вы покинули курс', 'success');
      navigate('/');
    } catch (err: any) {
      addAlert(err.response?.data?.detail || 'Ошибка выхода из курса', 'error');
    }
  };

  const handleArchiveCourse = async () => {
    const action = course?.is_archived ? 'разархивировать' : 'заархивировать';
    const confirmed = await confirm(`Вы уверены, что хотите ${action} курс?`);
    if (!confirmed) return;

    try {
      const updatedCourse = await archiveCourse(Number(id));
      setCourse(updatedCourse);
      addAlert(`Курс ${updatedCourse.is_archived ? 'заархивирован' : 'разархивирован'}`, 'success');
    } catch (err: any) {
      addAlert(err.response?.data?.detail || 'Ошибка архивации курса', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-text-secondary">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return <AccessDenied message="Курс не найден или у вас нет доступа к нему." type="not_found" />;
  }

  if (!course) return null;

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary break-words">{course.title}</h1>
              {course.is_archived === 1 && (
                <p className="text-sm text-warning mt-2">
                  📦 Курс находится в архиве. Редактирование, создание заданий и сдача работ недоступны.
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {course.is_creator ? (
                <>
                  <button onClick={handleArchiveCourse} className="btn-secondary text-sm flex-1 sm:flex-none">
                    {course.is_archived ? 'Разархивировать' : 'Архивировать'}
                  </button>
                  {!course.is_archived && (
                    <>
                      <button onClick={openEditCourseModal} className="btn-secondary text-sm flex-1 sm:flex-none">
                        Редактировать
                      </button>
                      <button onClick={() => setCreateModalOpen(true)} className="btn-primary text-sm flex-1 sm:flex-none">
                        Создать задание
                      </button>
                    </>
                  )}
                </>
              ) : (
                !course.is_archived && (
                  <button onClick={handleLeaveCourse} className="btn-secondary text-sm flex-1 sm:flex-none">
                    Покинуть курс
                  </button>
                )
              )}
            </div>
          </div>

          <p className="text-sm sm:text-base text-text-secondary mb-3 sm:mb-4 whitespace-pre-wrap break-words">{course.description}</p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            <span className="text-text-tertiary">{course.member_count} участников</span>
            <button onClick={copyCode} className="text-primary hover:text-primary-hover text-left">
              Код: <span className="font-mono">{course.code}</span>
            </button>
          </div>
        </div>

        <div className="border-b border-border-color mb-4 sm:mb-6 overflow-x-auto">
          <div className="flex gap-3 sm:gap-6 min-w-max">
            <button
              onClick={() => setTab('assignments')}
              className={`pb-2 sm:pb-3 border-b-2 transition-colors text-sm sm:text-base whitespace-nowrap font-medium ${
                tab === 'assignments'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Задания
            </button>
            {course.is_creator && (
              <>
                <button
                  onClick={() => setTab('gradebook')}
                  className={`pb-2 sm:pb-3 border-b-2 transition-colors text-sm sm:text-base whitespace-nowrap font-medium ${
                    tab === 'gradebook'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Оценки
                </button>
                <button
                  onClick={() => setTab('ungraded')}
                  className={`pb-2 sm:pb-3 border-b-2 transition-colors text-sm sm:text-base whitespace-nowrap font-medium ${
                    tab === 'ungraded'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Непроверенные
                </button>
                <button
                  onClick={() => setTab('members')}
                  className={`pb-2 sm:pb-3 border-b-2 transition-colors text-sm sm:text-base whitespace-nowrap font-medium ${
                    tab === 'members'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Участники
                </button>
              </>
            )}
          </div>
        </div>

        {tab === 'assignments' && (
          <div className="space-y-4">
            {assignments.length === 0 ? (
              <div className="text-center text-text-secondary py-12">
                Пока нет заданий
              </div>
            ) : (
              assignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  isTeacher={course?.is_creator || false}
                />
              ))
            )}
          </div>
        )}

        {tab === 'gradebook' && course.is_creator && (
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            {!gradebookData ? (
              <div className="text-center text-text-secondary py-12">Загрузка...</div>
            ) : gradebookData.students.length === 0 || gradebookData.assignments.length === 0 ? (
              <div className="text-center text-text-secondary py-12">
                {gradebookData.assignments.length === 0
                  ? 'Нет заданий для отображения'
                  : 'Нет студентов в курсе'}
              </div>
            ) : (
              <table className="w-full border-collapse text-xs sm:text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-bg-card border border-border-color p-2 sm:p-3 text-left text-text-primary font-medium min-w-[120px] sm:min-w-[200px]">
                      Студент
                    </th>
                    {gradebookData.assignments.map((assignment: any) => (
                      <th
                        key={assignment.id}
                        className="border border-border-color p-2 sm:p-3 text-center text-text-primary font-medium min-w-[100px] sm:min-w-[120px]"
                      >
                        <Link
                          to={`/assignments/${assignment.id}`}
                          className="text-primary hover:text-primary-hover block text-xs sm:text-sm"
                        >
                          {assignment.title.length > 15
                            ? assignment.title.substring(0, 15) + '...'
                            : assignment.title}
                        </Link>
                        {assignment.due_date && (
                          <div className="text-[10px] sm:text-xs text-text-tertiary mt-1">
                            {new Date(assignment.due_date).toLocaleDateString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gradebookData.students.map((student: any) => (
                    <tr key={student.id}>
                      <td className="sticky left-0 z-10 bg-bg-card border border-border-color p-2 sm:p-3 text-text-primary font-medium">
                        <div className="text-xs sm:text-sm">{student.username}</div>
                        <div className="text-[10px] sm:text-xs text-text-secondary">{student.email}</div>
                      </td>
                      {gradebookData.assignments.map((assignment: any) => {
                        const cell = gradebookData.gradebook[student.id][assignment.id];
                        let bgColor = 'bg-red-900/30'; // Не сдано
                        let textColor = 'text-red-400';
                        let content = '—';

                        if (cell.submitted) {
                          if (cell.graded) {
                            // Сдано и проверено
                            bgColor = 'bg-green-900/30';
                            textColor = 'text-green-400';

                            // Форматируем оценку в зависимости от типа
                            const scoreStr = String(cell.score);
                            const formattedScore = scoreStr.endsWith('.0')
                              ? scoreStr.slice(0, -2)
                              : scoreStr;

                            if (assignment.grading_type === 'numeric') {
                              content = `${formattedScore} (${assignment.grade_min}-${assignment.grade_max})`;
                            } else {
                              content = formattedScore;
                            }
                          } else {
                            // Сдано, но не проверено
                            bgColor = 'bg-warning-bg';
                            textColor = 'text-warning';
                            content = 'Ожидает';
                          }
                        }

                        // Формируем подсказку для множественных попыток
                        const tooltipText = cell.has_multiple_attempts && cell.graded
                          ? assignment.grading_type === 'numeric'
                            ? `Максимальная оценка из ${cell.attempts} попыток`
                            : `Последняя оценка из ${cell.attempts} попыток`
                          : '';

                        return (
                          <td
                            key={assignment.id}
                            className={`border border-border-color p-1.5 sm:p-2 text-center ${bgColor} ${textColor} cursor-pointer hover:opacity-80 relative`}
                            onClick={() =>
                              cell.submitted && navigate(`/assignments/${assignment.id}`)
                            }
                            title={tooltipText}
                          >
                            <div className="flex flex-col gap-0.5">
                              <div className="font-medium text-xs sm:text-sm">{content}</div>
                              {cell.has_multiple_attempts && (
                                <div className="flex items-center justify-center gap-1 text-[10px] sm:text-xs opacity-70">
                                  <span className="inline-block w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-current"></span>
                                  <span>{cell.attempts} {cell.attempts === 1 ? 'попытка' : cell.attempts < 5 ? 'попытки' : 'попыток'}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'ungraded' && course.is_creator && (
          <div className="space-y-4">
            {ungradedSubmissions.length === 0 ? (
              <div className="text-center text-text-secondary py-12">
                Все работы проверены
              </div>
            ) : (
              ungradedSubmissions.map((submission) => (
                <Link
                  key={submission.submission_id}
                  to={`/assignments/${submission.assignment_id}`}
                  className="block card hover:border-primary/50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary mb-1">
                        {submission.assignment_title}
                      </h3>
                      <p className="text-sm text-text-secondary">
                        Студент: <span className="text-white">{submission.student_name}</span>
                      </p>
                    </div>
                    <span className="text-warning text-sm bg-warning-bg px-3 py-1 rounded-full">
                      Не проверено
                    </span>
                  </div>
                  <p className="text-xs text-text-tertiary mb-2">
                    Сдано: {new Date(submission.submitted_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {submission.content && (
                    <div className="mt-3 p-3 bg-bg-primary rounded border border-border-color">
                      <p className="text-xs text-text-secondary mb-1">Текст ответа:</p>
                      <p className="text-sm text-text-primary line-clamp-3">{submission.content}</p>
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        )}

        {tab === 'members' && course.is_creator && (
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="card flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium">{member.username}</p>
                    {member.user_id === course.creator_id && (
                      <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
                        Создатель
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary">{member.email}</p>
                </div>
                {member.user_id !== user?.id && (
                  <button
                    onClick={() => handleRemoveMember(member.id, member.user_id)}
                    className="text-red-500 hover:text-red-400 text-sm"
                  >
                    Удалить
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Создать задание">
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Название</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Тип оценки</label>
            <select
              value={gradingType}
              onChange={(e) => setGradingType(e.target.value as 'numeric' | 'text')}
              className="input"
            >
              <option value="numeric">Числовая оценка</option>
              <option value="text">Текстовая оценка</option>
            </select>
          </div>

          {gradingType === 'numeric' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">От</label>
                <input
                  type="number"
                  value={gradeMin}
                  onChange={(e) => setGradeMin(Number(e.target.value))}
                  className="input"
                  step="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">До</label>
                <input
                  type="number"
                  value={gradeMax}
                  onChange={(e) => setGradeMax(Number(e.target.value))}
                  className="input"
                  step="1"
                  required
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Варианты оценок (минимум 2)
              </label>
              <div className="space-y-2 mb-2">
                {gradeOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...gradeOptions];
                        newOptions[index] = e.target.value;
                        setGradeOptions(newOptions);
                      }}
                      className="input flex-1"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setGradeOptions(gradeOptions.filter((_, i) => i !== index))}
                      className="text-red-400 hover:text-red-300 px-2"
                      disabled={gradeOptions.length <= 2}
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={textGradeInput}
                  onChange={(e) => setTextGradeInput(e.target.value)}
                  className="input flex-1"
                  placeholder="Новый вариант оценки"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (textGradeInput.trim()) {
                      setGradeOptions([...gradeOptions, textGradeInput.trim()]);
                      setTextGradeInput('');
                    }
                  }}
                  className="btn-secondary"
                >
                  Добавить
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Количество попыток
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={maxAttemptsEnabled}
                  onChange={(e) => setMaxAttemptsEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-text-secondary">Ограничить количество попыток</span>
              </label>

              {maxAttemptsEnabled && (
                <div>
                  <input
                    type="number"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Math.max(1, Number(e.target.value)))}
                    className="input w-full"
                    min="1"
                    required
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    {maxAttempts === 1
                      ? 'Студент сможет сдать работу только один раз'
                      : `Студент сможет сдать работу максимум ${maxAttempts} раз`}
                  </p>
                </div>
              )}
              {!maxAttemptsEnabled && (
                <p className="text-xs text-text-tertiary">
                  Студент сможет пересдавать работу неограниченное количество раз
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Файлы (необязательно)
            </label>
            <FileUploadZone
              files={assignmentFiles}
              onFilesChange={setAssignmentFiles}
              multiple={true}
              maxFiles={10}
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={uploadingFiles}>
            {uploadingFiles ? 'Загрузка файлов...' : 'Создать'}
          </button>
        </form>
      </Modal>

      <Modal isOpen={editCourseModalOpen} onClose={() => setEditCourseModalOpen(false)} title="Редактировать курс">
        <form onSubmit={handleEditCourse} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Название</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Описание</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="input"
              rows={3}
              maxLength={5000}
            />
          </div>

          <button type="submit" className="btn-primary w-full">
            Сохранить
          </button>
        </form>
      </Modal>
    </div>
  );
};
