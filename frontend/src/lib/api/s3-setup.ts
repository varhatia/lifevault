/**
 * S3 Bucket Setup Script
 * Run this once to create the S3 bucket for encrypted file storage
 * 
 * Usage: npx tsx src/lib/api/s3-setup.ts
 */

import { S3Client, CreateBucketCommand, PutBucketEncryptionCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: process.env.AWS_ENDPOINT_URL,
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'lifevault-vaults';

async function setupS3Bucket() {
  try {
    console.log(`Creating bucket: ${BUCKET_NAME}...`);
    
    // Create bucket
    await s3Client.send(new CreateBucketCommand({
      Bucket: BUCKET_NAME,
    }));
    
    console.log(`✅ Bucket created: ${BUCKET_NAME}`);
    
    // Enable encryption (additional layer - data is already encrypted client-side)
    try {
      await s3Client.send(new PutBucketEncryptionCommand({
        Bucket: BUCKET_NAME,
        ServerSideEncryptionConfiguration: {
          Rules: [{
            ApplyServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256',
            },
          }],
        },
      }));
      console.log('✅ Server-side encryption enabled');
    } catch (error: any) {
      if (error.name !== 'BucketAlreadyOwnedByYou') {
        console.warn('⚠️  Could not enable encryption:', error.message);
      }
    }
    
    console.log('\n✅ S3 bucket setup complete!');
    console.log(`Bucket: ${BUCKET_NAME}`);
    console.log('All files will be stored encrypted (client-side encryption + S3 encryption)');
  } catch (error: any) {
    if (error.name === 'BucketAlreadyOwnedByYou') {
      console.log(`✅ Bucket already exists: ${BUCKET_NAME}`);
    } else {
      console.error('❌ Error setting up bucket:', error);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  setupS3Bucket();
}

export { setupS3Bucket };

