"""
Email Service for TaxAssist
Handles all email notifications with smart batching
"""
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from typing import Optional, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.api_key = os.environ.get('SENDGRID_API_KEY')
        self.sender_email = os.environ.get('SENDER_EMAIL', 'noreply@taxassist.com')
        self.admin_email = os.environ.get('ADMIN_NOTIFICATION_EMAIL')
        self.enabled = bool(self.api_key)
    
    def _send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email via SendGrid"""
        if not self.enabled:
            logger.warning(f"Email service disabled. Would send to {to_email}: {subject}")
            return False
        
        try:
            message = Mail(
                from_email=self.sender_email,
                to_emails=to_email,
                subject=subject,
                html_content=html_content
            )
            sg = SendGridAPIClient(self.api_key)
            response = sg.send(message)
            logger.info(f"Email sent to {to_email}: {subject}")
            return response.status_code == 202
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    def _get_base_template(self, content: str, title: str = "TaxAssist Notification") -> str:
        """Get base HTML email template"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #0f2e1f; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #0f2e1f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .header h1 {{ margin: 0; font-size: 24px; }}
                .content {{ background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }}
                .footer {{ background-color: #f5f5f0; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }}
                .button {{ display: inline-block; background-color: #c25e00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }}
                .status-approved {{ color: #2e7d32; font-weight: bold; }}
                .status-rejected {{ color: #d32f2f; font-weight: bold; }}
                .status-pending {{ color: #ed6c02; font-weight: bold; }}
                .info-box {{ background-color: #f5f5f0; padding: 15px; border-radius: 6px; margin: 15px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>TaxAssist</h1>
                </div>
                <div class="content">
                    {content}
                </div>
                <div class="footer">
                    <p>© 2025 TaxAssist. All rights reserved.</p>
                    <p>This is an automated notification. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

    # ================== USER NOTIFICATIONS ==================
    
    def send_welcome_email(self, user_email: str, user_name: str) -> bool:
        """Send welcome email to new user"""
        content = f"""
        <h2>Welcome to TaxAssist, {user_name}!</h2>
        <p>Your account has been successfully created. You can now:</p>
        <ul>
            <li>Browse our tax filing plans</li>
            <li>Upload your documents securely</li>
            <li>Track your filing progress</li>
            <li>Chat with our tax experts</li>
        </ul>
        <p><a href="#" class="button">Go to Dashboard</a></p>
        """
        return self._send_email(user_email, "Welcome to TaxAssist!", self._get_base_template(content))

    def send_document_status_update(self, user_email: str, user_name: str, doc_name: str, 
                                     doc_type: str, status: str, admin_notes: str = None,
                                     plan_name: str = "", financial_year: str = "") -> bool:
        """Send document status update notification"""
        status_class = f"status-{status}"
        status_text = status.replace('_', ' ').title()
        
        notes_section = ""
        if admin_notes:
            notes_section = f"""
            <div class="info-box">
                <strong>Notes from reviewer:</strong><br>
                {admin_notes}
            </div>
            """
        
        action_text = ""
        if status == 'rejected' or status == 'needs_revision':
            action_text = "<p><strong>Action Required:</strong> Please upload a revised document.</p>"
        elif status == 'approved':
            action_text = "<p>No further action needed for this document.</p>"
        
        content = f"""
        <h2>Document Status Update</h2>
        <p>Hello {user_name},</p>
        <p>Your document has been reviewed:</p>
        <div class="info-box">
            <p><strong>Document:</strong> {doc_name}</p>
            <p><strong>Type:</strong> {doc_type}</p>
            <p><strong>Plan:</strong> {plan_name} - FY {financial_year}</p>
            <p><strong>Status:</strong> <span class="{status_class}">{status_text}</span></p>
        </div>
        {notes_section}
        {action_text}
        <p><a href="#" class="button">View Your Documents</a></p>
        """
        return self._send_email(user_email, f"Document {status_text}: {doc_name}", self._get_base_template(content))

    def send_batch_document_update(self, user_email: str, user_name: str, 
                                    documents: List[dict], plan_name: str, financial_year: str) -> bool:
        """Send batched notification for multiple document updates"""
        doc_rows = ""
        for doc in documents:
            status_class = f"status-{doc['status']}"
            status_text = doc['status'].replace('_', ' ').title()
            doc_rows += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">{doc['name']}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">{doc['document_type']}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><span class="{status_class}">{status_text}</span></td>
            </tr>
            """
        
        needs_action = any(d['status'] in ['rejected', 'needs_revision'] for d in documents)
        action_text = ""
        if needs_action:
            action_text = "<p><strong>Action Required:</strong> Some documents need to be resubmitted. Please check the details above.</p>"
        
        content = f"""
        <h2>Document Review Summary</h2>
        <p>Hello {user_name},</p>
        <p>Your documents for <strong>{plan_name} - FY {financial_year}</strong> have been reviewed:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
                <tr style="background-color: #f5f5f0;">
                    <th style="padding: 10px; text-align: left;">Document</th>
                    <th style="padding: 10px; text-align: left;">Type</th>
                    <th style="padding: 10px; text-align: left;">Status</th>
                </tr>
            </thead>
            <tbody>
                {doc_rows}
            </tbody>
        </table>
        {action_text}
        <p><a href="#" class="button">View Your Case</a></p>
        """
        return self._send_email(user_email, f"Document Review Summary - {plan_name}", self._get_base_template(content))

    def send_payment_confirmation(self, user_email: str, user_name: str, 
                                   amount: float, plan_name: str, financial_year: str) -> bool:
        """Send payment confirmation email"""
        content = f"""
        <h2>Payment Confirmed!</h2>
        <p>Hello {user_name},</p>
        <p>We have received your payment. Thank you!</p>
        <div class="info-box">
            <p><strong>Amount Paid:</strong> ₹{amount:,.2f}</p>
            <p><strong>Plan:</strong> {plan_name}</p>
            <p><strong>Financial Year:</strong> {financial_year}</p>
            <p><strong>Date:</strong> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>
        </div>
        <p>Our team will now begin processing your tax filing. You'll receive updates as we make progress.</p>
        <p><a href="#" class="button">Track Your Filing</a></p>
        """
        return self._send_email(user_email, "Payment Confirmed - TaxAssist", self._get_base_template(content))

    def send_case_status_update(self, user_email: str, user_name: str,
                                 status: str, plan_name: str, financial_year: str, message: str = "") -> bool:
        """Send case status update notification"""
        status_text = status.replace('_', ' ').title()
        
        content = f"""
        <h2>Case Status Update</h2>
        <p>Hello {user_name},</p>
        <p>Your tax filing case has been updated:</p>
        <div class="info-box">
            <p><strong>Plan:</strong> {plan_name}</p>
            <p><strong>Financial Year:</strong> {financial_year}</p>
            <p><strong>New Status:</strong> <strong>{status_text}</strong></p>
        </div>
        {f'<p>{message}</p>' if message else ''}
        <p><a href="#" class="button">View Your Case</a></p>
        """
        return self._send_email(user_email, f"Case Update: {status_text}", self._get_base_template(content))

    # ================== ADMIN NOTIFICATIONS ==================
    
    def send_admin_new_submission(self, admin_email: str, user_name: str, user_email: str,
                                   plan_name: str, financial_year: str, doc_count: int) -> bool:
        """Notify admin of new document submission"""
        content = f"""
        <h2>New Document Submission</h2>
        <p>A client has submitted documents for review:</p>
        <div class="info-box">
            <p><strong>Client:</strong> {user_name} ({user_email})</p>
            <p><strong>Plan:</strong> {plan_name}</p>
            <p><strong>Financial Year:</strong> {financial_year}</p>
            <p><strong>Documents Submitted:</strong> {doc_count}</p>
            <p><strong>Time:</strong> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>
        </div>
        <p><a href="#" class="button">Review Documents</a></p>
        """
        return self._send_email(admin_email, f"New Submission: {user_name} - {plan_name}", self._get_base_template(content))

    def send_admin_payment_received(self, admin_email: str, user_name: str, 
                                     amount: float, plan_name: str) -> bool:
        """Notify admin of payment received"""
        content = f"""
        <h2>Payment Received</h2>
        <p>A new payment has been received:</p>
        <div class="info-box">
            <p><strong>Client:</strong> {user_name}</p>
            <p><strong>Amount:</strong> ₹{amount:,.2f}</p>
            <p><strong>Plan:</strong> {plan_name}</p>
            <p><strong>Time:</strong> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>
        </div>
        """
        return self._send_email(admin_email, f"Payment Received: ₹{amount:,.2f} - {user_name}", self._get_base_template(content))

    def send_admin_new_message(self, admin_email: str, user_name: str, message: str) -> bool:
        """Notify admin of new message from client"""
        content = f"""
        <h2>New Message from Client</h2>
        <p>You have received a new message:</p>
        <div class="info-box">
            <p><strong>From:</strong> {user_name}</p>
            <p><strong>Message:</strong></p>
            <p style="background: white; padding: 15px; border-radius: 4px;">{message}</p>
        </div>
        <p><a href="#" class="button">Reply to Message</a></p>
        """
        return self._send_email(admin_email, f"New Message from {user_name}", self._get_base_template(content))

    def send_custom_email(self, to_email: str, subject: str, message: str, sender_name: str = "TaxAssist Team") -> bool:
        """Send custom email from admin to client"""
        content = f"""
        <h2>{subject}</h2>
        <p>{message}</p>
        <p style="margin-top: 30px; color: #666;">
            Best regards,<br>
            <strong>{sender_name}</strong><br>
            TaxAssist Team
        </p>
        """
        return self._send_email(to_email, subject, self._get_base_template(content))


# Singleton instance
email_service = EmailService()
