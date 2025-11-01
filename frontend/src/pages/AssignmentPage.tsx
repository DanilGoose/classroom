import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { AccessDenied } from '../components/AccessDenied';
import { AssignmentDetails } from '../components/assignment/AssignmentDetails';
import { StudentSubmissionForm } from '../components/assignment/StudentSubmissionForm';
import { TeacherSubmissionsList } from '../components/assignment/TeacherSubmissionsList';
import { GradingForm } from '../components/assignment/GradingForm';
import { AssignmentChat } from '../components/assignment/AssignmentChat';
import { EditAssignmentModal } from '../components/assignment/EditAssignmentModal';
import {
  getAssignment,
  getMessages,
  sendMessage,
  deleteMessage,
  uploadFile,
  deleteFile,
  submitAssignment,
  getMySubmission,
  uploadSubmissionFile,
  getAssignmentSubmissions,
  gradeSubmission,
  getCourse,
  updateAssignment,
  deleteSubmission,
  deleteAssignment,
  getMyAttemptsInfo,
} from '../api/api';
import { useAuthStore } from '../store/authStore';
import { useAlertStore } from '../store/alertStore';
import { useConfirmStore } from '../store/confirmStore';
import type { Assignment, Message, Submission, Course } from '../types';

export const AssignmentPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addAlert } = useAlertStore();
  const { confirm } = useConfirmStore();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Submission states
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [submissionContent, setSubmissionContent] = useState('');
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [uploadingSubmissionFiles, setUploadingSubmissionFiles] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeComment, setGradeComment] = useState('');
  const [totalAttempts, setTotalAttempts] = useState(0);

  // Edit assignment states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editError, setEditError] = useState('');
  const [editGradingType, setEditGradingType] = useState<'numeric' | 'text'>('numeric');
  const [editGradeMin, setEditGradeMin] = useState(2);
  const [editGradeMax, setEditGradeMax] = useState(5);
  const [editGradeOptions, setEditGradeOptions] = useState<string[]>([]);
  const [editTextGradeInput, setEditTextGradeInput] = useState('');
  const [editMaxAttemptsEnabled, setEditMaxAttemptsEnabled] = useState(false);
  const [editMaxAttempts, setEditMaxAttempts] = useState(1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isTeacher = !!(course && user && course.creator_id === user.id);
  const isArchived = !!(course && course.is_archived === 1);

  useEffect(() => {
    if (id) {
      loadAssignment();
      loadMessages();
      loadMySubmission();
    }
  }, [id]);

  useEffect(() => {
    if (assignment && isTeacher) {
      loadAllSubmissions();
    }
  }, [assignment, isTeacher]);

  const loadAssignment = async () => {
    try {
      const data = await getAssignment(Number(id));
      setAssignment(data);

      // Load course info
      const courseData = await getCourse(data.course_id);
      setCourse(courseData);

      // Сохраняем courseId для навигации кнопки "Назад"
      sessionStorage.setItem(`assignment_${id}_course`, String(data.course_id));
    } catch (err) {
      console.error('Failed to load assignment');
      setAccessDenied(true);
    } finally {
      setLoading(false);
    }
  };

  const loadMySubmission = async () => {
    try {
      const data = await getMySubmission(Number(id));
      setMySubmissions(data);

      // Загружаем информацию о попытках (включая удалённые)
      const attemptsInfo = await getMyAttemptsInfo(Number(id));
      setTotalAttempts(attemptsInfo.total_attempts);
    } catch (err) {
      // No submission yet
      setMySubmissions([]);
      setTotalAttempts(0);
    }
  };

  const loadAllSubmissions = async () => {
    try {
      const data = await getAssignmentSubmissions(Number(id));
      setAllSubmissions(data);
    } catch (err) {
      console.error('Failed to load submissions');
    }
  };

  const loadMessages = async (offset = 0) => {
    try {
      const data = await getMessages(Number(id), offset, 10);
      if (data.length < 10) {
        setHasMore(false);
      }
      if (offset === 0) {
        setMessages(data.reverse());
        setTimeout(() => scrollToBottom(), 100);
      } else {
        setMessages([...data.reverse(), ...messages]);
      }
    } catch (err) {
      console.error('Failed to load messages');
    }
  };


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const message = await sendMessage(Number(id), { message: newMessage });
      setMessages([...messages, message]);
      setNewMessage('');
      setTimeout(() => scrollToBottom(), 100);
    } catch (err) {
      addAlert('Ошибка отправки сообщения', 'error');
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    const confirmed = await confirm('Удалить сообщение?');
    if (!confirmed) return;

    try {
      await deleteMessage(messageId);
      setMessages(messages.map((m) =>
        m.id === messageId ? { ...m, is_deleted: true, message: '[Удалено]' } : m
      ));
    } catch (err) {
      addAlert('Ошибка удаления сообщения', 'error');
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await loadMessages(messages.length);
    setLoadingMore(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadFile(Number(id), file);
      await loadAssignment();
      addAlert('Файл загружен', 'success');
    } catch (err: any) {
      addAlert(err.response?.data?.detail || 'Ошибка загрузки файла', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    const confirmed = await confirm('Удалить файл?');
    if (!confirmed) return;

    try {
      await deleteFile(Number(id), fileId);
      await loadAssignment();
      addAlert('Файл удален', 'success');
    } catch (err: any) {
      addAlert(err.response?.data?.detail || 'Ошибка удаления файла', 'error');
    }
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();

    // Проверка, что сдача не пустая
    if (!submissionContent.trim() && submissionFiles.length === 0) {
      addAlert('Необходимо добавить текст ответа или прикрепить файлы', 'warning');
      return;
    }

    setSubmissionLoading(true);
    let fileUploadError = false;
    let fileUploadErrorMessage = '';

    try {
      const data = await submitAssignment(Number(id), { content: submissionContent });

      // Загрузка файлов, если они есть
      if (submissionFiles.length > 0) {
        setUploadingSubmissionFiles(true);
        try {
          for (const file of submissionFiles) {
            await uploadSubmissionFile(data.id, file);
          }
        } catch (err: any) {
          console.error('Error uploading files:', err);
          fileUploadError = true;
          fileUploadErrorMessage = err.response?.data?.detail || 'Не удалось загрузить файлы';

          // Удаляем созданную сдачу, если файлы не загрузились
          try {
            await deleteSubmission(data.id);
          } catch (deleteErr) {
            console.error('Error deleting submission:', deleteErr);
          }
        } finally {
          setUploadingSubmissionFiles(false);
        }
      }

      // Если была ошибка загрузки файлов, показываем её и не продолжаем
      if (fileUploadError) {
        addAlert(`Ошибка: ${fileUploadErrorMessage}\nСдача не была сохранена.`, 'error');
        return;
      }

      // Очищаем поле ввода и перезагружаем список сдач
      setSubmissionContent('');
      setSubmissionFiles([]);

      // Сохраняем старое значение для проверки
      const hadPreviousSubmissions = mySubmissions.length > 0;

      await loadMySubmission();

      // Показываем сообщение об успехе
      addAlert(hadPreviousSubmissions ? 'Новая попытка отправлена' : 'Задание сдано', 'success');
    } catch (err: any) {
      addAlert(err.response?.data?.detail || 'Ошибка сдачи задания', 'error');
    } finally {
      setSubmissionLoading(false);
    }
  };

  const handleDeleteSubmission = async (submissionId: number) => {
    // Формируем сообщение в зависимости от наличия лимита попыток
    let confirmMessage = 'Удалить эту попытку? Это действие нельзя отменить.';

    if (assignment?.max_attempts !== null && assignment?.max_attempts !== undefined) {
      confirmMessage = `⚠️ ВНИМАНИЕ: У этого задания ограниченное количество попыток (${assignment.max_attempts}).\n\nУдаление попытки не вернёт её обратно - она всё равно будет учитываться в общем счётчике попыток.\n\nВы уверены, что хотите удалить эту попытку?`;
    }

    const confirmed = await confirm(confirmMessage);
    if (!confirmed) return;

    try {
      await deleteSubmission(submissionId);
      await loadMySubmission();
      setSubmissionContent('');
      addAlert('Попытка удалена', 'success');
    } catch (err: any) {
      addAlert(err.response?.data?.detail || 'Ошибка удаления попытки', 'error');
    }
  };

  const handleGradeSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission || !assignment) return;

    // Определяем оценку в зависимости от типа
    let score: number | string;
    if (assignment.grading_type === 'numeric') {
      const numScore = parseFloat(gradeScore);
      if (isNaN(numScore)) {
        addAlert('Введите корректную оценку', 'error');
        return;
      }
      // Проверка диапазона для числовой оценки
      if (assignment.grade_min !== null && numScore < assignment.grade_min) {
        addAlert(`Оценка не может быть меньше ${assignment.grade_min}`, 'error');
        return;
      }
      if (assignment.grade_max !== null && numScore > assignment.grade_max) {
        addAlert(`Оценка не может быть больше ${assignment.grade_max}`, 'error');
        return;
      }
      score = numScore;
    } else {
      // Для текстовой оценки
      if (!gradeScore) {
        addAlert('Выберите оценку', 'error');
        return;
      }
      score = gradeScore;
    }

    try {
      await gradeSubmission(selectedSubmission.id, {
        score,
        teacher_comment: gradeComment || undefined,
      });
      await loadAllSubmissions();
      addAlert('Оценка выставлена', 'success');
      setSelectedSubmission(null);
      setGradeScore('');
      setGradeComment('');
    } catch (err: any) {
      addAlert(err.response?.data?.detail || 'Ошибка выставления оценки', 'error');
    }
  };

  const handleDeleteAssignment = async () => {
    if (!assignment || !course) return;

    const confirmed = await confirm('Удалить это задание? Это действие нельзя отменить.\n\nБудут удалены все сдачи студентов и файлы задания.');
    if (!confirmed) return;

    try {
      await deleteAssignment(Number(id));
      // Очищаем сохранённый courseId для этого задания
      sessionStorage.removeItem(`assignment_${id}_course`);
      addAlert('Задание удалено', 'success');
      // Используем replace: true чтобы заменить текущую страницу в истории
      navigate(`/courses/${course.id}`, { replace: true });
    } catch (err: any) {
      addAlert(err.response?.data?.detail || 'Ошибка удаления задания', 'error');
    }
  };



  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const openEditModal = () => {
    if (!assignment) return;
    setEditTitle(assignment.title);
    setEditDescription(assignment.description || '');
    setEditDueDate(assignment.due_date ? assignment.due_date.split('T')[0] : '');
    setEditGradingType(assignment.grading_type);
    setEditGradeMin(assignment.grade_min || 2);
    setEditGradeMax(assignment.grade_max || 5);

    // Парсим grade_options из JSON строки
    if (assignment.grade_options) {
      try {
        const options = JSON.parse(assignment.grade_options);
        setEditGradeOptions(Array.isArray(options) ? options : []);
      } catch {
        setEditGradeOptions([]);
      }
    } else {
      setEditGradeOptions([]);
    }

    // Устанавливаем max_attempts
    if (assignment.max_attempts !== null && assignment.max_attempts !== undefined) {
      setEditMaxAttemptsEnabled(true);
      setEditMaxAttempts(assignment.max_attempts);
    } else {
      setEditMaxAttemptsEnabled(false);
      setEditMaxAttempts(1);
    }

    setEditTextGradeInput('');
    setEditError('');
    setEditModalOpen(true);
  };

  const handleEditAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    // Валидация для текстового типа оценки
    if (editGradingType === 'text' && editGradeOptions.length < 2) {
      setEditError('Для текстовой оценки нужно минимум 2 варианта');
      return;
    }

    try {
      const updatedAssignment = await updateAssignment(Number(id), {
        title: editTitle,
        description: editDescription,
        due_date: editDueDate || undefined,
        grading_type: editGradingType,
        grade_min: editGradingType === 'numeric' ? editGradeMin : undefined,
        grade_max: editGradingType === 'numeric' ? editGradeMax : undefined,
        grade_options: editGradingType === 'text' ? editGradeOptions : undefined,
        max_attempts: editMaxAttemptsEnabled ? editMaxAttempts : null,
      });
      setAssignment(updatedAssignment);
      setEditModalOpen(false);
      addAlert('Задание обновлено', 'success');
    } catch (err: any) {
      setEditError(err.response?.data?.detail || 'Ошибка обновления задания');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
    return <AccessDenied message="Задание не найдено или у вас нет доступа к нему." type="not_found" />;
  }

  if (!assignment) return null;

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Assignment Details */}
        <AssignmentDetails
          assignment={assignment}
          isTeacher={isTeacher}
          isArchived={isArchived}
          onEdit={openEditModal}
          onDelete={handleDeleteAssignment}
          onFileUpload={handleFileUpload}
          onFileDelete={handleDeleteFile}
          uploading={uploading}
          fileInputRef={fileInputRef}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Left Column: Submission or Submissions List */}
          <div className="space-y-4 sm:space-y-6">
            {!isTeacher ? (
              /* Student Submission Form */
              <StudentSubmissionForm
                assignment={assignment}
                mySubmissions={mySubmissions}
                totalAttempts={totalAttempts}
                submissionContent={submissionContent}
                setSubmissionContent={setSubmissionContent}
                submissionFiles={submissionFiles}
                setSubmissionFiles={setSubmissionFiles}
                submissionLoading={submissionLoading}
                uploadingSubmissionFiles={uploadingSubmissionFiles}
                isArchived={isArchived}
                onSubmit={handleSubmitAssignment}
                onDeleteSubmission={handleDeleteSubmission}
                formatDate={formatDate}
              />
            ) : (
              /* Teacher: Submissions List */
              <TeacherSubmissionsList
                allSubmissions={allSubmissions}
                assignment={assignment}
                selectedSubmission={selectedSubmission}
                onSelectSubmission={(submission) => {
                  setSelectedSubmission(submission);
                  setGradeScore(submission.score?.toString() || '');
                  setGradeComment(submission.teacher_comment || '');
                }}
                formatDate={formatDate}
              />
            )}
          </div>

          {/* Right Column: Chat or Grading Interface */}
          <div className="space-y-4 sm:space-y-6">
            {isTeacher && selectedSubmission ? (
              <>
                {/* Grading Form */}
                <GradingForm
                  selectedSubmission={selectedSubmission}
                  assignment={assignment}
                  gradeScore={gradeScore}
                  setGradeScore={setGradeScore}
                  gradeComment={gradeComment}
                  setGradeComment={setGradeComment}
                  isArchived={isArchived}
                  onSubmit={handleGradeSubmission}
                />
              </>
            ) : null}

            {/* General Chat */}
            <AssignmentChat
              messages={messages}
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              hasMore={hasMore}
              loadingMore={loadingMore}
              isArchived={isArchived}
              onSendMessage={handleSendMessage}
              onDeleteMessage={handleDeleteMessage}
              onLoadMore={handleLoadMore}
              formatDate={formatDate}
              user={user}
              messagesEndRef={messagesEndRef}
            />
          </div>
        </div>
      </div>

      <EditAssignmentModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        editTitle={editTitle}
        setEditTitle={setEditTitle}
        editDescription={editDescription}
        setEditDescription={setEditDescription}
        editDueDate={editDueDate}
        setEditDueDate={setEditDueDate}
        editGradingType={editGradingType}
        setEditGradingType={setEditGradingType}
        editGradeMin={editGradeMin}
        setEditGradeMin={setEditGradeMin}
        editGradeMax={editGradeMax}
        setEditGradeMax={setEditGradeMax}
        editGradeOptions={editGradeOptions}
        setEditGradeOptions={setEditGradeOptions}
        editTextGradeInput={editTextGradeInput}
        setEditTextGradeInput={setEditTextGradeInput}
        editMaxAttemptsEnabled={editMaxAttemptsEnabled}
        setEditMaxAttemptsEnabled={setEditMaxAttemptsEnabled}
        editMaxAttempts={editMaxAttempts}
        setEditMaxAttempts={setEditMaxAttempts}
        editError={editError}
        onSubmit={handleEditAssignment}
      />
    </div>
  );
};
