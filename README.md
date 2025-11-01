# Classroom

Образовательная платформа для управления курсами и заданиями.

## Запуск с помощью докера

По умолчанию фронт и бэк запускаются на одном хосте, поэтому при запуске сборки докер контейнера он настраивает .env файл для фронта автоматически.

```bash
docker-compose up --build
```

При запуске происходит автоматический билд фронтенда и копирование в основной проект бэкэнда. Настройки .env для бэкэнда можно посмотреть и настроить в docker-compose.yml, который сделан на основе .env.example из /backend/.

## Запуск без докера

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

## Технологии

- Backend: FastAPI, SQLAlchemy, SQLite
- Frontend: React, TypeScript, Tailwind CSS
