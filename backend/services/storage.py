"""
Storage Service - Supports Local and AWS S3 Storage
"""
import os
import base64
import uuid
from abc import ABC, abstractmethod
from typing import Optional, Tuple
from pathlib import Path

class StorageService(ABC):
    """Abstract base class for storage services"""
    
    @abstractmethod
    async def upload_file(self, file_data: str, file_name: str, folder: str = "") -> str:
        """Upload file and return storage key/path"""
        pass
    
    @abstractmethod
    async def download_file(self, file_key: str) -> Tuple[bytes, str]:
        """Download file and return (data, filename)"""
        pass
    
    @abstractmethod
    async def delete_file(self, file_key: str) -> bool:
        """Delete file from storage"""
        pass
    
    @abstractmethod
    def get_file_url(self, file_key: str) -> str:
        """Get public/signed URL for file"""
        pass


class LocalStorageService(StorageService):
    """Local filesystem storage implementation"""
    
    def __init__(self, base_path: str = "/app/uploads"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    async def upload_file(self, file_data: str, file_name: str, folder: str = "") -> str:
        """Store base64 encoded file locally"""
        file_id = str(uuid.uuid4())
        ext = Path(file_name).suffix
        storage_key = f"{folder}/{file_id}{ext}" if folder else f"{file_id}{ext}"
        
        file_path = self.base_path / storage_key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Decode and save
        file_bytes = base64.b64decode(file_data)
        with open(file_path, 'wb') as f:
            f.write(file_bytes)
        
        return storage_key
    
    async def download_file(self, file_key: str) -> Tuple[bytes, str]:
        """Read file from local storage"""
        file_path = self.base_path / file_key
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_key}")
        
        with open(file_path, 'rb') as f:
            data = f.read()
        
        return data, file_path.name
    
    async def delete_file(self, file_key: str) -> bool:
        """Delete file from local storage"""
        file_path = self.base_path / file_key
        if file_path.exists():
            file_path.unlink()
            return True
        return False
    
    def get_file_url(self, file_key: str) -> str:
        """Return local file path as URL"""
        return f"/uploads/{file_key}"


class AWSS3StorageService(StorageService):
    """AWS S3 storage implementation"""
    
    def __init__(self, bucket: str, region: str, access_key: str, secret_key: str):
        self.bucket = bucket
        self.region = region
        self.access_key = access_key
        self.secret_key = secret_key
        self._client = None
    
    @property
    def client(self):
        """Lazy load boto3 client"""
        if self._client is None:
            import boto3
            self._client = boto3.client(
                's3',
                region_name=self.region,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key
            )
        return self._client
    
    async def upload_file(self, file_data: str, file_name: str, folder: str = "") -> str:
        """Upload base64 encoded file to S3"""
        file_id = str(uuid.uuid4())
        ext = Path(file_name).suffix
        storage_key = f"{folder}/{file_id}{ext}" if folder else f"{file_id}{ext}"
        
        file_bytes = base64.b64decode(file_data)
        
        self.client.put_object(
            Bucket=self.bucket,
            Key=storage_key,
            Body=file_bytes,
            ContentType=self._get_content_type(ext)
        )
        
        return storage_key
    
    async def download_file(self, file_key: str) -> Tuple[bytes, str]:
        """Download file from S3"""
        response = self.client.get_object(Bucket=self.bucket, Key=file_key)
        data = response['Body'].read()
        filename = Path(file_key).name
        return data, filename
    
    async def delete_file(self, file_key: str) -> bool:
        """Delete file from S3"""
        try:
            self.client.delete_object(Bucket=self.bucket, Key=file_key)
            return True
        except Exception:
            return False
    
    def get_file_url(self, file_key: str, expiry: int = 3600) -> str:
        """Generate presigned URL for S3 object"""
        url = self.client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': file_key},
            ExpiresIn=expiry
        )
        return url
    
    def _get_content_type(self, ext: str) -> str:
        """Get MIME type for file extension"""
        content_types = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }
        return content_types.get(ext.lower(), 'application/octet-stream')


def get_storage_service() -> StorageService:
    """Factory function to get appropriate storage service based on config"""
    from config import config
    
    if config.is_aws_storage():
        return AWSS3StorageService(
            bucket=config.aws.s3_bucket,
            region=config.aws.region,
            access_key=config.aws.s3_access_key,
            secret_key=config.aws.s3_secret_key
        )
    else:
        return LocalStorageService()
