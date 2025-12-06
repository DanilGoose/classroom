# Сборка фронтенда
FROM node:20-alpine AS frontend-builder

# Аргумент для API URL
ARG VITE_API_URL=/api

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./

# Создание env для фронтенда
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Сборка бэкенда
FROM python:3.12-slim

WORKDIR /app
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=frontend-builder /frontend/dist ./static
RUN mkdir -p ./uploads ./db

# Безопасные значения по умолчанию (можно переопределить через docker-compose env)
ENV DOCS_ENABLED=false \
    ENFORCE_ORIGIN=true \
    ALLOWED_ORIGINS=https://localhost,http://localhost

EXPOSE 8000

# Запускаем приложение
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
