#!/bin/bash
# Setup S3 Bucket for LifeVault

set -e

echo "🪣 Setting up S3 bucket for LifeVault..."

# Check if using MinIO or AWS S3
if [ -n "$AWS_ENDPOINT_URL" ] && [[ "$AWS_ENDPOINT_URL" == *"localhost"* ]]; then
    echo "Using MinIO (local development)"
    ENDPOINT="$AWS_ENDPOINT_URL"
else
    echo "Using AWS S3"
    ENDPOINT=""
fi

BUCKET_NAME="${AWS_S3_BUCKET:-lifevault-vaults}"

echo "Bucket name: $BUCKET_NAME"

# For MinIO, we can use mc (MinIO Client) or AWS CLI
if command -v aws &> /dev/null; then
    echo "Using AWS CLI..."
    
    if [ -n "$ENDPOINT" ]; then
        # MinIO
        aws --endpoint-url="$ENDPOINT" s3 mb "s3://$BUCKET_NAME" 2>/dev/null || echo "Bucket may already exist"
        aws --endpoint-url="$ENDPOINT" s3api put-bucket-encryption \
            --bucket "$BUCKET_NAME" \
            --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
            2>/dev/null || echo "Encryption may already be enabled"
    else
        # AWS S3
        aws s3 mb "s3://$BUCKET_NAME" 2>/dev/null || echo "Bucket may already exist"
        aws s3api put-bucket-encryption \
            --bucket "$BUCKET_NAME" \
            --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
            2>/dev/null || echo "Encryption may already be enabled"
    fi
    
    echo "✅ S3 bucket setup complete!"
    echo ""
    echo "Bucket: $BUCKET_NAME"
    echo "All files will be stored encrypted (client-side + S3 encryption)"
else
    echo "⚠️  AWS CLI not found. Please install it or create bucket manually:"
    echo ""
    echo "For MinIO:"
    echo "  1. Visit http://localhost:9001"
    echo "  2. Login: minioadmin / minioadmin123"
    echo "  3. Create bucket: $BUCKET_NAME"
    echo ""
    echo "For AWS S3:"
    echo "  1. Go to AWS Console → S3"
    echo "  2. Create bucket: $BUCKET_NAME"
    echo "  3. Enable encryption"
fi


