import { Modal } from './Modal';

interface FullTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

export const FullTextModal = ({ isOpen, onClose, title, content }: FullTextModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="default">
      <div className="space-y-4">
        <div className="bg-bg-primary border border-border-color rounded-lg p-4">
          <pre className="text-sm text-text-primary whitespace-pre-wrap break-words font-sans leading-relaxed">
            {content}
          </pre>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="btn-primary"
          >
            Закрыть
          </button>
        </div>
      </div>
    </Modal>
  );
};