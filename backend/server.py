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
    offer_code: Optional[str] = None
    offer_email: Optional[str] = None
    offer_phone: Optional[str] = None

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
    except Exception:
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
async def create_filing_request(data: TaxFilingRequestCreate, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    plan = await db.tax_plans.find_one({"id": data.plan_id, "is_active": True}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    original_price = plan["price"]
    final_price = original_price
    applied_offer = None
    
    # Apply offer if provided
    if data.offer_code:
        offer_email = data.offer_email or user["email"]
        offer_phone = data.offer_phone or user.get("phone", "")
        
        offer = await db.offers.find_one({
            "code": data.offer_code.upper(),
            "is_active": True
        }, {"_id": 0})
        
        if offer:
            now = datetime.now(timezone.utc).isoformat()
            is_valid = (
                now >= offer["valid_from"] and 
                now <= offer["valid_until"] and
                (not offer.get("max_uses") or offer["current_uses"] < offer["max_uses"])
            )
            
            # Check if applicable to this plan
            if offer.get("applicable_plans") and plan["id"] not in offer["applicable_plans"]:
                is_valid = False
            
            # Check if user already used this offer
            email_lower = offer_email.lower()
            phone_clean = offer_phone.replace(" ", "").replace("-", "")
            
            for usage in offer.get("used_by", []):
                if usage.get("email", "").lower() == email_lower or usage.get("phone", "").replace(" ", "").replace("-", "") == phone_clean:
                    is_valid = False
                    break
            
            if is_valid:
                # Calculate discount
                if offer["discount_type"] == "percentage":
                    discount_amount = (original_price * offer["discount_value"]) / 100
                else:
                    discount_amount = offer["discount_value"]
                
                final_price = max(0, original_price - discount_amount)
                applied_offer = {
                    "offer_id": offer["id"],
                    "code": offer["code"],
                    "name": offer["name"],
                    "discount_type": offer["discount_type"],
                    "discount_value": offer["discount_value"],
                    "discount_amount": discount_amount
                }
                
                # Record offer usage
                await db.offers.update_one(
                    {"id": offer["id"]},
                    {
                        "$inc": {"current_uses": 1},
                        "$push": {
                            "used_by": {
                                "email": offer_email,
                                "phone": offer_phone,
                                "user_id": user["id"],
                                "used_at": now
                            }
                        }
                    }
                )
    
    request = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "plan_id": data.plan_id,
        "plan_name": plan["name"],
        "plan_type": plan["plan_type"],
        "original_price": original_price,
        "price": final_price,
        "applied_offer": applied_offer,
        "required_documents": plan["required_documents"],
        "financial_year": data.financial_year,
        "status": "pending",
        "payment_status": "unpaid",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.filing_requests.insert_one(request)
    
    # Notify admin of new case
    admin_email = await get_super_admin_email()
    if admin_email:
        settings = await db.admin_settings.find_one({"type": "global"}, {"_id": 0})
        if not settings or settings.get("new_case_email_enabled", True):
            background_tasks.add_task(
                email_service.send_admin_new_submission,
                admin_email, user["name"], user["email"],
                plan["name"], data.financial_year, 0
            )
    
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
async def allow_document_change(document_id: str, background_tasks: BackgroundTasks, admin: dict = Depends(require_admin)):
    """Allow client to change an approved document"""
    if not check_permission(admin, "unlock_documents"):
        if admin.get("admin_role") != "super_admin":
            raise HTTPException(status_code=403, detail="Permission denied: unlock_documents required")
    
    document = await db.documents.find_one({"id": document_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    result = await db.documents.update_one(
        {"id": document_id},
        {"$set": {
            "status": "needs_revision", 
            "admin_notes": "Admin has unlocked this document for replacement.",
            "unlocked_by": admin["id"],
            "unlocked_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify user
    user = await db.users.find_one({"id": document["user_id"]}, {"_id": 0})
    request = await db.filing_requests.find_one({"id": document["request_id"]}, {"_id": 0})
    
    if user and request:
        background_tasks.add_task(
            email_service.send_document_status_update,
            user["email"], user["name"],
            document["name"], document["document_type"],
            "needs_revision", "Admin has unlocked this document. You can now upload a new version.",
            request["plan_name"], request["financial_year"]
        )
    
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
    
    # Offer stats
    active_offers = await db.offers.count_documents({"is_active": True})
    total_offer_uses = 0
    offers = await db.offers.find({}, {"_id": 0, "current_uses": 1}).to_list(100)
    for offer in offers:
        total_offer_uses += offer.get("current_uses", 0)
    
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
        "active_offers": active_offers,
        "total_offer_uses": total_offer_uses,
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

# ================== OFFERS MANAGEMENT ==================

@api_router.post("/admin/offers")
async def create_offer(data: OfferCreate, admin: dict = Depends(require_super_admin)):
    """Create a new discount offer (Super Admin only)"""
    # Check if code already exists
    existing = await db.offers.find_one({"code": data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Offer code already exists")
    
    offer = {
        "id": str(uuid.uuid4()),
        "code": data.code.upper(),
        "name": data.name,
        "description": data.description,
        "discount_type": data.discount_type,
        "discount_value": data.discount_value,
        "valid_from": data.valid_from,
        "valid_until": data.valid_until,
        "max_uses": data.max_uses,
        "current_uses": 0,
        "applicable_plans": data.applicable_plans,
        "used_by": [],  # List of {email, phone, used_at}
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["id"]
    }
    await db.offers.insert_one(offer)
    offer.pop("_id", None)
    return offer

@api_router.get("/admin/offers")
async def get_all_offers(admin: dict = Depends(require_admin)):
    """Get all offers (admin only)"""
    if not check_permission(admin, "manage_offers"):
        if admin.get("admin_role") != "super_admin":
            raise HTTPException(status_code=403, detail="Permission denied")
    
    offers = await db.offers.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return offers

@api_router.put("/admin/offers/{offer_id}")
async def update_offer(offer_id: str, data: OfferUpdate, admin: dict = Depends(require_super_admin)):
    """Update an offer (Super Admin only)"""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.offers.update_one({"id": offer_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    offer = await db.offers.find_one({"id": offer_id}, {"_id": 0})
    return offer

@api_router.delete("/admin/offers/{offer_id}")
async def deactivate_offer(offer_id: str, admin: dict = Depends(require_super_admin)):
    """Deactivate an offer (Super Admin only)"""
    result = await db.offers.update_one({"id": offer_id}, {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"message": "Offer deactivated"}

@api_router.post("/offers/validate")
async def validate_offer(data: ApplyOfferRequest):
    """Validate an offer code and check if user can use it"""
    offer = await db.offers.find_one({
        "code": data.code.upper(),
        "is_active": True
    }, {"_id": 0})
    
    if not offer:
        raise HTTPException(status_code=404, detail="Invalid offer code")
    
    # Check validity dates
    now = datetime.now(timezone.utc).isoformat()
    if now < offer["valid_from"]:
        raise HTTPException(status_code=400, detail="This offer is not yet active")
    if now > offer["valid_until"]:
        raise HTTPException(status_code=400, detail="This offer has expired")
    
    # Check max uses
    if offer.get("max_uses") and offer["current_uses"] >= offer["max_uses"]:
        raise HTTPException(status_code=400, detail="This offer has reached its usage limit")
    
    # Check if user already used this offer
    email_lower = data.email.lower()
    phone_clean = data.phone.replace(" ", "").replace("-", "")
    
    for usage in offer.get("used_by", []):
        if usage.get("email", "").lower() == email_lower or usage.get("phone", "").replace(" ", "").replace("-", "") == phone_clean:
            raise HTTPException(status_code=400, detail="You have already used this offer")
    
    return {
        "valid": True,
        "offer_id": offer["id"],
        "code": offer["code"],
        "name": offer["name"],
        "discount_type": offer["discount_type"],
        "discount_value": offer["discount_value"],
        "applicable_plans": offer["applicable_plans"]
    }

@api_router.get("/offers/active")
async def get_active_offers():
    """Get active offers (for client display)"""
    now = datetime.now(timezone.utc).isoformat()
    offers = await db.offers.find({
        "is_active": True,
        "valid_from": {"$lte": now},
        "valid_until": {"$gte": now}
    }, {"_id": 0, "used_by": 0}).to_list(20)
    
    # Filter out offers that have reached max uses
    valid_offers = []
    for offer in offers:
        if not offer.get("max_uses") or offer["current_uses"] < offer["max_uses"]:
            valid_offers.append({
                "code": offer["code"],
                "name": offer["name"],
                "description": offer["description"],
                "discount_type": offer["discount_type"],
                "discount_value": offer["discount_value"],
                "valid_until": offer["valid_until"],
                "applicable_plans": offer.get("applicable_plans")
            })
    
    return valid_offers

# ================== ADMIN SETTINGS ==================

@api_router.get("/admin/settings")
async def get_admin_settings(admin: dict = Depends(require_super_admin)):
    """Get admin settings (Super Admin only)"""
    settings = await db.admin_settings.find_one({"type": "global"}, {"_id": 0})
    if not settings:
        # Return default settings
        settings = {
            "type": "global",
            "notification_email": admin["email"],
            "new_case_email_enabled": True,
            "payment_email_enabled": True,
            "message_email_enabled": True
        }
    return settings

@api_router.put("/admin/settings")
async def update_admin_settings(data: AdminSettingsUpdate, admin: dict = Depends(require_super_admin)):
    """Update admin settings (Super Admin only)"""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["type"] = "global"
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = admin["id"]
    
    await db.admin_settings.update_one(
        {"type": "global"},
        {"$set": update_data},
        upsert=True
    )
    
    settings = await db.admin_settings.find_one({"type": "global"}, {"_id": 0})
    return settings

# ================== CA ADMIN PERMISSIONS ==================

@api_router.get("/admin/permissions/available")
async def get_available_permissions(admin: dict = Depends(require_super_admin)):
    """Get list of available permissions for CA Admins"""
    return CA_ADMIN_AVAILABLE_PERMISSIONS

@api_router.put("/admin/users/{user_id}/permissions")
async def update_ca_admin_permissions(user_id: str, data: CAAdminPermissionsUpdate, admin: dict = Depends(require_super_admin)):
    """Update CA Admin permissions (Super Admin only)"""
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user.get("admin_role") == "super_admin":
        raise HTTPException(status_code=400, detail="Cannot modify super admin permissions")
    
    if target_user.get("user_type") != "admin":
        raise HTTPException(status_code=400, detail="User is not an admin")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"permissions": data.permissions}}
    )
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return updated_user

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
