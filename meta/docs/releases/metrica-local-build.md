# Метрика: сборка на Mac, выкладка готового Docker-образа

Сборка должна выполняться на компьютере пользователя. Команды этого чата
сейчас исполняются на production-сервере; локальный executor недоступен.
Локальный проект: `/Users/yshishenya/Documents/projects/open-webui`.

## Локальная сборка и публикация

Запускать в Terminal на Mac с работающим Docker Desktop и доступом к Docker Hub.
Выделить Docker Desktop достаточную память для Node heap 4096 MB и остальных
процессов сборки (рекомендуется не менее 8 GB). `docker login` выполнять локально;
учётные данные серверного Docker не авторизуют Mac.

Команды используют отдельный временный контекст из конкретного commit;
локальные незакоммиченные изменения не включаются и не перезаписываются.
Сборка frontend использует существующий Dockerfile, backend берётся из точного
production digest. Итоговый образ — `linux/amd64`, в том числе на Apple Silicon.

```bash
set -euo pipefail
cd /Users/yshishenya/Documents/projects/open-webui
git fetch origin codex/bugfix/metrica-audit-20260930
metrica_revision=a5ccb3c8717a05ab7fd1409e7e74209715f7729d
metrica_context=$(mktemp -d "${TMPDIR:-/tmp}/airis-metrica.XXXXXX")
git archive "$metrica_revision" | tar -x -C "$metrica_context"
metrica_frontend=airis-metrica-frontend:a5ccb3c87
metrica_image=yshishenya/yshishenya:a5ccb3c87-metrica-20260930

docker build --platform linux/amd64 --target build \
  --build-arg BUILD_HASH="$metrica_revision" \
  --build-arg PUBLIC_YANDEX_METRICA_ID=111392024 \
  --build-arg PUBLIC_GA_MEASUREMENT_ID= \
  --build-arg AIRIS_VITE_SOURCEMAP=false \
  --build-arg NODE_MAX_OLD_SPACE_SIZE=4096 \
  -t "$metrica_frontend" "$metrica_context"

metrica_container=$(docker create "$metrica_frontend")
docker cp "$metrica_container:/app/build" "$metrica_context/build"
docker rm "$metrica_container"

cat > "$metrica_context/Dockerfile.metrica" <<'DOCKERFILE'
FROM yshishenya/yshishenya@sha256:67360084aec6e582998835285b68704af278dd1c165886f6f56f3697882558c7
ARG SOURCE_REVISION
LABEL org.opencontainers.image.revision=$SOURCE_REVISION
LABEL org.opencontainers.image.description="Airis Yandex Metrica frontend fix"
COPY build/ /app/build/
DOCKERFILE

docker build --platform linux/amd64 \
  --build-arg SOURCE_REVISION="$metrica_revision" \
  -f "$metrica_context/Dockerfile.metrica" \
  -t "$metrica_image" "$metrica_context"

# Проверить содержимое готового образа без запуска backend.
metrica_runtime=$(docker create --platform linux/amd64 "$metrica_image")
docker cp "$metrica_runtime:/app/build/_app/env.js" "$metrica_context/env.js"
docker rm "$metrica_runtime"
cat "$metrica_context/env.js"
grep -Eq 'PUBLIC_YANDEX_METRICA_ID[[:space:]]*:[[:space:]]*"111392024"' "$metrica_context/env.js"
test "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$metrica_image")" = linux/amd64

docker push "$metrica_image"
docker image inspect --format '{{json .RepoDigests}}' "$metrica_image"
```

Если любая команда завершилась ошибкой, не продолжать публикацию вручную и не
использовать частичный `build/`. Сохранять вывод успешного push и digest для
серверной проверки. Номер 111392024 взят из production deployment configuration;
его настройки и принадлежность дополнительно сверить в кабинете Метрики.

## Серверная выкладка после публикации

На сервере разрешены pull/import готового образа и Docker Compose rollout.
Сборку на сервере не запускать. Перед переключением:

1. Сверить текущий image: baseline `a78b95932936c97651baefe9955f7b8dfdb42d86`,
   digest `sha256:67360084aec6e582998835285b68704af278dd1c165886f6f56f3697882558c7`.
   При другой параллельной выкладке пересмотреть frontend overlay base.
2. Проверить архитектуру, digest, revision label, compiled env.js и version marker.
3. Пройти штатные backup/checksum/archive, disk и migration gates guarded deploy.
   Сохранить реально работающий image для отката: `.env` содержит устаревший tag.
4. Пересоздать только сервис `airis` с `--no-build --no-deps`;
   дождаться healthy и проверить публичный `/health`.
5. В браузере проверить consent, один initial PageView, SPA transitions,
   UTM и отсутствие приватных query/hash/title, отзыв согласия.
6. Отдельно подключить и перепубликовать Tilda; проверить domain filters, цели,
   ecommerce и появление данных в авторизованном кабинете Метрики.

До выполнения этих шагов rollout и восстановление статистики не подтверждены.
