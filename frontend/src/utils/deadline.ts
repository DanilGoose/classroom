export interface TimeRemaining {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  isExpired: boolean;
  isUrgent: boolean; // Меньше 24 часов
}

export const getTimeRemaining = (deadline: string): TimeRemaining => {
  const now = new Date().getTime();

  let deadlineDate: Date;
  if (deadline.endsWith('Z') || deadline.includes('+')) {
    deadlineDate = new Date(deadline);
  } else {
    deadlineDate = new Date(deadline + 'Z');
  }

  const deadlineTime = deadlineDate.getTime();
  const total = deadlineTime - now;

  const isExpired = total < 0;
  const absTotal = Math.abs(total);

  const days = Math.floor(absTotal / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absTotal % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absTotal % (1000 * 60 * 60)) / (1000 * 60));

  const isUrgent = !isExpired && total < 24 * 60 * 60 * 1000; // Меньше 24 часов

  return {
    total,
    days,
    hours,
    minutes,
    isExpired,
    isUrgent,
  };
};

export const formatTimeRemaining = (timeRemaining: TimeRemaining): string => {
  const { days, hours, minutes, isExpired } = timeRemaining;

  if (isExpired) {
    return 'Срок истёк';
  }

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} ${getDayWord(days)}`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours} ${getHourWord(hours)}`);
  }
  if (days === 0) {
    parts.push(`${minutes} ${getMinuteWord(minutes)}`);
  }

  return `Осталось: ${parts.join(' ')}`;
};

export const isSubmittedOnTime = (submittedAt: string, deadline: string | null): boolean | null => {
  if (!deadline) return null;

  const parseUTC = (dateStr: string): Date => {
    if (dateStr.endsWith('Z') || dateStr.includes('+')) {
      return new Date(dateStr);
    }
    return new Date(dateStr + 'Z');
  };

  return parseUTC(submittedAt).getTime() <= parseUTC(deadline).getTime();
};

const getDayWord = (days: number): string => {
  if (days % 10 === 1 && days % 100 !== 11) return 'день';
  if (days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20)) return 'дня';
  return 'дней';
};

const getHourWord = (hours: number): string => {
  if (hours % 10 === 1 && hours % 100 !== 11) return 'час';
  if (hours % 10 >= 2 && hours % 10 <= 4 && (hours % 100 < 10 || hours % 100 >= 20)) return 'часа';
  return 'часов';
};

const getMinuteWord = (minutes: number): string => {
  if (minutes % 10 === 1 && minutes % 100 !== 11) return 'минута';
  if (minutes % 10 >= 2 && minutes % 10 <= 4 && (minutes % 100 < 10 || minutes % 100 >= 20)) return 'минуты';
  return 'минут';
};
