# Open WebUI - Система бэкапа и восстановления

## Обзор

Комплексная система бэкапа для Open WebUI, включающая автоматическое резервное копирование всех критичных данных.

### Что бэкапится

1. **PostgreSQL база данных** (~12GB) - все пользователи, чаты, настройки
2. **Данные приложения** (~70GB) - загруженные файлы, документы, модели
3. **Конфигурация** - docker-compose.yaml, .env файлы
4. **Метаданные** - информация о бэкапе для удобного восстановления

## Доступные скрипты

### 1. backup-full.sh - Полный бэкап
Создает полный бэкап всей системы (БД + данные + конфигурация).

**Использование:**
```bash
sudo ./backup-full.sh
```

**Что делает:**
- Создает дамп PostgreSQL базы данных
- Архивирует все данные приложения (open-webui-data/)
- Копирует конфигурационные файлы
- Создает метаданные с информацией о бэкапе
- Упаковывает все в один tar.gz архив
- Автоматически удаляет старые бэкапы (оставляет последние 7)

**Результат:**
- Файл: `backups/openwebui_full_YYYYMMDD_HHMMSS.tar.gz`
- Размер: ~15-20GB (сжатый)
- Время выполнения: 10-30 минут (зависит от размера данных)

### 2. backup-db-only.sh - Быстрый бэкап БД
Создает только дамп базы данных (для частых инкрементальных бэкапов).

**Использование:**
```bash
sudo ./backup-db-only.sh
```

**Что делает:**
- Создает сжатый дамп PostgreSQL
- Быстрое выполнение (1-2 минуты)
- Автоматически удаляет старые бэкапы БД (оставляет последние 30)

**Результат:**
- Файл: `backups/db/database_YYYYMMDD_HHMMSS.sql.gz`
- Размер: ~500MB-2GB (сжатый)

### 3. restore.sh - Восстановление
Восстанавливает систему из бэкапа.

**Использование:**
```bash
# Просмотр доступных бэкапов
sudo ./restore.sh

# Восстановление из конкретного бэкапа
sudo ./restore.sh openwebui_full_20251118_120000
```

**Что делает:**
- Останавливает все контейнеры
- Сохраняет текущие данные в `old_data_YYYYMMDD_HHMMSS/`
- Восстанавливает базу данных
- Восстанавливает данные приложения
- Опционально восстанавливает конфигурацию
- Запускает систему

**ВНИМАНИЕ:** Это действие заменит все текущие данные!

### 4. setup-backup-cron.sh - Автоматизация
Настраивает автоматические бэкапы через cron.

**Использование:**
```bash
sudo ./setup-backup-cron.sh
```

**Стандартное расписание:**
- Полный бэкап: каждый день в 02:00
- Бэкап БД: каждые 6 часов (00:00, 06:00, 12:00, 18:00)

**Логи:** `backups/cron.log`

## Быстрый старт

### Первоначальная настройка

1. Перейти в директорию со скриптами:
```bash
cd /opt/projects/open-webui/backup-scripts
```

2. Сделать скрипты исполняемыми:
```bash
sudo chmod +x backup-full.sh backup-db-only.sh restore.sh setup-backup-cron.sh
```

3. Создать первый тестовый бэкап:
```bash
sudo ./backup-full.sh
```

4. Настроить автоматические бэкапы:
```bash
sudo ./setup-backup-cron.sh
```

### Типичные сценарии

#### Ежедневный бэкап перед важным обновлением
```bash
cd /opt/projects/open-webui/backup-scripts
sudo ./backup-full.sh
```

#### Быстрый бэкап перед экспериментами
```bash
cd /opt/projects/open-webui/backup-scripts
sudo ./backup-db-only.sh
```

#### Восстановление после сбоя
```bash
# 1. Перейти в директорию со скриптами
cd /opt/projects/open-webui/backup-scripts

# 2. Посмотреть доступные бэкапы
sudo ./restore.sh

# 3. Выбрать нужный и восстановить
sudo ./restore.sh openwebui_full_20251118_120000

# 4. Проверить что все работает
cd /opt/projects/open-webui
docker-compose ps
docker-compose logs -f
```

## Управление бэкапами

### Просмотр всех бэкапов
```bash
# Полные бэкапы
ls -lh backups/openwebui_full_*.tar.gz

# Бэкапы БД
ls -lh backups/db/database_*.sql.gz
```

### Информация о бэкапе
```bash
# Распаковать и посмотреть метаданные
tar -xzf backups/openwebui_full_20251118_120000.tar.gz -C /tmp/
cat /tmp/openwebui_full_20251118_120000/backup_info.txt
```

### Ручная очистка старых бэкапов
```bash
# Удалить бэкапы старше 30 дней
find backups/ -name "openwebui_full_*.tar.gz" -mtime +30 -delete
```

### Копирование бэкапов в удаленное хранилище
```bash
# Пример с rsync
rsync -avz backups/ user@backup-server:/path/to/backups/

# Пример с rclone (Google Drive, S3, etc.)
rclone copy backups/ remote:openwebui-backups/
```

## Мониторинг

### Проверка статуса автоматических бэкапов
```bash
# Просмотреть расписание cron
sudo cat /etc/cron.d/openwebui-backup

# Просмотреть логи
tail -f backups/cron.log

# Последние 50 строк
tail -n 50 backups/cron.log
```

### Проверка размера бэкапов
```bash
# Общий размер всех бэкапов
du -sh backups/

# Размер по типам
du -sh backups/openwebui_full_*
du -sh backups/db/
```

### Проверка успешности последнего бэкапа
```bash
# Проверить что бэкап был создан сегодня
ls -lh backups/openwebui_full_$(date +%Y%m%d)*.tar.gz

# Проверить логи
grep -i "успешно\|error" backups/cron.log | tail -20
```

## Восстановление на новом сервере

1. Установить Docker и Docker Compose
2. Скопировать проект Open WebUI
3. Скопировать бэкап в директорию `backups/`
4. Запустить восстановление:
```bash
cd /opt/projects/open-webui/backup-scripts
sudo ./restore.sh openwebui_full_YYYYMMDD_HHMMSS
```

## Хранение бэкапов

### Рекомендации
- **Локально:** минимум 7 последних полных бэкапов
- **Удаленно:** бэкапы за последние 30+ дней
- **Архив:** ежемесячные бэкапы на долгосрочное хранение

### Стратегия 3-2-1
- **3** копии данных
- На **2** разных типах носителей
- **1** копия вне офиса (облако/удаленный сервер)

### Варианты удаленного хранения
1. **Облачное хранилище** (rclone + Google Drive/Dropbox/OneDrive)
2. **S3-совместимое** (AWS S3, MinIO, Wasabi)
3. **Удаленный сервер** (rsync, scp)
4. **NAS** (Synology, QNAP)

## Тестирование восстановления

**ВАЖНО:** Регулярно тестируйте процесс восстановления!

### Тест на тестовом сервере (рекомендуется)
1. Настроить тестовую VM или контейнер
2. Скопировать последний бэкап
3. Выполнить восстановление
4. Проверить работоспособность

### Быстрый тест (проверка архива)
```bash
# Проверить целостность архива
tar -tzf backups/openwebui_full_YYYYMMDD_HHMMSS.tar.gz > /dev/null

# Проверить что все файлы на месте
tar -tzf backups/openwebui_full_YYYYMMDD_HHMMSS.tar.gz | grep -E "database.sql|open-webui-data.tar.gz|.env.backup"
```

## Безопасность

### Защита бэкапов
1. **Права доступа:** Только root имеет доступ к бэкапам
```bash
chmod 600 backups/*.tar.gz
chown root:root backups/*.tar.gz
```

2. **Шифрование:** Для конфиденциальных данных
```bash
# Шифрование бэкапа
gpg --symmetric --cipher-algo AES256 backups/openwebui_full_YYYYMMDD_HHMMSS.tar.gz

# Расшифровка
gpg --decrypt backups/openwebui_full_YYYYMMDD_HHMMSS.tar.gz.gpg > backup.tar.gz
```

3. **.env файлы:** Содержат пароли! Храните безопасно.

## Troubleshooting

### Бэкап не создается
```bash
# Перейти в директорию со скриптами
cd /opt/projects/open-webui/backup-scripts

# Проверить права доступа
ls -la backup-full.sh

# Проверить место на диске
df -h

# Запустить с подробным выводом
sudo bash -x ./backup-full.sh
```

### Ошибка при восстановлении БД
```bash
# Проверить что PostgreSQL запущен
docker ps | grep postgres

# Проверить логи PostgreSQL
docker logs open-webui-postgres

# Пересоздать БД
docker-compose down
sudo rm -rf postgres-data/
docker-compose up -d postgres
```

### Нет места для бэкапов
```bash
# Очистить старые бэкапы
sudo rm backups/openwebui_full_202511*.tar.gz

# Переместить бэкапы на другой диск
sudo mv backups/ /mnt/backup-drive/
sudo ln -s /mnt/backup-drive/backups backups
```

## Changelog системы бэкапа

### v1.0 (2025-01-18)
- Полный бэкап системы
- Инкрементальный бэкап БД
- Автоматическое восстановление
- Автоматизация через cron
- Документация

## Поддержка

При возникновении проблем:
1. Проверьте логи: `backups/cron.log` и `backups/backup_YYYYMMDD_HHMMSS.log`
2. Проверьте права доступа к скриптам
3. Проверьте свободное место на диске
4. Проверьте что Docker контейнеры запущены

---

**Разработано для Open WebUI**
Последнее обновление: 2025-01-18
