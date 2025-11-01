import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { Course } from '../types';
import { getAssignments } from '../api/api';

interface CourseCardProps {
  course: Course;
  onUpdate?: () => void;
}

export const CourseCard = ({ course }: CourseCardProps) => {
  const [newAssignmentsCount, setNewAssignmentsCount] = useState(0);

  useEffect(() => {
    checkNewAssignments();
  }, [course.id]);

  const checkNewAssignments = async () => {
    try {
      if (course.is_creator) {
        // Если пользователь создатель, не показываем бейдж
        return;
      }

      // Получаем все задания курса
      const assignments = await getAssignments(course.id);

      // Считаем количество непосещенных заданий
      const newCount = assignments.filter(assignment => {
        const visitKey = `assignment_${assignment.id}_visited`;
        const hasVisited = localStorage.getItem(visitKey);
        return !hasVisited;
      }).length;

      setNewAssignmentsCount(newCount);
    } catch (err) {
      console.error('Failed to check new assignments:', err);
    }
  };

  return (
    <Link to={`/courses/${course.id}`} className="block h-full">
      <div className="card hover:shadow-lg h-full relative">
        {newAssignmentsCount > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
            {newAssignmentsCount}
          </div>
        )}
        <div className="flex flex-col h-full justify-between">
          <div className="mb-2 sm:mb-3">
            <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-1 sm:mb-2 break-words">{course.title}</h3>
            {newAssignmentsCount > 0 && (
              <p className="text-xs text-warning mb-1">
                {newAssignmentsCount} {newAssignmentsCount === 1 ? 'непросмотренное задание' : newAssignmentsCount < 5 ? 'непросмотренных задания' : 'непросмотренных заданий'}
              </p>
            )}
            <p className="text-xs sm:text-sm text-text-secondary line-clamp-2 break-words">
              {course.description || 'Нет описания'}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between text-[10px] sm:text-xs text-text-tertiary gap-2 flex-wrap">
            <span>{course.member_count} участников</span>
            <div className="flex gap-1.5">
              {course.is_archived === 1 && (
                <span className="bg-gray-700/50 text-text-secondary px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs">
                  Архивный
                </span>
              )}
              {course.is_creator && (
                <span className="bg-primary/20 text-primary px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs">
                  Создатель
                </span>
              )}
            </div>
          </div>

          <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-text-tertiary">
            Код: <span className="font-mono text-primary">{course.code}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};
