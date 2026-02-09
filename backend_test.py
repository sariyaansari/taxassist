import requests
import sys
import json
from datetime import datetime

class TaxAssistAPITester:
    def __init__(self, base_url="https://find-my-tax.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.client_token = None
        self.client_user_id = None
        self.admin_user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "status": "PASS" if success else "FAIL",
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status_icon = "✅" if success else "❌"
        print(f"{status_icon} {name}: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f" (Expected: {expected_status})"
                if response.text:
                    try:
                        error_data = response.json()
                        details += f" - {error_data.get('detail', 'Unknown error')}"
                    except:
                        details += f" - {response.text[:100]}"

            self.log_test(name, success, details)
            return success, response.json() if success and response.text else {}

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@taxassist.com", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            self.admin_user_id = response['user']['id']
            return True
        return False

    def test_client_registration(self):
        """Test client registration"""
        test_email = f"testclient_{datetime.now().strftime('%H%M%S')}@test.com"
        success, response = self.run_test(
            "Client Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": test_email,
                "password": "TestPass123!",
                "name": "Test Client",
                "phone": "9876543210",
                "user_type": "client"
            }
        )
        if success and 'token' in response:
            self.client_token = response['token']
            self.client_user_id = response['user']['id']
            return True
        return False

    def test_client_login(self):
        """Test client login with registered user"""
        if not self.client_token:
            return False
        
        # Test auth/me endpoint to verify token works
        headers = {'Authorization': f'Bearer {self.client_token}'}
        return self.run_test("Client Auth Check", "GET", "auth/me", 200, headers=headers)[0]

    def test_admin_create_tax_plan(self):
        """Test admin creating tax plans"""
        if not self.admin_token:
            return False
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Create salary plan
        salary_plan_success, salary_response = self.run_test(
            "Create Salary Tax Plan",
            "POST",
            "admin/plans",
            200,
            data={
                "name": "Basic Salary Filing",
                "description": "For salaried professionals",
                "plan_type": "salary",
                "price": 999.0,
                "required_documents": ["Form 16", "Bank Statements", "PAN Card"],
                "features": ["ITR-1 Filing", "Expert Review", "E-filing"]
            },
            headers=headers
        )
        
        # Create business plan
        business_plan_success, business_response = self.run_test(
            "Create Business Tax Plan",
            "POST",
            "admin/plans",
            200,
            data={
                "name": "Business Tax Filing",
                "description": "For business owners",
                "plan_type": "business",
                "price": 2999.0,
                "required_documents": ["P&L Statement", "Balance Sheet", "GST Returns"],
                "features": ["ITR-3/4 Filing", "Business Consultation", "Audit Support"]
            },
            headers=headers
        )
        
        return salary_plan_success and business_plan_success

    def test_get_public_plans(self):
        """Test getting public tax plans"""
        return self.run_test("Get Public Plans", "GET", "plans", 200)[0]

    def test_client_create_filing_request(self):
        """Test client creating filing request"""
        if not self.client_token:
            return False
        
        # First get available plans
        success, plans = self.run_test("Get Plans for Request", "GET", "plans", 200)
        if not success or not plans:
            return False
        
        headers = {'Authorization': f'Bearer {self.client_token}'}
        plan_id = plans[0]['id']
        
        return self.run_test(
            "Create Filing Request",
            "POST",
            "requests",
            200,
            data={
                "plan_id": plan_id,
                "financial_year": "2023-24"
            },
            headers=headers
        )[0]

    def test_client_upload_document(self):
        """Test client uploading document"""
        if not self.client_token:
            return False
        
        headers = {'Authorization': f'Bearer {self.client_token}'}
        
        # Get client's requests first
        success, requests = self.run_test("Get Client Requests", "GET", "requests", 200, headers=headers)
        if not success or not requests:
            return False
        
        request_id = requests[0]['id']
        
        return self.run_test(
            "Upload Document",
            "POST",
            f"requests/{request_id}/documents",
            200,
            data={
                "name": "Form 16",
                "document_type": "form16",
                "file_data": "base64encodeddata",
                "file_name": "form16.pdf"
            },
            headers=headers
        )[0]

    def test_client_send_message(self):
        """Test client sending message"""
        if not self.client_token:
            return False
        
        headers = {'Authorization': f'Bearer {self.client_token}'}
        
        return self.run_test(
            "Send Client Message",
            "POST",
            "messages",
            200,
            data={
                "content": "Hello, I have a question about my tax filing."
            },
            headers=headers
        )[0]

    def test_admin_view_requests(self):
        """Test admin viewing all requests"""
        if not self.admin_token:
            return False
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Admin View Requests", "GET", "admin/requests", 200, headers=headers)[0]

    def test_admin_view_documents(self):
        """Test admin viewing all documents"""
        if not self.admin_token:
            return False
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Admin View Documents", "GET", "admin/documents", 200, headers=headers)[0]

    def test_admin_view_messages(self):
        """Test admin viewing messages"""
        if not self.admin_token:
            return False
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Admin View Messages", "GET", "messages", 200, headers=headers)[0]

    def test_admin_stats(self):
        """Test admin statistics"""
        if not self.admin_token:
            return False
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Admin Statistics", "GET", "admin/stats", 200, headers=headers)[0]

    def test_admin_payments(self):
        """Test admin viewing payments"""
        if not self.admin_token:
            return False
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Admin View Payments", "GET", "admin/payments", 200, headers=headers)[0]

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting TaxAssist API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 50)
        
        # Basic connectivity
        self.test_root_endpoint()
        
        # Authentication tests
        admin_login_success = self.test_admin_login()
        client_reg_success = self.test_client_registration()
        
        if client_reg_success:
            self.test_client_login()
        
        # Admin functionality tests
        if admin_login_success:
            self.test_admin_create_tax_plan()
            self.test_admin_view_requests()
            self.test_admin_view_documents()
            self.test_admin_view_messages()
            self.test_admin_stats()
            self.test_admin_payments()
        
        # Public endpoints
        self.test_get_public_plans()
        
        # Client functionality tests
        if client_reg_success:
            self.test_client_create_filing_request()
            self.test_client_upload_document()
            self.test_client_send_message()
        
        # Print summary
        print("=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return 1

def main():
    tester = TaxAssistAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())