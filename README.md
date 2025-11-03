# Classroom

Образовательная платформа для управления курсами и заданиями.

## Запуск с помощью докера

По умолчанию фронт и бэк запускаются на одном хосте, поэтому при запуске сборки докер контейнера он настраивает .env файл для фронта автоматически.

```bash
docker-compose up --build
```

При запуске происходит автоматический билд фронтенда и копирование в основной проект бэкэнда. Настройки .env для бэкэнда можно посмотреть и настроить в docker-compose.yml, который сделан на основе .env.example из /backend/.

## Запуск без докера
По умолчанию бэкэнд запускается на localhost:8000 и доступ к api через localhost:8000/api, а фронтэнд в дев режиме работает на localhost:5173

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Запуск в проде
Если нужно запустить в проде, то требуется сделать
```bash
cd frontend
npm install
npm run build
```
Далее переместите папку dist в папку backend и назовите static. Далее запускаем бэкэнд
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Фичи

### WebSocket 
Нужен чтобы перезагрузка сайта для его корректной работы сводилась к минимуму.

В данный момент работает в следующих моментах

#### В заданиях
- Задание создано
- Задание изменено
- Задание удалено

#### В чатах
- Сообщение отправлено
- Сообщение удалено

#### При сдаче работ
- Студент сдал работу
- Студент удалил работу
- Учитель просмотрел работу
- Учитель оценил работу

## Бета фичи

- Светлая тема

## Технологии

- Backend: FastAPI, SQLAlchemy, SQLite
- Frontend: React, TypeScript, Tailwind CSS
