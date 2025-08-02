# LMS Hiring Portal

## Overview

The hiring portal is an integrated module within the LMS backend system that enables job posting, application management, and resume handling. It serves as a platform for connecting students with potential employers through the LMS system.

## Features

### Admin Features

- Create and manage job postings
- View all applications for each job
- Update application statuses (applied, under review, shortlisted, rejected, hired)
- Filter and search job listings
- Associate jobs with organizations (mandatory)

### Student/User Features

- Browse open job postings
- Apply for jobs with resume upload
- Track application status
- View application history

## API Endpoints

### Admin Endpoints (Requires Admin Authentication)

#### Job Management
- `POST /api/admin/hiring/jobs` - Create a new job
- `PUT /api/admin/hiring/jobs/:jobId` - Update an existing job
- `DELETE /api/admin/hiring/jobs/:jobId` - Delete a job
- `GET /api/admin/hiring/jobs` - Get all jobs (with optional org_id filter)
- `GET /api/admin/hiring/jobs/:jobId` - Get a single job with applications

#### Application Management
- `PUT /api/admin/hiring/applications/:applicationId/status` - Update application status

### Student/User Endpoints (Requires User Authentication)

- `GET /api/hiring/jobs` - Get all open jobs
- `POST /api/hiring/jobs/:jobId/apply` - Apply for a job (requires resume upload)
- `GET /api/hiring/applications` - Get user's job applications

## File Storage

The hiring portal uses AWS S3 for storing resumes:

- Resumes are stored in a dedicated 'resumes' folder in the configured S3 bucket
- File naming follows a pattern: `user_[userId]_[timestamp]_[random].[extension]`
- Direct S3 URLs are stored in the database for secure access

## Required Environment Variables

```
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
AWS_S3_BUCKET_NAME=your_s3_bucket_name
```

## Testing

A test script is provided at `src/scripts/test-hiring-portal.js` to verify all functionality. 
To run the tests:

```bash
node src/scripts/test-hiring-portal.js
```

Make sure to set the `API_URL` environment variable if your API is not running at the default location.

## Database Models

### Job Model
- Basic job details (title, company, description)
- Skills and eligibility requirements
- Status tracking (open, closed, completed)
- Mandatory organization association

### JobApplication Model
- Links users to jobs
- Stores resume S3 URL
- Tracks application status
- Records application timestamps

## Development

When extending the hiring portal functionality, make sure to:

1. Maintain proper authentication and authorization
2. Validate all input parameters
3. Handle file uploads securely
4. Follow error handling patterns
5. Update documentation when adding new features

## Additional Documentation

For more detailed information, refer to these guides:

1. [Hiring Portal Testing Guide](./hiring-portal-testing-guide.md) - Comprehensive guide for testing all features
2. [Hiring Portal Setup Guide](./hiring-portal-setup-guide.md) - Instructions for setting up and running the portal
3. [Hiring Portal Implementation Guide](./hiring-portal.md) - Technical details about the implementation

## Pending Items and Future Enhancements

The current implementation has a few items pending completion:

1.  Organization ID validation is now mandatory for job creation
2. ⏳ Complete comprehensive testing of all implemented functionalities
3. 🔄 Potential enhancements to consider:
   - Search functionality for jobs by skills or keywords
   - Pagination for job listings and applications
   - Email notifications for application status changes
   - Analytics dashboard for job posting performance
   - Resume parsing for candidate skill extraction
