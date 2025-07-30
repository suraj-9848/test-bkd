# Authentication Troubleshooting Guide

## Quick Diagnosis

Use the new debug information in the SignIn component to identify issues:

1. Go to `http://localhost:3001/sign-in`
2. Click "Test Connection" to verify backend is running
3. Try signing in with Google
4. Click "Show Debug Information" to see detailed logs

## Common Issues & Solutions

### ❌ Backend Connection Failed (ECONNREFUSED)

**Problem**: Cannot connect to `http://localhost:3000`

**Solutions**:
```bash
# 1. Start the backend server
cd nirudhyog-backend
npm run dev

# 2. Check if port 3000 is in use
lsof -i :3000

# 3. Verify environment variables
cat .env | grep -E "(GOOGLE_CLIENT_ID|JWT_SECRET|CORS_ORIGIN)"
```

### ❌ Admin Login Returns 403 Forbidden

**Problem**: `Access denied. Admin account not found.`

**Solutions**:
```bash
# 1. Create admin user (MOST COMMON FIX)
cd nirudhyog-backend
node scripts/create-admin-user.js your-email@gmail.com "Your Name"

# 2. Check if user exists in database
# Connect to your MySQL database and run:
# SELECT email, userRole FROM users WHERE email = 'your-email@gmail.com';

# 3. Update existing user to admin
# UPDATE users SET userRole = 'admin' WHERE email = 'your-email@gmail.com';
```

### ❌ Google Token Validation Failed

**Problem**: `Invalid Google token` or authentication errors

**Solutions**:

1. **Check Google OAuth Configuration**:
   ```env
   # In nirudhyog-backend/.env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

2. **Verify Google OAuth Settings**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Check "Authorized JavaScript origins": `http://localhost:3001`
   - Check "Authorized redirect URIs": `http://localhost:3001/api/auth/callback/google`

3. **Clear Browser Cache**:
   - Clear cookies and local storage
   - Try incognito/private browsing mode

### ⚠️ Student Login Also Fails

**Problem**: Both admin and student authentication fail

**Solutions**:

1. **Check CORS Configuration**:
   ```env
   # In nirudhyog-backend/.env
   CORS_ORIGIN=http://localhost:3001,http://localhost:3002
   ```

2. **Verify Database Connection**:
   ```bash
   # Test database connection
   cd nirudhyog-backend
   npm run dev
   # Look for "MYSQL connected.." in logs
   ```

3. **Check JWT Secret**:
   ```env
   # In nirudhyog-backend/.env
   JWT_SECRET=your-long-random-secret-key-here
   ```

### 🔄 Authentication Loops or Redirects

**Problem**: Page keeps redirecting or shows loading state

**Solutions**:

1. **Clear All Tokens**:
   ```javascript
   // In browser console
   localStorage.clear();
   sessionStorage.clear();
   ```

2. **Check NextAuth Configuration**:
   ```env
   # In nirudhyog-frontend/.env.local
   NEXTAUTH_SECRET=your-nextauth-secret
   NEXTAUTH_URL=http://localhost:3001
   ```

## Environment Setup Checklist

### Backend (.env)
```env
✅ JWT_SECRET=long-random-string
✅ GOOGLE_CLIENT_ID=*.apps.googleusercontent.com
✅ GOOGLE_CLIENT_SECRET=secret
✅ CORS_ORIGIN=http://localhost:3001,http://localhost:3002
✅ MYSQL_DEV_DATABASE_URL=mysql://user:pass@localhost:3306/db
```

### Frontend (.env.local)
```env
✅ NEXTAUTH_SECRET=your-secret
✅ NEXTAUTH_URL=http://localhost:3001
✅ GOOGLE_CLIENT_ID=same-as-backend
✅ GOOGLE_CLIENT_SECRET=same-as-backend
✅ NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:3000
```

## Database Setup

### Create Admin User
```bash
# Method 1: Use the script (Recommended)
cd nirudhyog-backend
node scripts/create-admin-user.js your-email@gmail.com "Your Name"

# Method 2: Direct SQL
mysql -u root -p lms_db
INSERT INTO users (username, email, userRole, batch_id) 
VALUES ('Admin', 'your-email@gmail.com', 'admin', '[]');
```

### Verify User Creation
```sql
SELECT id, username, email, userRole FROM users WHERE email = 'your-email@gmail.com';
```

## Testing Steps

1. **Backend Health Check**:
   ```bash
   curl http://localhost:3000/ping
   # Should return: {"message":"pong"}
   ```

2. **Frontend Access**:
   - Visit: `http://localhost:3001/sign-in`
   - Click "Test Connection"
   - Should show green success message

3. **Google OAuth Test**:
   - Click "Continue with Google"
   - Complete Google sign-in
   - Check debug logs for detailed information

4. **Admin Access Test**:
   - If admin login succeeds, you should be redirected to `http://localhost:3002`
   - If student login succeeds, you should be redirected to `/student`

## Debug Tools

### Enable Debug Mode
The new SignIn component includes comprehensive debug information:
- Shows all API requests and responses
- Displays detailed error messages
- Provides step-by-step authentication flow
- Includes backend connectivity tests

### Browser Network Tab
Check the Network tab in browser dev tools for:
- Failed HTTP requests
- CORS errors
- 4xx/5xx response codes
- Missing request headers

### Backend Logs
The backend shows detailed logs for:
- Google token verification
- Database queries
- Authentication attempts
- CORS issues

## Getting Help

If you're still having issues:

1. **Collect Debug Information**:
   - Screenshot of debug logs from SignIn page
   - Backend server logs
   - Browser network tab errors

2. **Common Questions to Answer**:
   - Is the backend server running on localhost:3000?
   - Does `curl http://localhost:3000/ping` work?
   - Is the user created in the database with admin role?
   - Are Google OAuth credentials correctly configured?

3. **Test Sequence**:
   ```bash
   # Terminal 1: Start backend
   cd nirudhyog-backend && npm run dev
   
   # Terminal 2: Create admin user
   cd nirudhyog-backend
   node scripts/create-admin-user.js your-email@gmail.com "Your Name"
   
   # Terminal 3: Start frontend
   cd nirudhyog-frontend && npm run dev
   
   # Browser: Test authentication
   # Go to http://localhost:3001/sign-in
   ``` 