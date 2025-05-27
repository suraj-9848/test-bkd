# Hiring Portal Setup and Testing Guide

This guide will help you set up, run, and test the hiring portal functionality in the LMS backend system.

## Prerequisites

Before you begin, make sure you have:

1. Node.js (v16 or higher) installed
2. pnpm installed globally (`npm install -g pnpm`)
3. AWS S3 account with proper credentials
4. A local MySQL database set up

## Environment Setup

1. Create a `.env` file in the root directory with the following variables:

```
# Database Configuration
MYSQL_DEV_DATABASE_URL=mysql://username:password@localhost:3306/lms_db

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=10d
JWT_COOKIE_EXPIRES_IN=864000000

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
AWS_S3_BUCKET_NAME=your_s3_bucket_name

# API Configuration
PORT=3000
CORS_ORIGIN=http://localhost:4000
```

## Building and Running

There are several ways to build and run the application:

### Method 1: Using pnpm scripts

```bash
# Install dependencies
pnpm i

# Build the TypeScript files
pnpm tsc

# Run the application for macOS
pnpm run mac-dev-build
```

### Method 2: Using the all-in-one script

We've created a convenient script that builds, runs, and tests the hiring portal:

```bash
# Make the script executable (if not already)
chmod +x ./scripts/hiring-portal-runner.sh

# Run the script
./scripts/hiring-portal-runner.sh
```

Or use the npm script:

```bash
pnpm run hiring:all
```

## Testing the Hiring Portal

### Automated Testing

To run the automated tests for the hiring portal:

```bash
# Make sure the server is running
pnpm run test:hiring
```

This will:
1. Check if AWS environment variables are set
2. Run the test script that exercises all API endpoints
3. Report the results

### Manual Testing

For manual testing, you can use tools like Postman or cURL to interact with the API:

#### Admin Endpoints

1. **Login as Admin**
   ```
   POST http://localhost:3000/api/auth/login
   Body: {"email": "admin@example.com", "password": "adminpassword"}
   ```

2. **Create a Job**
   ```
   POST http://localhost:3000/api/admin/hiring/jobs
   Authorization: Bearer <admin_token>
   Body: {
     "title": "Software Engineer",
     "companyName": "Tech Company",
     "description": "Job description here",
     "skills": ["JavaScript", "React"],
     "eligibleBranches": ["Computer Science"],
     "org_id": "<org_id>"
   }
   ```

3. **Get All Jobs**
   ```
   GET http://localhost:3000/api/admin/hiring/jobs
   Authorization: Bearer <admin_token>
   ```

4. **Get Job by ID**
   ```
   GET http://localhost:3000/api/admin/hiring/jobs/<job_id>
   Authorization: Bearer <admin_token>
   ```

#### User Endpoints

1. **Login as Student**
   ```
   POST http://localhost:3000/api/auth/login
   Body: {"email": "student@example.com", "password": "studentpassword"}
   ```

2. **Get Open Jobs**
   ```
   GET http://localhost:3000/api/hiring/jobs
   Authorization: Bearer <student_token>
   ```

3. **Apply for a Job**
   ```
   POST http://localhost:3000/api/hiring/jobs/<job_id>/apply
   Authorization: Bearer <student_token>
   Body: FormData with resume file
   ```

4. **Get User Applications**
   ```
   GET http://localhost:3000/api/hiring/applications
   Authorization: Bearer <student_token>
   ```

## Troubleshooting

### Common Issues

1. **S3 Upload Failures**
   - Check AWS credentials in environment variables
   - Verify bucket permissions
   - Check if the bucket exists

2. **Database Connection Issues**
   - Verify database URL in .env file
   - Check if MySQL server is running
   - Ensure database and tables exist

3. **Authentication Failures**
   - Check if JWT_SECRET is properly set
   - Verify user credentials
   - Check if token is expired

### Logs

Check the console output for detailed logs. For persistent issues, you can modify the logger configuration in `src/utils/logger.ts` to save logs to a file.

## Next Steps

After successfully setting up and testing the hiring portal, you can:

1. Customize the job and application models
2. Implement additional features like search or filtering
3. Add email notifications for application status changes
4. Create a frontend interface to interact with the API
