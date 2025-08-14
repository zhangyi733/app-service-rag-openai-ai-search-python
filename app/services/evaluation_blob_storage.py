"""
Helper for appending evaluation data to Azure Blob Storage as JSONL
"""
import json
from azure.storage.blob import BlobServiceClient
from azure.identity import DefaultAzureCredential
from datetime import datetime

class EvaluationBlobStorage:
    def __init__(self, account_url: str, container_name: str, blob_name: str):
        self.account_url = account_url
        self.container_name = container_name
        self.blob_name = blob_name
        self.credential = DefaultAzureCredential()
        self.client = BlobServiceClient(account_url=self.account_url, credential=self.credential)
        self.container_client = self.client.get_container_client(self.container_name)
        try:
            self.container_client.create_container()
        except Exception:
            pass

    def append_evaluation(self, eval_dict: dict):
        try:
            blob_client = self.container_client.get_blob_client(self.blob_name)
            existing = blob_client.download_blob().readall().decode('utf-8')
        except Exception:
            existing = ''
        new_line = json.dumps(eval_dict, default=str) + '\n'
        updated = existing + new_line
        blob_client = self.container_client.get_blob_client(self.blob_name)
        blob_client.upload_blob(updated, overwrite=True)
