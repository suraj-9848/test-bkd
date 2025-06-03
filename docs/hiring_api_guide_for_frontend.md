## Hiring Portal Backend API Guide for Frontend Integration

This document outlines the backend API endpoints for the hiring portal functionality.

**Base API URL:** The backend is expected to be running on a specific host and port (e.g., `http://localhost:3000`). All API paths below are relative to this base URL.

### Public Endpoints (No Authentication Required)

1.  **Get Open Jobs**
    *   **Description:** Fetches a list of all jobs currently marked as "open".
    *   **Endpoint:** `GET /api/hiring/jobs`
    *   **Request Body:** None
    *   **Response (Success 200):**
        ```json
        {
          "message": "Open jobs retrieved successfully",
          "jobs": [
            {
              "id": "job_uuid_1",
              "title": "Software Engineer Intern",
              "companyName": "Tech Solutions Inc.",
              "description": "Exciting internship opportunity...",
              "location": "Remote",
              "skills": ["JavaScript", "React", "Node.js"],
              "eligibleBranches": ["CS", "IT"],
              "status": "open",
              "postedAt": "2024-05-01T10:00:00.000Z"
            }
            // ... more jobs
          ],
          "count": 1, // number of jobs
          "success": true
        }
        ```

2.  **Apply for a Job**
    *   **Description:** Allows anyone (logged in or not) to apply for a specific job by submitting their resume.
    *   **Endpoint:** `POST /api/hiring/jobs/:jobId/apply`
    *   **URL Parameters:**
        *   `jobId`: The UUID of the job to apply for.
    *   **Request Type:** `multipart/form-data`
    *   **Form Fields:**
        *   `resume`: The resume file (PDF format required).
        *   `applicantName` (Optional but recommended): String, name of the applicant.
        *   `applicantEmail` (Optional but recommended): String, email of the applicant.
    *   **Response (Success 201):**
        ```json
        {
          "message": "Job application submitted successfully",
          "application": {
            "id": "application_uuid",
            "job_id": "job_uuid_1",
            "user_id": null, // null for anonymous applicants
            "status": "applied", // initial status
            "resumePath": "s3_path_to_resume.pdf",
            "appliedAt": "2024-05-15T12:00:00.000Z"
          },
          "success": true
        }
        ```

---

### Authentication Endpoints (If Needed)

*   **Login:**
    *   **Endpoint:** `POST /api/auth/login`
    *   **Request Body:** `{ "email": "user@example.com", "password": "password123" }`
    *   **Response (Success):**
        ```json
        {
          "message": "Login successful",
          "token": "your_jwt_token_here",
          "user": {
            "id": "user_uuid",
            "username": "testuser",
            "email": "user@example.com",
            "userRole": "student" // or "admin"
          }
        }
        ```
*   **Registration:**
    *   **Endpoint:** `POST /api/auth/register`
    *   **Request Body:** `{ "username": "newuser", "email": "new@example.com", "password": "password123", "firstName": "New", "lastName": "User" }` (other fields like `userRole` might be set by default or based on registration type)
    *   **Response (Success):** Similar to login, providing a token and user details.

---

### Authenticated Endpoints (Require JWT Token)

For these endpoints, include your JWT token in the `Authorization` header:
`Authorization: Bearer <your_jwt_token_here>`

**Student Role Endpoints:**

1.  **Get Applications of a Student**
    *   **Description:** Fetches a list of all job applications submitted by the currently authenticated student.
    *   **Endpoint:** `GET /api/hiring/applications`
    *   **Request Body:** None
    *   **Response (Success 200):**
        ```json
        {
          "message": "Your applications retrieved successfully",
          "applications": [
            {
              "id": "application_uuid_1",
              "status": "applied",
              "appliedAt": "2024-05-15T12:00:00.000Z",
              "updatedAt": "2024-05-15T12:00:00.000Z",
              "resumePath": "s3_path_to_resume.pdf",
              "job": { // Details of the job applied for
                "id": "job_uuid_1",
                "title": "Software Engineer Intern",
                "companyName": "Tech Solutions Inc."
              }
            }
            // ... more applications
          ],
          "count": 1,
          "success": true
        }
        ```

**Admin Role Endpoints:**

1.  **Get All Jobs (Admin View)**
    *   **Description:** Fetches a list of all jobs, regardless of status.
    *   **Endpoint:** `GET /api/admin/hiring/jobs`
    *   **Response (Success 200):** Similar to student's "Get Open Jobs" but includes all jobs.
        
2.  **Create a New Job**
    *   **Description:** Allows an admin to create a new job posting.
    *   **Endpoint:** `POST /api/admin/hiring/jobs`
    *   **Request Body (JSON):**
        ```json
        {
          "title": "Senior Developer",
          "companyName": "Innovatech",
          "description": "Lead a team of developers...",
          "location": "New York, NY",
          "skills": ["Java", "Spring Boot", "AWS"],
          "eligibleBranches": ["CS", "SE"],
          "org_id": "org_uuid_representing_the_company_posting"
          // "status": "open" // Optional, might default
        }
        ```
    *   **Response (Success 201):** The created job object.
        
3.  **Update an Existing Job**
    *   **Description:** Allows an admin to update details of an existing job.
    *   **Endpoint:** `PUT /api/admin/hiring/jobs/:jobId`
    *   **URL Parameters:**
        *   `jobId`: The UUID of the job to update.
    *   **Request Body (JSON):** Contains fields to be updated.
        
4.  **Delete a Job**
    *   **Description:** Allows an admin to delete a job posting.
    *   **Endpoint:** `DELETE /api/admin/hiring/jobs/:jobId`
    *   **URL Parameters:**
        *   `jobId`: The UUID of the job to delete.
        
5.  **Get Applications for a Specific Job (Admin View)**
    *   **Description:** Fetches all applications submitted for a particular job.
    *   **Endpoint:** `GET /api/admin/hiring/jobs/:jobId/applications`
    *   **URL Parameters:**
        *   `jobId`: The UUID of the job.
        
6.  **Update Application Status**
    *   **Description:** Allows an admin to change the status of a job application (e.g., shortlist, reject).
    *   **Endpoint:** `PUT /api/admin/hiring/applications/:applicationId/status`
    *   **URL Parameters:**
        *   `applicationId`: The UUID of the application to update.
    *   **Request Body (JSON):**
        ```json
        {
          "status": "shortlisted" // New status
        }
        ```

---

**General Error Response Format:**

If an error occurs (e.g., validation error, not found, server error), the API will typically respond with an appropriate status code (4xx or 5xx) and a JSON body like:

```json
{
  "message": "Error message summary",
  "details": "More specific details about the error, or validation errors", // Can be a string or an object/array
  "success": false
}
```

**Known Issues:**

- **MySQL Connection:** If you encounter MYSQL connection errors (ETIMEDOUT), make sure your MySQL server is running and accessible at the URL specified in your environment variables.
