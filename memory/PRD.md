# TaxAssist - Tax Filing Platform PRD

## Overview
TaxAssist is a comprehensive tax filing web application that connects tax consultants (admin) with individuals filing taxes (clients). The platform supports both salaried professionals and business owners.

## Architecture
- **Frontend**: React.js with Tailwind CSS, shadcn/ui components
- **Backend**: FastAPI (Python) with JWT authentication
- **Database**: MongoDB
- **Storage**: Configurable - Local filesystem or AWS S3
- **Payments**: Configurable - Mock, PhonePe, Razorpay, Stripe
- **Design System**: Organic Professional theme with Deep Forest Green (#0f2e1f) primary, Bone White (#f5f5f0) secondary, Terracotta (#c25e00) accent

## Configuration System
The app uses environment-based configuration for flexibility:
```
STORAGE_PROVIDER=local|aws_s3
PAYMENT_GATEWAY=mock|phonepe|razorpay|stripe
AUTH_PROVIDER=jwt_local|aws_cognito
```

## User Personas
1. **Tax Consultant (Admin)**: Manages tax plans, reviews documents, communicates with clients
2. **Salaried Individual**: Files personal income tax returns
3. **Business Owner**: Files business tax returns with more complex documentation

## Core Requirements (Static)
### Admin Panel
- ✅ Create and manage tax filing plans (Salary & Business)
- ✅ Dashboard with request statistics
- ✅ View recent messages from customers
- ✅ Document review with status updates (approve/reject/needs revision)
- ✅ Payment tracking and revenue statistics

### Client App
- ✅ User registration and login
- ✅ Profile management
- ✅ Select tax filing plans
- ✅ Upload documents based on selected plan
- ✅ Track progress/status of tax filing
- ✅ Chat with admin support
- ✅ Make payments

## What's Been Implemented (Feb 9, 2025)
### Backend API Endpoints
- Auth: Register, Login, Profile
- Plans: CRUD operations (admin), Public listing
- Requests: Create filing request, View requests
- Documents: Upload, Download, Status update
- Messages: Send/receive, Conversations
- Payments: Create payment, View history
- Admin Stats: Dashboard analytics

### Frontend Pages
- Landing Page (hero, features, how it works)
- Login/Register Pages
- Client: Dashboard, Plans, Request Details, Messages
- Admin: Dashboard, Plans Management, Requests, Documents, Messages, Payments

## Test Credentials
- **Admin**: admin@taxassist.com / admin123
- **Client**: Can register through the app

## Prioritized Backlog
### P0 (Critical)
- All core features implemented ✅

### P1 (High Priority)
- Email notifications for status updates
- Document preview in browser
- Password reset functionality

### P2 (Medium Priority)
- Multiple admin users with roles
- Automated document validation
- Report generation (PDF)

### P3 (Future)
- Mobile app
- Integration with government tax portals
- AI-powered document classification

## Next Tasks
1. Add email notifications (SendGrid/Resend)
2. Implement document preview functionality
3. Add password reset flow
4. Create downloadable tax summary reports
