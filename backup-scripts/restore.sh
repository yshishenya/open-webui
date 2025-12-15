#!/bin/bash
#
# Open WebUI - Восстановление из бэкапа
# Восстанавливает все данные из указанного архива
#

set -euo pipefail

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Конфигурация
PROJECT_DIR="/opt/projects/open-webui"
BACKUP_DIR="${PROJECT_DIR}/backups"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Проверка аргументов
if [ $# -eq 0 ]; then
    error "Использование: sudo ./restore.sh <имя_бэкапа>"
    echo ""
    echo "Доступные бэкапы:"
    ls -1t ${BACKUP_DIR}/openwebui_full_*.tar.gz 2>/dev/null | while read backup; do
        basename "$backup" .tar.gz
    done
    exit 1
fi

BACKUP_NAME="$1"
BACKUP_ARCHIVE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

# Проверка наличия архива
if [ ! -f "$BACKUP_ARCHIVE" ]; then
    # Попробуем найти с расширением
    if [ -f "${BACKUP_DIR}/${BACKUP_NAME}" ]; then
        BACKUP_ARCHIVE="${BACKUP_DIR}/${BACKUP_NAME}"
    else
        error "Бэкап не найден: $BACKUP_ARCHIVE"
        exit 1
    fi
fi

# Проверка запуска от root
if [ "$EUID" -ne 0 ]; then
    error "Скрипт должен запускаться с правами root (sudo)"
    exit 1
fi

log "========================================="
log "Восстановление Open WebUI из бэкапа"
log "========================================="
log "Архив: $BACKUP_ARCHIVE"
log "Размер: $(du -h $BACKUP_ARCHIVE | cut -f1)"
log ""

# Предупреждение
warn "ВНИМАНИЕ! Это действие:"
warn "  - Остановит все контейнеры Open WebUI"
warn "  - Заменит текущие данные на данные из бэкапа"
warn "  - Существующие данные будут сохранены в директорию old_data/"
warn ""
read -p "Продолжить? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log "Восстановление отменено"
    exit 0
fi

# Распаковка архива
TEMP_DIR="${BACKUP_DIR}/restore_temp"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

log "1. Распаковка архива..."
tar -xzf "$BACKUP_ARCHIVE" -C "$TEMP_DIR"
RESTORE_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "openwebui_full_*" | head -1)

if [ -z "$RESTORE_DIR" ]; then
    error "Не удалось найти данные в архиве"
    exit 1
fi

log "   ✓ Архив распакован"

# Показать информацию о бэкапе
if [ -f "${RESTORE_DIR}/backup_info.txt" ]; then
    log ""
    log "Информация о бэкапе:"
    cat "${RESTORE_DIR}/backup_info.txt" | sed 's/^/   /'
    log ""
fi

# Остановка контейнеров
log "2. Остановка контейнеров..."
cd "$PROJECT_DIR"
docker-compose down
log "   ✓ Контейнеры остановлены"

# Сохранение текущих данных
log "3. Сохранение текущих данных..."
BACKUP_OLD_DIR="${PROJECT_DIR}/old_data_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_OLD_DIR"

if [ -d "${PROJECT_DIR}/postgres-data" ]; then
    mv "${PROJECT_DIR}/postgres-data" "${BACKUP_OLD_DIR}/"
    log "   ✓ PostgreSQL данные сохранены"
fi

if [ -d "${PROJECT_DIR}/open-webui-data" ]; then
    mv "${PROJECT_DIR}/open-webui-data" "${BACKUP_OLD_DIR}/"
    log "   ✓ Данные приложения сохранены"
fi

if [ -f "${PROJECT_DIR}/.env" ]; then
    cp "${PROJECT_DIR}/.env" "${BACKUP_OLD_DIR}/.env.old"
    log "   ✓ Конфигурация сохранена"
fi

# Восстановление базы данных
log "4. Подготовка базы данных..."
mkdir -p "${PROJECT_DIR}/postgres-data"

# Запускаем только PostgreSQL для восстановления
docker-compose up -d postgres
log "   Ожидание запуска PostgreSQL..."
sleep 10

# Восстанавливаем базу данных
if [ -f "${RESTORE_DIR}/database.sql" ]; then
    log "   Восстановление базы данных..."
    docker exec -i open-webui-postgres psql -U openwebui openwebui < "${RESTORE_DIR}/database.sql" >/dev/null 2>&1
    log "   ✓ База данных восстановлена"
else
    error "   ✗ Файл database.sql не найден в бэкапе"
fi

# Останавливаем PostgreSQL
docker-compose down
sleep 3

# Восстановление данных приложения
log "5. Восстановление данных приложения..."
if [ -f "${RESTORE_DIR}/open-webui-data.tar.gz" ]; then
    tar -xzf "${RESTORE_DIR}/open-webui-data.tar.gz" -C "${PROJECT_DIR}"
    log "   ✓ Данные приложения восстановлены"
else
    warn "   ! Файл open-webui-data.tar.gz не найден в бэкапе"
fi

# Восстановление конфигурации
log "6. Восстановление конфигурации..."
if [ -f "${RESTORE_DIR}/.env.backup" ]; then
    read -p "Восстановить файл .env из бэкапа? (yes/no): " -r
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        cp "${RESTORE_DIR}/.env.backup" "${PROJECT_DIR}/.env"
        log "   ✓ Файл .env восстановлен"
    else
        log "   - Файл .env оставлен без изменений"
    fi
fi

if [ -f "${RESTORE_DIR}/docker-compose.yaml" ]; then
    read -p "Восстановить docker-compose.yaml из бэкапа? (yes/no): " -r
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        cp "${RESTORE_DIR}/docker-compose.yaml" "${PROJECT_DIR}/"
        log "   ✓ docker-compose.yaml восстановлен"
    else
        log "   - docker-compose.yaml оставлен без изменений"
    fi
fi

# Исправление прав доступа
log "7. Исправление прав доступа..."
chown -R 70:70 "${PROJECT_DIR}/postgres-data" 2>/dev/null || true
log "   ✓ Права доступа установлены"

# Запуск системы
log "8. Запуск системы..."
cd "$PROJECT_DIR"
docker-compose up -d

log ""
log "========================================="
log "Восстановление успешно завершено!"
log "========================================="
log ""
log "Старые данные сохранены в: $BACKUP_OLD_DIR"
log "Вы можете удалить их после проверки: sudo rm -rf $BACKUP_OLD_DIR"
log ""
log "Проверьте работу системы:"
log "  - docker-compose ps"
log "  - docker-compose logs -f"
log ""

# Очистка
rm -rf "$TEMP_DIR"

exit 0
