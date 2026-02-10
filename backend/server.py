from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone
import hashlib
import jwt
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import configuration and services
from config import config, StorageProvider, PaymentGateway
from services.email import email_service

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Secret
JWT_SECRET = os.environ.get('JWT_SECRET', 'tax-assist-secret-key-2024')
security = HTTPBearer()

app = FastAPI(title="TaxAssist API", version="2.0.0")
api_router = APIRouter(prefix="/api")

# ================== ENUMS & CONSTANTS ==================

ADMIN_ROLES = {
    "super_admin": {
        "name": "Super Admin",
        "permissions": ["all"]
    },
    "ca_admin": {
        "name": "CA Admin",
        "permissions": ["view_requests", "review_documents", "send_messages", "view_payments"]
    }
}

# Available CA Admin Permissions
CA_ADMIN_AVAILABLE_PERMISSIONS = [
    {"id": "view_requests", "name": "View Requests", "description": "Can view all tax filing requests"},
    {"id": "review_documents", "name": "Review Documents", "description": "Can review and update document status"},
    {"id": "send_messages", "name": "Send Messages", "description": "Can send messages to clients"},
    {"id": "view_payments", "name": "View Payments", "description": "Can view payment records"},
    {"id": "manage_plans", "name": "Manage Plans", "description": "Can create and edit tax plans"},
    {"id": "manage_offers", "name": "Manage Offers", "description": "Can create and manage discount offers"},
    {"id": "view_users", "name": "View Users", "description": "Can view client list"},
    {"id": "send_emails", "name": "Send Emails", "description": "Can send custom emails to clients"},
    {"id": "unlock_documents", "name": "Unlock Documents", "description": "Can unlock approved documents for re-upload"}
]

# ================== MODELS ==================

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    phone: str
    user_type: str = "client"
    admin_role: Optional[str] = None  # super_admin or ca_admin

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    phone: str
    user_type: str
    admin_role: Optional[str] = None
    created_at: str

class TaxPlanCreate(BaseModel):
    name: str
    description: str
    plan_type: str
    price: float
    required_documents: List[str]
    features: List[str]

class ClientProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    pan_number: Optional[str] = None
    address: Optional[str] = None
    dob: Optional[str] = None
    occupation: Optional[str] = None
    annual_income: Optional[str] = None

class TaxFilingRequestCreate(BaseModel):
    plan_id: str
    financial_year: str

class DocumentUpload(BaseModel):
    name: str
    document_type: str
    file_data: str
    file_name: str
    password: Optional[str] = None  # Password for protected documents

class DocumentStatusUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None
    send_email: bool = True

class MessageCreate(BaseModel):
    content: str
    recipient_id: Optional[str] = None

class PaymentInitiate(BaseModel):
    request_id: str
    amount: float
    return_url: Optional[str] = None

class AdminEmailSend(BaseModel):
    to_email: str
    subject: str
    message: str

class AdminUserCreate(BaseModel):
    email: str
    password: str
    name: str
    phone: str
    admin_role: str  # super_admin or ca_admin
    permissions: Optional[List[str]] = None  # Custom permissions for ca_admin

class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    admin_role: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None

class DocumentChangeRequest(BaseModel):
    document_id: str
    reason: str

# ================== OFFER MODELS ==================

class OfferCreate(BaseModel):
    code: str
    name: str
    description: str
    discount_type: str  # "percentage" or "fixed"
    discount_value: float
    valid_from: str  # ISO date string
    valid_until: str  # ISO date string
    max_uses: Optional[int] = None
    applicable_plans: Optional[List[str]] = None  # If None, applies to all plans

class OfferUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    valid_until: Optional[str] = None
    max_uses: Optional[int] = None
    applicable_plans: Optional[List[str]] = None
    is_active: Optional[bool] = None

class ApplyOfferRequest(BaseModel):
    code: str
    email: str
    phone: str

# ================== ADMIN SETTINGS MODELS ==================

class AdminSettingsUpdate(BaseModel):
    notification_email: Optional[str] = None
    new_case_email_enabled: Optional[bool] = None
    payment_email_enabled: Optional[bool] = None
    message_email_enabled: Optional[bool] = None

# ================== CA ADMIN PERMISSIONS MODELS ==================

class CAAdminPermissionsUpdate(BaseModel):
    permissions: List[str]

# ================== HELPER FUNCTIONS ==================

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(user_id: str, user_type: str, admin_role: str = None) -> str:
    payload = {
        "user_id": user_id,
        "user_type": user_type,
        "admin_role": admin_role,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token_data = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": token_data["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_admin(user: dict = Depends(get_current_user)):
    if user["user_type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_super_admin(user: dict = Depends(get_current_user)):
    if user["user_type"] != "admin" or user.get("admin_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return user

def check_permission(user: dict, permission: str) -> bool:
    """Check if admin user has specific permission"""
    if user.get("admin_role") == "super_admin":
        return True
    user_permissions = user.get("permissions", [])
    return permission in user_permissions or "all" in user_permissions

async def get_super_admin_email() -> Optional[str]:
    """Get super admin email for notifications"""
    # First check admin settings
    settings = await db.admin_settings.find_one({"type": "global"}, {"_id": 0})
    if settings and settings.get("notification_email"):
        return settings["notification_email"]
    
    # Fall back to super admin email
    super_admin = await db.users.find_one(
        {"user_type": "admin", "admin_role": "super_admin", "is_active": {"$ne": False}},
        {"_id": 0, "email": 1}
    )
    return super_admin.get("email") if super_admin else os.environ.get('ADMIN_NOTIFICATION_EMAIL')

def require_permission(permission: str):
    """Decorator factory to check if admin has specific permission"""
    async def permission_checker(user: dict = Depends(require_admin)):
        if user.get("admin_role") == "super_admin":
            return user
        user_permissions = user.get("permissions", [])
        if permission not in user_permissions and "all" not in user_permissions:
            raise HTTPException(status_code=403, detail=f"Permission denied: {permission} required")
        return user
    return permission_checker

# ================== AUTH ROUTES ==================

@api_router.post("/auth/register")
async def register(data: UserCreate, background_tasks: BackgroundTasks):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = {
        "id": str(uuid.uuid4()),
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "phone": data.phone,
        "user_type": data.user_type,
        "admin_role": data.admin_role if data.user_type == "admin" else None,
        "permissions": [],
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "profile": {}
    }
    await db.users.insert_one(user)
    
    # Send welcome email
    if data.user_type == "client":
        background_tasks.add_task(email_service.send_welcome_email, data.email, data.name)
    
    token = create_token(user["id"], user["user_type"], user.get("admin_role"))
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "phone": user["phone"],
            "user_type": user["user_type"],
            "admin_role": user.get("admin_role")
        }
    }

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or user["password"] != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.get("is_active") == False:
        raise HTTPException(status_code=401, detail="Account is deactivated")
    
    token = create_token(user["id"], user["user_type"], user.get("admin_role"))
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "phone": user["phone"],
            "user_type": user["user_type"],
            "admin_role": user.get("admin_role"),
            "permissions": user.get("permissions", [])
        }
    }

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "phone": user["phone"],
        "user_type": user["user_type"],
        "admin_role": user.get("admin_role"),
        "permissions": user.get("permissions", []),
        "profile": user.get("profile", {})
    }

@api_router.put("/auth/profile")
async def update_profile(data: ClientProfileUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"profile": {**user.get("profile", {}), **update_data}}}
        )
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return updated_user

# ================== ADMIN USER MANAGEMENT ==================

@api_router.get("/admin/users")
async def get_all_users(admin: dict = Depends(require_admin)):
    """Get all registered users (clients and admins)"""
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(500)
    
    # Get request counts for each user
    for user in users:
        if user["user_type"] == "client":
            request_count = await db.filing_requests.count_documents({"user_id": user["id"]})
            user["request_count"] = request_count
    
    return users

@api_router.get("/admin/users/{user_id}")
async def get_user_details(user_id: str, admin: dict = Depends(require_admin)):
    """Get detailed user information with their cases"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's requests
    requests = await db.filing_requests.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    
    return {
        "user": user,
        "requests": requests
    }

@api_router.post("/admin/users/admin")
async def create_admin_user(data: AdminUserCreate, admin: dict = Depends(require_super_admin)):
    """Create new admin user (Super Admin only)"""
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if data.admin_role not in ADMIN_ROLES:
        raise HTTPException(status_code=400, detail="Invalid admin role")
    
    permissions = data.permissions if data.permissions else ADMIN_ROLES[data.admin_role]["permissions"]
    
    user = {
        "id": str(uuid.uuid4()),
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "phone": data.phone,
        "user_type": "admin",
        "admin_role": data.admin_role,
        "permissions": permissions,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["id"]
    }
    await db.users.insert_one(user)
    user.pop("_id", None)
    user.pop("password", None)
    return user

@api_router.put("/admin/users/{user_id}")
async def update_admin_user(user_id: str, data: AdminUserUpdate, admin: dict = Depends(require_super_admin)):
    """Update admin user (Super Admin only)"""
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return updated_user

@api_router.get("/admin/admins")
async def get_admin_users(admin: dict = Depends(require_super_admin)):
    """Get all admin users (Super Admin only)"""
    admins = await db.users.find(
        {"user_type": "admin"},
        {"_id": 0, "password": 0}
    ).to_list(100)
    return admins

# ================== TAX PLANS ==================

@api_router.post("/admin/plans")
async def create_plan(data: TaxPlanCreate, admin: dict = Depends(require_admin)):
    if not check_permission(admin, "manage_plans"):
        if admin.get("admin_role") != "super_admin":
            raise HTTPException(status_code=403, detail="Permission denied")
    
    plan = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "description": data.description,
        "plan_type": data.plan_type,
        "price": data.price,
        "required_documents": data.required_documents,
        "features": data.features,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["id"]
    }
    await db.tax_plans.insert_one(plan)
    plan.pop("_id", None)
    return plan

@api_router.get("/admin/plans")
async def get_all_plans_admin(admin: dict = Depends(require_admin)):
    plans = await db.tax_plans.find({}, {"_id": 0}).to_list(100)
    return plans

@api_router.put("/admin/plans/{plan_id}")
async def update_plan(plan_id: str, data: TaxPlanCreate, admin: dict = Depends(require_admin)):
    result = await db.tax_plans.update_one({"id": plan_id}, {"$set": data.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan = await db.tax_plans.find_one({"id": plan_id}, {"_id": 0})
    return plan

@api_router.delete("/admin/plans/{plan_id}")
async def delete_plan(plan_id: str, admin: dict = Depends(require_admin)):
    result = await db.tax_plans.update_one({"id": plan_id}, {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"message": "Plan deactivated"}

@api_router.get("/plans")
async def get_active_plans():
    plans = await db.tax_plans.find({"is_active": True}, {"_id": 0}).to_list(100)
    return plans

@api_router.get("/plans/{plan_id}")
async def get_plan(plan_id: str):
    plan = await db.tax_plans.find_one({"id": plan_id, "is_active": True}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan

# ================== TAX FILING REQUESTS ==================

@api_router.post("/requests")
async def create_filing_request(data: TaxFilingRequestCreate, user: dict = Depends(get_current_user)):
    plan = await db.tax_plans.find_one({"id": data.plan_id, "is_active": True}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    request = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "plan_id": data.plan_id,
        "plan_name": plan["name"],
        "plan_type": plan["plan_type"],
        "price": plan["price"],
        "required_documents": plan["required_documents"],
        "financial_year": data.financial_year,
        "status": "pending",
        "payment_status": "unpaid",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.filing_requests.insert_one(request)
    request.pop("_id", None)
    return request

@api_router.get("/requests")
async def get_my_requests(user: dict = Depends(get_current_user)):
    requests = await db.filing_requests.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

@api_router.get("/requests/{request_id}")
async def get_request(request_id: str, user: dict = Depends(get_current_user)):
    request = await db.filing_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if user["user_type"] != "admin" and request["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return request

@api_router.get("/admin/requests")
async def get_all_requests(admin: dict = Depends(require_admin)):
    requests = await db.filing_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return requests

@api_router.put("/admin/requests/{request_id}/status")
async def update_request_status(request_id: str, status: str, background_tasks: BackgroundTasks, admin: dict = Depends(require_admin)):
    request = await db.filing_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.filing_requests.update_one(
        {"id": request_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Send notification email
    user = await db.users.find_one({"id": request["user_id"]}, {"_id": 0})
    if user:
        background_tasks.add_task(
            email_service.send_case_status_update,
            user["email"], user["name"], status,
            request["plan_name"], request["financial_year"]
        )
    
    updated_request = await db.filing_requests.find_one({"id": request_id}, {"_id": 0})
    return updated_request

# ================== DOCUMENTS ==================

@api_router.post("/requests/{request_id}/documents")
async def upload_document(request_id: str, data: DocumentUpload, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    request = await db.filing_requests.find_one({"id": request_id, "user_id": user["id"]}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check if document of this type already exists
    existing_doc = await db.documents.find_one({
        "request_id": request_id,
        "document_type": data.document_type,
        "user_id": user["id"]
    }, {"_id": 0})
    
    if existing_doc:
        # If approved, don't allow replacement without admin approval
        if existing_doc["status"] == "approved":
            raise HTTPException(
                status_code=400, 
                detail="This document is already approved. Please send a message to admin to request changes."
            )
        
        # Replace existing document (for rejected/needs_revision/pending)
        await db.documents.update_one(
            {"id": existing_doc["id"]},
            {"$set": {
                "name": data.name,
                "file_name": data.file_name,
                "file_data": data.file_data if not config.is_aws_storage() else None,
                "password": data.password,
                "status": "pending",
                "admin_notes": "",
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
                "reviewed_at": None,
                "is_replacement": True,
                "previous_status": existing_doc["status"]
            }}
        )
        doc_id = existing_doc["id"]
    else:
        # Create new document
        storage_key = None
        if config.is_aws_storage():
            from services.storage import get_storage_service
            storage = get_storage_service()
            storage_key = await storage.upload_file(data.file_data, data.file_name, f"documents/{request_id}")
        
        doc_id = str(uuid.uuid4())
        document = {
            "id": doc_id,
            "request_id": request_id,
            "user_id": user["id"],
            "user_name": user["name"],
            "name": data.name,
            "document_type": data.document_type,
            "file_name": data.file_name,
            "file_data": data.file_data if not config.is_aws_storage() else None,
            "storage_key": storage_key,
            "storage_provider": config.storage_provider.value,
            "password": data.password,
            "status": "pending",
            "admin_notes": "",
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_at": None,
            "is_replacement": False
        }
        await db.documents.insert_one(document)
    
    # Update request status
    await db.filing_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "documents_uploaded", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Check if all documents are now uploaded - notify admin
    all_docs = await db.documents.find({"request_id": request_id}, {"_id": 0}).to_list(100)
    uploaded_types = {d["document_type"] for d in all_docs}
    required_types = set(request["required_documents"])
    
    if required_types.issubset(uploaded_types):
        admin_email = await get_super_admin_email()
        if admin_email:
            background_tasks.add_task(
                email_service.send_admin_new_submission,
                admin_email, user["name"], user["email"],
                request["plan_name"], request["financial_year"], len(all_docs)
            )
    
    document = await db.documents.find_one({"id": doc_id}, {"_id": 0, "file_data": 0})
    return document

@api_router.get("/requests/{request_id}/documents")
async def get_request_documents(request_id: str, user: dict = Depends(get_current_user)):
    request = await db.filing_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if user["user_type"] != "admin" and request["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    documents = await db.documents.find({"request_id": request_id}, {"_id": 0, "file_data": 0}).to_list(100)
    return documents

@api_router.get("/documents/{document_id}/download")
async def download_document(document_id: str, user: dict = Depends(get_current_user)):
    document = await db.documents.find_one({"id": document_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if user["user_type"] != "admin" and document["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if document.get("storage_provider") == "aws_s3" and document.get("storage_key"):
        from services.storage import get_storage_service
        storage = get_storage_service()
        file_data, file_name = await storage.download_file(document["storage_key"])
        return {
            "file_data": base64.b64encode(file_data).decode(),
            "file_name": file_name,
            "password": document.get("password")
        }
    else:
        return {
            "file_data": document.get("file_data", ""),
            "file_name": document["file_name"],
            "password": document.get("password")
        }

# ================== ADMIN DOCUMENTS ==================

@api_router.get("/admin/documents")
async def get_all_documents(admin: dict = Depends(require_admin)):
    documents = await db.documents.find({}, {"_id": 0, "file_data": 0}).sort("uploaded_at", -1).to_list(500)
    return documents

@api_router.put("/admin/documents/{document_id}/status")
async def update_document_status(document_id: str, data: DocumentStatusUpdate, background_tasks: BackgroundTasks, admin: dict = Depends(require_admin)):
    document = await db.documents.find_one({"id": document_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    await db.documents.update_one(
        {"id": document_id},
        {"$set": {
            "status": data.status,
            "admin_notes": data.admin_notes or "",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": admin["id"]
        }}
    )
    
    # Send email notification if enabled
    if data.send_email:
        user = await db.users.find_one({"id": document["user_id"]}, {"_id": 0})
        request = await db.filing_requests.find_one({"id": document["request_id"]}, {"_id": 0})
        
        if user and request:
            # Check if there are other pending document updates for this request
            # to batch notifications
            pending_reviews = await db.documents.find({
                "request_id": document["request_id"],
                "status": {"$in": ["pending"]},
                "id": {"$ne": document_id}
            }).to_list(10)
            
            if len(pending_reviews) == 0:
                # No more pending - send batch notification
                all_reviewed = await db.documents.find({
                    "request_id": document["request_id"],
                    "reviewed_at": {"$ne": None}
                }, {"_id": 0, "file_data": 0}).to_list(100)
                
                # Get only recently reviewed (within last hour)
                recent_reviews = [d for d in all_reviewed if d.get("reviewed_at")]
                
                if len(recent_reviews) > 1:
                    # Send batch notification
                    background_tasks.add_task(
                        email_service.send_batch_document_update,
                        user["email"], user["name"],
                        recent_reviews, request["plan_name"], request["financial_year"]
                    )
                else:
                    # Send single document notification
                    background_tasks.add_task(
                        email_service.send_document_status_update,
                        user["email"], user["name"],
                        document["name"], document["document_type"],
                        data.status, data.admin_notes,
                        request["plan_name"], request["financial_year"]
                    )
    
    updated_doc = await db.documents.find_one({"id": document_id}, {"_id": 0, "file_data": 0})
    return updated_doc

@api_router.post("/admin/documents/{document_id}/allow-change")
async def allow_document_change(document_id: str, admin: dict = Depends(require_admin)):
    """Allow client to change an approved document"""
    result = await db.documents.update_one(
        {"id": document_id},
        {"$set": {"status": "needs_revision", "admin_notes": "Admin has allowed you to replace this document."}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document change allowed"}

# ================== MESSAGES ==================

@api_router.post("/messages")
async def send_message(data: MessageCreate, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    message = {
        "id": str(uuid.uuid4()),
        "sender_id": user["id"],
        "sender_name": user["name"],
        "sender_type": user["user_type"],
        "recipient_id": data.recipient_id,
        "content": data.content,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(message)
    
    # Notify admin of new client message
    if user["user_type"] == "client":
        admin_email = await get_super_admin_email()
        if admin_email:
            background_tasks.add_task(
                email_service.send_admin_new_message,
                admin_email, user["name"], data.content
            )
    
    message.pop("_id", None)
    return message

@api_router.get("/messages")
async def get_my_messages(user: dict = Depends(get_current_user)):
    if user["user_type"] == "admin":
        messages = await db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    else:
        messages = await db.messages.find(
            {"$or": [{"sender_id": user["id"]}, {"recipient_id": user["id"]}]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    return messages

@api_router.get("/messages/conversation/{user_id}")
async def get_conversation(user_id: str, user: dict = Depends(get_current_user)):
    if user["user_type"] == "admin":
        messages = await db.messages.find(
            {"$or": [{"sender_id": user_id}, {"recipient_id": user_id}]},
            {"_id": 0}
        ).sort("created_at", 1).to_list(500)
    else:
        messages = await db.messages.find(
            {"$or": [{"sender_id": user["id"]}, {"recipient_id": user["id"]}]},
            {"_id": 0}
        ).sort("created_at", 1).to_list(100)
    return messages

@api_router.put("/messages/{message_id}/read")
async def mark_message_read(message_id: str, user: dict = Depends(get_current_user)):
    await db.messages.update_one({"id": message_id}, {"$set": {"is_read": True}})
    return {"success": True}

@api_router.get("/admin/messages/recent")
async def get_recent_messages_per_user(admin: dict = Depends(require_admin)):
    pipeline = [
        {"$match": {"sender_type": "client"}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$sender_id",
            "sender_name": {"$first": "$sender_name"},
            "last_message": {"$first": "$content"},
            "last_message_time": {"$first": "$created_at"},
            "is_read": {"$first": "$is_read"}
        }}
    ]
    recent_messages = await db.messages.aggregate(pipeline).to_list(100)
    return [
        {
            "user_id": msg["_id"],
            "user_name": msg["sender_name"],
            "last_message": msg["last_message"],
            "last_message_time": msg["last_message_time"],
            "is_read": msg["is_read"]
        }
        for msg in recent_messages
    ]

# ================== ADMIN EMAIL ==================

@api_router.post("/admin/email/send")
async def send_admin_email(data: AdminEmailSend, admin: dict = Depends(require_admin)):
    """Send custom email to client"""
    success = email_service.send_custom_email(
        data.to_email,
        data.subject,
        data.message,
        admin["name"]
    )
    if success:
        return {"message": "Email sent successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send email")

# ================== PAYMENTS ==================

@api_router.post("/payments/initiate")
async def initiate_payment(data: PaymentInitiate, user: dict = Depends(get_current_user)):
    from services.payment import payment_service, PaymentRequest
    
    request = await db.filing_requests.find_one({"id": data.request_id, "user_id": user["id"]}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    payment_request = PaymentRequest(
        order_id=data.request_id,
        amount=data.amount,
        user_id=user["id"],
        user_name=user["name"],
        user_email=user["email"],
        user_phone=user.get("phone", ""),
        description=f"Tax Filing - {request['plan_name']} - FY {request['financial_year']}",
        return_url=data.return_url,
        callback_url=os.environ.get("PAYMENT_CALLBACK_URL")
    )
    
    response = await payment_service.create_payment(payment_request)
    
    payment_record = {
        "id": response.payment_id,
        "request_id": data.request_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "amount": data.amount,
        "gateway": response.gateway,
        "gateway_order_id": response.gateway_order_id,
        "status": response.status.value,
        "payment_url": response.payment_url,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payments.insert_one(payment_record)
    
    return {
        "payment_id": response.payment_id,
        "status": response.status.value,
        "gateway": response.gateway,
        "payment_url": response.payment_url,
        "message": response.message
    }

@api_router.post("/payments")
async def create_payment_legacy(data: dict, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    request_id = data.get("request_id")
    amount = data.get("amount")
    payment_method = data.get("payment_method", "mock")
    
    request = await db.filing_requests.find_one({"id": request_id, "user_id": user["id"]}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    payment = {
        "id": str(uuid.uuid4()),
        "request_id": request_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "amount": amount,
        "payment_method": payment_method,
        "gateway": "mock",
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payments.insert_one(payment)
    
    await db.filing_requests.update_one(
        {"id": request_id},
        {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Send notifications
    background_tasks.add_task(
        email_service.send_payment_confirmation,
        user["email"], user["name"], amount,
        request["plan_name"], request["financial_year"]
    )
    
    admin_email = await get_super_admin_email()
    if admin_email:
        background_tasks.add_task(
            email_service.send_admin_payment_received,
            admin_email, user["name"], amount, request["plan_name"]
        )
    
    payment.pop("_id", None)
    return payment

@api_router.get("/payments")
async def get_my_payments(user: dict = Depends(get_current_user)):
    payments = await db.payments.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return payments

@api_router.get("/admin/payments")
async def get_all_payments(admin: dict = Depends(require_admin)):
    payments = await db.payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return payments

# ================== ADMIN STATS ==================

@api_router.get("/admin/stats")
async def get_admin_stats(admin: dict = Depends(require_admin)):
    total_requests = await db.filing_requests.count_documents({})
    pending_requests = await db.filing_requests.count_documents({"status": "pending"})
    completed_requests = await db.filing_requests.count_documents({"status": "completed"})
    
    total_documents = await db.documents.count_documents({})
    pending_documents = await db.documents.count_documents({"status": "pending"})
    
    total_users = await db.users.count_documents({"user_type": "client"})
    total_admins = await db.users.count_documents({"user_type": "admin"})
    
    payments = await db.payments.find({"status": "completed"}, {"_id": 0}).to_list(1000)
    total_revenue = sum(p["amount"] for p in payments)
    
    unread_messages = await db.messages.count_documents({"sender_type": "client", "is_read": False})
    
    return {
        "total_requests": total_requests,
        "pending_requests": pending_requests,
        "completed_requests": completed_requests,
        "total_documents": total_documents,
        "pending_documents": pending_documents,
        "total_users": total_users,
        "total_admins": total_admins,
        "total_revenue": total_revenue,
        "unread_messages": unread_messages,
        "config": {
            "payment_gateway": config.payment_gateway.value,
            "storage_provider": config.storage_provider.value,
            "email_enabled": email_service.enabled
        }
    }

@api_router.get("/config/public")
async def get_public_config():
    return {
        "payment_gateway": config.payment_gateway.value,
        "storage_provider": config.storage_provider.value,
        "features": {
            "aws_enabled": config.is_aws_storage(),
            "phonepe_enabled": config.payment_gateway == PaymentGateway.PHONEPE,
            "email_enabled": email_service.enabled
        }
    }

@api_router.get("/")
async def root():
    return {
        "message": "TaxAssist API",
        "version": "2.0.0",
        "config": {
            "payment_gateway": config.payment_gateway.value,
            "storage_provider": config.storage_provider.value
        }
    }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
