#!/bin/bash

# Скрипт для настройки Let's Encrypt SSL сертификатов на продакшене
# Использование: ./setup-letsencrypt.sh ваш-домен.com email@example.com

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "❌ Использование: ./setup-letsencrypt.sh ДОМЕН EMAIL"
    echo "   Пример: ./setup-letsencrypt.sh classroom.example.com admin@example.com"
    exit 1
fi

DOMAIN=$1
EMAIL=$2

echo "🔧 Настройка Let's Encrypt для домена: $DOMAIN"

# Создаем директорию для certbot challenge
mkdir -p ../certbot/www
mkdir -p ../certbot/conf

# Запускаем certbot для получения сертификата
docker run --rm \
    -v "$(pwd)/../certbot/conf:/etc/letsencrypt" \
    -v "$(pwd)/../certbot/www:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

if [ $? -eq 0 ]; then
    echo "✅ Сертификат успешно получен!"
    echo ""
    echo "📝 Теперь обновите nginx/nginx.conf:"
    echo "   Замените 'server_name _;' на 'server_name $DOMAIN;'"
    echo "   Замените пути к сертификатам:"
    echo "   ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;"
    echo "   ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;"
    echo ""
    echo "🔄 После изменений перезапустите контейнеры: docker-compose restart nginx"
else
    echo "❌ Ошибка при получении сертификата"
    exit 1
fi
