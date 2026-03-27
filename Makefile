
ifneq ($(shell which docker-compose 2>/dev/null),)
    DOCKER_COMPOSE := docker-compose
else
    DOCKER_COMPOSE := docker compose
endif

install:
	$(DOCKER_COMPOSE) up -d

remove:
	@printf '%s\n' 'Warning: This will remove all containers and volumes, including persistent data. Continue? [Y/N]'
	@read ans; \
	if [ "$$ans" = "Y" ] || [ "$$ans" = "y" ]; then \
		$(DOCKER_COMPOSE) down -v; \
	else \
		echo "Operation cancelled."; \
	fi

start:
	$(DOCKER_COMPOSE) start
startAndBuild: 
	$(DOCKER_COMPOSE) up -d --build

stop:
	$(DOCKER_COMPOSE) stop

update:
	@git pull
	$(DOCKER_COMPOSE) down
	# Make sure the ollama-webui container is stopped before rebuilding
	@docker stop open-webui || true
	$(DOCKER_COMPOSE) up --build -d
	$(DOCKER_COMPOSE) start
