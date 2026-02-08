"""
GREEN-AI FOOTPRINT TOOL — Database Seeding Script
==================================================

Populates the MySQL database with:
1. Predefined AI models from constants.ts
2. Grid carbon intensities from constants.ts  
3. GPU profiles from constants.ts
4. Default organization and user

Run this script after database migration to seed initial data.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base, test_connection
from models import (
    Organization, User, AIModel, GridCarbonIntensity, GPUProfile,
    ModelCategoryEnum, GpuTypeEnum
)
from decimal import Decimal
import uuid

# Data from constants.ts - adapted for Python
GRID_CARBON_INTENSITIES = [
    # ========= AMERICAS =========
    {
        "region_id": "ca-central-1", "provider": "aws", "location": "Montreal, Canada",
        "gco2e_per_kwh": Decimal("14"), "source": "Environment Canada NIR 2023 (Quebec grid)",
        "year": 2023, "renewable_percentage": 95
    },
    {
        "region_id": "us-west-2", "provider": "aws", "location": "Oregon, USA",
        "gco2e_per_kwh": Decimal("78"), "source": "EIA eGRID 2023 (NWPP)",
        "year": 2023, "renewable_percentage": 68
    },
    {
        "region_id": "us-east-1", "provider": "aws", "location": "Virginia, USA",
        "gco2e_per_kwh": Decimal("338"), "source": "EIA eGRID 2023 (SERC Virginia)",
        "year": 2023, "renewable_percentage": 22
    },
    {
        "region_id": "us-central1", "provider": "gcp", "location": "Iowa, USA",
        "gco2e_per_kwh": Decimal("410"), "source": "EIA eGRID 2023 (MROE)",
        "year": 2023, "renewable_percentage": 42
    },
    {
        "region_id": "sa-east-1", "provider": "aws", "location": "São Paulo, Brazil",
        "gco2e_per_kwh": Decimal("61"), "source": "MCTI Brazil National Inventory 2023",
        "year": 2023, "renewable_percentage": 83
    },
    # ========= EUROPE =========
    {
        "region_id": "eu-north-1", "provider": "aws", "location": "Stockholm, Sweden",
        "gco2e_per_kwh": Decimal("9"), "source": "Swedish Energy Agency 2023",
        "year": 2023, "renewable_percentage": 98
    },
    {
        "region_id": "eu-west-3", "provider": "aws", "location": "Paris, France",
        "gco2e_per_kwh": Decimal("56"), "source": "RTE France Bilan Electrique 2023",
        "year": 2023, "renewable_percentage": 92
    },
    {
        "region_id": "eu-west-1", "provider": "aws", "location": "Ireland",
        "gco2e_per_kwh": Decimal("296"), "source": "EEA 2023",
        "year": 2023, "renewable_percentage": 40
    },
    {
        "region_id": "europe-west4", "provider": "gcp", "location": "Netherlands",
        "gco2e_per_kwh": Decimal("328"), "source": "CBS Netherlands 2023",
        "year": 2023, "renewable_percentage": 33
    },
    {
        "region_id": "eu-central-1", "provider": "aws", "location": "Frankfurt, Germany",
        "gco2e_per_kwh": Decimal("350"), "source": "UBA Germany 2023",
        "year": 2023, "renewable_percentage": 46
    },
    # ========= MIDDLE EAST & AFRICA =========
    {
        "region_id": "me-south-1", "provider": "aws", "location": "Bahrain",
        "gco2e_per_kwh": Decimal("532"), "source": "IEA World Energy Outlook 2023 (Bahrain)",
        "year": 2023, "renewable_percentage": 5
    },
    {
        "region_id": "af-south-1", "provider": "aws", "location": "Cape Town, South Africa",
        "gco2e_per_kwh": Decimal("928"), "source": "Eskom Integrated Report 2023",
        "year": 2023, "renewable_percentage": 7
    },
    # ========= ASIA-PACIFIC =========
    {
        "region_id": "ap-south-1", "provider": "aws", "location": "Mumbai, India",
        "gco2e_per_kwh": Decimal("708"), "source": "CEA India CO2 Baseline Database v19 (2023)",
        "year": 2023, "renewable_percentage": 12
    },
    {
        "region_id": "ap-south-2", "provider": "aws", "location": "Hyderabad, India",
        "gco2e_per_kwh": Decimal("708"), "source": "CEA India CO2 Baseline Database v19 (2023)",
        "year": 2023, "renewable_percentage": 12
    },
    {
        "region_id": "ap-southeast-1", "provider": "aws", "location": "Singapore",
        "gco2e_per_kwh": Decimal("408"), "source": "EMA Singapore 2023",
        "year": 2023, "renewable_percentage": 3
    },
    {
        "region_id": "ap-northeast-2", "provider": "aws", "location": "Seoul, South Korea",
        "gco2e_per_kwh": Decimal("415"), "source": "KEPCO Sustainability Report 2023",
        "year": 2023, "renewable_percentage": 9
    },
    {
        "region_id": "ap-northeast-1", "provider": "aws", "location": "Tokyo, Japan",
        "gco2e_per_kwh": Decimal("462"), "source": "METI Japan 2023",
        "year": 2023, "renewable_percentage": 22
    },
    {
        "region_id": "ap-southeast-2", "provider": "aws", "location": "Sydney, Australia",
        "gco2e_per_kwh": Decimal("660"), "source": "Australian Government DISER 2023",
        "year": 2023, "renewable_percentage": 32
    },
]

GPU_PROFILES = [
    {
        "id": "nvidia-h100", "name": "NVIDIA H100 SXM5", "tdp_watts": 700,
        "typical_utilization": Decimal("0.65"), "memory_gb": 80, "flops_teraflops": 989,
        "embodied_carbon_kg_co2e": Decimal("150"), "expected_lifespan_hours": 35000,
        "water_cooling_liters_per_hour": Decimal("2.8")
    },
    {
        "id": "nvidia-a100-80gb", "name": "NVIDIA A100 80GB SXM", "tdp_watts": 400,
        "typical_utilization": Decimal("0.60"), "memory_gb": 80, "flops_teraflops": 312,
        "embodied_carbon_kg_co2e": Decimal("130"), "expected_lifespan_hours": 35000,
        "water_cooling_liters_per_hour": Decimal("1.8")
    },
    {
        "id": "nvidia-a100-40gb", "name": "NVIDIA A100 40GB", "tdp_watts": 400,
        "typical_utilization": Decimal("0.55"), "memory_gb": 40, "flops_teraflops": 312,
        "embodied_carbon_kg_co2e": Decimal("120"), "expected_lifespan_hours": 35000,
        "water_cooling_liters_per_hour": Decimal("1.7")
    },
    {
        "id": "nvidia-v100", "name": "NVIDIA V100 32GB", "tdp_watts": 300,
        "typical_utilization": Decimal("0.50"), "memory_gb": 32, "flops_teraflops": 125,
        "embodied_carbon_kg_co2e": Decimal("100"), "expected_lifespan_hours": 35000,
        "water_cooling_liters_per_hour": Decimal("1.2")
    },
    {
        "id": "nvidia-t4", "name": "NVIDIA T4", "tdp_watts": 70,
        "typical_utilization": Decimal("0.50"), "memory_gb": 16, "flops_teraflops": 65,
        "embodied_carbon_kg_co2e": Decimal("50"), "expected_lifespan_hours": 35000,
        "water_cooling_liters_per_hour": Decimal("0.4")
    },
    {
        "id": "nvidia-a10g", "name": "NVIDIA A10G", "tdp_watts": 150,
        "typical_utilization": Decimal("0.55"), "memory_gb": 24, "flops_teraflops": 125,
        "embodied_carbon_kg_co2e": Decimal("70"), "expected_lifespan_hours": 35000,
        "water_cooling_liters_per_hour": Decimal("0.7")
    },
    {
        "id": "cpu-only", "name": "CPU Only (Intel Xeon)", "tdp_watts": 250,
        "typical_utilization": Decimal("0.40"), "memory_gb": 0, "flops_teraflops": 2,
        "embodied_carbon_kg_co2e": Decimal("40"), "expected_lifespan_hours": 50000,
        "water_cooling_liters_per_hour": Decimal("0.5")
    },
]

MODEL_PROFILES = [
    {
        "slug": "gpt4", "display_name": "GPT-4 Class (≈1.8T params)", "family": "gpt-4-class",
        "category": "frontier-llm", "parameters_billion": Decimal("1800"), "energy_per_million_tokens_kwh": Decimal("4.2"),
        "default_gpu": "nvidia-a100-80gb", "gpu_count_inference": 8, "tokens_per_second_per_gpu": 40,
        "quality_score": 95, "training_energy_mwh": Decimal("62000"), "training_co2e_tons": Decimal("21000")
    },
    {
        "slug": "gpt35", "display_name": "GPT-3.5 Class (≈175B params)", "family": "gpt-3.5-class",
        "category": "mid-size-llm", "parameters_billion": Decimal("175"), "energy_per_million_tokens_kwh": Decimal("0.45"),
        "default_gpu": "nvidia-a100-40gb", "gpu_count_inference": 2, "tokens_per_second_per_gpu": 120,
        "quality_score": 78, "training_energy_mwh": Decimal("1287"), "training_co2e_tons": Decimal("552")
    },
    {
        "slug": "claude3-opus", "display_name": "Claude 3 Opus Class", "family": "claude-3-opus",
        "category": "frontier-llm", "parameters_billion": Decimal("500"), "energy_per_million_tokens_kwh": Decimal("2.8"),
        "default_gpu": "nvidia-a100-80gb", "gpu_count_inference": 4, "tokens_per_second_per_gpu": 50,
        "quality_score": 93, "training_energy_mwh": Decimal("30000"), "training_co2e_tons": Decimal("10200")
    },
    {
        "slug": "claude3-sonnet", "display_name": "Claude 3 Sonnet Class", "family": "claude-3-sonnet",
        "category": "mid-size-llm", "parameters_billion": Decimal("150"), "energy_per_million_tokens_kwh": Decimal("0.55"),
        "default_gpu": "nvidia-a100-40gb", "gpu_count_inference": 2, "tokens_per_second_per_gpu": 100,
        "quality_score": 85, "training_energy_mwh": Decimal("8000"), "training_co2e_tons": Decimal("2720")
    },
    {
        "slug": "claude3-haiku", "display_name": "Claude 3 Haiku Class", "family": "claude-3-haiku",
        "category": "small-edge", "parameters_billion": Decimal("30"), "energy_per_million_tokens_kwh": Decimal("0.08"),
        "default_gpu": "nvidia-a10g", "gpu_count_inference": 1, "tokens_per_second_per_gpu": 300,
        "quality_score": 72, "training_energy_mwh": Decimal("1500"), "training_co2e_tons": Decimal("510")
    },
    {
        "slug": "llama70b", "display_name": "Llama 3 70B", "family": "llama-70b",
        "category": "mid-size-llm", "parameters_billion": Decimal("70"), "energy_per_million_tokens_kwh": Decimal("0.85"),
        "default_gpu": "nvidia-a100-80gb", "gpu_count_inference": 2, "tokens_per_second_per_gpu": 80,
        "quality_score": 80, "training_energy_mwh": Decimal("6500"), "training_co2e_tons": Decimal("2210")
    },
    {
        "slug": "llama13b", "display_name": "Llama 2 13B", "family": "llama-13b",
        "category": "small-edge", "parameters_billion": Decimal("13"), "energy_per_million_tokens_kwh": Decimal("0.15"),
        "default_gpu": "nvidia-a10g", "gpu_count_inference": 1, "tokens_per_second_per_gpu": 150,
        "quality_score": 62, "training_energy_mwh": Decimal("1200"), "training_co2e_tons": Decimal("408")
    },
    {
        "slug": "llama7b", "display_name": "Llama 2 7B", "family": "llama-7b",
        "category": "small-edge", "parameters_billion": Decimal("7"), "energy_per_million_tokens_kwh": Decimal("0.05"),
        "default_gpu": "nvidia-t4", "gpu_count_inference": 1, "tokens_per_second_per_gpu": 200,
        "quality_score": 55, "training_energy_mwh": Decimal("500"), "training_co2e_tons": Decimal("170")
    },
    {
        "slug": "mistral7b", "display_name": "Mistral 7B", "family": "mistral-7b",
        "category": "small-edge", "parameters_billion": Decimal("7"), "energy_per_million_tokens_kwh": Decimal("0.04"),
        "default_gpu": "nvidia-t4", "gpu_count_inference": 1, "tokens_per_second_per_gpu": 220,
        "quality_score": 60, "training_energy_mwh": Decimal("400"), "training_co2e_tons": Decimal("136")
    },
    {
        "slug": "mixtral8x7b", "display_name": "Mixtral 8x7B (MoE)", "family": "mixtral-8x7b",
        "category": "mid-size-llm", "parameters_billion": Decimal("47"), "energy_per_million_tokens_kwh": Decimal("0.25"),
        "default_gpu": "nvidia-a100-40gb", "gpu_count_inference": 1, "tokens_per_second_per_gpu": 110,
        "quality_score": 74, "training_energy_mwh": Decimal("2000"), "training_co2e_tons": Decimal("680")
    },
    {
        "slug": "gemini-pro", "display_name": "Gemini Pro Class", "family": "gemini-pro",
        "category": "frontier-llm", "parameters_billion": Decimal("300"), "energy_per_million_tokens_kwh": Decimal("1.8"),
        "default_gpu": "nvidia-h100", "gpu_count_inference": 4, "tokens_per_second_per_gpu": 70,
        "quality_score": 90, "training_energy_mwh": Decimal("25000"), "training_co2e_tons": Decimal("8500")
    },
    {
        "slug": "grok-2", "display_name": "Grok-2 (xAI, ≈314B params)", "family": "grok-2",
        "category": "frontier-llm", "parameters_billion": Decimal("314"), "energy_per_million_tokens_kwh": Decimal("2.4"),
        "default_gpu": "nvidia-h100", "gpu_count_inference": 4, "tokens_per_second_per_gpu": 55,
        "quality_score": 88, "training_energy_mwh": Decimal("35000"), "training_co2e_tons": Decimal("11900")
    },
    {
        "slug": "deepseek-v3", "display_name": "DeepSeek-V3 (MoE, 671B total / 37B active)", "family": "deepseek-v3",
        "category": "frontier-llm", "parameters_billion": Decimal("671"), "energy_per_million_tokens_kwh": Decimal("0.95"),
        "default_gpu": "nvidia-h100", "gpu_count_inference": 4, "tokens_per_second_per_gpu": 90,
        "quality_score": 86, "training_energy_mwh": Decimal("5500"), "training_co2e_tons": Decimal("1870")
    },
    {
        "slug": "gemini-flash-2", "display_name": "Gemini 2.0 Flash (Google, distilled)", "family": "gemini-flash",
        "category": "small-edge", "parameters_billion": Decimal("9"), "energy_per_million_tokens_kwh": Decimal("0.10"),
        "default_gpu": "nvidia-t4", "gpu_count_inference": 1, "tokens_per_second_per_gpu": 180,
        "quality_score": 74, "training_energy_mwh": Decimal("800"), "training_co2e_tons": Decimal("272")
    },
    {
        "slug": "llama-3.1-405b", "display_name": "Llama 3.1 405B (Meta, open-weight)", "family": "llama-3.1-405b",
        "category": "frontier-llm", "parameters_billion": Decimal("405"), "energy_per_million_tokens_kwh": Decimal("3.6"),
        "default_gpu": "nvidia-h100", "gpu_count_inference": 8, "tokens_per_second_per_gpu": 30,
        "quality_score": 92, "training_energy_mwh": Decimal("39000"), "training_co2e_tons": Decimal("13260")
    },
    {
        "slug": "qwen-72b", "display_name": "Qwen 2.5 72B (Alibaba Cloud)", "family": "qwen-72b",
        "category": "mid-size-llm", "parameters_billion": Decimal("72"), "energy_per_million_tokens_kwh": Decimal("0.90"),
        "default_gpu": "nvidia-a100-80gb", "gpu_count_inference": 2, "tokens_per_second_per_gpu": 75,
        "quality_score": 82, "training_energy_mwh": Decimal("7000"), "training_co2e_tons": Decimal("2380")
    },
    {
        "slug": "dbrx", "display_name": "DBRX 132B (Databricks, MoE)", "family": "dbrx",
        "category": "mid-size-llm", "parameters_billion": Decimal("132"), "energy_per_million_tokens_kwh": Decimal("1.10"),
        "default_gpu": "nvidia-a100-80gb", "gpu_count_inference": 4, "tokens_per_second_per_gpu": 60,
        "quality_score": 78, "training_energy_mwh": Decimal("9000"), "training_co2e_tons": Decimal("3060")
    },
    {
        "slug": "phi-3-medium", "display_name": "Phi-3 Medium 14B (Microsoft)", "family": "phi-3-medium",
        "category": "small-edge", "parameters_billion": Decimal("14"), "energy_per_million_tokens_kwh": Decimal("0.18"),
        "default_gpu": "nvidia-a10g", "gpu_count_inference": 1, "tokens_per_second_per_gpu": 130,
        "quality_score": 71, "training_energy_mwh": Decimal("1400"), "training_co2e_tons": Decimal("476")
    },
    {
        "slug": "command-r-plus", "display_name": "Command R+ (Cohere, 104B)", "family": "command-r-plus",
        "category": "mid-size-llm", "parameters_billion": Decimal("104"), "energy_per_million_tokens_kwh": Decimal("1.50"),
        "default_gpu": "nvidia-a100-80gb", "gpu_count_inference": 2, "tokens_per_second_per_gpu": 65,
        "quality_score": 83, "training_energy_mwh": Decimal("8500"), "training_co2e_tons": Decimal("2890")
    },
    {
        "slug": "gemma-7b", "display_name": "Gemma 2 9B (Google, open)", "family": "gemma-7b",
        "category": "small-edge", "parameters_billion": Decimal("9"), "energy_per_million_tokens_kwh": Decimal("0.06"),
        "default_gpu": "nvidia-t4", "gpu_count_inference": 1, "tokens_per_second_per_gpu": 170,
        "quality_score": 64, "training_energy_mwh": Decimal("600"), "training_co2e_tons": Decimal("204")
    },
]

def create_tables():
    """Create all database tables."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

def seed_database():
    """Seed the database with initial data."""
    db = SessionLocal()
    try:
        print("Seeding database...")
        
        # Create default organization
        org = db.query(Organization).filter(Organization.slug == "default").first()
        if not org:
            org = Organization(
                id=str(uuid.uuid4()),
                name="Default Organization",
                slug="default"
            )
            db.add(org)
            db.commit()
            db.refresh(org)
            print(f"Created default organization: {org.name}")
        
        # Create default user
        user = db.query(User).filter(User.email == "admin@example.com").first()
        if not user:
            user = User(
                id=str(uuid.uuid4()),
                email="admin@example.com",
                name="Admin User",
                organization_id=org.id,
                role="admin"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created default user: {user.name}")
        
        # Seed GPU profiles
        if db.query(GPUProfile).count() == 0:
            for gpu_data in GPU_PROFILES:
                gpu = GPUProfile(**gpu_data)
                db.add(gpu)
            db.commit()
            print(f"Seeded {len(GPU_PROFILES)} GPU profiles")
        
        # Seed grid carbon intensities
        if db.query(GridCarbonIntensity).count() == 0:
            for grid_data in GRID_CARBON_INTENSITIES:
                grid = GridCarbonIntensity(**grid_data)
                db.add(grid)
            db.commit()
            print(f"Seeded {len(GRID_CARBON_INTENSITIES)} grid carbon intensities")
        
        # Seed AI models
        if db.query(AIModel).filter(AIModel.is_predefined == True).count() == 0:
            for model_data in MODEL_PROFILES:
                model = AIModel(
                    **model_data,
                    is_predefined=True,
                    is_active=True,
                    organization_id=org.id
                )
                db.add(model)
            db.commit()
            print(f"Seeded {len(MODEL_PROFILES)} predefined AI models")
        
        print("Database seeding completed successfully!")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def main():
    """Main seeding function."""
    print("Green-AI Footprint Tool - Database Seeding")
    print("=" * 50)
    
    # Test database connection
    if not test_connection():
        print("❌ Database connection failed. Please check your DATABASE_URL.")
        return
    
    print("✅ Database connection successful!")
    
    # Create tables
    create_tables()
    
    # Seed data
    seed_database()
    
    print("\n🎉 Database setup completed!")
    print("\nNext steps:")
    print("1. Run the FastAPI server: uvicorn api:app --reload")
    print("2. Access the API docs: http://localhost:8000/docs")
    print("3. Start the frontend: npm run dev")

if __name__ == "__main__":
    main()
