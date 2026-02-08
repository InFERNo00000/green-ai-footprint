"""
GREEN-AI FOOTPRINT TOOL — Database Connection
==============================================

SQLAlchemy setup for MySQL database connection.
Handles connection pooling and session management.
"""

import os
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables (always from this folder)
_ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Safe local default only (keeps dev experience, but prevents accidental prod fallbacks)
    DATABASE_URL = "mysql+mysqlconnector://root:password@localhost:3306/green_ai_footprint"

if DATABASE_URL.startswith("internal-postgresql://"):
    DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len("internal-postgresql://"):]

if DATABASE_URL.startswith("internal-postgres://"):
    DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len("internal-postgres://"):]

if DATABASE_URL.startswith("postgresql://"):
    # SQLAlchemy accepts postgresql://, but Render often provides postgres://
    # Keep explicit scheme normalization in one place.
    DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len("postgresql://"):]

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len("postgres://"):]


def _normalize_postgres_ssl_url(database_url: str) -> str:
    ssl_enabled = os.getenv("DB_SSL", "").lower() in {"1", "true", "yes"}
    if not ssl_enabled:
        return database_url

    ca_path = os.getenv("DB_SSL_CA")
    verify_cert = os.getenv("DB_SSL_VERIFY_CERT", "true").lower() in {"1", "true", "yes"}

    try:
        url = make_url(database_url)
    except Exception:
        return database_url

    if url.get_backend_name() != "postgresql":
        return database_url

    q = dict(url.query)
    # Remove any ssl params that could be inherited from provider defaults
    q.pop("sslmode", None)
    q.pop("sslrootcert", None)

    if verify_cert and ca_path:
        q["sslmode"] = "verify-full"
        q["sslrootcert"] = ca_path
    else:
        # Render external Postgres commonly works with sslmode=require without a local root.crt.
        q["sslmode"] = "require"

    return str(url.set(query=q))


if DATABASE_URL.startswith("postgresql+"):
    DATABASE_URL = _normalize_postgres_ssl_url(DATABASE_URL)


def _build_connect_args() -> dict:
    """Build DB driver connect_args with optional SSL settings.

    Render-managed databases commonly require SSL. Configure via env:
    - DB_SSL=true
    - DB_SSL_CA=/path/to/ca.pem (optional)
    - DB_SSL_VERIFY_CERT=true|false (optional)
    """
    connect_args: dict = {}

    ssl_enabled = os.getenv("DB_SSL", "").lower() in {"1", "true", "yes"}
    if not ssl_enabled:
        return connect_args

    ca_path = os.getenv("DB_SSL_CA")
    verify_cert = os.getenv("DB_SSL_VERIFY_CERT", "true").lower() in {"1", "true", "yes"}

    is_postgres = DATABASE_URL.startswith("postgresql+") or DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://")

    if is_postgres:
        # Postgres SSL is enforced via DATABASE_URL normalization above.
        connect_args.update(
            {
                # Prevent long hangs during cold starts / transient DB restarts
                "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "10")),
                # Keep connections alive; Render/free tier can drop idle SSL sessions
                "keepalives": 1,
                "keepalives_idle": int(os.getenv("DB_KEEPALIVES_IDLE", "30")),
                "keepalives_interval": int(os.getenv("DB_KEEPALIVES_INTERVAL", "10")),
                "keepalives_count": int(os.getenv("DB_KEEPALIVES_COUNT", "5")),
                "application_name": os.getenv("DB_APP_NAME", "green-ai-footprint"),
            }
        )
        return connect_args

    # mysql-connector-python SSL options
    if ca_path:
        connect_args.update({
            "ssl_ca": ca_path,
            "ssl_verify_cert": verify_cert,
        })
    else:
        # If CA isn't provided, still request SSL when supported
        connect_args.update({
            "ssl_disabled": False,
        })

    return connect_args

# Create SQLAlchemy engine
_is_postgres_engine = False
try:
    _is_postgres_engine = make_url(DATABASE_URL).get_backend_name() == "postgresql"
except Exception:
    _is_postgres_engine = DATABASE_URL.startswith("postgresql")

engine = create_engine(
    DATABASE_URL,
    echo=os.getenv("ENVIRONMENT") == "development",  # Log SQL in development
    pool_pre_ping=True,  # Check connections before use
    # Render/free-tier Postgres can drop idle SSL connections; recycle sooner
    pool_recycle=300 if _is_postgres_engine else 3600,
    pool_timeout=30,
    pool_size=1 if _is_postgres_engine else 5,
    max_overflow=0 if _is_postgres_engine else 10,
    connect_args=_build_connect_args(),
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for models
Base = declarative_base()

# Dependency to get DB session
def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Test database connection
def test_connection():
    """Test database connection."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            print("Database connection successful!")
            return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False


def get_sanitized_database_url() -> dict:
    """Return a sanitized view of the effective DATABASE_URL (no password)."""
    try:
        url = make_url(DATABASE_URL)
        return {
            "backend": url.get_backend_name(),
            "driver": url.drivername,
            "username": url.username,
            "host": url.host,
            "port": url.port,
            "database": url.database,
            "query": dict(url.query),
        }
    except Exception:
        # Fall back to best-effort masking if parsing fails
        raw = DATABASE_URL
        if "://" in raw and "@" in raw:
            prefix, rest = raw.split("://", 1)
            creds, after = rest.split("@", 1)
            if ":" in creds:
                user, _pw = creds.split(":", 1)
                creds = f"{user}:***"
            raw = f"{prefix}://{creds}@{after}"
        return {"raw": raw}
