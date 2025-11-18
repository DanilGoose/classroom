import type { Assignment } from '../../types';

interface AssignmentDetailsProps {
  assignment: Assignment;
  isTeacher: boolean;
  isArchived: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileDelete: (fileId: number) => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export const AssignmentDetails = ({
  assignment,
  isTeacher,
  isArchived,
  onEdit,
  onDelete,
  onFileUpload,
  onFileDelete,
  uploading,
  fileInputRef,
}: AssignmentDetailsProps) => {
  return (
    <div className="bg-bg-card rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-text-primary break-words min-w-0 flex-1">
          {assignment.title}
        </h1>
        {isTeacher && !isArchived && (
          <div className="flex gap-2 self-start sm:self-auto">
            <button
              onClick={onEdit}
              className="btn-secondary text-sm whitespace-nowrap"
            >
              Редактировать
            </button>
            <button
              onClick={onDelete}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              Удалить
            </button>
          </div>
        )}
      </div>

      <p className="text-sm sm:text-base text-text-secondary mb-3 sm:mb-4 break-words">
        {assignment.description}
      </p>

      {assignment.files && assignment.files.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-text-secondary mb-2">
            Файлы от преподавателя:
          </h3>
          <div className="flex flex-col gap-2">
            {assignment.files.map((file) => (
              <div key={file.id} className="flex items-center justify-between">
                <a
                  href={`http://localhost:8000/${file.file_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary-hover text-sm"
                >
                  {file.file_name}
                </a>
                {isTeacher && !isArchived && (
                  <button
                    onClick={() => onFileDelete(file.id)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Удалить
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isTeacher && !isArchived && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={onFileUpload}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`inline-block btn-secondary text-sm cursor-pointer ${
              uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {uploading ? 'Загрузка...' : 'Прикрепить файл'}
          </label>
        </div>
      )}
    </div>
  );
};
