import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { AccessDenied } from '../components/AccessDenied';
import { AssignmentDetails } from '../components/assignment/AssignmentDetails';
import { StudentSubmissionForm } from '../components/assignment/StudentSubmissionForm';
import { TeacherSubmissionsList } from '../components/assignment/TeacherSubmissionsList';
import { GradingForm } from '../components/assignment/GradingForm';
import { AssignmentChat } from '../components/assignment/AssignmentChat';
import { EditAssignmentModal } from '../components/assignment/EditAssignmentModal';
import { ReviewAnnotatorModal } from '../components/assignment/ReviewAnnotatorModal';
import { useWebSocket, useAssignmentSubscription, useCourseSubscription } from '../hooks/useWebSocket';
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
  markSubmissionViewed,
  markAssignmentAsRead,
  prepareSubmissionFileReview,
  downloadSubmissionFeedbackFile,
  deleteSubmissionFeedbackFile,
} from '../api/api';
import { useAuthStore } from '../store/authStore';
import { useAlertStore } from '../store/alertStore';
import { useConfirmStore } from '../store/confirmStore';
import type {
  Assignment,
  Message,
  Submission,
  Course,
  ReviewAsset,
  SubmissionFile,
  SubmissionFeedbackFile,
} from '../types';

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
  const [isSendingMessage, setIsSendingMessage] = useState(false);
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
  const [reviewAsset, setReviewAsset] = useState<ReviewAsset | null>(null);
  const [reviewSubmissionId, setReviewSubmissionId] = useState<number | null>(null);
  const [isAnnotatorOpen, setIsAnnotatorOpen] = useState(false);
  const [preparingReviewFileId, setPreparingReviewFileId] = useState<number | null>(null);
  const [downloadingFeedbackFileId, setDownloadingFeedbackFileId] = useState<number | null>(null);
  const [deletingFeedbackFileId, setDeletingFeedbackFileId] = useState<number | null>(null);
  const [feedbackFileToReplaceId, setFeedbackFileToReplaceId] = useState<number | null>(null);

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

  // Подписываемся на WebSocket обновления задания
  useAssignmentSubscription(id ? Number(id) : null);

  // Подписываемся на обновления курса (для событий assignment_updated/deleted)
  useCourseSubscription(course?.id || null);

  // Обработчик новых сообщений в чате
  const handleNewChatMessage = useCallback((data: Message) => {
    console.log('New chat message received:', data);
    setMessages((prev) => [...prev, data]);
    setTimeout(() => scrollToBottom(), 100);
  }, []);

  // Обработчик удаления сообщения
  const handleChatMessageDeleted = useCallback((data: { message_id: number }) => {
    console.log('Chat message deleted:', data);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === data.message_id
          ? { ...msg, is_deleted: true, message: '[Deleted]' }
          : msg
      )
    );
  }, []);

  // Обработчик новой сдачи работы
  const handleSubmissionCreated = useCallback((data: Submission) => {
    console.log('New submission created:', data);
    if (isTeacher) {
      setAllSubmissions((prev) => [data, ...prev]);
    } else if (data.student_id === user?.id) {
      setMySubmissions((prev) => [data, ...prev]);
    }
  }, [isTeacher, user]);

  // Обработчик оценивания работы
  const handleSubmissionGraded = useCallback((data: Submission) => {
    console.log('Submission graded:', data);
    if (isTeacher) {
      setAllSubmissions((prev) =>
        prev.map((sub) => (sub.id === data.id ? data : sub))
      );
    }
    if (data.student_id === user?.id) {
      setMySubmissions((prev) =>
        prev.map((sub) => (sub.id === data.id ? data : sub))
      );
      addAlert(`Ваша работа оценена! Оценка: ${data.score}`, 'success');
    }
    setSelectedSubmission((prev) => (prev && prev.id === data.id ? data : prev));
  }, [isTeacher, user, addAlert]);

  // Обработчик обновления сдачи
  const handleSubmissionUpdated = useCallback((data: Submission) => {
    console.log('Submission updated:', data);
    if (isTeacher) {
      setAllSubmissions((prev) =>
        prev.map((sub) => (sub.id === data.id ? data : sub))
      );
    }
    if (data.student_id === user?.id) {
      setMySubmissions((prev) =>
        prev.map((sub) => (sub.id === data.id ? data : sub))
      );
    }
    setSelectedSubmission((prev) => (prev && prev.id === data.id ? data : prev));
  }, [isTeacher, user]);

  // Обработчик удаления сдачи
  const handleSubmissionDeleted = useCallback((data: { submission_id: number }) => {
    console.log('Submission deleted:', data);
    setAllSubmissions((prev) =>
      prev.filter((sub) => sub.id !== data.submission_id)
    );
    setMySubmissions((prev) =>
      prev.filter((sub) => sub.id !== data.submission_id)
    );
  }, []);

  // Обработчик просмотра сдачи учителем
  const handleSubmissionViewed = useCallback((data: Submission) => {
    console.log('Submission viewed by teacher:', data);
    if (data.student_id === user?.id) {
      setMySubmissions((prev) =>
        prev.map((sub) => (sub.id === data.id ? data : sub))
      );
    }
    if (isTeacher) {
      setAllSubmissions((prev) =>
        prev.map((sub) => (sub.id === data.id ? data : sub))
      );
    }
    setSelectedSubmission((prev) => (prev && prev.id === data.id ? data : prev));
  }, [isTeacher, user]);

  // Обработчик обновления задания
  const handleAssignmentUpdated = useCallback((data: Assignment) => {
    console.log('Assignment updated:', data);
    // Проверяем, что это наше задание
    if (data.id === Number(id)) {
      setAssignment(data);
      addAlert('Задание обновлено', 'info');
    }
  }, [id, addAlert]);

  // Обработчик удаления задания
  const handleAssignmentDeleted = useCallback((data: { assignment_id: number }) => {
    console.log('Assignment deleted:', data);
    // Проверяем, что это наше задание
    if (data.assignment_id === Number(id)) {
      addAlert('Задание было удалено', 'warning');
      if (course?.id) {
        navigate(`/courses/${course.id}`);
      } else {
        navigate('/');
      }
    }
  }, [id, course, navigate, addAlert]);

  // Подписываемся на WebSocket события
  useWebSocket('chat_message', handleNewChatMessage, []);
  useWebSocket('chat_message_deleted', handleChatMessageDeleted, []);
  useWebSocket('submission_created', handleSubmissionCreated, [isTeacher, user]);
  useWebSocket('submission_updated', handleSubmissionUpdated, [isTeacher, user]);
  useWebSocket('submission_graded', handleSubmissionGraded, [isTeacher, user, addAlert]);
  useWebSocket('submission_deleted', handleSubmissionDeleted, []);
  useWebSocket('submission_viewed', handleSubmissionViewed, [isTeacher, user]);
  useWebSocket('assignment_updated', handleAssignmentUpdated, [id, addAlert]);
  useWebSocket('assignment_deleted', handleAssignmentDeleted, [id, course, navigate, addAlert]);

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

      // Помечаем задание как прочитанное (только для студентов)
      if (courseData && user && courseData.creator_id !== user.id) {
        try {
          await markAssignmentAsRead(Number(id));

          // Отправляем событие об обновлении счётчика и плашек
          window.dispatchEvent(new CustomEvent('assignment-visited', {
            detail: { assignmentId: Number(id), courseId: data.course_id }
          }));
        } catch (err) {
          console.error('Failed to mark assignment as read:', err);
        }
      }

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

  const loadAllSubmissions = async (preserveSelectedSubmissionId?: number) => {
    try {
      const data = await getAssignmentSubmissions(Number(id));
      setAllSubmissions(data);

      if (preserveSelectedSubmissionId) {
        const nextSelected = data.find((item) => item.id === preserveSelectedSubmissionId) || null;
        setSelectedSubmission(nextSelected);
        if (nextSelected) {
          setGradeScore(nextSelected.score?.toString() || '');
          setGradeComment(nextSelected.teacher_comment || '');
        }
      }
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
    if (!newMessage.trim() || isSendingMessage) return; 

    setIsSendingMessage(true);

    try {
      const message = await sendMessage(Number(id), { message: newMessage });
      setMessages([...messages, message]);
      setNewMessage('');
      setTimeout(() => scrollToBottom(), 100);
    } catch (err) {
      addAlert('Ошибка отправки сообщения', 'error');
    } finally {
      setIsSendingMessage(false);
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

  const handleOpenAnnotator = async (file: SubmissionFile, replaceFileId: number | null = null) => {
    if (!selectedSubmission) {
      return;
    }

    setPreparingReviewFileId(file.id);
    try {
      const preparedAsset = await prepareSubmissionFileReview(selectedSubmission.id, file.id);
      setReviewAsset(preparedAsset);
      setReviewSubmissionId(selectedSubmission.id);
      setFeedbackFileToReplaceId(replaceFileId);
      setIsAnnotatorOpen(true);
    } catch (err: any) {
      addAlert(err.response?.data?.detail || 'Не удалось подготовить файл к проверке', 'error');
    } finally {
      setPreparingReviewFileId(null);
    }
  };

  const handleCloseAnnotator = () => {
    setIsAnnotatorOpen(false);
    setReviewAsset(null);
    setReviewSubmissionId(null);
    setFeedbackFileToReplaceId(null);
  };

  const handleAnnotatorSaved = async () => {
    if (!reviewSubmissionId) {
      return;
    }
    await loadAllSubmissions(reviewSubmissionId);
  };

  const handleDownloadFeedbackFile = async (feedbackFile: SubmissionFeedbackFile) => {
    setDownloadingFeedbackFileId(feedbackFile.id);
    try {
      const blob = await downloadSubmissionFeedbackFile(feedbackFile.submission_id, feedbackFile.id);
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = feedbackFile.file_name;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(objectUrl);
      document.body.removeChild(link);
    } catch (err: any) {
      addAlert(err.response?.data?.detail || 'Не удалось скачать файл преподавателя', 'error');
    } finally {
      setDownloadingFeedbackFileId(null);
    }
  };

  const handleEditFeedbackFile = async (feedbackFile: SubmissionFeedbackFile) => {
    if (!selectedSubmission) {
      return;
    }

    if (!feedbackFile.source_submission_file_id) {
      addAlert('Невозможно открыть редактирование: исходный файл не найден', 'warning');
      return;
    }

    const sourceFile = selectedSubmission.files.find(
      (file) => file.id === feedbackFile.source_submission_file_id
    );
    if (!sourceFile) {
      addAlert('Невозможно открыть редактирование: исходный файл удален', 'warning');
      return;
    }

    await handleOpenAnnotator(sourceFile, feedbackFile.id);
  };

  const handleDeleteFeedbackFile = async (feedbackFile: SubmissionFeedbackFile) => {
    const confirmed = await confirm('Удалить файл с пометками преподавателя?');
    if (!confirmed) return;

    setDeletingFeedbackFileId(feedbackFile.id);
    try {
      await deleteSubmissionFeedbackFile(feedbackFile.submission_id, feedbackFile.id);
      if (selectedSubmission) {
        await loadAllSubmissions(selectedSubmission.id);
      } else {
        await loadAllSubmissions();
      }
      addAlert('Файл с пометками удален', 'success');
    } catch (err: any) {
      addAlert(err.response?.data?.detail || 'Не удалось удалить файл с пометками', 'error');
    } finally {
      setDeletingFeedbackFileId(null);
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
    // Преобразуем UTC datetime в локальное время для datetime-local input
    if (assignment.due_date) {
      const localDate = new Date(assignment.due_date);
      const year = localDate.getFullYear();
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const day = String(localDate.getDate()).padStart(2, '0');
      const hours = String(localDate.getHours()).padStart(2, '0');
      const minutes = String(localDate.getMinutes()).padStart(2, '0');
      setEditDueDate(`${year}-${month}-${day}T${hours}:${minutes}`);
    } else {
      setEditDueDate('');
    }
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
        due_date: editDueDate ? new Date(editDueDate).toISOString() : undefined,
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
    // Парсим как UTC и конвертируем в локальное время
    let date: Date;
    if (dateString.endsWith('Z') || dateString.includes('+')) {
      date = new Date(dateString);
    } else {
      date = new Date(dateString + 'Z');
    }
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
                onDownloadFeedbackFile={handleDownloadFeedbackFile}
                downloadingFeedbackFileId={downloadingFeedbackFileId}
                formatDate={formatDate}
              />
            ) : (
              /* Teacher: Submissions List */
              <TeacherSubmissionsList
                allSubmissions={allSubmissions}
                assignment={assignment}
                selectedSubmission={selectedSubmission}
                onSelectSubmission={async (submission) => {
                  setSelectedSubmission(submission);
                  setGradeScore(submission.score?.toString() || '');
                  setGradeComment(submission.teacher_comment || '');

                  // Помечаем сдачу как просмотренную учителем
                  try {
                    const updated = await markSubmissionViewed(submission.id);
                    // Обновляем сдачу в списке
                    setAllSubmissions(prev =>
                      prev.map(s => s.id === updated.id ? updated : s)
                    );
                  } catch (err) {
                    console.error('Failed to mark submission as viewed:', err);
                  }
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
                  isPreparingReviewFileId={preparingReviewFileId}
                  isDownloadingFeedbackFileId={downloadingFeedbackFileId}
                  isDeletingFeedbackFileId={deletingFeedbackFileId}
                  onOpenAnnotator={handleOpenAnnotator}
                  onDownloadFeedbackFile={handleDownloadFeedbackFile}
                  onEditFeedbackFile={handleEditFeedbackFile}
                  onDeleteFeedbackFile={handleDeleteFeedbackFile}
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
              isSending={isSendingMessage}
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

      <ReviewAnnotatorModal
        isOpen={isAnnotatorOpen}
        submissionId={reviewSubmissionId}
        reviewAsset={reviewAsset}
        feedbackFileToReplaceId={feedbackFileToReplaceId}
        onClose={handleCloseAnnotator}
        onSaved={handleAnnotatorSaved}
      />

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
