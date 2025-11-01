# Classroom

Образовательная платформа для управления курсами и заданиями.

## Запуск

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
