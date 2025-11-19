import os
import json
from google.cloud import firestore
from google.oauth2 import service_account
from datetime import datetime

def create_default_student():
    try:
        # Initialize Firestore
        credentials_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON')
        if credentials_json:
            credentials_info = json.loads(credentials_json)
            credentials = service_account.Credentials.from_service_account_info(credentials_info)
            db = firestore.Client(credentials=credentials)
        else:
            db = firestore.Client()

        student_id = 'student_default'
        
        # Check if exists
        doc_ref = db.collection('student_profiles').document(student_id)
        doc = doc_ref.get()
        
        if doc.exists:
            print(f"Student {student_id} already exists.")
            return

        # Create default student
        student_data = {
            'name': 'Alex Explorer',
            'age': 12,
            'grade': '7th',
            'interests': ['History', 'Geography', 'Photography'],
            'learning_style': 'Visual',
            'state': 'CA',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        doc_ref.set(student_data)
        print(f"Successfully created student profile: {student_id}")

    except Exception as e:
        print(f"Error creating student: {e}")

if __name__ == "__main__":
    create_default_student()
