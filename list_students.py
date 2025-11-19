import os
import json
from google.cloud import firestore
from google.oauth2 import service_account

def list_students():
    try:
        # Initialize Firestore
        credentials_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON')
        if credentials_json:
            credentials_info = json.loads(credentials_json)
            credentials = service_account.Credentials.from_service_account_info(credentials_info)
            db = firestore.Client(credentials=credentials)
        else:
            db = firestore.Client()

        print("Fetching student profiles...")
        docs = db.collection('student_profiles').stream()
        
        count = 0
        for doc in docs:
            count += 1
            data = doc.to_dict()
            print(f"ID: {doc.id}, Name: {data.get('name')}, Grade: {data.get('grade')}")
            
        if count == 0:
            print("No student profiles found.")

    except Exception as e:
        print(f"Error listing students: {e}")

if __name__ == "__main__":
    list_students()
