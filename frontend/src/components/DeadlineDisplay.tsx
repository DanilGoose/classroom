import { useEffect, useState } from 'react';
import { getTimeRemaining, formatTimeRemaining, type TimeRemaining } from '../utils/deadline';

interface DeadlineDisplayProps {
  deadline: string | null;
  showCountdown?: boolean;
  className?: string;
}

export const DeadlineDisplay = ({ deadline, showCountdown = false, className = '' }: DeadlineDisplayProps) => {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);

  useEffect(() => {
    if (!deadline) return;

    const updateTime = () => {
      setTimeRemaining(getTimeRemaining(deadline));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Обновляем каждую минуту

    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  // Убеждаемся, что дата парсится как UTC и конвертируется в локальное время
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

  const getColorClass = () => {
    if (!timeRemaining) return 'text-text-secondary';
    if (timeRemaining.isExpired) return 'text-red-400';
    if (timeRemaining.isUrgent) return 'text-red-400 font-semibold';
    return 'text-text-secondary';
  };

  return (
    <div className={className}>
      <div className={`text-sm ${getColorClass()}`}>
        <span className="font-medium">Срок сдачи:</span> {formattedDate}
      </div>
      {showCountdown && timeRemaining && (
        <div className={`text-xs mt-1 ${getColorClass()}`}>
          {formatTimeRemaining(timeRemaining)}
          {timeRemaining.isUrgent && !timeRemaining.isExpired && (
            <span className="ml-2">⚠️</span>
          )}
        </div>
      )}
    </div>
  );
};
