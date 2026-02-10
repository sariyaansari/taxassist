"""
TaxAssist Backend API Tests - New Features
Tests for: Offers, Admin Settings, CA Admin Permissions, Document Unlock
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_CREDS = {"email": "superadmin@taxassist.com", "password": "super123"}
CA_ADMIN_CREDS = {"email": "admin@taxassist.com", "password": "admin123"}
CLIENT_CREDS = {"email": "testclient@example.com", "password": "test123"}


class TestAuthAndSetup:
    """Test authentication and basic setup"""
    
    def test_api_health(self):
        """Test API is running"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "TaxAssist API"
        assert data["version"] == "2.0.0"
        print(f"✓ API health check passed - version {data['version']}")
    
    def test_super_admin_login(self):
        """Test super admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["admin_role"] == "super_admin"
        print(f"✓ Super admin login successful - {data['user']['email']}")
        return data["token"]
    
    def test_ca_admin_login(self):
        """Test CA admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CA_ADMIN_CREDS)
        assert response.status_code == 200, f"CA admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["admin_role"] == "ca_admin"
        print(f"✓ CA admin login successful - {data['user']['email']}")
        return data["token"]
    
    def test_client_login(self):
        """Test client login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CLIENT_CREDS)
        assert response.status_code == 200, f"Client login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["user_type"] == "client"
        print(f"✓ Client login successful - {data['user']['email']}")
        return data["token"]


class TestOffersManagement:
    """Test Offers CRUD and validation"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def ca_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CA_ADMIN_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def client_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CLIENT_CREDS)
        return response.json()["token"]
    
    def test_create_offer_super_admin(self, super_admin_token):
        """Super admin can create offers"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Create a test offer
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        offer_data = {
            "code": f"TEST{datetime.now().strftime('%H%M%S')}",
            "name": "Test Offer",
            "description": "Test discount offer",
            "discount_type": "percentage",
            "discount_value": 10,
            "valid_from": f"{today}T00:00:00Z",
            "valid_until": f"{next_month}T23:59:59Z",
            "max_uses": 100
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/offers", json=offer_data, headers=headers)
        assert response.status_code == 200, f"Create offer failed: {response.text}"
        data = response.json()
        assert data["code"] == offer_data["code"]
        assert data["discount_value"] == 10
        assert data["is_active"] == True
        print(f"✓ Offer created successfully - {data['code']}")
        return data
    
    def test_create_offer_ca_admin_denied(self, ca_admin_token):
        """CA admin cannot create offers (super admin only)"""
        headers = {"Authorization": f"Bearer {ca_admin_token}"}
        
        offer_data = {
            "code": "CATEST",
            "name": "CA Test Offer",
            "description": "Should fail",
            "discount_type": "percentage",
            "discount_value": 5,
            "valid_from": "2025-01-01T00:00:00Z",
            "valid_until": "2025-12-31T23:59:59Z"
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/offers", json=offer_data, headers=headers)
        assert response.status_code == 403, f"CA admin should not create offers: {response.text}"
        print("✓ CA admin correctly denied from creating offers")
    
    def test_get_all_offers_super_admin(self, super_admin_token):
        """Super admin can view all offers"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/offers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Super admin can view offers - {len(data)} offers found")
    
    def test_validate_offer_valid(self, super_admin_token):
        """Test offer validation with valid code"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # First create an offer
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        offer_code = f"VALID{datetime.now().strftime('%H%M%S')}"
        offer_data = {
            "code": offer_code,
            "name": "Valid Test Offer",
            "description": "For validation testing",
            "discount_type": "percentage",
            "discount_value": 15,
            "valid_from": f"{today}T00:00:00Z",
            "valid_until": f"{next_month}T23:59:59Z"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/admin/offers", json=offer_data, headers=headers)
        assert create_response.status_code == 200
        
        # Now validate the offer
        validate_data = {
            "code": offer_code,
            "email": "newuser@test.com",
            "phone": "9876543210"
        }
        
        response = requests.post(f"{BASE_URL}/api/offers/validate", json=validate_data)
        assert response.status_code == 200, f"Offer validation failed: {response.text}"
        data = response.json()
        assert data["valid"] == True
        assert data["code"] == offer_code
        assert data["discount_value"] == 15
        print(f"✓ Offer validation successful - {offer_code}")
    
    def test_validate_offer_invalid_code(self):
        """Test offer validation with invalid code"""
        validate_data = {
            "code": "INVALIDCODE123",
            "email": "test@test.com",
            "phone": "1234567890"
        }
        
        response = requests.post(f"{BASE_URL}/api/offers/validate", json=validate_data)
        assert response.status_code == 404
        print("✓ Invalid offer code correctly rejected")
    
    def test_get_active_offers_public(self):
        """Public endpoint to get active offers"""
        response = requests.get(f"{BASE_URL}/api/offers/active")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Public active offers endpoint works - {len(data)} active offers")
    
    def test_deactivate_offer(self, super_admin_token):
        """Super admin can deactivate offers"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Create an offer first
        today = datetime.now().strftime("%Y-%m-%d")
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        offer_code = f"DEACT{datetime.now().strftime('%H%M%S')}"
        offer_data = {
            "code": offer_code,
            "name": "To Deactivate",
            "description": "Will be deactivated",
            "discount_type": "fixed",
            "discount_value": 100,
            "valid_from": f"{today}T00:00:00Z",
            "valid_until": f"{next_month}T23:59:59Z"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/admin/offers", json=offer_data, headers=headers)
        assert create_response.status_code == 200
        offer_id = create_response.json()["id"]
        
        # Deactivate the offer
        response = requests.delete(f"{BASE_URL}/api/admin/offers/{offer_id}", headers=headers)
        assert response.status_code == 200
        print(f"✓ Offer deactivated successfully - {offer_code}")


class TestAdminSettings:
    """Test Admin Settings (Super Admin only)"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def ca_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CA_ADMIN_CREDS)
        return response.json()["token"]
    
    def test_get_settings_super_admin(self, super_admin_token):
        """Super admin can get settings"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "notification_email" in data or "type" in data
        print(f"✓ Super admin can access settings")
    
    def test_get_settings_ca_admin_denied(self, ca_admin_token):
        """CA admin cannot access settings"""
        headers = {"Authorization": f"Bearer {ca_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        assert response.status_code == 403
        print("✓ CA admin correctly denied from settings")
    
    def test_update_notification_email(self, super_admin_token):
        """Super admin can update notification email"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        update_data = {
            "notification_email": "notifications@taxassist.com",
            "new_case_email_enabled": True,
            "payment_email_enabled": True,
            "message_email_enabled": False
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/settings", json=update_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["notification_email"] == "notifications@taxassist.com"
        print("✓ Notification email updated successfully")
    
    def test_update_settings_ca_admin_denied(self, ca_admin_token):
        """CA admin cannot update settings"""
        headers = {"Authorization": f"Bearer {ca_admin_token}"}
        
        update_data = {"notification_email": "hacker@test.com"}
        
        response = requests.put(f"{BASE_URL}/api/admin/settings", json=update_data, headers=headers)
        assert response.status_code == 403
        print("✓ CA admin correctly denied from updating settings")


class TestCAAdminPermissions:
    """Test CA Admin Permissions Management"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def ca_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CA_ADMIN_CREDS)
        return response.json()["token"]
    
    def test_get_available_permissions(self, super_admin_token):
        """Super admin can get available permissions list"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/permissions/available", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Check expected permissions exist
        permission_ids = [p["id"] for p in data]
        expected_permissions = ["view_requests", "review_documents", "send_messages", "view_payments"]
        for perm in expected_permissions:
            assert perm in permission_ids, f"Missing permission: {perm}"
        
        print(f"✓ Available permissions retrieved - {len(data)} permissions")
    
    def test_get_admin_users(self, super_admin_token):
        """Super admin can get all admin users"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/admins", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin users retrieved - {len(data)} admins")
        return data
    
    def test_update_ca_admin_permissions(self, super_admin_token):
        """Super admin can update CA admin permissions"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Get CA admin user
        admins_response = requests.get(f"{BASE_URL}/api/admin/admins", headers=headers)
        admins = admins_response.json()
        ca_admin = next((a for a in admins if a["admin_role"] == "ca_admin"), None)
        
        if not ca_admin:
            pytest.skip("No CA admin found to test permissions update")
        
        # Update permissions
        new_permissions = ["view_requests", "review_documents", "send_messages"]
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{ca_admin['id']}/permissions",
            json={"permissions": new_permissions},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert set(data["permissions"]) == set(new_permissions)
        print(f"✓ CA admin permissions updated - {new_permissions}")
    
    def test_ca_admin_cannot_update_permissions(self, ca_admin_token, super_admin_token):
        """CA admin cannot update permissions"""
        headers = {"Authorization": f"Bearer {ca_admin_token}"}
        super_headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Get CA admin user ID
        admins_response = requests.get(f"{BASE_URL}/api/admin/admins", headers=super_headers)
        admins = admins_response.json()
        ca_admin = next((a for a in admins if a["admin_role"] == "ca_admin"), None)
        
        if not ca_admin:
            pytest.skip("No CA admin found")
        
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{ca_admin['id']}/permissions",
            json={"permissions": ["all"]},
            headers=headers
        )
        assert response.status_code == 403
        print("✓ CA admin correctly denied from updating permissions")


class TestDocumentUnlock:
    """Test Document Unlock Feature"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        return response.json()["token"]
    
    def test_get_all_documents(self, super_admin_token):
        """Admin can get all documents"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/documents", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Documents retrieved - {len(data)} documents")
        return data
    
    def test_unlock_document_endpoint_exists(self, super_admin_token):
        """Test unlock document endpoint exists"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        # Get documents
        docs_response = requests.get(f"{BASE_URL}/api/admin/documents", headers=headers)
        documents = docs_response.json()
        
        # Find an approved document
        approved_doc = next((d for d in documents if d.get("status") == "approved"), None)
        
        if not approved_doc:
            # Test with non-existent ID to verify endpoint exists
            response = requests.post(
                f"{BASE_URL}/api/admin/documents/nonexistent-id/allow-change",
                headers=headers
            )
            assert response.status_code == 404  # Document not found is expected
            print("✓ Document unlock endpoint exists (tested with non-existent ID)")
        else:
            response = requests.post(
                f"{BASE_URL}/api/admin/documents/{approved_doc['id']}/allow-change",
                headers=headers
            )
            assert response.status_code == 200
            print(f"✓ Document unlocked successfully - {approved_doc['id']}")


class TestRBACNavigation:
    """Test Role-Based Access Control for navigation"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def ca_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CA_ADMIN_CREDS)
        return response.json()["token"]
    
    def test_super_admin_access_all_endpoints(self, super_admin_token):
        """Super admin can access all admin endpoints"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        
        endpoints = [
            "/api/admin/requests",
            "/api/admin/documents",
            "/api/admin/payments",
            "/api/admin/users",
            "/api/admin/offers",
            "/api/admin/settings",
            "/api/admin/stats"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            assert response.status_code == 200, f"Super admin denied from {endpoint}: {response.text}"
            print(f"✓ Super admin can access {endpoint}")
    
    def test_ca_admin_restricted_endpoints(self, ca_admin_token):
        """CA admin is restricted from super-admin-only endpoints"""
        headers = {"Authorization": f"Bearer {ca_admin_token}"}
        
        # These should be denied for CA admin
        restricted_endpoints = [
            "/api/admin/settings",
            "/api/admin/admins"
        ]
        
        for endpoint in restricted_endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            assert response.status_code == 403, f"CA admin should be denied from {endpoint}"
            print(f"✓ CA admin correctly denied from {endpoint}")
    
    def test_ca_admin_allowed_endpoints(self, ca_admin_token):
        """CA admin can access allowed endpoints"""
        headers = {"Authorization": f"Bearer {ca_admin_token}"}
        
        # These should be allowed for CA admin
        allowed_endpoints = [
            "/api/admin/requests",
            "/api/admin/documents",
            "/api/admin/payments",
            "/api/admin/stats"
        ]
        
        for endpoint in allowed_endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            assert response.status_code == 200, f"CA admin should access {endpoint}: {response.text}"
            print(f"✓ CA admin can access {endpoint}")


class TestTaxPlans:
    """Test Tax Plans endpoints"""
    
    def test_get_public_plans(self):
        """Public can get active plans"""
        response = requests.get(f"{BASE_URL}/api/plans")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Public plans retrieved - {len(data)} plans")
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        return response.json()["token"]
    
    def test_admin_get_all_plans(self, super_admin_token):
        """Admin can get all plans including inactive"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/plans", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin plans retrieved - {len(data)} plans")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
