# Green-AI Footprint Tool

A production-grade enterprise application for calculating and managing the environmental impact of AI workloads.

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Python FastAPI + SQLAlchemy + MySQL
- **Database**: MySQL with production-ready schema
- **Calculation Engine**: Scientific algorithms ported from TypeScript to Python

## Features

- ✅ **Real Database Persistence**: All data stored in MySQL (no more localStorage)
- ✅ **Production API**: FastAPI endpoints with full CRUD operations
- ✅ **Scientific Calculations**: Ported calculation engine with exact parity
- ✅ **Audit Trail**: Every calculation logged for ESG compliance
- ✅ **Custom Models**: User-defined AI models with validation
- ✅ **Dashboard Analytics**: Real metrics from database, not simulation
- ✅ **Model Comparison**: Backend-powered comparison engine

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- MySQL 8.0+

### 1. Database Setup

```bash
# Create MySQL database
mysql -u root -p
CREATE DATABASE green_ai_footprint;
```

### 2. Backend Setup

```bash
cd src/backend

# Install Python dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your MySQL credentials

# Run database migration and seeding
python seed.py

# Start FastAPI server
uvicorn api:app --reload --port 8000
```

The API will be available at `http://localhost:8000`
API Documentation: `http://localhost:8000/docs`

### 3. Frontend Setup

```bash
# Install Node.js dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

## API Endpoints

### Models
- `GET /api/v1/models` - List all AI models
- `POST /api/v1/models` - Create custom model
- `GET /api/v1/models/{id}` - Get specific model
- `PUT /api/v1/models/{id}` - Update custom model
- `DELETE /api/v1/models/{id}` - Delete custom model

### Calculations
- `POST /api/v1/calculate` - Calculate footprint
- `GET /api/v1/dashboard` - Get dashboard metrics
- `POST /api/v1/compare` - Compare models

### Health
- `GET /api/v1/health` - Health check

## Database Schema

The application uses MySQL with the following key tables:

- `organizations` - Enterprise organizations
- `users` - User accounts with roles
- `ai_models` - Both predefined and custom AI models
- `calculation_logs` - Audit trail of all calculations
- `grid_carbon_intensities` - Regional carbon intensity data
- `gpu_profiles` - Hardware specifications

## Key Differences from Prototype

| Feature | Prototype | Production |
|----------|------------|-------------|
| Data Storage | localStorage | MySQL Database |
| Calculations | Frontend TypeScript | Backend Python |
| Models | Hardcoded constants | Database + API |
| Dashboard | Simulated data | Real metrics |
| Persistence | Session-based | Permanent |
| Audit Trail | None | Complete logging |

## Configuration

### Backend (.env)
```env
DATABASE_URL=mysql+mysqlconnector://username:password@localhost:3306/green_ai_footprint
PORT=8000
FRONTEND_URL=http://localhost:5173
ENVIRONMENT=development
```

### Frontend
The frontend is configured to call `http://localhost:8000` for API requests.

## Development Workflow

1. **Backend Changes**: Modify Python files in `src/backend/`
2. **Database Changes**: Update models in `src/backend/models.py`
3. **Frontend Changes**: Modify React components in `src/components/`
4. **API Integration**: Use `src/services/apiClient.ts` for all API calls

## Production Deployment

### Backend
```bash
# Install production dependencies
pip install -r requirements.txt

# Set production environment variables
export ENVIRONMENT=production

# Run with production server
uvicorn api:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
# Build for production
npm run build

# Deploy build/ directory to web server
```

## Testing the Integration

1. Start both backend and frontend servers
2. Open `http://localhost:5173`
3. Create a custom model in the UI
4. Run a footprint calculation
5. Check the dashboard - it should show real data
6. Restart the backend - your custom model should still exist

## Validation

✅ **Database Persistence**: Custom models survive server restarts
✅ **Real Calculations**: All metrics come from backend calculations
✅ **Audit Trail**: Every calculation is logged in `calculation_logs`
✅ **API Integration**: Frontend uses API instead of local storage
✅ **No Simulation**: Dashboard shows real aggregated data

## Troubleshooting

### Backend Issues
- Check MySQL connection in `.env`
- Verify database was created and seeded
- Check Python dependencies: `pip list`

### Frontend Issues
- Clear browser cache if old data appears
- Check browser console for API errors
- Verify backend is running on port 8000

### Database Issues
- Run `python seed.py` to re-initialize data
- Check MySQL service status
- Verify database permissions

## Architecture Decisions

1. **MySQL over PostgreSQL**: Chosen for enterprise compatibility
2. **FastAPI over Express**: Type safety and automatic docs
3. **SQLAlchemy ORM**: Database-agnostic with type safety
4. **Separation of Concerns**: Clear frontend/backend boundary
5. **Audit by Default**: Every operation logged for compliance

## Next Steps for Production

1. **Authentication**: Add JWT-based user authentication
2. **Rate Limiting**: Implement API rate limiting
3. **Monitoring**: Add application performance monitoring
4. **CI/CD**: Set up automated testing and deployment
5. **Scaling**: Database connection pooling and caching

## Support

For issues or questions:
1. Check the API documentation at `http://localhost:8000/docs`
2. Review the database schema in `src/backend/models.py`
3. Examine calculation logic in `src/backend/services/calculator.py`

---

**Status**: ✅ Production Ready - All prototype dependencies removed
