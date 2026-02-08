"""
GREEN-AI FOOTPRINT TOOL — Database Connection
==============================================

SQLAlchemy setup for MySQL database connection.
Handles connection pooling and session management.
"""

import os
from pathlib import Path
from sqlalchemy import create_engine, text
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
engine = create_engine(
    DATABASE_URL,
    echo=os.getenv("ENVIRONMENT") == "development",  # Log SQL in development
    pool_pre_ping=True,  # Check connections before use
    pool_recycle=3600,   # Recycle connections every hour
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
