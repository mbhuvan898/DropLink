import boto3, os
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv()

BUCKET      = os.getenv('SUPABASE_BUCKET', 'droplink-files')
PROJECT_REF = os.getenv('SUPABASE_PROJECT_REF', '')

def get_s3():
    return boto3.client(
        's3',
        endpoint_url=os.getenv('SUPABASE_ENDPOINT'),
        aws_access_key_id=os.getenv('SUPABASE_ACCESS_KEY'),
        aws_secret_access_key=os.getenv('SUPABASE_SECRET_KEY'),
        region_name=os.getenv('SUPABASE_REGION', 'us-east-1'),
        config=Config(signature_version='s3v4', s3={'addressing_style': 'path'})
    )

def upload_file(stored_name, file_stream, mimetype):
    file_stream.seek(0)
    get_s3().upload_fileobj(
        file_stream, BUCKET, stored_name,
        ExtraArgs={'ContentType': mimetype}
    )

def get_public_url(stored_name):
    return (
        f'https://{PROJECT_REF}.supabase.co'
        f'/storage/v1/object/public/{BUCKET}/{stored_name}'
    )

def stream_file(stored_name):
    resp = get_s3().get_object(Bucket=BUCKET, Key=stored_name)
    return resp['Body'], resp.get('ContentType', 'application/octet-stream')

def delete_file(stored_name):
    try:
        get_s3().delete_object(Bucket=BUCKET, Key=stored_name)
    except Exception:
        pass
