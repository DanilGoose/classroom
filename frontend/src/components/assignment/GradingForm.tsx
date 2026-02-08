import { useState } from 'react';
import type {
  Assignment,
  Submission,
  SubmissionFile,
  SubmissionFeedbackFile
} from '../../types';
import { getFileUrl } from '../../api/axios';
import { isSubmittedOnTime } from '../../utils/deadline';
import { FullTextModal } from '../FullTextModal';

interface GradingFormProps {
  selectedSubmission: Submission;
  assignment: Assignment;
  gradeScore: string;
  setGradeScore: (score: string) => void;
  gradeComment: string;
  setGradeComment: (comment: string) => void;
  isArchived: boolean;
  isPreparingReviewFileId: number | null;
  isDownloadingFeedbackFileId: number | null;
  isDeletingFeedbackFileId: number | null;
  onOpenAnnotator: (file: SubmissionFile) => void;
  onDownloadFeedbackFile: (file: SubmissionFeedbackFile) => void;
  onEditFeedbackFile: (file: SubmissionFeedbackFile) => void;
  onDeleteFeedbackFile: (file: SubmissionFeedbackFile) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const GradingForm = ({
  selectedSubmission,
  assignment,
  gradeScore,
  setGradeScore,
  gradeComment,
  setGradeComment,
  isArchived,
  isPreparingReviewFileId,
  isDownloadingFeedbackFileId,
  isDeletingFeedbackFileId,
  onOpenAnnotator,
  onDownloadFeedbackFile,
  onEditFeedbackFile,
  onDeleteFeedbackFile,
  onSubmit,
}: GradingFormProps) => {
  const [fullTextModalOpen, setFullTextModalOpen] = useState(false);
  const [fullTextContent, setFullTextContent] = useState('');
  const [fullTextTitle, setFullTextTitle] = useState('');
  
  const onTime = isSubmittedOnTime(selectedSubmission.submitted_at, assignment.due_date);

  const openFullTextModal = (content: string, studentName: string, assignmentTitle: string) => {
    setFullTextContent(content);
    setFullTextTitle(`${assignmentTitle} - ${studentName}`);
    setFullTextModalOpen(true);
  };

  const closeFullTextModal = () => {
    setFullTextModalOpen(false);
    setFullTextContent('');
    setFullTextTitle('');
  };

  return (
    <div className="bg-bg-card rounded-lg p-4 sm:p-6">
      <div className="mb-3 sm:mb-4">
        <h3 className="text-sm sm:text-base lg:text-lg font-bold text-text-primary break-words">
          Проверка: {selectedSubmission.student_name}
        </h3>
        {assignment.due_date && onTime !== null && (
          <div className={`text-xs sm:text-sm mt-1 ${onTime ? 'text-green-400' : 'text-orange-400'}`}>
            {onTime ? '✓ Сдано вовремя' : '⚠ Сдано с опозданием'}
          </div>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4 mb-3 sm:mb-4">
        <div>
          <p className="text-xs sm:text-sm text-text-secondary mb-2">Текст ответа:</p>
          <div className="bg-bg-primary p-3 sm:p-4 rounded border border-border-color">
            {selectedSubmission.content ? (
              <>
                <p className="text-xs sm:text-sm text-text-primary whitespace-pre-wrap line-clamp-3">{selectedSubmission.content}</p>
                {selectedSubmission.content && selectedSubmission.content.length > 150 && (
                  <button
                    onClick={() => openFullTextModal(
                      selectedSubmission.content!,
                      selectedSubmission.student_name || 'Неизвестный студент',
                      assignment.title
                    )}
                    className="text-primary hover:text-primary-hover text-xs mt-1 underline block"
                  >
                    Показать полностью
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs sm:text-sm text-text-tertiary italic">Нет текста</p>
            )}
          </div>
        </div>

        {selectedSubmission.files && selectedSubmission.files.length > 0 && (
          <div>
            <p className="text-xs sm:text-sm text-text-secondary mb-2">Файлы студента:</p>
            <div className="flex flex-col gap-2">
              {selectedSubmission.files.map((file) => (
                <div key={file.id} className="flex items-center justify-between gap-2 bg-bg-primary p-2 rounded border border-border-color">
                  <a
                    href={getFileUrl(file.file_path)}
                    download={file.file_name}
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary-hover text-xs sm:text-sm break-all flex-1 min-w-0"
                  >
                    {file.file_name}
                  </a>
                  <button
                    type="button"
                    onClick={() => onOpenAnnotator(file)}
                    disabled={isArchived || isPreparingReviewFileId === file.id}
                    className="btn-secondary text-xs whitespace-nowrap"
                  >
                    {isPreparingReviewFileId === file.id ? 'Подготовка...' : 'Проверить'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedSubmission.feedback_files && selectedSubmission.feedback_files.length > 0 && (
          <div>
            <p className="text-xs sm:text-sm text-text-secondary mb-2">Файлы с пометками преподавателя:</p>
            <div className="flex flex-col gap-2">
              {selectedSubmission.feedback_files.map((feedbackFile) => (
                <div key={feedbackFile.id} className="flex items-center justify-between gap-2 bg-bg-primary p-2 rounded border border-border-color">
                  <span className="text-xs sm:text-sm text-text-primary break-all flex-1 min-w-0">
                    {feedbackFile.file_name}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-xs whitespace-nowrap"
                      onClick={() => onDownloadFeedbackFile(feedbackFile)}
                      disabled={isDownloadingFeedbackFileId === feedbackFile.id}
                    >
                      {isDownloadingFeedbackFileId === feedbackFile.id ? 'Скачивание...' : 'Скачать'}
                    </button>
                    {!isArchived && (
                      <>
                        <button
                          type="button"
                          className="btn-secondary text-xs whitespace-nowrap"
                          onClick={() => onEditFeedbackFile(feedbackFile)}
                          disabled={
                            isDeletingFeedbackFileId === feedbackFile.id ||
                            !feedbackFile.source_submission_file_id ||
                            isPreparingReviewFileId === feedbackFile.source_submission_file_id
                          }
                        >
                          {isPreparingReviewFileId === feedbackFile.source_submission_file_id ? 'Подготовка...' : 'Изменить'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs whitespace-nowrap text-red-400"
                          onClick={() => onDeleteFeedbackFile(feedbackFile)}
                          disabled={isDeletingFeedbackFileId === feedbackFile.id}
                        >
                          {isDeletingFeedbackFileId === feedbackFile.id ? 'Удаление...' : 'Удалить'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
        <div>
          {assignment.grading_type === 'numeric' ? (
            <>
              <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-2">
                Оценка (от {assignment.grade_min} до {assignment.grade_max})
              </label>
              <input
                type="number"
                value={gradeScore}
                onChange={(e) => setGradeScore(e.target.value)}
                className="input w-full text-sm"
                min={Math.max(0, assignment.grade_min || 0)}
                max={assignment.grade_max || 1000000}
                step="1"
                required
                disabled={isArchived}
              />
            </>
          ) : (
            <>
              <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-2">
                Оценка
              </label>
              <select
                value={gradeScore}
                onChange={(e) => setGradeScore(e.target.value)}
                className="input w-full text-sm"
                required
                disabled={isArchived}
              >
                <option value="">Выберите оценку</option>
                {assignment.grade_options &&
                  (() => {
                    try {
                      const options = JSON.parse(assignment.grade_options);
                      return Array.isArray(options)
                        ? options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))
                        : null;
                    } catch {
                      return null;
                    }
                  })()}
              </select>
            </>
          )}
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-2">
            Комментарий (необязательно)
          </label>
          <textarea
            value={gradeComment}
            onChange={(e) => setGradeComment(e.target.value)}
            className="input w-full h-20 sm:h-24 resize-none text-sm"
            placeholder="Комментарий для студента..."
            maxLength={400}
            disabled={isArchived}
          />
          {gradeComment.length >= 400 && (
            <p className="text-xs text-warning mt-1">Достигнут лимит комментария (400 символов)</p>
          )}
        </div>

        {!isArchived && (
          <button type="submit" className="btn-primary w-full text-sm">
            Выставить оценку
          </button>
        )}
      </form>

      <FullTextModal
        isOpen={fullTextModalOpen}
        onClose={closeFullTextModal}
        title={fullTextTitle}
        content={fullTextContent}
      />
    </div>
  );
};
