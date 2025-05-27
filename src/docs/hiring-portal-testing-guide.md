# Hiring Portal Testing Guide

This guide provides instructions for testing the hiring portal functionality in the LMS backend system.

## Prerequisites

Before testing the hiring portal, make sure you have:

1. Set up the LMS backend locally
2. Configured AWS S3 credentials in your environment variables:
   ```
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_REGION=your_aws_region
   AWS_S3_BUCKET_NAME=your_s3_bucket_name
   ```
3. Created at least one organization in the system
4. Created admin and student test users

## Automated Testing

The system includes an automated test script that validates all major functionality:

```bash
node src/scripts/test-hiring-portal.js
```

This script will:
- Log in as both admin and student users
- Create a test job posting
- Retrieve job listings
- Update a job posting
- Apply for a job with a test resume
- Retrieve application history
- Update application status

You can check the console output to see if each test passes or fails.

## Manual Testing Steps

### Admin Features

1. **Login as Admin**
   - Use admin credentials to log in
   - Ensure you receive a valid JWT token

2. **Create a Job Posting**
   - Make a POST request to `/api/admin/hiring/jobs`
   - Include required fields: title, companyName, description, skills, eligibleBranches, org_id
   - Verify you receive a successful response with job details

3. **View All Jobs**
   - Make a GET request to `/api/admin/hiring/jobs`
   - Optionally filter by org_id using query parameter
   - Verify you can see all jobs including the one you created

4. **View Single Job**
   - Make a GET request to `/api/admin/hiring/jobs/:jobId`
   - Use the ID of the job you created
   - Verify you receive job details and any applications

5. **Update a Job**
   - Make a PUT request to `/api/admin/hiring/jobs/:jobId`
   - Update fields like title, description, or status
   - Verify changes are saved correctly

6. **Update Application Status**
   - Make a PUT request to `/api/admin/hiring/applications/:applicationId/status`
   - Change status (e.g., to "under_review", "shortlisted", "hired")
   - Verify status is updated correctly

7. **Delete a Job**
   - Make a DELETE request to `/api/admin/hiring/jobs/:jobId`
   - Verify job is removed from the system

### Student/User Features

1. **Login as Student**
   - Use student credentials to log in
   - Ensure you receive a valid JWT token

2. **View Open Jobs**
   - Make a GET request to `/api/hiring/jobs`
   - Verify you can see all open job listings

3. **Apply for a Job**
   - Make a POST request to `/api/hiring/jobs/:jobId/apply`
   - Include a resume file in the request (multipart/form-data)
   - Verify application is submitted successfully

4. **View Applications**
   - Make a GET request to `/api/hiring/applications`
   - Verify you can see all your submitted applications
   - Check that application status is correctly displayed

## Troubleshooting

If you encounter issues during testing:

1. **Resume Upload Failures**
   - Verify AWS S3 credentials are correctly set
   - Check that the S3 bucket exists and is accessible
   - Ensure the resume file is in PDF format

2. **Authorization Issues**
   - Verify your JWT token is valid and not expired
   - Ensure you're using the correct user type (admin/student)

3. **Missing Organizations**
   - Organizations must exist before creating jobs
   - Jobs require a valid organization ID

4. **Database Issues**
   - Check that all migrations have been run
   - Ensure the Job and JobApplication tables exist

## Edge Cases to Test

- Creating a job without a valid organization ID
- Applying for a job that's closed or completed
- Applying for the same job multiple times
- Updating application status to invalid values
- Uploading different file types for resumes

## Next Steps

After basic testing is complete, consider testing:

1. Performance with large numbers of jobs and applications
2. Concurrent applications from multiple users
3. Integration with notification systems
4. User experience flows from job posting to hiring
