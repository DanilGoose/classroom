import { Modal } from '../Modal';

interface EditAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTitle: string;
  setEditTitle: (title: string) => void;
  editDescription: string;
  setEditDescription: (description: string) => void;
  editDueDate: string;
  setEditDueDate: (date: string) => void;
  editGradingType: 'numeric' | 'text';
  setEditGradingType: (type: 'numeric' | 'text') => void;
  editGradeMin: number;
  setEditGradeMin: (min: number) => void;
  editGradeMax: number;
  setEditGradeMax: (max: number) => void;
  editGradeOptions: string[];
  setEditGradeOptions: (options: string[]) => void;
  editTextGradeInput: string;
  setEditTextGradeInput: (input: string) => void;
  editMaxAttemptsEnabled: boolean;
  setEditMaxAttemptsEnabled: (enabled: boolean) => void;
  editMaxAttempts: number;
  setEditMaxAttempts: (attempts: number) => void;
  editError: string;
  onSubmit: (e: React.FormEvent) => void;
}

export const EditAssignmentModal = ({
  isOpen,
  onClose,
  editTitle,
  setEditTitle,
  editDescription,
  setEditDescription,
  editDueDate,
  setEditDueDate,
  editGradingType,
  setEditGradingType,
  editGradeMin,
  setEditGradeMin,
  editGradeMax,
  setEditGradeMax,
  editGradeOptions,
  setEditGradeOptions,
  editTextGradeInput,
  setEditTextGradeInput,
  editMaxAttemptsEnabled,
  setEditMaxAttemptsEnabled,
  editMaxAttempts,
  setEditMaxAttempts,
  editError,
  onSubmit,
}: EditAssignmentModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Редактировать задание">
      <form onSubmit={onSubmit} className="space-y-4">
        {editError && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
            {editError}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Название</label>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="input"
            maxLength={200}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Описание</label>
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            className="input h-24 resize-none"
            maxLength={5000}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Срок сдачи (необязательно)
          </label>
          <input
            type="datetime-local"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Тип оценки</label>
          <select
            value={editGradingType}
            onChange={(e) => setEditGradingType(e.target.value as 'numeric' | 'text')}
            className="input"
          >
            <option value="numeric">Числовая оценка</option>
            <option value="text">Текстовая оценка</option>
          </select>
        </div>

        {editGradingType === 'numeric' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">От</label>
              <input
                type="number"
                value={editGradeMin}
                onChange={(e) => setEditGradeMin(Number(e.target.value))}
                className="input"
                step="1"
                min={-1000000}
                max={1000000}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">До</label>
              <input
                type="number"
                value={editGradeMax}
                onChange={(e) => setEditGradeMax(Number(e.target.value))}
                className="input"
                step="1"
                min={-1000000}
                max={1000000}
                required
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Варианты оценок (минимум 2)
            </label>
            <div className="space-y-2 mb-2">
              {editGradeOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...editGradeOptions];
                      newOptions[index] = e.target.value;
                      setEditGradeOptions(newOptions);
                    }}
                    className="input flex-1"
                    maxLength={100}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setEditGradeOptions(editGradeOptions.filter((_, i) => i !== index))}
                    className="text-red-400 hover:text-red-300 px-2"
                    disabled={editGradeOptions.length <= 2}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={editTextGradeInput}
                onChange={(e) => setEditTextGradeInput(e.target.value)}
                className="input flex-1"
                placeholder="Новый вариант оценки"
                maxLength={100}
              />
              <button
                type="button"
                onClick={() => {
                  if (editTextGradeInput.trim()) {
                    setEditGradeOptions([...editGradeOptions, editTextGradeInput.trim()]);
                    setEditTextGradeInput('');
                  }
                }}
                className="btn-secondary"
              >
                Добавить
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Количество попыток
          </label>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editMaxAttemptsEnabled}
                onChange={(e) => setEditMaxAttemptsEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-text-secondary">Ограничить количество попыток</span>
            </label>

            {editMaxAttemptsEnabled && (
              <div>
                <input
                  type="number"
                  value={editMaxAttempts}
                  onChange={(e) => setEditMaxAttempts(Math.max(1, Number(e.target.value)))}
                  className="input w-full"
                  min="1"
                  max="1000"
                  required
                />
                <p className="text-xs text-text-tertiary mt-1">
                  {editMaxAttempts === 1
                    ? 'Студент сможет сдать работу только один раз'
                    : `Студент сможет сдать работу максимум ${editMaxAttempts} раз`}
                </p>
              </div>
            )}
            {!editMaxAttemptsEnabled && (
              <p className="text-xs text-text-tertiary">
                Студент сможет пересдавать работу неограниченное количество раз
              </p>
            )}
          </div>
        </div>

        <button type="submit" className="btn-primary w-full">
          Сохранить
        </button>
      </form>
    </Modal>
  );
};
