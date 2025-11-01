import type { Assignment, Submission } from '../../types';

interface GradingFormProps {
  selectedSubmission: Submission;
  assignment: Assignment;
  gradeScore: string;
  setGradeScore: (score: string) => void;
  gradeComment: string;
  setGradeComment: (comment: string) => void;
  isArchived: boolean;
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
  onSubmit,
}: GradingFormProps) => {
  return (
    <div className="bg-bg-card rounded-lg p-4 sm:p-6">
      <h3 className="text-sm sm:text-base lg:text-lg font-bold text-text-primary mb-3 sm:mb-4 break-words">
        Проверка: {selectedSubmission.student_name}
      </h3>

      <div className="space-y-3 sm:space-y-4 mb-3 sm:mb-4">
        <div>
          <p className="text-xs sm:text-sm text-text-secondary mb-2">Текст ответа:</p>
          <div className="bg-bg-primary p-3 sm:p-4 rounded border border-border-color">
            <p className="text-xs sm:text-sm text-text-primary break-words">{selectedSubmission.content || 'Нет текста'}</p>
          </div>
        </div>

        {selectedSubmission.files && selectedSubmission.files.length > 0 && (
          <div>
            <p className="text-xs sm:text-sm text-text-secondary mb-2">Файлы студента:</p>
            <div className="flex flex-col gap-1.5 sm:gap-2">
              {selectedSubmission.files.map((file) => (
                <a
                  key={file.id}
                  href={`http://localhost:8000/${file.file_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary-hover text-xs sm:text-sm break-all"
                >
                  {file.file_name}
                </a>
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
                min={assignment.grade_min || 0}
                max={assignment.grade_max || 100}
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
            disabled={isArchived}
          />
        </div>

        {!isArchived && (
          <button type="submit" className="btn-primary w-full text-sm">
            Выставить оценку
          </button>
        )}
      </form>
    </div>
  );
};
