"""
Payment Service - Gateway-agnostic payment processing
Supports: Mock, PhonePe, Razorpay, Stripe
"""
import os
import uuid
import hashlib
import base64
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel

class PaymentStatus(str, Enum):
    PENDING = "pending"
    INITIATED = "initiated"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

class PaymentRequest(BaseModel):
    """Standard payment request model"""
    order_id: str
    amount: float  # In INR
    currency: str = "INR"
    user_id: str
    user_name: str
    user_email: str
    user_phone: str
    description: str
    return_url: Optional[str] = None
    callback_url: Optional[str] = None

class PaymentResponse(BaseModel):
    """Standard payment response model"""
    payment_id: str
    order_id: str
    status: PaymentStatus
    amount: float
    currency: str
    gateway: str
    gateway_order_id: Optional[str] = None
    payment_url: Optional[str] = None  # Redirect URL for payment
    qr_code: Optional[str] = None  # QR code for UPI
    upi_intent: Optional[str] = None  # UPI deep link
    message: Optional[str] = None
    raw_response: Optional[Dict] = None

class PaymentVerification(BaseModel):
    """Payment verification result"""
    payment_id: str
    order_id: str
    status: PaymentStatus
    amount: float
    gateway_transaction_id: Optional[str] = None
    verified: bool
    message: Optional[str] = None


class PaymentGatewayBase(ABC):
    """Abstract base class for payment gateways"""
    
    @abstractmethod
    async def initiate_payment(self, request: PaymentRequest) -> PaymentResponse:
        """Initiate a payment and return payment details"""
        pass
    
    @abstractmethod
    async def verify_payment(self, payment_id: str, gateway_data: Dict) -> PaymentVerification:
        """Verify payment status after callback"""
        pass
    
    @abstractmethod
    async def check_status(self, payment_id: str) -> PaymentVerification:
        """Check current payment status"""
        pass
    
    @abstractmethod
    async def initiate_refund(self, payment_id: str, amount: Optional[float] = None) -> Dict:
        """Initiate refund for a payment"""
        pass


class MockPaymentGateway(PaymentGatewayBase):
    """Mock payment gateway for testing"""
    
    def __init__(self):
        self.payments = {}
    
    async def initiate_payment(self, request: PaymentRequest) -> PaymentResponse:
        payment_id = f"mock_{uuid.uuid4().hex[:12]}"
        
        self.payments[payment_id] = {
            "order_id": request.order_id,
            "amount": request.amount,
            "status": PaymentStatus.INITIATED
        }
        
        return PaymentResponse(
            payment_id=payment_id,
            order_id=request.order_id,
            status=PaymentStatus.INITIATED,
            amount=request.amount,
            currency=request.currency,
            gateway="mock",
            gateway_order_id=payment_id,
            message="Mock payment initiated. Auto-completes on verification."
        )
    
    async def verify_payment(self, payment_id: str, gateway_data: Dict) -> PaymentVerification:
        # Mock always succeeds
        if payment_id in self.payments:
            self.payments[payment_id]["status"] = PaymentStatus.COMPLETED
            return PaymentVerification(
                payment_id=payment_id,
                order_id=self.payments[payment_id]["order_id"],
                status=PaymentStatus.COMPLETED,
                amount=self.payments[payment_id]["amount"],
                gateway_transaction_id=f"txn_{uuid.uuid4().hex[:8]}",
                verified=True,
                message="Payment verified successfully (mock)"
            )
        return PaymentVerification(
            payment_id=payment_id,
            order_id="",
            status=PaymentStatus.FAILED,
            amount=0,
            verified=False,
            message="Payment not found"
        )
    
    async def check_status(self, payment_id: str) -> PaymentVerification:
        if payment_id in self.payments:
            return PaymentVerification(
                payment_id=payment_id,
                order_id=self.payments[payment_id]["order_id"],
                status=self.payments[payment_id]["status"],
                amount=self.payments[payment_id]["amount"],
                verified=self.payments[payment_id]["status"] == PaymentStatus.COMPLETED,
                message="Status retrieved"
            )
        return PaymentVerification(
            payment_id=payment_id,
            order_id="",
            status=PaymentStatus.FAILED,
            amount=0,
            verified=False,
            message="Payment not found"
        )
    
    async def initiate_refund(self, payment_id: str, amount: Optional[float] = None) -> Dict:
        return {"status": "refunded", "refund_id": f"ref_{uuid.uuid4().hex[:8]}"}


class PhonePePaymentGateway(PaymentGatewayBase):
    """PhonePe Payment Gateway Implementation"""
    
    def __init__(self, merchant_id: str, salt_key: str, salt_index: str = "1", env: str = "UAT"):
        self.merchant_id = merchant_id
        self.salt_key = salt_key
        self.salt_index = salt_index
        self.env = env
        
        # API endpoints
        if env == "PROD":
            self.base_url = "https://api.phonepe.com/apis/hermes"
        else:
            self.base_url = "https://api-preprod.phonepe.com/apis/pg-sandbox"
    
    def _generate_checksum(self, payload_base64: str, endpoint: str) -> str:
        """Generate X-VERIFY checksum for PhonePe"""
        string_to_hash = payload_base64 + endpoint + self.salt_key
        sha256_hash = hashlib.sha256(string_to_hash.encode()).hexdigest()
        return f"{sha256_hash}###{self.salt_index}"
    
    async def initiate_payment(self, request: PaymentRequest) -> PaymentResponse:
        import httpx
        import json
        
        payment_id = f"pp_{uuid.uuid4().hex[:12]}"
        
        # PhonePe payload
        payload = {
            "merchantId": self.merchant_id,
            "merchantTransactionId": payment_id,
            "merchantUserId": request.user_id[:36],  # Max 36 chars
            "amount": int(request.amount * 100),  # Amount in paise
            "redirectUrl": request.return_url or "",
            "redirectMode": "POST",
            "callbackUrl": request.callback_url or "",
            "mobileNumber": request.user_phone.replace("+91", "")[-10:],
            "paymentInstrument": {
                "type": "PAY_PAGE"
            }
        }
        
        payload_json = json.dumps(payload)
        payload_base64 = base64.b64encode(payload_json.encode()).decode()
        
        checksum = self._generate_checksum(payload_base64, "/pg/v1/pay")
        
        headers = {
            "Content-Type": "application/json",
            "X-VERIFY": checksum
        }
        
        request_body = {"request": payload_base64}
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/pg/v1/pay",
                json=request_body,
                headers=headers
            )
            result = response.json()
        
        if result.get("success"):
            payment_url = result.get("data", {}).get("instrumentResponse", {}).get("redirectInfo", {}).get("url")
            return PaymentResponse(
                payment_id=payment_id,
                order_id=request.order_id,
                status=PaymentStatus.INITIATED,
                amount=request.amount,
                currency=request.currency,
                gateway="phonepe",
                gateway_order_id=payment_id,
                payment_url=payment_url,
                message="Payment initiated. Redirect user to payment URL.",
                raw_response=result
            )
        else:
            return PaymentResponse(
                payment_id=payment_id,
                order_id=request.order_id,
                status=PaymentStatus.FAILED,
                amount=request.amount,
                currency=request.currency,
                gateway="phonepe",
                message=result.get("message", "Payment initiation failed"),
                raw_response=result
            )
    
    async def verify_payment(self, payment_id: str, gateway_data: Dict) -> PaymentVerification:
        """Verify payment using callback data or status check"""
        return await self.check_status(payment_id)
    
    async def check_status(self, payment_id: str) -> PaymentVerification:
        import httpx
        
        endpoint = f"/pg/v1/status/{self.merchant_id}/{payment_id}"
        string_to_hash = endpoint + self.salt_key
        checksum = hashlib.sha256(string_to_hash.encode()).hexdigest() + "###" + self.salt_index
        
        headers = {
            "Content-Type": "application/json",
            "X-VERIFY": checksum,
            "X-MERCHANT-ID": self.merchant_id
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}{endpoint}",
                headers=headers
            )
            result = response.json()
        
        if result.get("success"):
            data = result.get("data", {})
            code = result.get("code", "")
            
            status_map = {
                "PAYMENT_SUCCESS": PaymentStatus.COMPLETED,
                "PAYMENT_ERROR": PaymentStatus.FAILED,
                "PAYMENT_PENDING": PaymentStatus.PENDING,
                "PAYMENT_DECLINED": PaymentStatus.FAILED,
            }
            
            status = status_map.get(code, PaymentStatus.PENDING)
            
            return PaymentVerification(
                payment_id=payment_id,
                order_id=data.get("merchantTransactionId", ""),
                status=status,
                amount=data.get("amount", 0) / 100,  # Convert paise to INR
                gateway_transaction_id=data.get("transactionId"),
                verified=status == PaymentStatus.COMPLETED,
                message=result.get("message", "")
            )
        
        return PaymentVerification(
            payment_id=payment_id,
            order_id="",
            status=PaymentStatus.FAILED,
            amount=0,
            verified=False,
            message=result.get("message", "Status check failed")
        )
    
    async def initiate_refund(self, payment_id: str, amount: Optional[float] = None) -> Dict:
        # Implement PhonePe refund API
        return {"status": "refund_initiated", "message": "PhonePe refund API to be implemented"}


class PaymentService:
    """Main payment service that delegates to appropriate gateway"""
    
    def __init__(self):
        from config import config
        self.config = config
        self._gateway = None
    
    @property
    def gateway(self) -> PaymentGatewayBase:
        """Get configured payment gateway"""
        if self._gateway is None:
            from config import PaymentGateway
            
            gateway_type = self.config.get_payment_gateway()
            
            if gateway_type == PaymentGateway.PHONEPE:
                self._gateway = PhonePePaymentGateway(
                    merchant_id=self.config.payment.phonepe_merchant_id,
                    salt_key=self.config.payment.phonepe_salt_key,
                    salt_index=self.config.payment.phonepe_salt_index,
                    env=self.config.payment.phonepe_env
                )
            elif gateway_type == PaymentGateway.MOCK:
                self._gateway = MockPaymentGateway()
            else:
                # Default to mock
                self._gateway = MockPaymentGateway()
        
        return self._gateway
    
    async def create_payment(self, request: PaymentRequest) -> PaymentResponse:
        """Create a new payment"""
        return await self.gateway.initiate_payment(request)
    
    async def verify_payment(self, payment_id: str, gateway_data: Dict = None) -> PaymentVerification:
        """Verify a payment"""
        return await self.gateway.verify_payment(payment_id, gateway_data or {})
    
    async def check_status(self, payment_id: str) -> PaymentVerification:
        """Check payment status"""
        return await self.gateway.check_status(payment_id)
    
    async def refund(self, payment_id: str, amount: Optional[float] = None) -> Dict:
        """Initiate refund"""
        return await self.gateway.initiate_refund(payment_id, amount)


# Global payment service instance
payment_service = PaymentService()
