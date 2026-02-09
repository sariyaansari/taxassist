from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import hashlib
import jwt
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Secret
JWT_SECRET = os.environ.get('JWT_SECRET', 'tax-assist-secret-key-2024')
security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ================== MODELS ==================

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    phone: str
    user_type: str = "client"  # client or admin

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
    created_at: str

class TaxPlanCreate(BaseModel):
    name: str
    description: str
    plan_type: str  # salary or business
    price: float
    required_documents: List[str]
    features: List[str]

class TaxPlanResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: str
    plan_type: str
    price: float
    required_documents: List[str]
    features: List[str]
    is_active: bool
    created_at: str

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
    file_data: str  # base64 encoded
    file_name: str

class DocumentStatusUpdate(BaseModel):
    status: str  # pending, approved, rejected, needs_revision
    admin_notes: Optional[str] = None

class MessageCreate(BaseModel):
    content: str
    recipient_id: Optional[str] = None  # For admin sending to specific user

class PaymentCreate(BaseModel):
    request_id: str
    amount: float
    payment_method: str

# ================== HELPER FUNCTIONS ==================

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(user_id: str, user_type: str) -> str:
    payload = {
        "user_id": user_id,
        "user_type": user_type,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
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

# ================== AUTH ROUTES ==================

@api_router.post("/auth/register")
async def register(data: UserCreate):
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
        "created_at": datetime.now(timezone.utc).isoformat(),
        "profile": {}
    }
    await db.users.insert_one(user)
    token = create_token(user["id"], user["user_type"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "phone": user["phone"],
            "user_type": user["user_type"]
        }
    }

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or user["password"] != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["user_type"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "phone": user["phone"],
            "user_type": user["user_type"]
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

# ================== TAX PLANS (ADMIN) ==================

@api_router.post("/admin/plans")
async def create_plan(data: TaxPlanCreate, admin: dict = Depends(require_admin)):
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
    result = await db.tax_plans.update_one(
        {"id": plan_id},
        {"$set": data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan = await db.tax_plans.find_one({"id": plan_id}, {"_id": 0})
    return plan

@api_router.delete("/admin/plans/{plan_id}")
async def delete_plan(plan_id: str, admin: dict = Depends(require_admin)):
    result = await db.tax_plans.update_one(
        {"id": plan_id},
        {"$set": {"is_active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"message": "Plan deactivated"}

# ================== PUBLIC PLANS ==================

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
        "status": "pending",  # pending, documents_uploaded, under_review, completed, rejected
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

# ================== DOCUMENTS ==================

@api_router.post("/requests/{request_id}/documents")
async def upload_document(request_id: str, data: DocumentUpload, user: dict = Depends(get_current_user)):
    request = await db.filing_requests.find_one({"id": request_id, "user_id": user["id"]}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    document = {
        "id": str(uuid.uuid4()),
        "request_id": request_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "name": data.name,
        "document_type": data.document_type,
        "file_name": data.file_name,
        "file_data": data.file_data,
        "status": "pending",  # pending, approved, rejected, needs_revision
        "admin_notes": "",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None
    }
    await db.documents.insert_one(document)
    
    # Update request status
    await db.filing_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "documents_uploaded", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    document.pop("_id", None)
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
    return {"file_data": document["file_data"], "file_name": document["file_name"]}

# ================== ADMIN DOCUMENTS ==================

@api_router.get("/admin/documents")
async def get_all_documents(admin: dict = Depends(require_admin)):
    documents = await db.documents.find({}, {"_id": 0, "file_data": 0}).sort("uploaded_at", -1).to_list(500)
    return documents

@api_router.put("/admin/documents/{document_id}/status")
async def update_document_status(document_id: str, data: DocumentStatusUpdate, admin: dict = Depends(require_admin)):
    result = await db.documents.update_one(
        {"id": document_id},
        {"$set": {
            "status": data.status,
            "admin_notes": data.admin_notes or "",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": admin["id"]
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document = await db.documents.find_one({"id": document_id}, {"_id": 0, "file_data": 0})
    return document

# ================== ADMIN REQUESTS ==================

@api_router.get("/admin/requests")
async def get_all_requests(admin: dict = Depends(require_admin)):
    requests = await db.filing_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return requests

@api_router.put("/admin/requests/{request_id}/status")
async def update_request_status(request_id: str, status: str, admin: dict = Depends(require_admin)):
    result = await db.filing_requests.update_one(
        {"id": request_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    request = await db.filing_requests.find_one({"id": request_id}, {"_id": 0})
    return request

# ================== MESSAGES ==================

@api_router.post("/messages")
async def send_message(data: MessageCreate, user: dict = Depends(get_current_user)):
    message = {
        "id": str(uuid.uuid4()),
        "sender_id": user["id"],
        "sender_name": user["name"],
        "sender_type": user["user_type"],
        "recipient_id": data.recipient_id,  # None for client messages (goes to admin)
        "content": data.content,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(message)
    message.pop("_id", None)
    return message

@api_router.get("/messages")
async def get_my_messages(user: dict = Depends(get_current_user)):
    if user["user_type"] == "admin":
        # Admin sees all messages
        messages = await db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    else:
        # Client sees their own messages and messages sent to them
        messages = await db.messages.find(
            {"$or": [{"sender_id": user["id"]}, {"recipient_id": user["id"]}]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
    return messages

@api_router.get("/messages/conversation/{user_id}")
async def get_conversation(user_id: str, user: dict = Depends(get_current_user)):
    if user["user_type"] == "admin":
        messages = await db.messages.find(
            {"$or": [
                {"sender_id": user_id},
                {"recipient_id": user_id}
            ]},
            {"_id": 0}
        ).sort("created_at", 1).to_list(500)
    else:
        messages = await db.messages.find(
            {"$or": [
                {"sender_id": user["id"]},
                {"recipient_id": user["id"]}
            ]},
            {"_id": 0}
        ).sort("created_at", 1).to_list(100)
    return messages

@api_router.put("/messages/{message_id}/read")
async def mark_message_read(message_id: str, user: dict = Depends(get_current_user)):
    await db.messages.update_one({"id": message_id}, {"$set": {"is_read": True}})
    return {"success": True}

# ================== ADMIN MESSAGES ==================

@api_router.get("/admin/messages/recent")
async def get_recent_messages_per_user(admin: dict = Depends(require_admin)):
    # Get unique client users who have sent messages
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

# ================== PAYMENTS ==================

@api_router.post("/payments")
async def create_payment(data: PaymentCreate, user: dict = Depends(get_current_user)):
    request = await db.filing_requests.find_one({"id": data.request_id, "user_id": user["id"]}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    payment = {
        "id": str(uuid.uuid4()),
        "request_id": data.request_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "amount": data.amount,
        "payment_method": data.payment_method,
        "status": "completed",  # For demo, auto-complete
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payments.insert_one(payment)
    
    # Update request payment status
    await db.filing_requests.update_one(
        {"id": data.request_id},
        {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    payment.pop("_id", None)
    return payment

@api_router.get("/payments")
async def get_my_payments(user: dict = Depends(get_current_user)):
    payments = await db.payments.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
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
    
    # Payment stats
    payments = await db.payments.find({}, {"_id": 0}).to_list(1000)
    total_revenue = sum(p["amount"] for p in payments)
    
    # Unread messages
    unread_messages = await db.messages.count_documents({"sender_type": "client", "is_read": False})
    
    return {
        "total_requests": total_requests,
        "pending_requests": pending_requests,
        "completed_requests": completed_requests,
        "total_documents": total_documents,
        "pending_documents": pending_documents,
        "total_users": total_users,
        "total_revenue": total_revenue,
        "unread_messages": unread_messages
    }

@api_router.get("/admin/payments")
async def get_all_payments(admin: dict = Depends(require_admin)):
    payments = await db.payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return payments

# ================== ROOT ==================

@api_router.get("/")
async def root():
    return {"message": "TaxAssist API", "version": "1.0.0"}

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
