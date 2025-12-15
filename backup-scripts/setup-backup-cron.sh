#!/bin/bash
#
# Open WebUI - Настройка автоматических бэкапов через cron
#

set -euo pipefail

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка запуска от root
if [ "$EUID" -ne 0 ]; then
    error "Скрипт должен запускаться с правами root (sudo)"
    exit 1
fi

PROJECT_DIR="/opt/projects/open-webui"

log "========================================="
log "Настройка автоматических бэкапов"
log "========================================="
log ""

# Проверка наличия скриптов
if [ ! -f "${PROJECT_DIR}/backup-scripts/backup-full.sh" ] || [ ! -f "${PROJECT_DIR}/backup-scripts/backup-db-only.sh" ]; then
    error "Скрипты бэкапа не найдены!"
    exit 1
fi

# Делаем скрипты исполняемыми
chmod +x "${PROJECT_DIR}/backup-scripts/backup-full.sh"
chmod +x "${PROJECT_DIR}/backup-scripts/backup-db-only.sh"
chmod +x "${PROJECT_DIR}/backup-scripts/restore.sh"
log "✓ Скрипты сделаны исполняемыми"

# Создаем cron задачи
CRON_FILE="/etc/cron.d/openwebui-backup"

log ""
log "Создание cron задач..."
log "Предлагаемое расписание:"
log "  - Полный бэкап: каждый день в 02:00"
log "  - Бэкап БД: каждые 6 часов"
log ""

read -p "Использовать стандартное расписание? (yes/no): " -r
if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    cat > "$CRON_FILE" << EOF
# Open WebUI Automated Backups
#
# Полный бэкап - каждый день в 02:00
0 2 * * * root ${PROJECT_DIR}/backup-scripts/backup-full.sh >> ${PROJECT_DIR}/backups/cron.log 2>&1

# Бэкап базы данных - каждые 6 часов
0 */6 * * * root ${PROJECT_DIR}/backup-scripts/backup-db-only.sh >> ${PROJECT_DIR}/backups/cron.log 2>&1
EOF

    chmod 644 "$CRON_FILE"
    log "✓ Cron задачи созданы: $CRON_FILE"
    log ""
    log "Расписание бэкапов:"
    log "  - Полный бэкап: ежедневно в 02:00"
    log "  - Бэкап БД: каждые 6 часов (00:00, 06:00, 12:00, 18:00)"
    log "  - Логи: ${PROJECT_DIR}/backups/cron.log"
else
    log ""
    log "Создание custom расписания..."
    log "Введите расписание для полного бэкапа (формат cron, например: 0 2 * * *):"
    read -r FULL_SCHEDULE

    log "Введите расписание для бэкапа БД (формат cron, например: 0 */6 * * *):"
    read -r DB_SCHEDULE

    cat > "$CRON_FILE" << EOF
# Open WebUI Automated Backups
#
# Полный бэкап
$FULL_SCHEDULE root ${PROJECT_DIR}/backup-scripts/backup-full.sh >> ${PROJECT_DIR}/backups/cron.log 2>&1

# Бэкап базы данных
$DB_SCHEDULE root ${PROJECT_DIR}/backup-scripts/backup-db-only.sh >> ${PROJECT_DIR}/backups/cron.log 2>&1
EOF

    chmod 644 "$CRON_FILE"
    log "✓ Custom cron задачи созданы"
fi

# Перезапускаем cron
systemctl restart cron 2>/dev/null || service cron restart 2>/dev/null || true
log "✓ Cron сервис перезапущен"

log ""
log "========================================="
log "Автоматические бэкапы настроены!"
log "========================================="
log ""
log "Полезные команды:"
log "  Просмотр расписания:  sudo cat $CRON_FILE"
log "  Просмотр логов:       tail -f ${PROJECT_DIR}/backups/cron.log"
log "  Ручной запуск:        sudo ${PROJECT_DIR}/backup-scripts/backup-full.sh"
log "  Список бэкапов:       ls -lh ${PROJECT_DIR}/backups/"
log ""
log "Первый автоматический бэкап будет создан согласно расписанию."
log "Для немедленного создания бэкапа запустите: sudo ${PROJECT_DIR}/backup-scripts/backup-full.sh"
log ""

exit 0
