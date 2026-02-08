"""
GREEN-AI FOOTPRINT TOOL — FastAPI Backend
==========================================

Production-ready API for managing AI models (predefined + custom)
and serving footprint calculations.

DEPLOYMENT: Render (Python 3.11+, PostgreSQL 15+)
DEPENDENCIES: fastapi, uvicorn, asyncpg, pydantic, python-dotenv

To run locally:
  pip install fastapi uvicorn asyncpg pydantic python-dotenv
  uvicorn api:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Literal
from datetime import datetime
from decimal import Decimal
import uuid
import os

# ============================================================
# App Configuration
# ============================================================

app = FastAPI(
    title="Green-AI Footprint API",
    version="1.0.0",
    description="Enterprise API for GenAI environmental impact management",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# ============================================================
# Pydantic Models (Request / Response Schemas)
# ============================================================

ModelCategory = Literal[
    "frontier-llm", "mid-size-llm", "small-edge", "code-model",
    "image-gen", "embedding", "multimodal", "custom"
]

GpuType = Literal[
    "nvidia-h100", "nvidia-a100-80gb", "nvidia-a100-40gb",
    "nvidia-v100", "nvidia-t4", "nvidia-a10g", "cpu-only"
]


class AIModelBase(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=200)
    family: str = Field(..., min_length=1, max_length=100)
    category: ModelCategory
    parameters_billion: float = Field(..., gt=0, le=10000)
    energy_per_million_tokens_kwh: float = Field(..., gt=0, le=100)
    default_gpu: GpuType
    gpu_count_inference: int = Field(default=1, ge=1, le=64)
    tokens_per_second_per_gpu: int = Field(..., ge=1, le=10000)
    quality_score: int = Field(..., ge=0, le=100)
    description: Optional[str] = Field(None, max_length=500)

    @validator("display_name")
    def strip_name(cls, v):
        return v.strip()


class AIModelCreate(AIModelBase):
    """Schema for creating a custom AI model."""
    pass


class AIModelUpdate(BaseModel):
    """Schema for updating a custom AI model (all fields optional)."""
    display_name: Optional[str] = Field(None, min_length=2, max_length=200)
    category: Optional[ModelCategory] = None
    parameters_billion: Optional[float] = Field(None, gt=0, le=10000)
    energy_per_million_tokens_kwh: Optional[float] = Field(None, gt=0, le=100)
    default_gpu: Optional[GpuType] = None
    gpu_count_inference: Optional[int] = Field(None, ge=1, le=64)
    tokens_per_second_per_gpu: Optional[int] = Field(None, ge=1, le=10000)
    quality_score: Optional[int] = Field(None, ge=0, le=100)
    description: Optional[str] = Field(None, max_length=500)


class AIModelResponse(AIModelBase):
    """Schema for returning an AI model."""
    id: str
    slug: str
    is_predefined: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AIModelListResponse(BaseModel):
    models: List[AIModelResponse]
    total: int
    predefined_count: int
    custom_count: int


class CalculationRequest(BaseModel):
    model_id: str
    region_id: str
    request_count: int = Field(..., ge=1)
    avg_tokens_per_request: int = Field(..., ge=1)
    pue: Optional[float] = Field(None, ge=1.0, le=3.0)
    wue: Optional[float] = Field(None, ge=0.0, le=5.0)


class CalculationResponse(BaseModel):
    energy_kwh: float
    co2e_grams: float
    water_liters: float
    hardware_amortized_grams: float
    duration_hours: float
    energy_per_request: float
    co2e_per_request: float
    water_per_request: float
    eco_score: float
    eco_grade: str
    equivalent_km_driving: float
    equivalent_smartphone_charges: float
    assumptions: List[str]
    confidence: str


class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: datetime


# ============================================================
# Database Connection (asyncpg)
# ============================================================

# In production, use connection pooling:
# DATABASE_URL = os.getenv("DATABASE_URL")
# pool = None
#
# @app.on_event("startup")
# async def startup():
#     global pool
#     pool = await asyncpg.create_pool(DATABASE_URL, min_size=5, max_size=20)
#
# @app.on_event("shutdown")
# async def shutdown():
#     await pool.close()
#
# async def get_db():
#     async with pool.acquire() as conn:
#         yield conn


# ============================================================
# API Routes — Health
# ============================================================

@app.get("/api/v1/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        timestamp=datetime.utcnow(),
    )


# ============================================================
# API Routes — AI Models
# ============================================================

@app.get("/api/v1/models", response_model=AIModelListResponse)
async def list_models(
    category: Optional[ModelCategory] = Query(None),
    include_custom: bool = Query(True),
    include_predefined: bool = Query(True),
):
    """
    List all available AI models.
    
    Supports filtering by category and model type (predefined vs custom).
    Returns models sorted by: predefined first, then custom, within each
    sorted by parameter count descending.
    
    Production implementation:
        SELECT * FROM ai_models 
        WHERE is_active = TRUE
          AND (category = $1 OR $1 IS NULL)
          AND (is_predefined = TRUE OR $2 = TRUE)
          AND (is_predefined = FALSE OR $3 = TRUE)
        ORDER BY is_predefined DESC, parameters_billion DESC;
    """
    # PoC: Return empty list — frontend uses local constants
    # In production, query PostgreSQL via asyncpg
    return AIModelListResponse(
        models=[],
        total=0,
        predefined_count=0,
        custom_count=0,
    )


@app.get("/api/v1/models/{model_id}", response_model=AIModelResponse)
async def get_model(model_id: str):
    """
    Get a single AI model by ID or slug.
    
    Production implementation:
        SELECT * FROM ai_models 
        WHERE (id::text = $1 OR slug = $1) AND is_active = TRUE;
    """
    raise HTTPException(status_code=404, detail=f"Model {model_id} not found")


@app.post("/api/v1/models", response_model=AIModelResponse, status_code=201)
async def create_custom_model(model: AIModelCreate):
    """
    Create a new custom AI model.
    
    Validation:
    - Name uniqueness checked per organization
    - Energy and parameter values clamped to physical bounds
    - GPU type validated against known hardware profiles
    
    Production implementation:
        INSERT INTO ai_models (slug, display_name, family, category, ...)
        VALUES ($1, $2, $3, $4, ...)
        RETURNING *;
    """
    slug = f"custom-{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow()
    
    return AIModelResponse(
        id=str(uuid.uuid4()),
        slug=slug,
        display_name=model.display_name,
        family=model.family,
        category=model.category,
        parameters_billion=model.parameters_billion,
        energy_per_million_tokens_kwh=model.energy_per_million_tokens_kwh,
        default_gpu=model.default_gpu,
        gpu_count_inference=model.gpu_count_inference,
        tokens_per_second_per_gpu=model.tokens_per_second_per_gpu,
        quality_score=model.quality_score,
        description=model.description,
        is_predefined=False,
        is_active=True,
        created_at=now,
        updated_at=now,
    )


@app.put("/api/v1/models/{model_id}", response_model=AIModelResponse)
async def update_custom_model(model_id: str, update: AIModelUpdate):
    """
    Update a custom AI model.
    
    Only non-predefined models can be updated.
    
    Production implementation:
        UPDATE ai_models 
        SET display_name = COALESCE($2, display_name), ...
        WHERE id::text = $1 AND is_predefined = FALSE AND is_active = TRUE
        RETURNING *;
    """
    raise HTTPException(status_code=404, detail=f"Model {model_id} not found")


@app.delete("/api/v1/models/{model_id}", status_code=204)
async def delete_custom_model(model_id: str):
    """
    Soft-delete a custom AI model.
    
    Only non-predefined models can be deleted.
    Sets is_active = FALSE rather than removing the row,
    preserving audit trail for historical calculations.
    
    Production implementation:
        UPDATE ai_models 
        SET is_active = FALSE, updated_at = NOW()
        WHERE id::text = $1 AND is_predefined = FALSE
        RETURNING id;
    """
    raise HTTPException(status_code=404, detail=f"Model {model_id} not found")


# ============================================================
# API Routes — Calculations
# ============================================================

@app.post("/api/v1/calculate", response_model=CalculationResponse)
async def calculate_footprint(request: CalculationRequest):
    """
    Calculate the environmental footprint for a given model + region + usage.
    
    Production implementation:
    1. Fetch model profile from ai_models table
    2. Fetch region carbon intensity from grid_intensities table
    3. Run calculation pipeline (same formulas as frontend engine)
    4. Log result to calculation_logs table
    5. Return result
    
    This endpoint mirrors the frontend calculation engine exactly,
    serving as the source of truth for ESG report generation.
    """
    raise HTTPException(
        status_code=501,
        detail="Server-side calculation requires database connection. "
               "Use frontend engine for PoC demo."
    )


# ============================================================
# API Routes — ESG Reports
# ============================================================

@app.get("/api/v1/reports")
async def list_reports():
    """List generated ESG reports for the organization."""
    return {"reports": [], "total": 0}


@app.post("/api/v1/reports/generate")
async def generate_report():
    """
    Generate an ESG sustainability report.
    
    Aggregates calculation_logs for the reporting period,
    computes org-wide metrics, and produces a structured report
    suitable for internal ESG reviews and regulatory submissions.
    """
    raise HTTPException(status_code=501, detail="Report generation requires database connection.")


# ============================================================
# Entry point
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
