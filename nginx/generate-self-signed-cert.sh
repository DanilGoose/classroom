#!/bin/bash

# Скрипт для генерации самоподписанного сертификата для локальной разработки
# Для продакшена используйте Let's Encrypt (см. README)

mkdir -p ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=RU/ST=State/L=City/O=Organization/CN=localhost"

echo "✅ Самоподписанный сертификат создан в nginx/ssl/"
echo "⚠️  Браузер будет предупреждать о недоверенном сертификате"
echo "ℹ️  Для продакшена используйте setup-letsencrypt.sh"
