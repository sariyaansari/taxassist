"""
Configuration Module for TaxAssist
Supports switching between local and AWS services
"""
import os
from enum import Enum
from pydantic import BaseModel
from typing import Optional

class StorageProvider(str, Enum):
    LOCAL = "local"
    AWS_S3 = "aws_s3"

class AuthProvider(str, Enum):
    JWT_LOCAL = "jwt_local"
    AWS_COGNITO = "aws_cognito"

class PaymentGateway(str, Enum):
    MOCK = "mock"
    PHONEPE = "phonepe"
    RAZORPAY = "razorpay"
    STRIPE = "stripe"

class AWSConfig(BaseModel):
    """AWS Configuration"""
    region: str = "ap-south-1"
    s3_bucket: Optional[str] = None
    s3_access_key: Optional[str] = None
    s3_secret_key: Optional[str] = None
    cognito_user_pool_id: Optional[str] = None
    cognito_client_id: Optional[str] = None

class PaymentConfig(BaseModel):
    """Payment Gateway Configuration"""
    gateway: PaymentGateway = PaymentGateway.MOCK
    # PhonePe Config
    phonepe_merchant_id: Optional[str] = None
    phonepe_salt_key: Optional[str] = None
    phonepe_salt_index: Optional[str] = None
    phonepe_env: str = "UAT"  # UAT or PROD
    # Razorpay Config
    razorpay_key_id: Optional[str] = None
    razorpay_key_secret: Optional[str] = None
    # Stripe Config
    stripe_secret_key: Optional[str] = None
    stripe_publishable_key: Optional[str] = None

class AppConfig:
    """Main Application Configuration"""
    
    def __init__(self):
        # Storage Configuration
        self.storage_provider = StorageProvider(
            os.environ.get("STORAGE_PROVIDER", "local")
        )
        
        # Auth Configuration
        self.auth_provider = AuthProvider(
            os.environ.get("AUTH_PROVIDER", "jwt_local")
        )
        
        # Payment Configuration
        self.payment_gateway = PaymentGateway(
            os.environ.get("PAYMENT_GATEWAY", "mock")
        )
        
        # AWS Config
        self.aws = AWSConfig(
            region=os.environ.get("AWS_REGION", "ap-south-1"),
            s3_bucket=os.environ.get("AWS_S3_BUCKET"),
            s3_access_key=os.environ.get("AWS_ACCESS_KEY_ID"),
            s3_secret_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
            cognito_user_pool_id=os.environ.get("AWS_COGNITO_USER_POOL_ID"),
            cognito_client_id=os.environ.get("AWS_COGNITO_CLIENT_ID"),
        )
        
        # Payment Config
        self.payment = PaymentConfig(
            gateway=self.payment_gateway,
            phonepe_merchant_id=os.environ.get("PHONEPE_MERCHANT_ID"),
            phonepe_salt_key=os.environ.get("PHONEPE_SALT_KEY"),
            phonepe_salt_index=os.environ.get("PHONEPE_SALT_INDEX", "1"),
            phonepe_env=os.environ.get("PHONEPE_ENV", "UAT"),
            razorpay_key_id=os.environ.get("RAZORPAY_KEY_ID"),
            razorpay_key_secret=os.environ.get("RAZORPAY_KEY_SECRET"),
            stripe_secret_key=os.environ.get("STRIPE_SECRET_KEY"),
            stripe_publishable_key=os.environ.get("STRIPE_PUBLISHABLE_KEY"),
        )
    
    def is_aws_storage(self) -> bool:
        return self.storage_provider == StorageProvider.AWS_S3
    
    def is_aws_auth(self) -> bool:
        return self.auth_provider == AuthProvider.AWS_COGNITO
    
    def get_payment_gateway(self) -> PaymentGateway:
        return self.payment_gateway

# Global config instance
config = AppConfig()
