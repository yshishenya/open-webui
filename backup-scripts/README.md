# Система бэкапа Open WebUI

Автоматизированное резервное копирование всех данных Open WebUI.

## Быстрый старт

### 1. Создать первый бэкап

```bash
cd /opt/projects/open-webui/backup-scripts
sudo ./backup-full.sh
```

### 2. Настроить автоматические бэкапы

```bash
sudo ./setup-backup-cron.sh
```

Стандартное расписание:
- **Полный бэкап**: ежедневно в 02:00
- **Бэкап БД**: каждые 6 часов

## Доступные команды

| Команда | Описание | Время выполнения |
|---------|----------|------------------|
| `sudo ./backup-full.sh` | Полный бэкап (БД + данные + конфиг) | 10-30 мин |
| `sudo ./backup-db-only.sh` | Только база данных | 2-5 мин |
| `sudo ./restore.sh` | Восстановление из бэкапа | 15-40 мин |
| `sudo ./setup-backup-cron.sh` | Настройка автоматизации | 1 мин |

## Что бэкапится

- PostgreSQL база данных (~12GB)
- Данные приложения (~70GB) - файлы, документы, модели
- Конфигурация (.env, docker-compose.yaml)

## Восстановление

```bash
cd /opt/projects/open-webui/backup-scripts

# Посмотреть доступные бэкапы
sudo ./restore.sh

# Восстановить из конкретного бэкапа
sudo ./restore.sh openwebui_full_YYYYMMDD_HHMMSS
```

## Мониторинг

```bash
# Просмотреть логи автоматических бэкапов
tail -f ../backups/cron.log

# Список всех бэкапов
ls -lh ../backups/

# Размер бэкапов
du -sh ../backups/
```

## Структура

```
open-webui/
├── backup-scripts/          # Скрипты (вы здесь)
│   ├── backup-full.sh      # Полный бэкап
│   ├── backup-db-only.sh   # Бэкап БД
│   ├── restore.sh          # Восстановление
│   ├── setup-backup-cron.sh # Автоматизация
│   ├── README.md           # Этот файл
│   └── BACKUP_README.md    # Полная документация
└── backups/                # Директория с бэкапами
    ├── db/                 # Бэкапы БД
    │   └── database_*.sql.gz
    └── openwebui_full_*.tar.gz  # Полные бэкапы
```

## Полная документация

Подробная документация со всеми возможностями, troubleshooting и best practices:

**[BACKUP_README.md](BACKUP_README.md)**

## Важно

- Запускайте скрипты с `sudo`
- Бэкапы хранятся в `../backups/`
- Автоматически удаляются старые бэкапы (7 полных, 30 БД)
- Перед восстановлением текущие данные сохраняются в `old_data_*/`

---

Для получения помощи: см. [BACKUP_README.md](BACKUP_README.md)
