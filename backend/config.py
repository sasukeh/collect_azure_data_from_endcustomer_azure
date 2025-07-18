"""
Configuration settings for Azure Data Collector
"""

import os
from typing import Dict, Any

# Firebase configuration
FIREBASE_CONFIG = {
    'project_id': os.getenv('FIREBASE_PROJECT_ID', 'your-firebase-project'),
    'service_account_path': os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH', 'service-account-key.json')
}

# Azure API configuration
AZURE_CONFIG = {
    'management_endpoint': 'https://management.azure.com',
    'authority': 'https://login.microsoftonline.com',
    'scope': ['https://management.azure.com/.default']
}

# Data collection settings
COLLECTION_CONFIG = {
    'cost_data_days_back': 30,
    'metrics_retention_days': 90,
    'batch_size': 100,
    'max_retries': 3,
    'retry_delay': 5  # seconds
}

# Logging configuration
LOGGING_CONFIG = {
    'level': os.getenv('LOG_LEVEL', 'INFO'),
    'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
}

# Rate limiting
RATE_LIMIT_CONFIG = {
    'azure_api_calls_per_minute': 100,
    'firestore_writes_per_minute': 500
}
