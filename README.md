# TaxAssist - Tax Filing Platform

A comprehensive tax filing web application that connects tax consultants with individuals filing taxes. Supports both salaried professionals and business owners.

![TaxAssist](https://img.shields.io/badge/TaxAssist-v1.0.0-green)

## Features

### Admin Panel
- **Tax Plans Management**: Create and manage plans for salary and business clients
- **Dashboard**: Real-time statistics (requests, users, revenue, messages)
- **Document Review**: Approve/reject/request revisions on uploaded documents
- **Messages**: Two-way chat with clients
- **Payments**: Revenue tracking and payment history

### Client App
- **User Registration/Login**: Simple signup with JWT authentication
- **Plan Selection**: Choose appropriate tax filing plan
- **Document Upload**: Upload required documents based on selected plan
- **Progress Tracking**: Visual progress bar and status badges
- **Chat Support**: Direct messaging with admin team

## Tech Stack

- **Frontend**: React.js, Tailwind CSS, shadcn/ui components
- **Backend**: FastAPI (Python), JWT Authentication
- **Database**: MongoDB

## Prerequisites

- Node.js (v18 or higher)
- Python (v3.9 or higher)
- MongoDB (v5.0 or higher)
- Yarn package manager

## Local Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd taxassist
```

### 2. Setup MongoDB

Make sure MongoDB is running locally on the default port (27017).

**macOS (Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Ubuntu/Debian:**
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

**Windows:**
Download and install from [MongoDB Community Server](https://www.mongodb.com/try/download/community)

**Docker (Alternative):**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGO_URL="mongodb://localhost:27017"
DB_NAME="taxassist_db"
CORS_ORIGINS="*"
JWT_SECRET="your-secret-key-change-in-production"
EOF

# Run the backend server
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

The backend will be available at `http://localhost:8001`

### 4. Frontend Setup

Open a new terminal:

```bash
cd frontend

# Install dependencies
yarn install

# Create .env file
cat > .env << EOF
REACT_APP_BACKEND_URL=http://localhost:8001
EOF

# Run the frontend
yarn start
```

The frontend will be available at `http://localhost:3000`

### 5. Create Admin User

After both servers are running, create an admin user:

```bash
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@taxassist.com",
    "password": "admin123",
    "name": "Admin User",
    "phone": "+911234567890",
    "user_type": "admin"
  }'
```

## Test Credentials

- **Admin**: admin@taxassist.com / admin123
- **Client**: Register through the app at `/register`

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |

### Tax Plans
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/plans` | List active plans |
| GET | `/api/plans/:id` | Get plan details |
| POST | `/api/admin/plans` | Create plan (Admin) |
| PUT | `/api/admin/plans/:id` | Update plan (Admin) |
| DELETE | `/api/admin/plans/:id` | Deactivate plan (Admin) |

### Filing Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/requests` | Create filing request |
| GET | `/api/requests` | List my requests |
| GET | `/api/requests/:id` | Get request details |
| GET | `/api/admin/requests` | List all requests (Admin) |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/requests/:id/documents` | Upload document |
| GET | `/api/requests/:id/documents` | List request documents |
| GET | `/api/documents/:id/download` | Download document |
| PUT | `/api/admin/documents/:id/status` | Update document status (Admin) |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/messages` | Send message |
| GET | `/api/messages` | Get my messages |
| GET | `/api/messages/conversation/:userId` | Get conversation |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments` | Create payment |
| GET | `/api/payments` | Get my payments |
| GET | `/api/admin/payments` | Get all payments (Admin) |

### Admin Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Get dashboard statistics |

## Project Structure

```
├── backend/
│   ├── server.py          # FastAPI application
│   ├── requirements.txt   # Python dependencies
│   └── .env              # Environment variables
├── frontend/
│   ├── src/
│   │   ├── App.js        # Main React app with routing
│   │   ├── pages/        # Page components
│   │   │   ├── LandingPage.js
│   │   │   ├── LoginPage.js
│   │   │   ├── RegisterPage.js
│   │   │   ├── ClientDashboard.js
│   │   │   ├── ClientPlans.js
│   │   │   ├── ClientRequest.js
│   │   │   ├── ClientMessages.js
│   │   │   ├── AdminDashboard.js
│   │   │   ├── AdminPlans.js
│   │   │   ├── AdminRequests.js
│   │   │   ├── AdminDocuments.js
│   │   │   ├── AdminMessages.js
│   │   │   └── AdminPayments.js
│   │   └── components/   # Reusable components
│   ├── package.json
│   └── .env
└── README.md
```

## Development

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
yarn test
```

### Code Linting

```bash
# Backend
cd backend
ruff check .

# Frontend
cd frontend
yarn lint
```

## Deployment

For production deployment, ensure you:

1. Set strong `JWT_SECRET` in backend `.env`
2. Configure proper MongoDB connection string
3. Set `CORS_ORIGINS` to your frontend domain
4. Use HTTPS for all communications
5. Set up proper environment variables for production

## License

MIT License

## Support

For issues or questions, please open a GitHub issue.
