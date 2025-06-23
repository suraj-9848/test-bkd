# Environment Variables Setup Guide

This guide explains how to set up environment variables for all three projects in this workspace.

## Quick Setup

### Backend (nirudhyog-backend)
```bash
cd nirudhyog-backend
cp env.example .env
# Edit .env with your actual values
```

### Frontend (nirudhyog-frontend)
```bash
cd nirudhyog-frontend
cp env.example .env.local
# Edit .env.local with your actual values
```

### Admin Dashboard (admin-dashboard)
```bash
cd admin-dashboard
cp env.example .env.local
# Edit .env.local with your actual values
```

## Required Environment Variables

### Backend Variables

#### Database Configuration
- `MYSQL_DEV_DATABASE_URL`: MySQL connection string for development
- `MYSQL_PROD_DATABASE_URL`: MySQL connection string for production
- `MONGO_KEY`: MongoDB connection string

#### Redis Configuration
- `REDIS_URL_DEV`: Redis connection string for development
- `REDIS_URL_PROD`: Redis connection string for production

#### JWT Configuration
- `JWT_SECRET`: Secret key for JWT tokens (must be secure and random)
- `JWT_EXPIRES_IN`: JWT token expiration time (default: 10d)
- `JWT_COOKIE_EXPIRES_IN`: JWT cookie expiration time in milliseconds

#### Google OAuth
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

#### AWS S3 Configuration
- `AWS_ACCESS_KEY_ID`: AWS access key for S3
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for S3
- `AWS_REGION`: AWS region (default: us-east-1)
- `AWS_S3_BUCKET_NAME`: S3 bucket name for file uploads

### Frontend Variables

#### API Configuration
- `NEXT_PUBLIC_API_BASE_URL`: Backend API base URL
- `NEXT_PUBLIC_BACKEND_BASE_URL`: Backend base URL

#### NextAuth Configuration
- `NEXTAUTH_SECRET`: Secret key for NextAuth (must be secure and random)
- `NEXTAUTH_URL`: Base URL for NextAuth

#### Google OAuth
- `GOOGLE_CLIENT_ID`: Google OAuth client ID (same as backend)
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret (same as backend)

### Admin Dashboard Variables

Similar to frontend but focused on admin functionality:
- `NEXT_PUBLIC_BACKEND_BASE_URL`: Backend API base URL
- `NEXTAUTH_SECRET`: Secret key for NextAuth
- `NEXTAUTH_URL`: Base URL for NextAuth
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

## GitHub Actions CI/CD

The GitHub Actions workflows include mock environment variables for CI builds:
- Mock values are used to prevent build failures in CI
- Real secrets should be configured in GitHub repository secrets for production deployments
- The workflows will build successfully with mock values for testing purposes

## Security Notes

1. **Never commit actual .env files** - they are in .gitignore for security
2. **Use strong, random secrets** for JWT and NextAuth secrets
3. **Rotate secrets regularly** in production environments
4. **Use GitHub Secrets** for production deployments
5. **Different values for dev/staging/prod** environments

## Troubleshooting

### Build Errors
If you see build errors related to missing environment variables:
1. Ensure all required variables are set
2. Check variable names match exactly (case-sensitive)
3. Restart your development server after changing .env files

### OAuth Errors
For Google OAuth setup:
1. Create a project in Google Cloud Console
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URIs
5. Use the same client ID/secret in both frontend and backend

### Database Connection Issues
1. Ensure database servers are running
2. Check connection strings are correct
3. Verify database exists and user has permissions
4. For MySQL, ensure the database is created before running the app

## Production Deployment

For production deployments:
1. Set environment variables in your hosting platform
2. Use secure, production-grade secrets
3. Enable HTTPS and update CORS origins
4. Use production database and Redis instances
5. Configure proper AWS S3 bucket policies 