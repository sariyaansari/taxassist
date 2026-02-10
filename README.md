# TaxAssist - Tax Filing Platform

A comprehensive tax filing web application that connects tax consultants with individuals filing taxes. Supports both salaried professionals and business owners.

![TaxAssist](https://img.shields.io/badge/TaxAssist-v2.0.0-green)

## Features

### Admin Panel
- **Dashboard**: Real-time statistics (requests, users, revenue, messages, offers)
- **Tax Plans Management**: Create and manage plans for salary and business clients
- **Document Review**: Approve/reject/request revisions, unlock approved documents
- **Messages**: Two-way chat with clients
- **Payments**: Revenue tracking and payment history
- **Users Management**: View clients, manage CA Admins
- **Offers Management**: Create discount offers with validity periods and usage limits
- **Settings**: Configure notification email, manage CA Admin permissions

### Client App
- **User Registration/Login**: Simple signup with JWT authentication
- **Plan Selection**: Choose appropriate tax filing plan with offer code support
- **Document Upload**: Upload required documents with optional password protection
- **Document Replacement**: Replace rejected documents (not duplicate)
- **Progress Tracking**: Visual progress bar and status badges
- **Chat Support**: Direct messaging with admin team
- **Additional Documents**: View all uploaded documents including extras

### Role-Based Access Control (RBAC)
- **Super Admin**: Full access to all features
- **CA Admin**: Restricted access based on assigned permissions
  - view_requests, review_documents, send_messages, view_payments
  - manage_plans, manage_offers, view_users, send_emails, unlock_documents

## Tech Stack

- **Frontend**: React.js, Tailwind CSS, shadcn/ui components
- **Backend**: FastAPI (Python), JWT Authentication
- **Database**: MongoDB
- **Storage**: Local or AWS S3 (configurable)
- **Payments**: Mock or PhonePe (configurable)
- **Email**: Resend (optional)

## Architecture - Configurable Services

The application supports switching between local and cloud services via environment variables:

### Storage Providers
| Provider | Config Value | Description |
|----------|--------------|-------------|
| Local | `local` | Files stored on local filesystem |
| AWS S3 | `aws_s3` | Files stored in Amazon S3 bucket |

### Payment Gateways
| Gateway | Config Value | Description |
|---------|--------------|-------------|
| Mock | `mock` | Test payments (auto-succeeds) |
| PhonePe | `phonepe` | PhonePe UPI payments |

### Switching Providers
Simply update the `.env` file:
```bash
# Use AWS S3 for storage
STORAGE_PROVIDER="aws_s3"

# Use PhonePe for payments
PAYMENT_GATEWAY="phonepe"
```

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

# Storage Configuration: "local" or "aws_s3"
STORAGE_PROVIDER="local"

# Payment Gateway: "mock" or "phonepe"
PAYMENT_GATEWAY="mock"

# Email Configuration (optional - for notifications)
RESEND_API_KEY=""
SENDER_EMAIL="noreply@taxassist.com"
ADMIN_NOTIFICATION_EMAIL=""

# AWS Configuration (required if STORAGE_PROVIDER=aws_s3)
AWS_REGION="ap-south-1"
AWS_S3_BUCKET=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""

# PhonePe Configuration (required if PAYMENT_GATEWAY=phonepe)
PHONEPE_MERCHANT_ID=""
PHONEPE_SALT_KEY=""
PHONEPE_SALT_INDEX="1"
PHONEPE_ENV="UAT"
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

### 5. Create Admin Users

After both servers are running, create admin users:

**Create Super Admin:**
```bash
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@taxassist.com",
    "password": "super123",
    "name": "Super Admin",
    "phone": "+911234567890",
    "user_type": "admin",
    "admin_role": "super_admin"
  }'
```

**Create CA Admin:**
```bash
curl -X POST http://localhost:8001/api/admins/create-admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <super_admin_token>" \
  -d '{
    "email": "admin@taxassist.com",
    "password": "admin123",
    "name": "CA Admin",
    "phone": "+911234567891",
    "admin_role": "ca_admin",
    "permissions": ["view_requests", "review_documents", "send_messages", "view_payments"]
  }'
```

## Test Credentials

- **Super Admin**: superadmin@taxassist.com / super123
- **CA Admin**: admin@taxassist.com / admin123
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
| GET | `/api/plans` | List active plans (public) |
| GET | `/api/admin/plans` | List all plans (Admin) |
| POST | `/api/admin/plans` | Create plan (Admin) |
| PUT | `/api/admin/plans/:id` | Update plan (Admin) |
| DELETE | `/api/admin/plans/:id` | Deactivate plan (Admin) |

### Offers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offers/active` | List active offers (public) |
| POST | `/api/offers/validate` | Validate offer code (public) |
| GET | `/api/admin/offers` | List all offers (Super Admin) |
| POST | `/api/admin/offers` | Create offer (Super Admin) |
| PUT | `/api/admin/offers/:id` | Update offer (Super Admin) |
| DELETE | `/api/admin/offers/:id` | Deactivate offer (Super Admin) |

### Filing Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/requests` | Create filing request (with offer support) |
| GET | `/api/requests` | List my requests |
| GET | `/api/requests/:id` | Get request details |
| GET | `/api/admin/requests` | List all requests (Admin) |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/requests/:id/documents/upload` | Upload document |
| GET | `/api/requests/:id/documents` | List request documents |
| GET | `/api/documents/:id/download` | Download document |
| PUT | `/api/admin/documents/:id/status` | Update document status (Admin) |
| POST | `/api/admin/documents/:id/allow-change` | Unlock approved document (Admin) |

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

### Admin Settings (Super Admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/settings` | Get admin settings |
| PUT | `/api/admin/settings` | Update admin settings |
| GET | `/api/admin/permissions/available` | Get available permissions |
| PUT | `/api/admin/users/:id/permissions` | Update CA Admin permissions |

### Admin Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Get dashboard statistics |

## Project Structure

```
├── backend/
│   ├── server.py          # FastAPI application
│   ├── config.py          # Configuration management
│   ├── requirements.txt   # Python dependencies
│   ├── services/
│   │   ├── email.py       # Email service (Resend)
│   │   ├── payment.py     # Payment gateway abstraction
│   │   └── storage.py     # Storage provider abstraction
│   ├── tests/
│   │   └── test_taxassist_features.py
│   └── .env               # Environment variables
├── frontend/
│   ├── src/
│   │   ├── App.js         # Main React app with routing
│   │   ├── pages/
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
│   │   │   ├── AdminPayments.js
│   │   │   ├── AdminUsers.js
│   │   │   ├── AdminOffers.js
│   │   │   └── AdminSettings.js
│   │   └── components/
│   │       ├── AdminLayout.js
│   │       ├── ClientLayout.js
│   │       └── ui/        # shadcn/ui components
│   ├── package.json
│   └── .env
├── memory/
│   └── PRD.md             # Product requirements document
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
5. Configure email service (RESEND_API_KEY) for notifications
6. Set up proper environment variables for production

## Changelog

### v2.0.0 (December 2025)
- Added Offers system with validity periods and usage tracking
- Added Admin Settings page with notification configuration
- Implemented CA Admin role-based access control (RBAC)
- Added document unlock feature for approved documents
- Improved Tax Plans UI for mobile responsiveness
- Added offer code support during plan selection
- Added additional documents display for clients

### v1.0.0 (Initial Release)
- Basic tax filing workflow
- Admin and Client panels
- Document upload and review
- Messaging system
- Payment integration (mock)

## License

MIT License

## Support

For issues or questions, please open a GitHub issue.
