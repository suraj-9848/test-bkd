# Hiring Portal Implementation Guide

## Overview

This document outlines the implementation details and testing procedures for the hiring portal in the LMS backend system.

## Architecture

The hiring portal follows a standard MVC architecture:

1. **Models**: Job and JobApplication entities with relationships to User and Org
2. **Controllers**: Separate controllers for admin and user operations
3. **Routes**: Dedicated route handlers for admin and user endpoints
4. **Middleware**: Validation middleware for job creation and application submission
5. **Services**: S3 service for resume storage

## Key Features Implemented

### Admin Features
- Create, read, update, and delete job postings
- View all job applications
- Update application statuses (applied → under_review → shortlisted/rejected → hired)
- Filter jobs by organization

### Student/User Features
- View all open job postings
- Apply for jobs with resume upload
- Track application status and history

## Testing Guide

### Prerequisites
- LMS backend server running
- MySQL database configured
- AWS S3 bucket set up for resume storage
- Test admin and student user accounts

### Step 1: Setting Up Test Environment

1. Configure environment variables for AWS S3:
   ```
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_REGION=your_region
   AWS_S3_BUCKET_NAME=your_bucket_name
   ```

2. Ensure at least one organization exists in the database.

### Step 2: Running Automated Tests

We've created a comprehensive test script that validates all hiring portal functionality:

```bash
# Run from project root
npm run test:hiring
```

This will execute all tests and show results in the console.

### Step 3: Manual Testing Procedure

#### Admin Workflows

1. **Create Job**
   - Log in as an admin user
   - Create a new job posting with mandatory org_id
   - Verify the job appears in the admin job list

2. **Manage Jobs**
   - Edit job details
   - Update job status (open/closed/completed)
   - Delete a job posting

3. **Process Applications**
   - View applications for a specific job
   - Update application statuses
   - Verify status transitions are working correctly

#### Student Workflows

1. **Browse Jobs**
   - Log in as a student user
   - View all open job listings
   - Verify organization details are displayed

2. **Apply for Jobs**
   - Apply for a job with resume upload
   - Verify application is recorded
   - Test duplicate application prevention

3. **Track Applications**
   - View all submitted applications
   - Check application status updates
   - Verify resume links are working

## Error Handling Improvements

We've implemented comprehensive error handling throughout the hiring portal:

1. **Validation Errors**
   - Clear error messages for missing required fields
   - Detailed validation for job parameters
   - Resume file type validation

2. **Database Errors**
   - Graceful handling of database connection issues
   - Proper error responses with detailed messages

3. **S3 Upload Errors**
   - Handling of S3 service unavailability
   - Resume upload validation and error reporting

4. **Status Transition Errors**
   - Prevention of invalid application status transitions
   - Validation of status values

## API Response Format

All API responses now follow a consistent format:

```json
{
  "message": "Human-readable message",
  "details": "Optional detailed explanation (for errors)",
  "success": true/false,
  "data": { /* Response data */ }
}
```

## Future Enhancements

1. **Search and Filtering**
   - Implement search by skills or keywords
   - Add filtering by job type, location, etc.

2. **Notifications**
   - Email notifications for status changes
   - Application reminders and updates

3. **Analytics**
   - Application tracking metrics
   - Job posting performance statistics

4. **UI Improvements**
   - Rich text editor for job descriptions
   - Multi-file resume/portfolio uploads

## Troubleshooting

### Common Issues

1. **Resume Upload Failures**
   - Check S3 bucket permissions
   - Verify AWS credentials are correctly set
   - Ensure file size is within limits

2. **Missing Organization Error**
   - Create an organization first
   - Verify org_id is valid

3. **Invalid Status Transitions**
   - Follow the correct status flow
   - Check for typos in status values

### Testing Support

For any issues during testing, please refer to:
- The detailed logs in the server console
- The S3 service configuration
- Database connection status

## Building and Running

To build and run the hiring portal as part of the LMS backend:

```bash
# Install dependencies
pnpm i

# Build TypeScript
pnpm tsc

# Run for macOS
pnpm run mac-dev-build
```

We've also created a comprehensive script that builds, runs, and tests the hiring portal in one go:

```bash
# Run the all-in-one script
./scripts/hiring-portal-runner.sh

# Or use npm script
pnpm run hiring:all
```

## Conclusion

The hiring portal implementation provides a robust platform for job posting and application management. With comprehensive error handling and detailed responses, it offers a reliable experience for both administrators and students.
