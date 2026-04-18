import os
from dotenv import load_dotenv
load_dotenv()

#load api key from .env file
api_key=os.getenv('api_key')
model_name=os.getenv('model_name')

