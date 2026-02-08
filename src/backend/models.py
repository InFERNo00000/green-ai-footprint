"""
GREEN-AI FOOTPRINT TOOL — SQLAlchemy Models
============================================

MySQL-compatible models for the Green-AI Footprint Tool database.
Adapted from PostgreSQL schema to use MySQL-compatible data types.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey, DECIMAL, Enum
from sqlalchemy.orm import relationship
from .database import Base

# Enum definitions for MySQL
ModelCategoryEnum = Enum(
    'frontier-llm', 'mid-size-llm', 'small-edge', 'code-model',
    'image-gen', 'embedding', 'multimodal', 'custom',
    name='model_category'
)

GpuTypeEnum = Enum(
    'nvidia-h100', 'nvidia-a100-80gb', 'nvidia-a100-40gb',
    'nvidia-v100', 'nvidia-t4', 'nvidia-a10g', 'cpu-only',
    name='gpu_type'
)

class Organization(Base):
    """Organization model."""
    __tablename__ = "organizations"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    ai_models = relationship("AIModel", back_populates="organization", cascade="all, delete-orphan")
    calculation_logs = relationship("CalculationLog", back_populates="organization", cascade="all, delete-orphan")
    esg_reports = relationship("ESGReport", back_populates="organization", cascade="all, delete-orphan")

class User(Base):
    """User model."""
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False)
    role = Column(String(50), default="viewer")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    ai_models = relationship("AIModel", back_populates="creator")
    calculation_logs = relationship("CalculationLog", back_populates="user")

class AIModel(Base):
    """AI Model table - stores both predefined and custom models."""
    __tablename__ = "ai_models"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    slug = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(200), nullable=False)
    family = Column(String(100), nullable=False)
    category = Column(ModelCategoryEnum, nullable=False)
    is_predefined = Column(Boolean, default=False)
    
    # Model specifications
    parameters_billion = Column(DECIMAL(10, 4), nullable=False)
    energy_per_million_tokens_kwh = Column(DECIMAL(10, 6), nullable=False)
    default_gpu = Column(GpuTypeEnum, nullable=False)
    gpu_count_inference = Column(Integer, nullable=False, default=1)
    tokens_per_second_per_gpu = Column(Integer, nullable=False)
    quality_score = Column(Integer, nullable=False)
    
    # Training metadata (optional)
    training_energy_mwh = Column(DECIMAL(12, 2))
    training_co2e_tons = Column(DECIMAL(12, 2))
    
    # User-provided context
    description = Column(Text)
    
    # Ownership (NULL for predefined models)
    created_by = Column(String(36), ForeignKey("users.id"))
    organization_id = Column(String(36), ForeignKey("organizations.id"))
    
    # Lifecycle
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = relationship("User", back_populates="ai_models")
    organization = relationship("Organization", back_populates="ai_models")
    calculation_logs = relationship("CalculationLog", back_populates="model")

class CalculationLog(Base):
    """Footprint calculation logs (audit trail)."""
    __tablename__ = "calculation_logs"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"))
    organization_id = Column(String(36), ForeignKey("organizations.id"))
    model_id = Column(String(36), ForeignKey("ai_models.id"))
    region_id = Column(String(50), nullable=False)
    request_count = Column(Integer, nullable=False)
    avg_tokens_per_request = Column(Integer, nullable=False)
    total_tokens = Column(Integer, nullable=False)
    
    # Results
    energy_kwh = Column(DECIMAL(12, 6), nullable=False)
    co2e_grams = Column(DECIMAL(12, 4), nullable=False)
    water_liters = Column(DECIMAL(12, 6), nullable=False)
    hardware_amortized_grams = Column(DECIMAL(12, 6), nullable=False)
    eco_score = Column(DECIMAL(5, 1))
    eco_grade = Column(String(3))
    
    # Configuration used
    pue_factor = Column(DECIMAL(4, 2))
    wue_factor = Column(DECIMAL(4, 2))
    
    calculated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="calculation_logs")
    organization = relationship("Organization", back_populates="calculation_logs")
    model = relationship("AIModel", back_populates="calculation_logs")

# Grid Carbon Intensity Table (for reference data)
class GridCarbonIntensity(Base):
    """Grid carbon intensity by region."""
    __tablename__ = "grid_carbon_intensities"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    region_id = Column(String(50), unique=True, nullable=False)
    provider = Column(String(50), nullable=False)
    location = Column(String(200), nullable=False)
    gco2e_per_kwh = Column(DECIMAL(8, 2), nullable=False)
    source = Column(String(500), nullable=False)
    year = Column(Integer, nullable=False)
    renewable_percentage = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# GPU Profile Table (for reference data)
class GPUProfile(Base):
    """GPU hardware profiles."""
    __tablename__ = "gpu_profiles"
    
    id = Column(String(50), primary_key=True)  # GPU type as primary key
    name = Column(String(100), nullable=False)
    tdp_watts = Column(Integer, nullable=False)
    typical_utilization = Column(DECIMAL(3, 2), nullable=False)
    memory_gb = Column(Integer, nullable=False)
    flops_teraflops = Column(Integer, nullable=False)
    embodied_carbon_kg_co2e = Column(DECIMAL(8, 2), nullable=False)
    expected_lifespan_hours = Column(Integer, nullable=False)
    water_cooling_liters_per_hour = Column(DECIMAL(4, 2), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ESGReport(Base):
    """Persisted ESG report snapshots for an organization."""

    __tablename__ = "esg_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False)

    name = Column(String(200), nullable=False)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)

    total_requests = Column(Integer, nullable=False)
    total_energy_kwh = Column(DECIMAL(14, 6), nullable=False)
    total_co2e_kg = Column(DECIMAL(14, 6), nullable=False)
    total_water_liters = Column(DECIMAL(14, 6), nullable=False)
    avg_eco_score = Column(DECIMAL(6, 2))

    payload_json = Column(Text, nullable=False)

    generated_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="esg_reports")
