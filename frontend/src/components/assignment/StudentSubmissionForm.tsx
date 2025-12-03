import { useState } from 'react';
import type { Assignment, Submission } from '../../types';
import { FileUploadZone } from '../FileUploadZone';
import { getFileUrl } from '../../api/axios';
import { isSubmittedOnTime } from '../../utils/deadline';
import { FullTextModal } from '../FullTextModal';

interface StudentSubmissionFormProps {
  assignment: Assignment;
  mySubmissions: Submission[];
  totalAttempts: number;
  submissionContent: string;
  setSubmissionContent: (content: string) => void;
  submissionFiles: File[];
  setSubmissionFiles: (files: File[]) => void;
  submissionLoading: boolean;
  uploadingSubmissionFiles: boolean;
  isArchived: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onDeleteSubmission: (submissionId: number) => void;
  formatDate: (dateString: string) => string;
}

export const StudentSubmissionForm = ({
  assignment,
  mySubmissions,
  totalAttempts,
  submissionContent,
  setSubmissionContent,
  submissionFiles,
  setSubmissionFiles,
  submissionLoading,
  uploadingSubmissionFiles,
  isArchived,
  onSubmit,
  onDeleteSubmission,
  formatDate,
}: StudentSubmissionFormProps) => {
  const [fullTextModalOpen, setFullTextModalOpen] = useState(false);
  const [fullTextContent, setFullTextContent] = useState('');
  const [fullTextTitle, setFullTextTitle] = useState('');
  
  const attemptsLeft = assignment.max_attempts
    ? assignment.max_attempts - totalAttempts
    : null;
  const canSubmit = assignment.max_attempts === null || attemptsLeft! > 0;

  const openFullTextModal = (content: string, attemptNumber: number) => {
    setFullTextContent(content);
    setFullTextTitle(`Попытка #${attemptNumber} - ${assignment.title}`);
    setFullTextModalOpen(true);
  };

  const closeFullTextModal = () => {
    setFullTextModalOpen(false);
    setFullTextContent('');
    setFullTextTitle('');
  };

  return (
    <div className="bg-bg-card rounded-lg p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-text-primary">Ваши сдачи</h2>
        {mySubmissions.length > 0 && (
          <span className="text-sm text-text-secondary">
            Всего попыток: {mySubmissions.length}
          </span>
        )}
      </div>

      {/* Информация об оставшихся попытках */}
      {assignment.max_attempts !== null && (
        <div className={`mb-4 p-3 rounded-lg border ${
          attemptsLeft === 0
            ? 'bg-red-900/20 border-red-500/50'
            : attemptsLeft === 1
            ? 'bg-warning-bg border-warning-border'
            : 'bg-blue-900/20 border-blue-500/50'
        }`}>
          <p className={`text-sm font-medium ${
            attemptsLeft === 0
              ? 'text-red-400'
              : attemptsLeft === 1
              ? 'text-warning'
              : 'text-blue-400'
          }`}>
            {attemptsLeft === 0 ? (
              <>⚠️ Вы исчерпали все попытки сдачи. Пересдача невозможна.</>
            ) : attemptsLeft === 1 ? (
              <>⚠️ Осталась последняя попытка! После сдачи вы не сможете пересдать работу.</>
            ) : (
              <>Осталось попыток: {attemptsLeft} из {assignment.max_attempts}</>
            )}
          </p>
        </div>
      )}

      {/* История всех сдач */}
      {mySubmissions.length > 0 && (
        <div className="mb-4 sm:mb-6 space-y-2 sm:space-y-3">
          <p className="text-xs sm:text-sm font-medium text-text-secondary">
            Предыдущие попытки ({mySubmissions.length}):
          </p>
          <div className="space-y-2 sm:space-y-3">
            {mySubmissions.map((submission, index) => (
              <div
                key={submission.id}
                className="p-3 sm:p-4 rounded border border-border-color bg-bg-primary"
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-2 mb-2 sm:mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-medium text-text-primary">
                        Попытка #{mySubmissions.length - index}
                      </span>
                      {assignment.due_date && (() => {
                        const onTime = isSubmittedOnTime(submission.submitted_at, assignment.due_date);
                        if (onTime === null) return null;
                        return (
                          <span className={`text-[10px] sm:text-xs ${onTime ? 'text-green-400' : 'text-orange-400'}`}>
                            {onTime ? '✓ Вовремя' : '⚠ С опозданием'}
                          </span>
                        );
                      })()}
                    </div>
                    <span className="text-[10px] sm:text-xs text-text-tertiary block mt-0.5">
                      {formatDate(submission.submitted_at)}
                    </span>
                  </div>
                </div>

                {/* Текст ответа */}
                {submission.content && (
                  <div className="mb-2 sm:mb-3">
                    <p className="text-[10px] sm:text-xs text-text-secondary mb-1">Текст ответа:</p>
                    <div className="text-xs sm:text-sm text-text-primary">
                      <p className="whitespace-pre-wrap line-clamp-3">{submission.content}</p>
                      {submission.content && submission.content.length > 150 && (
                        <button
                          onClick={() => openFullTextModal(submission.content!, mySubmissions.length - index)}
                          className="text-primary hover:text-primary-hover text-xs mt-1 underline"
                        >
                          Показать полностью
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Файлы */}
                {submission.files && submission.files.length > 0 && (
                  <div className="mb-2 sm:mb-3">
                    <p className="text-[10px] sm:text-xs text-text-secondary mb-1">Прикрепленные файлы:</p>
                    <div className="flex flex-col gap-1">
                      {submission.files.map((file) => (
                        <div key={file.id} className="flex items-center justify-between">
                          <a
                            href={getFileUrl(file.file_path)}
                            download={file.file_name}
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary-hover text-xs sm:text-sm break-all"
                          >
                            {file.file_name}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Оценка */}
                {submission.score !== null ? (
                  <div className="bg-green-900/20 border border-green-700 rounded p-2 sm:p-3">
                    <p className="text-green-400 font-medium text-xs sm:text-sm">
                      Оценка: {(() => {
                        const scoreStr = String(submission.score);
                        const formattedScore = scoreStr.endsWith('.0')
                          ? scoreStr.slice(0, -2)
                          : scoreStr;

                        return assignment?.grading_type === 'numeric'
                          ? `${formattedScore} (от ${assignment.grade_min} до ${assignment.grade_max})`
                          : formattedScore;
                      })()}
                    </p>
                    {submission.teacher_comment && (
                      <p className="text-text-secondary mt-1 text-[10px] sm:text-xs break-words">
                        Комментарий: {submission.teacher_comment}
                      </p>
                    )}
                    <p className="text-[10px] sm:text-xs text-text-tertiary mt-1">
                      Оценено: {formatDate(submission.graded_at!)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-warning-bg border border-warning-border rounded p-2 sm:p-3">
                      <p className="text-warning text-xs sm:text-sm">Ожидает проверки</p>
                    </div>

                    {/* Плашка "Просмотрено учителем" */}
                    {submission.viewed_by_teacher === 1 && (
                      <div className="bg-blue-900/20 border border-blue-500/30 rounded p-2 sm:p-3">
                        <p className="text-blue-400 text-xs sm:text-sm">
                          👁️ Просмотрено преподавателем
                        </p>
                      </div>
                    )}

                    {!isArchived && submission.viewed_by_teacher === 0 && (
                      <button
                        onClick={() => onDeleteSubmission(submission.id)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Удалить эту попытку
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Форма для новой сдачи */}
      {!isArchived && (
        <div className={mySubmissions.length > 0 ? 'border-t border-border-color pt-4 sm:pt-6' : ''}>
          <h3 className="text-base sm:text-lg font-medium text-text-primary mb-3 sm:mb-4">
            {mySubmissions.length > 0 ? 'Новая попытка' : 'Сдать задание'}
          </h3>
          <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-2">
                Текст ответа (необязательно)
              </label>
              <textarea
                value={submissionContent}
                onChange={(e) => setSubmissionContent(e.target.value)}
                className="input w-full h-24 sm:h-32 resize-none text-sm"
                placeholder="Введите ваш ответ..."
                maxLength={400}
              />
              {submissionContent.length >= 400 && (
                <p className="text-xs text-warning mt-1">Достигнут лимит текста ответа (400 символов)</p>
              )}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-2">
                Файлы (необязательно)
              </label>
              <FileUploadZone
                files={submissionFiles}
                onFilesChange={setSubmissionFiles}
                multiple={true}
                maxFiles={10}
              />
            </div>

            <button
              type="submit"
              disabled={submissionLoading || uploadingSubmissionFiles || !canSubmit}
              className="btn-primary w-full text-sm"
            >
              {!canSubmit
                ? 'Попытки исчерпаны'
                : uploadingSubmissionFiles
                ? 'Загрузка файлов...'
                : submissionLoading
                ? 'Отправка...'
                : mySubmissions.length > 0
                ? 'Отправить новую попытку'
                : 'Сдать задание'}
            </button>
            {assignment.max_attempts === null ? (
              <p className="text-[10px] sm:text-xs text-text-secondary">
                Примечание: вы можете отправить неограниченное количество попыток. Каждая будет сохранена в истории.
              </p>
            ) : canSubmit ? (
              <p className="text-[10px] sm:text-xs text-text-secondary">
                Примечание: после отправки у вас останется {attemptsLeft! - 1} {attemptsLeft === 2 ? 'попытка' : attemptsLeft! > 2 && attemptsLeft! < 5 ? 'попытки' : 'попыток'}.
              </p>
            ) : null}
          </form>
        </div>
      )}

      <FullTextModal
        isOpen={fullTextModalOpen}
        onClose={closeFullTextModal}
        title={fullTextTitle}
        content={fullTextContent}
      />
    </div>
  );
};
