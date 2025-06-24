import swaggerJsdoc from "swagger-jsdoc";
import { config } from "../config";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Nirudhyog Backend API",
      version: "1.0.0",
      description:
        "API documentation for Nirudhyog Backend - A comprehensive learning management and hiring platform",
      contact: {
        name: "API Support",
        email: "support@nirudhyog.com",
      },
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === "production"
            ? "https://api.nirudhyog.com"
            : `http://localhost:${config.PORT}`,
        description:
          process.env.NODE_ENV === "production"
            ? "Production server"
            : "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "token",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message",
            },
            message: {
              type: "string",
              description: "Error message",
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "User ID",
            },
            email: {
              type: "string",
              format: "email",
              description: "User email address",
            },
            username: {
              type: "string",
              description: "Username",
            },
            userRole: {
              type: "string",
              enum: ["student", "instructor", "admin"],
              description: "User role",
            },
            batch_id: {
              type: "array",
              items: { type: "string" },
              description: "Batch IDs associated with user",
            },
            org_id: {
              type: "string",
              description: "Organization ID",
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "User email",
            },
            password: {
              type: "string",
              description: "User password",
            },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["username", "email", "password"],
          properties: {
            username: {
              type: "string",
              description: "Username",
            },
            email: {
              type: "string",
              format: "email",
              description: "User email",
            },
            password: {
              type: "string",
              description:
                "Password (min 8 chars, must include uppercase, lowercase, number, special char)",
            },
          },
        },
        Course: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Course ID",
            },
            title: {
              type: "string",
              description: "Course title",
            },
            description: {
              type: "string",
              description: "Course description",
            },
            duration: {
              type: "number",
              description: "Course duration in hours",
            },
          },
        },
        Job: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Job ID",
            },
            title: {
              type: "string",
              description: "Job title",
            },
            description: {
              type: "string",
              description: "Job description",
            },
            company: {
              type: "string",
              description: "Company name",
            },
            location: {
              type: "string",
              description: "Job location",
            },
            salary: {
              type: "number",
              description: "Job salary",
            },
            requirements: {
              type: "string",
              description: "Job requirements",
            },
            status: {
              type: "string",
              enum: ["open", "closed"],
              description: "Job status",
            },
          },
        },
        JobApplication: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Application ID",
            },
            jobId: {
              type: "string",
              description: "Job ID",
            },
            applicantName: {
              type: "string",
              description: "Applicant name",
            },
            applicantEmail: {
              type: "string",
              format: "email",
              description: "Applicant email",
            },
            resumeUrl: {
              type: "string",
              description: "Resume file URL",
            },
            status: {
              type: "string",
              enum: ["pending", "reviewed", "accepted", "rejected"],
              description: "Application status",
            },
            appliedAt: {
              type: "string",
              format: "date-time",
              description: "Application submission date",
            },
          },
        },
        Module: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Module ID",
            },
            title: {
              type: "string",
              description: "Module title",
            },
            description: {
              type: "string",
              description: "Module description",
            },
            courseId: {
              type: "string",
              description: "Course ID this module belongs to",
            },
          },
        },
        Test: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Test ID",
            },
            title: {
              type: "string",
              description: "Test title",
            },
            description: {
              type: "string",
              description: "Test description",
            },
            duration: {
              type: "number",
              description: "Test duration in minutes",
            },
            totalMarks: {
              type: "number",
              description: "Total marks for the test",
            },
          },
        },
      },
    },
    paths: {
      "/": {
        get: {
          summary: "Health check",
          description: "Check if the API is running",
          responses: {
            "200": {
              description: "API is running",
              content: {
                "text/plain": {
                  schema: {
                    type: "string",
                    example: "App is running",
                  },
                },
              },
            },
          },
        },
      },
      "/ping": {
        get: {
          summary: "Ping endpoint",
          description: "Ping endpoint for testing",
          responses: {
            "200": {
              description: "Pong response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: {
                        type: "string",
                        example: "pong",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/register": {
        post: {
          tags: ["Authentication"],
          summary: "Register a new user",
          description: "Create a new user account",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/RegisterRequest",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "User registered successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: {
                        type: "string",
                        example: "User registered successfully",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Bad request",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "500": {
              description: "Internal server error",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Authentication"],
          summary: "User login",
          description: "Authenticate user and return JWT token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/LoginRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Login successful",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: {
                        type: "string",
                        example: "Login successful",
                      },
                      token: {
                        type: "string",
                        description: "JWT token",
                      },
                      user: {
                        $ref: "#/components/schemas/User",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Bad request",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "401": {
              description: "Invalid credentials",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "404": {
              description: "User not found",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Authentication"],
          summary: "User logout",
          description: "Logout user and clear authentication cookie",
          responses: {
            "200": {
              description: "Logged out successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: {
                        type: "string",
                        example: "Logged out successfully",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Authentication"],
          summary: "Get current user",
          description: "Get currently authenticated user information",
          security: [
            {
              cookieAuth: [],
            },
          ],
          responses: {
            "200": {
              description: "User information",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: {
                        $ref: "#/components/schemas/User",
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/api/hiring/test": {
        get: {
          tags: ["Hiring - Public"],
          summary: "Test hiring public endpoint",
          description: "Test endpoint for hiring public routes",
          responses: {
            "200": {
              description: "Test successful",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: {
                        type: "string",
                        example: "Public test route works!",
                      },
                      success: {
                        type: "boolean",
                        example: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/hiring/jobs": {
        get: {
          tags: ["Hiring - Public"],
          summary: "Get all open jobs",
          description: "Retrieve all open job positions",
          responses: {
            "200": {
              description: "List of open jobs",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/Job",
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/hiring/jobs/{jobId}": {
        get: {
          tags: ["Hiring - Public"],
          summary: "Get job by ID",
          description: "Retrieve a specific job by its ID",
          parameters: [
            {
              name: "jobId",
              in: "path",
              required: true,
              schema: {
                type: "string",
              },
              description: "Job ID",
            },
          ],
          responses: {
            "200": {
              description: "Job details",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Job",
                  },
                },
              },
            },
            "404": {
              description: "Job not found",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/api/hiring/jobs/{jobId}/apply": {
        post: {
          tags: ["Hiring - Public"],
          summary: "Apply for a job",
          description: "Submit job application with resume",
          parameters: [
            {
              name: "jobId",
              in: "path",
              required: true,
              schema: {
                type: "string",
              },
              description: "Job ID",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    applicantName: {
                      type: "string",
                      description: "Applicant name",
                    },
                    applicantEmail: {
                      type: "string",
                      format: "email",
                      description: "Applicant email",
                    },
                    resume: {
                      type: "string",
                      format: "binary",
                      description: "Resume PDF file (max 10MB)",
                    },
                  },
                  required: ["applicantName", "applicantEmail", "resume"],
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Application submitted successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/JobApplication",
                  },
                },
              },
            },
            "400": {
              description: "Bad request",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/api/student/courses": {
        get: {
          tags: ["Student"],
          summary: "Get student courses",
          description: "Get all courses for the authenticated student",
          security: [
            {
              cookieAuth: [],
            },
          ],
          responses: {
            "200": {
              description: "List of student courses",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/Course",
                    },
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/api/student/tests": {
        get: {
          tags: ["Student"],
          summary: "Get student tests",
          description: "Get all tests available for the authenticated student",
          security: [
            {
              cookieAuth: [],
            },
          ],
          responses: {
            "200": {
              description: "List of student tests",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/Test",
                    },
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/hiring/jobs": {
        post: {
          tags: ["Admin - Hiring"],
          summary: "Create new job",
          description: "Create a new job posting (Admin only)",
          security: [
            {
              cookieAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "Job title",
                    },
                    description: {
                      type: "string",
                      description: "Job description",
                    },
                    company: {
                      type: "string",
                      description: "Company name",
                    },
                    location: {
                      type: "string",
                      description: "Job location",
                    },
                    salary: {
                      type: "number",
                      description: "Job salary",
                    },
                    requirements: {
                      type: "string",
                      description: "Job requirements",
                    },
                  },
                  required: ["title", "description", "company"],
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Job created successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Job",
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "403": {
              description: "Forbidden - Admin access required",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
        get: {
          tags: ["Admin - Hiring"],
          summary: "Get all jobs (Admin)",
          description:
            "Get all job postings including closed ones (Admin only)",
          security: [
            {
              cookieAuth: [],
            },
          ],
          responses: {
            "200": {
              description: "List of all jobs",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/Job",
                    },
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/hiring/applications": {
        get: {
          tags: ["Admin - Hiring"],
          summary: "Get all applications",
          description: "Get all job applications with details (Admin only)",
          security: [
            {
              cookieAuth: [],
            },
          ],
          responses: {
            "200": {
              description: "List of all applications",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/JobApplication",
                    },
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/create-course": {
        post: {
          tags: ["Admin"],
          summary: "Create new course",
          description: "Create a new course (Admin only)",
          security: [
            {
              cookieAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "Course title",
                    },
                    description: {
                      type: "string",
                      description: "Course description",
                    },
                  },
                  required: ["title", "description"],
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Course created successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Course",
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/fetch-all-courses": {
        get: {
          tags: ["Admin"],
          summary: "Get all courses",
          description: "Get all courses (Admin only)",
          security: [
            {
              cookieAuth: [],
            },
          ],
          responses: {
            "200": {
              description: "List of all courses",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/Course",
                    },
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/api/instructor/batches": {
        get: {
          tags: ["Instructor"],
          summary: "Get all batches",
          description: "Get all batches for the instructor",
          security: [
            {
              cookieAuth: [],
            },
          ],
          responses: {
            "200": {
              description: "List of batches",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          description: "Batch ID",
                        },
                        name: {
                          type: "string",
                          description: "Batch name",
                        },
                        description: {
                          type: "string",
                          description: "Batch description",
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Instructor"],
          summary: "Create new batch",
          description: "Create a new batch (Instructor only)",
          security: [
            {
              cookieAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Batch name",
                    },
                    description: {
                      type: "string",
                      description: "Batch description",
                    },
                  },
                  required: ["name"],
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Batch created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        description: "Batch ID",
                      },
                      name: {
                        type: "string",
                        description: "Batch name",
                      },
                      description: {
                        type: "string",
                        description: "Batch description",
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/api/courseProgress/updateCourseProgress": {
        post: {
          tags: ["Course Progress"],
          summary: "Update course progress",
          description: "Update student course progress",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    courseId: {
                      type: "string",
                      description: "Course ID",
                    },
                    progress: {
                      type: "number",
                      description: "Progress percentage",
                    },
                  },
                  required: ["courseId", "progress"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Progress updated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: {
                        type: "string",
                        example: "Progress updated successfully",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Bad request",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication and authorization",
      },
      {
        name: "Hiring - Public",
        description: "Public hiring portal endpoints (no auth required)",
      },
      {
        name: "Hiring - User",
        description: "User hiring portal endpoints (auth required)",
      },
      {
        name: "Admin - Hiring",
        description: "Admin hiring management endpoints",
      },
      {
        name: "Student",
        description: "Student learning management endpoints",
      },
      {
        name: "Instructor",
        description: "Instructor management endpoints",
      },
      {
        name: "Admin",
        description: "Administrative endpoints",
      },
      {
        name: "Course Progress",
        description: "Course progress tracking endpoints",
      },
    ],
  },
  apis: ["./src/routes/**/*.ts", "./src/controllers/**/*.ts"],
};

export const specs = swaggerJsdoc(options);
