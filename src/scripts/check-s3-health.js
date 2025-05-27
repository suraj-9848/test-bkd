// Script to check S3 connection health
const { s3Service } = require('../utils/s3Service');

async function checkS3Health() {
  console.log('Checking S3 connection health...');
  
  try {
    // Check if AWS credentials are set
    if (!process.env.AWS_ACCESS_KEY_ID || 
        !process.env.AWS_SECRET_ACCESS_KEY || 
        !process.env.AWS_REGION || 
        !process.env.AWS_S3_BUCKET_NAME) {
      console.error('❌ Missing AWS environment variables');
      console.log('Please set the following environment variables:');
      console.log('  - AWS_ACCESS_KEY_ID');
      console.log('  - AWS_SECRET_ACCESS_KEY');
      console.log('  - AWS_REGION');
      console.log('  - AWS_S3_BUCKET_NAME');
      return false;
    }
    
    // Try to list objects in the bucket (with a limit of 1)
    // This is a lightweight operation to verify connectivity
    await s3Service.testConnection();
    
    console.log('✅ S3 connection successful');
    console.log(`Connected to bucket: ${process.env.AWS_S3_BUCKET_NAME}`);
    console.log(`Region: ${process.env.AWS_REGION}`);
    return true;
  } catch (error) {
    console.error('❌ S3 connection failed:', error.message);
    console.log('Please check your AWS credentials and permissions.');
    return false;
  }
}

// Execute the check if this script is run directly
if (require.main === module) {
  checkS3Health().then(isHealthy => {
    if (!isHealthy) {
      process.exit(1);
    }
  });
}

module.exports = { checkS3Health };
