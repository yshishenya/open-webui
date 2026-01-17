import logging
import os
import time

import docker
import pytest
from docker import DockerClient
from pytest_docker.plugin import get_docker_ip
from fastapi.testclient import TestClient
from sqlalchemy import text, create_engine


log = logging.getLogger(__name__)


def get_fast_api_client():
    from main import app

    with TestClient(app) as c:
        return c


class AbstractIntegrationTest:
    BASE_PATH = None

    def create_url(self, path="", query_params=None):
        if self.BASE_PATH is None:
            raise Exception("BASE_PATH is not set")
        parts = self.BASE_PATH.split("/")
        parts = [part.strip() for part in parts if part.strip() != ""]
        path_parts = path.split("/")
        path_parts = [part.strip() for part in path_parts if part.strip() != ""]
        query_parts = ""
        if query_params:
            query_parts = "&".join(
                [f"{key}={value}" for key, value in query_params.items()]
            )
            query_parts = f"?{query_parts}"
        return "/".join(parts + path_parts) + query_parts

    @classmethod
    def setup_class(cls):
        pass

    def setup_method(self):
        pass

    @classmethod
    def teardown_class(cls):
        pass

    def teardown_method(self):
        pass


class AbstractPostgresTest(AbstractIntegrationTest):
    DOCKER_CONTAINER_NAME = "postgres-test-container-will-get-deleted"
    docker_client: DockerClient

    @classmethod
    def _create_db_url(cls, env_vars_postgres: dict) -> str:
        host = get_docker_ip()
        user = env_vars_postgres["POSTGRES_USER"]
        pw = env_vars_postgres["POSTGRES_PASSWORD"]
        port = 8081
        db = env_vars_postgres["POSTGRES_DB"]
        return f"postgresql://{user}:{pw}@{host}:{port}/{db}"

    @classmethod
    def setup_class(cls):
        super().setup_class()
        existing_db_url = os.environ.get("DATABASE_URL")
        if existing_db_url:
            cls.fast_api_client = get_fast_api_client()
            return

        try:
            env_vars_postgres = {
                "POSTGRES_USER": "user",
                "POSTGRES_PASSWORD": "example",
                "POSTGRES_DB": "openwebui",
            }
            cls.docker_client = docker.from_env()
            cls.docker_client.containers.run(
                "postgres:16.2",
                detach=True,
                environment=env_vars_postgres,
                name=cls.DOCKER_CONTAINER_NAME,
                ports={5432: ("0.0.0.0", 8081)},
                command="postgres -c log_statement=all",
            )
            time.sleep(0.5)

            database_url = cls._create_db_url(env_vars_postgres)
            os.environ["DATABASE_URL"] = database_url
            retries = 10
            db = None
            while retries > 0:
                try:
                    from open_webui.config import OPEN_WEBUI_DIR

                    db = create_engine(database_url, pool_pre_ping=True)
                    db = db.connect()
                    log.info("postgres is ready!")
                    break
                except Exception as e:
                    log.warning(e)
                    time.sleep(3)
                    retries -= 1

            if db:
                # import must be after setting env!
                cls.fast_api_client = get_fast_api_client()
                db.close()
            else:
                raise Exception("Could not connect to Postgres")
        except Exception as ex:
            log.error(ex)
            cls.teardown_class()
            pytest.fail(f"Could not setup test environment: {ex}")

    def _check_db_connection(self):
        from open_webui.internal.db import Session

        retries = 10
        while retries > 0:
            try:
                Session.execute(text("SELECT 1"))
                Session.commit()
                break
            except Exception as e:
                Session.rollback()
                log.warning(e)
                time.sleep(3)
                retries -= 1

    def setup_method(self):
        super().setup_method()
        self._check_db_connection()

    @classmethod
    def teardown_class(cls) -> None:
        super().teardown_class()
        if getattr(cls, "docker_client", None):
            cls.docker_client.containers.get(cls.DOCKER_CONTAINER_NAME).remove(
                force=True
            )

    def teardown_method(self):
        from open_webui.internal.db import Session

        # rollback everything not yet committed
        Session.commit()

        # truncate all tables
        tables = [
            "auth",
            "billing_audit_log",
            "billing_ledger_entry",
            "billing_payment",
            "billing_plan",
            "billing_pricing_rate_card",
            "billing_promo_code",
            "billing_subscription",
            "billing_transaction",
            "billing_usage",
            "billing_usage_event",
            "billing_lead_magnet_state",
            "billing_wallet",
            "chat",
            "chatidtag",
            "document",
            "memory",
            "model",
            "prompt",
            "tag",
            '"user"',
        ]
        dialect_name = Session.get_bind().dialect.name
        for table in tables:
            if dialect_name == "sqlite":
                Session.execute(text(f"DELETE FROM {table}"))
            else:
                Session.execute(text(f"TRUNCATE TABLE {table}"))
        Session.commit()
