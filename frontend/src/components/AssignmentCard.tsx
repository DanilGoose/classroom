import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { Assignment } from '../types';
import { getMySubmission } from '../api/api';
import { getTimeRemaining } from '../utils/deadline';

interface AssignmentCardProps {
  assignment: Assignment;
  isTeacher: boolean;
}

export const AssignmentCard = ({ assignment, isTeacher }: AssignmentCardProps) => {
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isTeacher) {
      checkSubmissionStatus();
    }
  }, [assignment.id, isTeacher]);

  const checkSubmissionStatus = async () => {
    setLoading(true);
    try {
      const data = await getMySubmission(assignment.id);
      // Берем последнюю сдачу
      if (data && data.length > 0) {
        setSubmission(data[0]);
      }
    } catch (err) {
      // Нет сдачи - это нормально
    } finally {
      setLoading(false);
    }
  };

  const getBadge = () => {
    if (isTeacher) {
      return null;
    }

    if (loading) {
      return null;
    }

    if (submission) {
      if (submission.score !== null && submission.score !== undefined) {
        // Проверено
        return (
          <span className="flex-shrink-0 bg-green-900/30 text-green-400 text-xs px-3 py-1 rounded-full">
            Оценка: {submission.score}
          </span>
        );
      } else {
        // На проверке
        return (
          <span className="flex-shrink-0 bg-blue-900/30 text-blue-400 text-xs px-3 py-1 rounded-full">
            На проверке
          </span>
        );
      }
    } else if (!assignment.is_read) {
      // Новое задание (не просмотрено)
      return (
        <span className="flex-shrink-0 bg-warning-bg text-warning text-xs px-3 py-1 rounded-full">
          Новое задание
        </span>
      );
    } else {
      // Не сдано (просмотрено)
      return (
        <span className="flex-shrink-0 bg-red-900/30 text-red-400 text-xs px-3 py-1 rounded-full">
          Не сдано
        </span>
      );
    }
  };

  return (
    <Link
      to={`/assignments/${assignment.id}`}
      className="block card"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-text-primary mb-2 line-clamp-2 lg:line-clamp-1">{assignment.title}</h3>
          <p className="text-sm text-text-secondary mb-2 line-clamp-2">{assignment.description}</p>
          {assignment.due_date && (() => {
            const deadline = assignment.due_date;
            let deadlineDate: Date;
            if (deadline.endsWith('Z') || deadline.includes('+')) {
              deadlineDate = new Date(deadline);
            } else {
              deadlineDate = new Date(deadline + 'Z');
            }

            const formattedDate = deadlineDate.toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            const timeRemaining = getTimeRemaining(deadline);
            let colorClass = 'text-text-secondary';
            if (timeRemaining.isExpired) {
              colorClass = 'text-red-400 font-semibold';
            } else if (timeRemaining.isUrgent) {
              colorClass = 'text-red-400 font-semibold';
            }

            return (
              <p className={`text-xs ${colorClass}`}>
                Срок: {formattedDate}
                {timeRemaining.isUrgent && !timeRemaining.isExpired && ' ⚠️'}
              </p>
            );
          })()}
        </div>
        {getBadge()}
      </div>
    </Link>
  );
};
