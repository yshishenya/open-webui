#!/bin/bash
#
# Open WebUI - Полный бэкап системы
# Создает архив всех критичных данных
#

set -euo pipefail

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Конфигурация
PROJECT_DIR="/opt/projects/open-webui"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="openwebui_full_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Переменные окружения
if [ -f "${PROJECT_DIR}/.env" ]; then
    source "${PROJECT_DIR}/.env"
fi

# Логирование
LOG_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.log"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Проверка запуска от root или с правами на sudo
if [ "$EUID" -ne 0 ]; then
    error "Скрипт должен запускаться с правами root (sudo)"
    exit 1
fi

# Создание директории для бэкапа
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_PATH"

log "========================================="
log "Начало полного бэкапа Open WebUI"
log "========================================="
log "Директория бэкапа: $BACKUP_PATH"

# 1. Бэкап PostgreSQL базы данных (с использованием pg_dump)
log "1. Создание дампа PostgreSQL базы данных..."
docker exec open-webui-postgres pg_dump -U openwebui openwebui > "${BACKUP_PATH}/database.sql" 2>> "$LOG_FILE"
if [ $? -eq 0 ]; then
    log "   ✓ База данных успешно экспортирована ($(du -h ${BACKUP_PATH}/database.sql | cut -f1))"
else
    error "   ✗ Ошибка при экспорте базы данных"
    exit 1
fi

# 2. Бэкап данных приложения
log "2. Архивирование данных приложения..."
if [ -d "${PROJECT_DIR}/open-webui-data" ]; then
    tar -czf "${BACKUP_PATH}/open-webui-data.tar.gz" -C "${PROJECT_DIR}" open-webui-data 2>> "$LOG_FILE"
    if [ $? -eq 0 ]; then
        log "   ✓ Данные приложения заархивированы ($(du -h ${BACKUP_PATH}/open-webui-data.tar.gz | cut -f1))"
    else
        error "   ✗ Ошибка при архивировании данных приложения"
    fi
else
    warn "   ! Директория open-webui-data не найдена"
fi

# 3. Бэкап конфигурационных файлов
log "3. Копирование конфигурационных файлов..."
cp "${PROJECT_DIR}/docker-compose.yaml" "${BACKUP_PATH}/" 2>> "$LOG_FILE"
cp "${PROJECT_DIR}/.env" "${BACKUP_PATH}/.env.backup" 2>> "$LOG_FILE"
if [ -f "${PROJECT_DIR}/.env.example" ]; then
    cp "${PROJECT_DIR}/.env.example" "${BACKUP_PATH}/" 2>> "$LOG_FILE"
fi
log "   ✓ Конфигурационные файлы скопированы"

# 4. Создание метаданных бэкапа
log "4. Создание метаданных бэкапа..."
cat > "${BACKUP_PATH}/backup_info.txt" << EOF
Open WebUI Backup Information
==============================
Дата создания: $(date +'%Y-%m-%d %H:%M:%S')
Hostname: $(hostname)
Версия образа: ${WEBUI_DOCKER_TAG-main}

Содержимое бэкапа:
- PostgreSQL база данных (database.sql)
- Данные приложения (open-webui-data.tar.gz)
- Конфигурация Docker Compose (docker-compose.yaml)
- Переменные окружения (.env.backup)

Размеры:
- База данных: $(du -h ${BACKUP_PATH}/database.sql | cut -f1)
- Данные приложения: $(du -h ${BACKUP_PATH}/open-webui-data.tar.gz | cut -f1 2>/dev/null || echo "N/A")
- Общий размер: $(du -sh ${BACKUP_PATH} | cut -f1)

Для восстановления используйте: sudo ./restore.sh ${BACKUP_NAME}
EOF
log "   ✓ Метаданные созданы"

# 5. Создание общего архива (опционально)
log "5. Создание финального архива..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}" 2>> "$LOG_FILE"
if [ $? -eq 0 ]; then
    log "   ✓ Финальный архив создан: ${BACKUP_NAME}.tar.gz ($(du -h ${BACKUP_NAME}.tar.gz | cut -f1))"
    # Удаляем временную директорию
    rm -rf "${BACKUP_PATH}"
else
    error "   ✗ Ошибка при создании финального архива"
fi

# 6. Очистка старых бэкапов (оставляем последние 7)
log "6. Очистка старых бэкапов..."
BACKUP_COUNT=$(ls -1 ${BACKUP_DIR}/openwebui_full_*.tar.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 7 ]; then
    ls -1t ${BACKUP_DIR}/openwebui_full_*.tar.gz | tail -n +8 | xargs rm -f
    log "   ✓ Удалены старые бэкапы (оставлено последних 7)"
else
    log "   ✓ Очистка не требуется (всего бэкапов: $BACKUP_COUNT)"
fi

log "========================================="
log "Бэкап успешно завершен!"
log "Файл: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
log "Размер: $(du -h ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz | cut -f1)"
log "========================================="

# Вывод информации о всех доступных бэкапах
echo ""
log "Доступные бэкапы:"
ls -lh ${BACKUP_DIR}/openwebui_full_*.tar.gz 2>/dev/null | awk '{print "  " $9 " - " $5 " - " $6 " " $7 " " $8}'

exit 0
