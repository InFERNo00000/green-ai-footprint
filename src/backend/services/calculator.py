"""
GREEN-AI FOOTPRINT TOOL — Calculation Engine (Python)
======================================================

Port of the TypeScript calculation engine to Python.
Maintains exact parity with frontend formulas and logic.

CALCULATION CHAIN:
1. Tokens → Energy (kWh) via model-specific energy coefficient
2. Energy → CO2e via grid carbon intensity + PUE
3. Energy → Water via WUE + GPU cooling model
4. Hardware → Amortized embodied carbon via lifespan model
5. All metrics → EcoScore via weighted normalization
"""

import math
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from decimal import Decimal
from sqlalchemy.orm import Session
from models import AIModel, GPUProfile, GridCarbonIntensity

# Constants from TypeScript constants.ts
DEFAULT_PUE = 1.2
DEFAULT_WUE_LITERS_PER_KWH = 1.1
EQUIVALENCIES = {
    "kmDrivingPerKgCO2e": 5.95,  # Average EU passenger car: 168g CO2/km
    "smartphoneChargesPerKwh": 86,  # ~0.012 kWh per charge
    "treeDaysAbsorptionPerKgCO2e": 16.7,  # Average tree absorbs ~22kg CO2/year = 0.06kg/day
}

DEFAULT_ECOSCORE_WEIGHTS = {
    "energyEfficiency": 0.30,
    "carbonIntensity": 0.30,
    "waterUsage": 0.10,
    "hardwareLifecycle": 0.10,
    "renewableAlignment": 0.20,
}

ECOSCORE_BENCHMARKS = {
    "energyPerMillionTokens": {"best": 0.03, "worst": 5.0},  # kWh
    "co2ePerMillionTokens": {"best": 2.3, "worst": 2100},  # grams
    "waterPerMillionTokens": {"best": 0.03, "worst": 5.5},  # liters
    "hardwareAmortizedPerMillionTokens": {"best": 0.5, "worst": 120},  # grams CO2e
    "renewablePercentage": {"best": 100, "worst": 0},  # %
}

@dataclass
class FootprintInput:
    model_id: str
    region_id: str
    total_tokens: int
    request_count: int
    avg_tokens_per_request: Optional[int] = None
    gpu_override: Optional[str] = None
    pue: Optional[float] = None
    wue: Optional[float] = None

@dataclass
class FootprintResult:
    energy_kwh: float
    co2e_grams: float
    water_liters: float
    hardware_amortized_grams: float
    duration_hours: float
    energy_per_request: float
    co2e_per_request: float
    water_per_request: float
    equivalent_km_driving: float
    equivalent_smartphone_charges: float
    model: AIModel
    gpu: GPUProfile
    grid: GridCarbonIntensity
    assumptions: List[str]

@dataclass
class EcoScoreBreakdown:
    score: float
    raw: float
    unit: str
    explanation: str

@dataclass
class EcoScoreResult:
    overall: float
    grade: str
    breakdown: Dict[str, EcoScoreBreakdown]
    assumptions: List[str]
    confidence: str

class CalculatorService:
    """Service for calculating environmental footprint and EcoScore."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_model_profile(self, model_id: str) -> AIModel:
        """Get model profile from database."""
        model = self.db.query(AIModel).filter(
            (AIModel.id == model_id) | (AIModel.slug == model_id),
            AIModel.is_active == True
        ).first()
        if not model:
            raise ValueError(f"Model not found: {model_id}")
        return model
    
    def get_gpu_profile(self, gpu_id: str) -> GPUProfile:
        """Get GPU profile from database."""
        gpu = self.db.query(GPUProfile).filter(GPUProfile.id == gpu_id).first()
        if not gpu:
            raise ValueError(f"GPU not found: {gpu_id}")
        return gpu
    
    def get_grid_intensity(self, region_id: str) -> GridCarbonIntensity:
        """Get grid carbon intensity for region."""
        grid = self.db.query(GridCarbonIntensity).filter(
            GridCarbonIntensity.region_id == region_id
        ).first()
        if not grid:
            raise ValueError(f"Region not found: {region_id}")
        return grid
    
    def calculate_energy(self, total_tokens: int, model: AIModel, pue: float = DEFAULT_PUE) -> float:
        """
        Calculate energy consumption for a given number of tokens.
        
        Formula: E = (tokens / 1,000,000) × energyPerMillionTokens × PUE
        """
        million_tokens = total_tokens / 1_000_000
        return million_tokens * float(model.energy_per_million_tokens_kwh) * pue
    
    def calculate_co2e(self, energy_kwh: float, region_id: str) -> float:
        """
        Calculate CO2 equivalent emissions.
        
        Formula: CO2e = E(kWh) × gridIntensity(gCO2e/kWh)
        """
        grid = self.get_grid_intensity(region_id)
        return energy_kwh * float(grid.gco2e_per_kwh)
    
    def calculate_water(self, energy_kwh: float, gpu: GPUProfile, duration_hours: float, 
                       wue: float = DEFAULT_WUE_LITERS_PER_KWH) -> float:
        """
        Calculate water consumption for AI workloads.
        
        Formula: Water = E(kWh) × WUE(L/kWh) + GPU_cooling × duration
        """
        facility_water = energy_kwh * wue
        server_water = float(gpu.water_cooling_liters_per_hour) * duration_hours
        return facility_water + server_water
    
    def calculate_hardware_amortization(self, gpu: GPUProfile, gpu_count: int, 
                                       usage_duration_hours: float) -> float:
        """
        Calculate amortized embodied carbon from hardware manufacturing.
        
        Formula: amortized = (embodiedCO2e / lifespan) × usage_duration × gpu_count
        """
        amortized_per_gpu_per_hour = (
            float(gpu.embodied_carbon_kg_co2e) * 1000 / gpu.expected_lifespan_hours
        )
        return amortized_per_gpu_per_hour * gpu_count * usage_duration_hours
    
    def calculate_full_footprint(self, input_data: FootprintInput) -> FootprintResult:
        """Calculate complete footprint for given input."""
        model = self.get_model_profile(input_data.model_id)
        gpu_id = input_data.gpu_override or model.default_gpu
        gpu = self.get_gpu_profile(gpu_id)
        grid = self.get_grid_intensity(input_data.region_id)
        
        assumptions = []
        
        # Energy calculation
        pue = input_data.pue or DEFAULT_PUE
        energy_kwh = self.calculate_energy(input_data.total_tokens, model, pue)
        assumptions.append(f"PUE factor: {pue} (industry average for modern data centers)")
        
        # Duration estimate
        total_seconds = input_data.total_tokens / (model.tokens_per_second_per_gpu * model.gpu_count_inference)
        duration_hours = total_seconds / 3600
        assumptions.append(
            f"Estimated duration: {duration_hours:.3f} hours based on "
            f"{model.tokens_per_second_per_gpu} tok/s × {model.gpu_count_inference} GPUs"
        )
        
        # CO2e calculation
        co2e_grams = self.calculate_co2e(energy_kwh, input_data.region_id)
        assumptions.append(f"Grid intensity: {grid.gco2e_per_kwh} gCO2e/kWh ({grid.source})")
        
        # Water calculation
        wue = input_data.wue or DEFAULT_WUE_LITERS_PER_KWH
        water_liters = self.calculate_water(energy_kwh, gpu, duration_hours, wue)
        assumptions.append(f"WUE: {wue} L/kWh (Google 2023 average)")
        
        # Hardware amortization
        hardware_amortized_grams = self.calculate_hardware_amortization(
            gpu, model.gpu_count_inference, duration_hours
        )
        assumptions.append(
            f"GPU embodied carbon: {gpu.embodied_carbon_kg_co2e} kgCO2e over "
            f"{gpu.expected_lifespan_hours:,} hour lifespan"
        )
        
        # Equivalencies
        total_co2e_kg = co2e_grams / 1000
        equivalent_km_driving = total_co2e_kg * EQUIVALENCIES["kmDrivingPerKgCO2e"]
        equivalent_smartphone_charges = energy_kwh * EQUIVALENCIES["smartphoneChargesPerKwh"]
        
        # Per-request calculations
        request_count = max(input_data.request_count, 1)
        
        return FootprintResult(
            energy_kwh=energy_kwh,
            co2e_grams=co2e_grams,
            water_liters=water_liters,
            hardware_amortized_grams=hardware_amortized_grams,
            duration_hours=duration_hours,
            energy_per_request=energy_kwh / request_count,
            co2e_per_request=co2e_grams / request_count,
            water_per_request=water_liters / request_count,
            equivalent_km_driving=equivalent_km_driving,
            equivalent_smartphone_charges=equivalent_smartphone_charges,
            model=model,
            gpu=gpu,
            grid=grid,
            assumptions=assumptions
        )
    
    def log_normalize(self, value: float, best: float, worst: float) -> float:
        """Logarithmic normalization for EcoScore calculation."""
        if value <= best:
            return 100
        if value >= worst:
            return 0
        log_value = math.log(value)
        log_best = math.log(best)
        log_worst = math.log(worst)
        score = 100 * (1 - (log_value - log_best) / (log_worst - log_best))
        return max(0, min(100, score))
    
    def linear_normalize(self, value: float, worst: float, best: float) -> float:
        """Linear normalization for EcoScore calculation."""
        if value >= best:
            return 100
        if value <= worst:
            return 0
        return 100 * (value - worst) / (best - worst)
    
    def get_grade(self, score: float) -> str:
        """Convert EcoScore to letter grade."""
        if score >= 90:
            return 'A+'
        if score >= 80:
            return 'A'
        if score >= 70:
            return 'B+'
        if score >= 60:
            return 'B'
        if score >= 50:
            return 'C+'
        if score >= 40:
            return 'C'
        if score >= 30:
            return 'D'
        return 'F'
    
    def calculate_eco_score(self, model_id: str, region_id: str, 
                          weights: Optional[Dict[str, float]] = None,
                          gpu_override: Optional[str] = None) -> EcoScoreResult:
        """
        Calculate EcoScore for a model in a specific region.
        
        EcoScore: A composite sustainability rating for AI model usage.
        Uses logarithmic scaling for proportional improvements.
        """
        if weights is None:
            weights = DEFAULT_ECOSCORE_WEIGHTS
        
        model = self.get_model_profile(model_id)
        gpu_id = gpu_override or model.default_gpu
        gpu = self.get_gpu_profile(gpu_id)
        grid = self.get_grid_intensity(region_id)
        benchmarks = ECOSCORE_BENCHMARKS
        
        assumptions = []
        
        # Energy Efficiency sub-score
        energy_raw = float(model.energy_per_million_tokens_kwh) * DEFAULT_PUE
        energy_score = self.log_normalize(
            energy_raw, 
            benchmarks["energyPerMillionTokens"]["best"], 
            benchmarks["energyPerMillionTokens"]["worst"]
        )
        assumptions.append(
            'Energy efficiency scored against best (0.03 kWh/M tokens) and worst (5.0 kWh/M tokens) benchmarks'
        )
        
        # Carbon Intensity sub-score
        co2_raw = energy_raw * float(grid.gco2e_per_kwh)
        co2_score = self.log_normalize(
            co2_raw,
            benchmarks["co2ePerMillionTokens"]["best"],
            benchmarks["co2ePerMillionTokens"]["worst"]
        )
        assumptions.append(
            f"Carbon intensity uses {grid.location} grid at {grid.gco2e_per_kwh} gCO2e/kWh"
        )
        
        # Water Usage sub-score
        inference_seconds = 1_000_000 / (model.tokens_per_second_per_gpu * model.gpu_count_inference)
        inference_hours = inference_seconds / 3600
        water_raw = (energy_raw * DEFAULT_WUE_LITERS_PER_KWH) + (
            float(gpu.water_cooling_liters_per_hour) * inference_hours
        )
        water_score = self.log_normalize(
            water_raw,
            benchmarks["waterPerMillionTokens"]["best"],
            benchmarks["waterPerMillionTokens"]["worst"]
        )
        
        # Hardware Lifecycle sub-score
        hw_raw = ((float(gpu.embodied_carbon_kg_co2e) * 1000) / gpu.expected_lifespan_hours) * \
                 model.gpu_count_inference * inference_hours
        hw_score = self.log_normalize(
            hw_raw,
            benchmarks["hardwareAmortizedPerMillionTokens"]["best"],
            benchmarks["hardwareAmortizedPerMillionTokens"]["worst"]
        )
        
        # Renewable Alignment sub-score
        renewable_score = self.linear_normalize(
            grid.renewable_percentage,
            benchmarks["renewablePercentage"]["worst"],
            benchmarks["renewablePercentage"]["best"]
        )
        assumptions.append(f"Region renewable energy: {grid.renewable_percentage}%")
        
        # Weighted overall score
        overall = (
            weights["energyEfficiency"] * energy_score +
            weights["carbonIntensity"] * co2_score +
            weights["waterUsage"] * water_score +
            weights["hardwareLifecycle"] * hw_score +
            weights["renewableAlignment"] * renewable_score
        )
        
        grade = self.get_grade(overall)
        
        # Confidence assessment
        confidence = 'medium'
        if model.family == 'custom':
            confidence = 'low'
        assumptions.append(
            'Confidence reflects data source quality; production use requires real telemetry'
        )
        
        breakdown = {
            "energyEfficiency": EcoScoreBreakdown(
                score=round(energy_score, 1),
                raw=round(energy_raw, 3),
                unit="kWh per M tokens",
                explanation=f"Model consumes {energy_raw:.3f} kWh per million tokens (incl. PUE {DEFAULT_PUE})"
            ),
            "carbonIntensity": EcoScoreBreakdown(
                score=round(co2_score, 1),
                raw=round(co2_raw, 2),
                unit="gCO₂e per M tokens",
                explanation=f"{co2_raw:.1f}g CO₂e per million tokens in {grid.location}"
            ),
            "waterUsage": EcoScoreBreakdown(
                score=round(water_score, 1),
                raw=round(water_raw, 3),
                unit="liters per M tokens",
                explanation=f"{water_raw:.3f}L water per million tokens (facility + server cooling)"
            ),
            "hardwareLifecycle": EcoScoreBreakdown(
                score=round(hw_score, 1),
                raw=round(hw_raw, 2),
                unit="gCO₂e amortized per M tokens",
                explanation=f"{hw_raw:.2f}g embodied carbon amortized per million tokens across "
                          f"{model.gpu_count_inference}× {gpu.name}"
            ),
            "renewableAlignment": EcoScoreBreakdown(
                score=round(renewable_score, 1),
                raw=grid.renewable_percentage,
                unit="% renewable grid",
                explanation=f"{grid.location} grid is {grid.renewable_percentage}% renewable ({grid.source})"
            )
        }
        
        return EcoScoreResult(
            overall=round(overall, 1),
            grade=grade,
            breakdown=breakdown,
            assumptions=assumptions,
            confidence=confidence
        )
    
    def compare_models(self, model_ids: List[str], region_id: str,
                      requests_per_1k: int = 1000, avg_tokens_per_request: int = 1000,
                      weights: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        """Compare multiple models and return comparison results."""
        if weights is None:
            weights = DEFAULT_ECOSCORE_WEIGHTS
        
        total_tokens = requests_per_1k * avg_tokens_per_request
        scenario_assumptions = [
            f"Comparison scenario: {requests_per_1k:,} requests, {avg_tokens_per_request} avg tokens/request",
            f"Region: {region_id}",
            f"Total tokens evaluated: {total_tokens:,}",
        ]
        
        entries = []
        for model_id in model_ids:
            model = self.get_model_profile(model_id)
            eco_score = self.calculate_eco_score(model_id, region_id, weights)
            
            footprint_input = FootprintInput(
                model_id=model_id,
                region_id=region_id,
                total_tokens=total_tokens,
                request_count=requests_per_1k
            )
            footprint = self.calculate_full_footprint(footprint_input)
            
            # Cost efficiency: quality points per gram CO2e
            cost_efficiency = (
                model.quality_score / (footprint.co2e_grams / 1000) 
                if footprint.co2e_grams > 0 else 0
            )
            
            entry = {
                "modelId": model_id,
                "displayName": model.display_name,
                "ecoScore": eco_score,
                "footprint": {
                    "energyKwhPer1kRequests": footprint.energy_kwh,
                    "co2eGramsPer1kRequests": footprint.co2e_grams,
                    "waterLitersPer1kRequests": footprint.water_liters,
                    "hardwareAmortizedGramsPer1kRequests": footprint.hardware_amortized_grams,
                    "totalEquivalentKmDriving": footprint.equivalent_km_driving,
                    "totalEquivalentSmartphoneCharges": footprint.equivalent_smartphone_charges,
                },
                "qualityScore": model.quality_score,
                "costEfficiency": round(cost_efficiency, 1),
            }
            entries.append(entry)
        
        # Generate recommendations
        sorted_by_score = sorted(entries, key=lambda x: x["ecoScore"].overall, reverse=True)
        sorted_by_efficiency = sorted(entries, key=lambda x: x["footprint"]["co2eGramsPer1kRequests"])
        sorted_by_cost_efficiency = sorted(entries, key=lambda x: x["costEfficiency"], reverse=True)
        
        best_overall = sorted_by_score[0]
        best_efficiency = sorted_by_efficiency[0]
        best_quality_per_carbon = sorted_by_cost_efficiency[0]
        
        tradeoffs = []
        
        if best_overall["modelId"] != best_efficiency["modelId"]:
            tradeoffs.append(
                f"{best_overall['displayName']} has the best overall EcoScore but "
                f"{best_efficiency['displayName']} has lower absolute emissions — "
                f"consider workload criticality."
            )
        
        if best_overall["modelId"] != best_quality_per_carbon["modelId"]:
            tradeoffs.append(
                f"{best_quality_per_carbon['displayName']} delivers the most quality per unit of carbon — "
                f"optimal for tasks where model capability matters."
            )
        
        worst_entry = sorted_by_score[-1]
        improvement_pct = 0
        if worst_entry["footprint"]["co2eGramsPer1kRequests"] > 0:
            improvement_pct = round(
                (1 - best_efficiency["footprint"]["co2eGramsPer1kRequests"] / 
                 worst_entry["footprint"]["co2eGramsPer1kRequests"]) * 100
            )
        
        if improvement_pct > 10:
            tradeoffs.append(
                f"Switching from {worst_entry['displayName']} to {best_efficiency['displayName']} "
                f"could reduce emissions by ~{improvement_pct}% with a quality score change of "
                f"{worst_entry['qualityScore']} → {best_quality_per_carbon['qualityScore']}."
            )
        
        narrative = (
            f"Based on {requests_per_1k:,} requests in {self.get_grid_intensity(region_id).location}, "
            f"{best_overall['displayName']} achieves the best overall EcoScore "
            f"({best_overall['ecoScore'].grade}, {best_overall['ecoScore'].overall}/100). "
            f"For maximum efficiency, {best_efficiency['displayName']} uses only "
            f"{best_efficiency['footprint']['co2eGramsPer1kRequests']:.1f}g CO₂e. "
            f"The best quality-per-carbon ratio belongs to {best_quality_per_carbon['displayName']} "
            f"at {best_quality_per_carbon['costEfficiency']} quality points per kgCO₂e."
        )
        
        recommendation = {
            "bestOverall": best_overall["modelId"],
            "bestEfficiency": best_efficiency["modelId"],
            "bestQualityPerCarbon": best_quality_per_carbon["modelId"],
            "narrative": narrative,
            "tradeoffs": tradeoffs,
        }
        
        return {
            "models": entries,
            "recommendation": recommendation,
            "scenarioAssumptions": scenario_assumptions,
        }
