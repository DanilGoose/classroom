import { useState, useMemo } from 'react';
import type { Assignment, Submission } from '../../types';

interface TeacherSubmissionsListProps {
  allSubmissions: Submission[];
  assignment: Assignment;
  selectedSubmission: Submission | null;
  onSelectSubmission: (submission: Submission) => void;
  formatDate: (dateString: string) => string;
}

interface StudentGroup {
  studentId: number;
  studentName: string;
  submissions: Submission[];
  latestSubmission: Submission;
  hasUngraded: boolean;
}

export const TeacherSubmissionsList = ({
  allSubmissions,
  assignment,
  selectedSubmission,
  onSelectSubmission,
  formatDate,
}: TeacherSubmissionsListProps) => {
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());

  // Группируем сдачи по ученикам
  const studentGroups = useMemo<StudentGroup[]>(() => {
    const groupsMap = new Map<number, StudentGroup>();

    allSubmissions.forEach((submission) => {
      if (!groupsMap.has(submission.student_id)) {
        groupsMap.set(submission.student_id, {
          studentId: submission.student_id,
          studentName: submission.student_name || 'Неизвестный студент',
          submissions: [],
          latestSubmission: submission,
          hasUngraded: false,
        });
      }

      const group = groupsMap.get(submission.student_id)!;
      group.submissions.push(submission);

      // Обновляем последнюю сдачу (самая новая)
      if (new Date(submission.submitted_at) > new Date(group.latestSubmission.submitted_at)) {
        group.latestSubmission = submission;
      }

      // Проверяем наличие непроверенных работ
      if (submission.score === null) {
        group.hasUngraded = true;
      }
    });

    // Сортируем сдачи внутри каждой группы по дате (новые первые)
    groupsMap.forEach((group) => {
      group.submissions.sort((a, b) =>
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      );
    });

    return Array.from(groupsMap.values()).sort((a, b) =>
      a.studentName.localeCompare(b.studentName)
    );
  }, [allSubmissions]);

  const toggleStudent = (studentId: number) => {
    setExpandedStudents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const formatScore = (score: number | string | null) => {
    if (score === null) return null;

    const scoreStr = String(score);
    const formattedScore = scoreStr.endsWith('.0') ? scoreStr.slice(0, -2) : scoreStr;

    return assignment.grading_type === 'numeric'
      ? `${formattedScore} (от ${assignment.grade_min} до ${assignment.grade_max})`
      : formattedScore;
  };

  return (
    <div className="bg-bg-card rounded-lg p-4 sm:p-6">
      <h2 className="text-base sm:text-lg lg:text-xl font-bold text-text-primary mb-3 sm:mb-4">
        Сдачи студентов
      </h2>

      {studentGroups.length === 0 ? (
        <p className="text-sm text-text-secondary">Пока нет сдач</p>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {studentGroups.map((group) => {
            const isExpanded = expandedStudents.has(group.studentId);
            const latestScore = group.latestSubmission.score;

            return (
              <div key={group.studentId} className="border border-border-color rounded">
                {/* Заголовок группы студента */}
                <div
                  className="p-3 sm:p-4 cursor-pointer hover:bg-bg-primary/50 transition-colors"
                  onClick={() => toggleStudent(group.studentId)}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                        <p className="font-medium text-sm sm:text-base text-white truncate">
                          {group.studentName}
                        </p>
                      </div>
                      <p className="text-[10px] sm:text-xs text-text-tertiary ml-5">
                        {group.submissions.length} {group.submissions.length === 1 ? 'сдача' : 'сдачи'}
                        {group.hasUngraded && (
                          <span className="text-warning ml-2">• Есть непроверенные</span>
                        )}
                      </p>
                    </div>

                    {/* Последняя оценка */}
                    <div className="text-right flex-shrink-0">
                      {latestScore !== null ? (
                        <span className="text-green-400 text-xs sm:text-sm font-medium">
                          {formatScore(latestScore)}
                        </span>
                      ) : (
                        <span className="text-warning text-xs sm:text-sm">Не проверено</span>
                      )}
                      <p className="text-[10px] sm:text-xs text-text-tertiary mt-1">
                        {formatDate(group.latestSubmission.submitted_at)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Список всех сдач студента */}
                {isExpanded && (
                  <div className="border-t border-border-color bg-bg-primary/30">
                    {group.submissions.map((submission, index) => (
                      <div
                        key={submission.id}
                        className={`p-3 sm:p-4 cursor-pointer transition-colors border-l-4 ${
                          selectedSubmission?.id === submission.id
                            ? 'border-l-primary bg-primary/10'
                            : 'border-l-transparent hover:bg-bg-primary/50'
                        } ${index !== 0 ? 'border-t border-border-color' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSubmission(submission);
                        }}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm text-text-secondary mb-1">
                              Попытка #{group.submissions.length - index}
                            </p>
                            <p className="text-[10px] sm:text-xs text-text-tertiary">
                              Сдано: {formatDate(submission.submitted_at)}
                            </p>
                          </div>

                          {submission.score !== null ? (
                            <span className="text-green-400 text-xs sm:text-sm font-medium flex-shrink-0">
                              {formatScore(submission.score)}
                            </span>
                          ) : (
                            <span className="text-warning text-xs sm:text-sm flex-shrink-0">
                              Не проверено
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
