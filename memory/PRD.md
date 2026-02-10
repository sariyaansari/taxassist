# TaxAssist - Tax Filing Application PRD

## Original Problem Statement
Build a comprehensive tax filing assistance application with:
- **Admin Panel**: Manage tax plans, review documents, handle payments, communicate with clients
- **Client App**: Select plans, upload documents, track status, communicate with admin
- **Infrastructure**: Configurable storage (local/AWS S3), configurable payment gateway (mock/PhonePe), email notifications

## Tech Stack
- **Frontend**: React, TailwindCSS, shadcn/ui components
- **Backend**: FastAPI (Python), MongoDB
- **Authentication**: JWT-based
- **Email**: Resend (when configured)

## User Personas
1. **Super Admin**: Full access - manage plans, offers, users, settings, CA Admins
2. **CA Admin**: Restricted access based on permissions - review documents, handle messages
3. **Client**: Select plans, upload documents, track filing status, communicate with admin

## Core Requirements

### Admin Panel
- ✅ Dashboard with statistics (requests, revenue, messages, offers)
- ✅ Tax Plans management (create, edit, deactivate for salary/business)
- ✅ Requests management (view all filings, update status)
- ✅ Document review (approve/reject/request revision, unlock approved docs)
- ✅ Messages (chat with clients)
- ✅ Payments (view all payments)
- ✅ Users management (view clients, manage admins)
- ✅ **Offers management** (create discount offers with validity, code verification)
- ✅ **Settings** (notification email, CA Admin permissions)

### Client App
- ✅ User registration and login
- ✅ Plan selection with offer code support
- ✅ Document upload with password protection
- ✅ Document replacement (not duplication) for rejected docs
- ✅ Status tracking
- ✅ Chat with admin
- ✅ Additional documents display

### Infrastructure
- ✅ Configurable storage provider (local/S3)
- ✅ Configurable payment gateway (mock/PhonePe)
- ✅ Email service integration (Resend)
- ✅ Role-based access control (RBAC)

---

## Completed Features (December 2025)

### Session 1: Initial Build
- Full-stack application with React frontend and FastAPI backend
- MongoDB database integration
- JWT authentication system
- Admin and Client panels
- Basic tax plans and document management

### Session 2: Enhancements
- Configurable backend architecture (storage/payment providers)
- UI/UX improvements (dialogs, dropdowns)
- Document workflow improvements
- Basic admin roles (super_admin, ca_admin)

### Session 3: Advanced Features (Current)
1. **Tax Plan Offers System**
   - Create/edit/deactivate offers with validity periods
   - Discount types: percentage or fixed amount
   - Max usage limits
   - Email/phone linked verification (prevents reuse)
   - Offer code validation API
   - Client-side offer application during plan selection

2. **Admin Settings**
   - Configurable notification email
   - Toggle email notifications (new case, payment, messages)

3. **CA Admin RBAC**
   - Granular permissions system
   - Super Admin can manage CA Admin permissions
   - Sidebar navigation filtered by permissions
   - API endpoint protection

4. **Approved Document Lock**
   - Approved documents locked from client changes
   - Admin unlock feature (changes status to needs_revision)
   - Email notification on unlock

5. **Smart Email Notifications**
   - Notification queue with 30-second batching delay
   - Multiple document updates consolidated into single email
   - Prevents notification spam when reviewing multiple documents

6. **UI Improvements**
   - Additional documents section for clients
   - Responsive Tax Plans layout
   - Better plan cards for all screen sizes
   - Document replacement working (not duplication)

---

## Database Schema

### Collections
- **users**: {id, email, name, phone, password, user_type, admin_role, permissions, is_active}
- **tax_plans**: {id, name, price, description, plan_type, features, required_documents, is_active}
- **filing_requests**: {id, user_id, plan_id, status, payment_status, original_price, price, applied_offer, financial_year}
- **documents**: {id, request_id, user_id, name, document_type, status, password, admin_notes, unlocked_by}
- **messages**: {id, request_id, sender_id, content, timestamp, is_read}
- **payments**: {id, request_id, user_id, amount, status, gateway, transaction_id}
- **offers**: {id, code, name, description, discount_type, discount_value, valid_from, valid_until, max_uses, current_uses, used_by, applicable_plans, is_active}
- **admin_settings**: {type, notification_email, new_case_email_enabled, payment_email_enabled, message_email_enabled}

---

## API Endpoints

### Authentication
- POST /api/auth/register
- POST /api/auth/login

### Plans
- GET /api/plans (public)
- GET /api/admin/plans
- POST /api/admin/plans
- PUT /api/admin/plans/{id}
- DELETE /api/admin/plans/{id}

### Offers
- GET /api/offers/active (public)
- POST /api/offers/validate (public)
- GET /api/admin/offers
- POST /api/admin/offers
- PUT /api/admin/offers/{id}
- DELETE /api/admin/offers/{id}

### Requests
- GET /api/requests
- POST /api/requests (with offer support)
- GET /api/admin/requests

### Documents
- POST /api/requests/{id}/documents/upload
- PUT /api/admin/documents/{id}/status
- POST /api/admin/documents/{id}/allow-change (unlock)
- GET /api/documents/{id}/download

### Settings (Super Admin only)
- GET /api/admin/settings
- PUT /api/admin/settings
- GET /api/admin/permissions/available
- PUT /api/admin/users/{id}/permissions

---

## Test Credentials
- **Super Admin**: superadmin@taxassist.com / super123
- **CA Admin**: admin@taxassist.com / admin123
- **Client**: testclient@example.com / test123

---

## Mocked Services
- **Email Service**: MOCKED (requires RESEND_API_KEY)
- **Payment Gateway**: MOCKED (using mock provider)
- **Storage**: LOCAL (can be switched to S3)

---

## Pending/Future Tasks

### P1 - High Priority
- [ ] Smart email notifications (batch multiple document updates into single email)
- [ ] PhonePe payment gateway integration
- [ ] AWS S3 storage integration

### P2 - Medium Priority
- [ ] Admin email composition feature (send custom emails to clients)
- [ ] Enhanced user management (view user's all cases)

### P3 - Low Priority
- [ ] Session management improvements (investigate potential random logouts)
- [ ] Mobile app consideration

---

## Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb://...
DB_NAME=taxassist_db
JWT_SECRET=your-secret
STORAGE_PROVIDER=local (or s3)
PAYMENT_GATEWAY=mock (or phonepe)
RESEND_API_KEY=your-key (optional)
ADMIN_NOTIFICATION_EMAIL=admin@example.com
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://your-domain.com
```

---

## File Structure
```
/app
├── backend/
│   ├── server.py (main FastAPI app)
│   ├── config.py (configuration)
│   ├── requirements.txt
│   ├── services/
│   │   ├── email.py
│   │   ├── payment.py
│   │   └── storage.py
│   └── tests/
│       └── test_taxassist_features.py
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── components/
│   │   │   ├── AdminLayout.js
│   │   │   ├── ClientLayout.js
│   │   │   └── ui/ (shadcn)
│   │   └── pages/
│   │       ├── AdminDashboard.js
│   │       ├── AdminPlans.js
│   │       ├── AdminRequests.js
│   │       ├── AdminDocuments.js
│   │       ├── AdminMessages.js
│   │       ├── AdminPayments.js
│   │       ├── AdminUsers.js
│   │       ├── AdminOffers.js
│   │       ├── AdminSettings.js
│   │       ├── ClientDashboard.js
│   │       ├── ClientPlans.js
│   │       ├── ClientRequest.js
│   │       ├── ClientMessages.js
│   │       └── LandingPage.js
│   └── package.json
└── memory/
    └── PRD.md
```
