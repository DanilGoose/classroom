import type { Message, User } from '../../types';

interface AssignmentChatProps {
  messages: Message[];
  newMessage: string;
  setNewMessage: (message: string) => void;
  hasMore: boolean;
  loadingMore: boolean;
  isArchived: boolean;
  onSendMessage: (e: React.FormEvent) => void;
  onDeleteMessage: (messageId: number) => void;
  onLoadMore: () => void;
  formatDate: (dateString: string) => string;
  user: User | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const AssignmentChat = ({
  messages,
  newMessage,
  setNewMessage,
  hasMore,
  loadingMore,
  isArchived,
  onSendMessage,
  onDeleteMessage,
  onLoadMore,
  formatDate,
  user,
  messagesEndRef,
}: AssignmentChatProps) => {
  return (
    <div className="bg-bg-card rounded-lg p-4 sm:p-6 flex flex-col h-80 sm:h-96">
      <h3 className="text-sm sm:text-base lg:text-lg font-bold text-text-primary mb-3 sm:mb-4">Общий чат</h3>

      {hasMore && (
        <div className="text-center mb-3 sm:mb-4">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="btn-secondary text-xs sm:text-sm"
          >
            {loadingMore ? 'Загрузка...' : 'Загрузить еще'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto mb-3 sm:mb-4 space-y-2 sm:space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.user_id === user?.id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-2 ${
                msg.user_id === user?.id
                  ? 'bg-primary text-white'
                  : 'bg-bg-primary text-text-primary'
              }`}
            >
              {msg.user_id !== user?.id && (
                <p className="text-[10px] sm:text-xs font-medium mb-1 opacity-70">{msg.username}</p>
              )}
              <p className={`text-xs sm:text-sm break-words ${msg.is_deleted ? 'italic opacity-50' : ''}`}>{msg.message}</p>
              <div className="flex items-center justify-between mt-1 gap-2">
                <p className="text-[10px] sm:text-xs opacity-70">{formatDate(msg.created_at)}</p>
                {!msg.is_deleted && msg.user_id === user?.id && !isArchived && (
                  <button
                    onClick={() => onDeleteMessage(msg.id)}
                    className="text-[10px] sm:text-xs opacity-70 hover:opacity-100"
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {!isArchived && (
        <form onSubmit={onSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="input flex-1 text-sm"
            placeholder="Введите сообщение..."
          />
          <button type="submit" className="btn-primary text-xs sm:text-sm px-3 sm:px-4">
            Отправить
          </button>
        </form>
      )}
    </div>
  );
};
