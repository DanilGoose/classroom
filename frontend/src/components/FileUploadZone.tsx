import { useState, useRef, type DragEvent } from 'react';
import { useAlertStore } from '../store/alertStore';

interface FileUploadZoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  multiple?: boolean;
  maxFiles?: number;
}

export const FileUploadZone = ({
  files,
  onFilesChange,
  multiple = true,
  maxFiles = 10
}: FileUploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addAlert } = useAlertStore();

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    if (multiple) {
      const totalFiles = [...files, ...newFiles];
      if (totalFiles.length > maxFiles) {
        addAlert(`Максимум ${maxFiles} файлов`, 'warning');
        return;
      }
      onFilesChange(totalFiles);
    } else {
      onFilesChange([newFiles[0]]);
    }
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-3">
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-border-color hover:border-gray-500 bg-bg-primary'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileInputChange}
          className="hidden"
          multiple={multiple}
          accept="*/*"
        />
        <div className="flex flex-col items-center gap-2">
          <svg
            className="w-10 h-10 sm:w-12 sm:h-12 text-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm sm:text-base text-text-secondary">
            Перетащите файлы сюда или нажмите для выбора
          </p>
          <p className="text-xs sm:text-sm text-text-tertiary">
            {multiple ? `Максимум ${maxFiles} файлов` : 'Один файл'}
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary">
            Выбранные файлы ({files.length}):
          </p>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-bg-primary p-2 sm:p-3 rounded border border-border-color"
            >
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-white truncate">{file.name}</p>
                  <p className="text-[10px] sm:text-xs text-text-tertiary">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="text-red-400 hover:text-red-300 text-xs sm:text-sm ml-2 flex-shrink-0"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
