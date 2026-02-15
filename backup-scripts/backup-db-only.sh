#!/bin/bash
#
# Open WebUI - Быстрый бэкап базы данных
# Создает только дамп PostgreSQL (для частых бэкапов)
#

set -euo pipefail

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Конфигурация
PROJECT_DIR="/opt/projects/open-webui"
BACKUP_DIR="${PROJECT_DIR}/backups/db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="database_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

log "Создание бэкапа базы данных PostgreSQL..."

# Проверка что контейнер запущен
if ! docker ps | grep -q open-webui-postgres; then
    error "Контейнер PostgreSQL не запущен"
    exit 1
fi

# Создание дампа и сжатие
docker exec open-webui-postgres pg_dump -U openwebui openwebui | gzip > "${BACKUP_DIR}/${BACKUP_NAME}"

if [ $? -eq 0 ]; then
    log "✓ Бэкап базы данных создан: ${BACKUP_NAME}"
    log "  Размер: $(du -h ${BACKUP_DIR}/${BACKUP_NAME} | cut -f1)"

    # Очистка старых бэкапов БД (оставляем последние 30)
    BACKUP_COUNT=$(ls -1 ${BACKUP_DIR}/database_*.sql.gz 2>/dev/null | wc -l)
    if [ "$BACKUP_COUNT" -gt 30 ]; then
        ls -1t ${BACKUP_DIR}/database_*.sql.gz | tail -n +31 | xargs rm -f
        log "✓ Очищены старые бэкапы БД (оставлено последних 30)"
    fi
else
    error "✗ Ошибка при создании бэкапа базы данных"
    exit 1
fi

exit 0
