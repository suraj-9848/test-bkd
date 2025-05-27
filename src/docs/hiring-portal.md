# Hiring Portal Documentation

## Overview
The hiring portal module enables the LMS system to function as a job board and application management system. It allows administrators to post job openings, manage applications, and users to apply for jobs with their resumes.

## Features

### Admin Features
- Create job postings with detailed descriptions, skills, and eligibility criteria
- Edit existing job postings
- Change job status (open, closed, completed)
- View all job applications
- Update application status (applied, under review, shortlisted, rejected, hired)
- Filter jobs by organization

### User Features
- View all open job postings
- Apply for jobs with resume upload
- View status of submitted applications
- Track application history

## Database Structure

### Job Table
- id: UUID (Primary Key)
- title: String
- companyName: String
- description: Text (contains the job description)
- skills: String Array
- eligibleBranches: String Array
- status: Enum (OPEN, CLOSED, COMPLETED)
- org_id: UUID (Foreign Key to Organization, Required)
- createdAt: Date
- updatedAt: Date

### JobApplication Table
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key to User)
- job_id: UUID (Foreign Key to Job)
- resumePath: String
- status: Enum (APPLIED, UNDER_REVIEW, SHORTLISTED, REJECTED, HIRED)
- appliedAt: Date
- updatedAt: Date

## API Endpoints

### Admin Endpoints
- POST /api/admin/hiring/jobs - Create a new job
- PUT /api/admin/hiring/jobs/:jobId - Update an existing job
- DELETE /api/admin/hiring/jobs/:jobId - Delete a job
- GET /api/admin/hiring/jobs - Get all jobs (with optional org_id filter)
- GET /api/admin/hiring/jobs/:jobId - Get a single job with applications
- PUT /api/admin/hiring/applications/:applicationId/status - Update application status

### User Endpoints
- GET /api/hiring/jobs - Get all open jobs
- POST /api/hiring/jobs/:jobId/apply - Apply for a job (requires resume upload)
- GET /api/hiring/applications - Get user's job applications

## File Storage

- Resumes are stored in AWS S3 in the 'resumes' folder
- Direct S3 URLs are stored in the database for access

## Testing

For comprehensive testing of the hiring portal, refer to:
- The test script at `src/scripts/test-hiring-portal.js`
- The detailed testing guide at `src/docs/hiring-portal-testing-guide.md`

## Implementation Details
- Resume file uploads are handled using multer for processing
- File storage is managed through AWS S3
- AWS SDK is used for S3 interactions
- Field validation is performed through custom middleware
- Authentication is required for all endpoints
- Admin middleware is applied to admin endpoints
