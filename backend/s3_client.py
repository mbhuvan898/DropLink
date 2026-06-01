import boto3, os
from dotenv import load_dotenv

load_dotenv()

BUCKET = os.getenv('AWS_BUCKET_NAME', '')

def get_s3():
    kwargs = dict(
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION', 'auto'),
    )
    endpoint = os.getenv('AWS_ENDPOINT_URL')
    if endpoint:
        kwargs['endpoint_url'] = endpoint
    return boto3.client('s3', **kwargs)

def setup_lifecycle():
    """Delete each file from S3 at its own expiry: 1 day, 2 days, or 7 days."""
    try:
        get_s3().put_bucket_lifecycle_configuration(
            Bucket=BUCKET,
            LifecycleConfiguration={
                'Rules': [
                    {
                        'ID': 'droplink-expire-24h',
                        'Status': 'Enabled',
                        'Filter': {'Tag': {'Key': 'expires_in', 'Value': '24h'}},
                        'Expiration': {'Days': 1},
                    },
                    {
                        'ID': 'droplink-expire-2d',
                        'Status': 'Enabled',
                        'Filter': {'Tag': {'Key': 'expires_in', 'Value': '2d'}},
                        'Expiration': {'Days': 2},
                    },
                    {
                        'ID': 'droplink-expire-7d',
                        'Status': 'Enabled',
                        'Filter': {'Tag': {'Key': 'expires_in', 'Value': '7d'}},
                        'Expiration': {'Days': 7},
                    },
                ]
            }
        )
    except Exception:
        pass
