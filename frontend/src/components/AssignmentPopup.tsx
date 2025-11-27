import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { getAssignmentAdmin, getAssignmentSubmissionsAdmin } from '../api/api';
import type { Assignment, Submission } from '../types';

interface AssignmentPopupProps {
  assignmentId: number;
  isOpen: boolean;
  onClose: () => void;
}

export const AssignmentPopup = ({ assignmentId, isOpen, onClose }: AssignmentPopupProps) => {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && assignmentId) {
      loadAssignmentData();
    }
  }, [isOpen, assignmentId]);

  const loadAssignmentData = async () => {
    setLoading(true);
    try {
      // Используем админские эндпоинты для получения данных
      const [assignmentData, submissionsData] = await Promise.all([
        getAssignmentAdmin(assignmentId),
        getAssignmentSubmissionsAdmin(assignmentId)
      ]);
      
      setAssignment(assignmentData);
      setSubmissions(submissionsData);
    } catch (error) {
      console.error('Failed to load assignment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatGradeOptions = (assignment: Assignment) => {
    if (assignment.grading_type === 'numeric') {
      return `${assignment.grade_min ?? 'не указан'} - ${assignment.grade_max ?? 'не указан'}`;
    } else {
      try {
        const options = assignment.grade_options ? JSON.parse(assignment.grade_options) : [];
        return options.length > 0 ? options.join(', ') : 'не указаны';
      } catch {
        return 'не указаны';
      }
    }
  };

  const getSubmissionStatus = (submission: Submission) => {
    if (submission.graded_at) {
      return { text: 'Проверено', color: 'text-green-400' };
    } else if (submission.score !== null) {
      return { text: 'На проверке', color: 'text-yellow-400' };
    } else {
      return { text: 'Не проверено', color: 'text-red-400' };
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Задание и сдачи учеников" size="full">
      <div className="space-y-6">
        {loading ? (
          <div className="text-center text-text-secondary py-8">Загрузка...</div>
        ) : assignment ? (
          <>
            {/* Информация о задании */}
            <div className="bg-bg-secondary rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">{assignment.title}</h2>
              
              {assignment.description && (
                <div className="mb-4">
                  <h3 className="text-white font-medium mb-2">Описание:</h3>
                  <p className="text-text-secondary whitespace-pre-wrap">{assignment.description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-text-tertiary">Тип оценивания:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                    assignment.grading_type === 'numeric' 
                      ? 'bg-blue-500/20 text-blue-400' 
                      : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {assignment.grading_type === 'numeric' ? 'Числовая оценка' : 'Текстовая оценка'}
                  </span>
                </div>

                <div>
                  <span className="text-text-tertiary">Возможные оценки:</span>
                  <span className="ml-2 text-white">{formatGradeOptions(assignment)}</span>
                </div>

                {assignment.due_date && (
                  <div>
                    <span className="text-text-tertiary">Срок сдачи:</span>
                    <span className="ml-2 text-white">
                      {new Date(assignment.due_date).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                )}

                <div>
                  <span className="text-text-tertiary">Попытки:</span>
                  <span className="ml-2 text-white">
                    {assignment.max_attempts ? assignment.max_attempts : 'не ограничено'}
                  </span>
                </div>

                <div>
                  <span className="text-text-tertiary">Дата создания:</span>
                  <span className="ml-2 text-white">
                    {new Date(assignment.created_at).toLocaleDateString('ru-RU')}
                  </span>
                </div>

                <div>
                  <span className="text-text-tertiary">Всего сдач:</span>
                  <span className="ml-2 text-white">{submissions.length}</span>
                </div>
              </div>

              {/* Файлы задания */}
              {assignment.files && assignment.files.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-white font-medium mb-2">Файлы задания:</h3>
                  <div className="flex flex-wrap gap-2">
                    {assignment.files.map((file) => (
                            <a
                              key={file.id}
                              href={`/admin/assignments/${assignment.id}/files/${file.id}/download`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 bg-bg-primary hover:bg-bg-hover px-3 py-2 rounded text-text-secondary hover:text-white transition-colors text-sm border border-border-color"
                              title={`Скачать ${file.file_name}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {file.file_name}
                            </a>
                          ))}
                  </div>
                </div>
              )}
            </div>

            {/* Сдачи учеников */}
            <div>
              <h3 className="text-white font-medium mb-4">Сдачи учеников ({submissions.length})</h3>
              
              {submissions.length > 0 ? (
                <div className="space-y-3">
                  {submissions.map((submission) => {
                    const status = getSubmissionStatus(submission);
                    return (
                      <div key={submission.id} className="bg-bg-secondary rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="text-white font-medium">
                              {submission.student_name || `Студент #${submission.student_id}`}
                            </h4>
                            <p className="text-text-tertiary text-sm">
                              Сдано: {new Date(submission.submitted_at).toLocaleDateString('ru-RU')}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-medium ${status.color}`}>
                              {status.text}
                            </span>
                            {submission.score && (
                              <div className="text-white font-bold text-lg">
                                Оценка: {submission.score}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Содержание сдачи */}
                        {submission.content && (
                          <div className="mb-3">
                            <h5 className="text-text-secondary text-sm mb-1">Содержание:</h5>
                            <p className="text-text-primary text-sm whitespace-pre-wrap">{submission.content}</p>
                          </div>
                        )}

                        {/* Комментарий учителя */}
                        {submission.teacher_comment && (
                          <div className="mb-3">
                            <h5 className="text-text-secondary text-sm mb-1">Комментарий учителя:</h5>
                            <p className="text-text-primary text-sm whitespace-pre-wrap bg-bg-primary p-2 rounded">
                              {submission.teacher_comment}
                            </p>
                          </div>
                        )}

                        {/* Файлы сдачи */}
                        {submission.files && submission.files.length > 0 && (
                          <div>
                            <h5 className="text-text-secondary text-sm mb-2">Прикрепленные файлы:</h5>
                            <div className="flex flex-wrap gap-2">
                              {submission.files.map((file) => (
                                  <a
                                    key={file.id}
                                    href={`/admin/submissions/${submission.id}/files/${file.id}/download`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 bg-bg-primary hover:bg-bg-hover px-3 py-2 rounded text-text-secondary hover:text-white transition-colors text-sm border border-border-color"
                                    title={`Скачать ${file.file_name}`}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    {file.file_name}
                                  </a>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-text-secondary py-8 bg-bg-secondary rounded-lg">
                  Сдачи пока отсутствуют
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center text-text-secondary py-8">
            Не удалось загрузить информацию о задании
          </div>
        )}
      </div>
    </Modal>
  );
};