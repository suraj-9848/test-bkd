// Script to test the hiring portal functionality
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';
let adminToken = '';
let studentToken = '';
let jobId = '';
let applicationId = '';

async function login(email, password) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email,
      password
    });
    return response.data.token;
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function createJob(token) {
  try {
    // First, get an organization ID
    const orgsResponse = await axios.get(`${BASE_URL}/admin/organizations`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const organizations = orgsResponse.data.organizations || [];
    if (organizations.length === 0) {
      throw new Error('No organizations found. Please create an organization first.');
    }
    
    const org_id = organizations[0].id;
    console.log(`Using organization ID: ${org_id}`);
    
    const jobData = {
      title: 'Software Engineer',
      companyName: 'Tech Innovations Inc.',
      description: 'We are looking for a talented software engineer to join our team.',
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
      eligibleBranches: ['Computer Science', 'Information Technology'],
      org_id: org_id // Now mandatory
    };

    const response = await axios.post(`${BASE_URL}/admin/hiring/jobs`, jobData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Job created successfully:', response.data.job.id);
    return response.data.job.id;
  } catch (error) {
    console.error('Job creation failed:', error.response?.data || error.message);
    throw error;
  }
}

async function getAllJobs(token, isAdmin = false) {
  try {
    const endpoint = isAdmin ? `${BASE_URL}/admin/hiring/jobs` : `${BASE_URL}/hiring/jobs`;
    const response = await axios.get(endpoint, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Retrieved ${response.data.jobs.length} jobs`);
    return response.data.jobs;
  } catch (error) {
    console.error('Failed to fetch jobs:', error.response?.data || error.message);
    throw error;
  }
}

async function getJobById(token, jobId) {
  try {
    const response = await axios.get(`${BASE_URL}/admin/hiring/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Job details retrieved:', response.data.job.title);
    return response.data.job;
  } catch (error) {
    console.error('Failed to fetch job details:', error.response?.data || error.message);
    throw error;
  }
}

async function applyForJob(token, jobId, resumePath) {
  try {
    const form = new FormData();
    form.append('resume', fs.createReadStream(resumePath));
    
    const response = await axios.post(`${BASE_URL}/hiring/jobs/${jobId}/apply`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Job application submitted:', response.data.application.id);
    return response.data.application.id;
  } catch (error) {
    console.error('Job application failed:', error.response?.data || error.message);
    throw error;
  }
}

async function getUserApplications(token) {
  try {
    const response = await axios.get(`${BASE_URL}/hiring/applications`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Retrieved ${response.data.applications.length} applications`);
    return response.data.applications;
  } catch (error) {
    console.error('Failed to fetch user applications:', error.response?.data || error.message);
    throw error;
  }
}

async function updateApplicationStatus(token, applicationId, status) {
  try {
    const response = await axios.put(`${BASE_URL}/admin/hiring/applications/${applicationId}/status`, 
      { status },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('Application status updated to:', response.data.application.status);
    return response.data.application;
  } catch (error) {
    console.error('Failed to update application status:', error.response?.data || error.message);
    throw error;
  }
}

async function updateJob(token, jobId, updates) {
  try {
    const response = await axios.put(`${BASE_URL}/admin/hiring/jobs/${jobId}`, updates, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Job updated successfully:', response.data.job.title);
    return response.data.job;
  } catch (error) {
    console.error('Job update failed:', error.response?.data || error.message);
    throw error;
  }
}

async function runTests() {
  try {
    console.log('=== STARTING HIRING PORTAL TESTS ===');
    
    // Login as admin and student
    console.log('\n1. Login Tests:');
    try {
      adminToken = await login('admin@gmail.com', 'Password@123');
      console.log('✅ Admin login successful');
    } catch (error) {
      console.error('❌ Admin login failed:', error.message);
      return;
    }
    
    try {
      studentToken = await login('test@gmail.com', 'Password@123');
      console.log('✅ Student login successful');
    } catch (error) {
      console.error('❌ Student login failed:', error.message);
      return;
    }
    
    // Test job creation
    console.log('\n2. Job Creation Test:');
    try {
      jobId = await createJob(adminToken);
      console.log('✅ Job creation successful');
    } catch (error) {
      console.error('❌ Job creation failed:', error.message);
      // Continue with other tests even if job creation fails
    }
    
    // Test getting all jobs
    console.log('\n3. Get All Jobs Test:');
    try {
      const adminJobs = await getAllJobs(adminToken, true);
      console.log(`✅ Retrieved ${adminJobs.length} jobs as admin`);
    } catch (error) {
      console.error('❌ Failed to get jobs as admin:', error.message);
    }
    
    // Test getting open jobs
    console.log('\n4. Get Open Jobs Test:');
    try {
      const studentJobs = await getAllJobs(studentToken, false);
      console.log(`✅ Retrieved ${studentJobs.length} open jobs as student`);
    } catch (error) {
      console.error('❌ Failed to get open jobs as student:', error.message);
    }
    
    // Test getting job by ID
    console.log('\n5. Get Job By ID Test:');
    try {
      if (jobId) {
        const job = await getJobById(adminToken, jobId);
        console.log(`✅ Successfully retrieved job: ${job.title}`);
      } else {
        console.log('⚠️ Skipping job details test - no job ID available');
      }
    } catch (error) {
      console.error('❌ Failed to get job details:', error.message);
    }
    
    // Test job update
    console.log('\n6. Update Job Test:');
    try {
      if (jobId) {
        const updatedJob = await updateJob(adminToken, jobId, {
          title: 'Senior Software Engineer',
          description: 'Updated job description with more details'
        });
        console.log(`✅ Successfully updated job to: ${updatedJob.title}`);
      } else {
        console.log('⚠️ Skipping job update test - no job ID available');
      }
    } catch (error) {
      console.error('❌ Failed to update job:', error.message);
    }
    
    // Test job application
    console.log('\n7. Job Application Test:');
    try {
      // Create a sample resume file
      const resumeDir = path.join(__dirname, '../../uploads/resumes');
      if (!fs.existsSync(resumeDir)) {
        fs.mkdirSync(resumeDir, { recursive: true });
      }
      
      const sampleResumePath = path.join(resumeDir, 'sample_resume.pdf');
      if (!fs.existsSync(sampleResumePath)) {
        fs.writeFileSync(sampleResumePath, 'Sample Resume Content');
      }
      
      if (jobId) {
        applicationId = await applyForJob(studentToken, jobId, sampleResumePath);
        console.log(`✅ Successfully applied for job, application ID: ${applicationId}`);
      } else {
        console.log('⚠️ Skipping job application test - no job ID available');
      }
    } catch (error) {
      console.error('❌ Failed to apply for job:', error.message);
    }
    
    // Test getting user applications
    console.log('\n8. Get User Applications Test:');
    try {
      const applications = await getUserApplications(studentToken);
      console.log(`✅ Successfully retrieved ${applications.length} user applications`);
    } catch (error) {
      console.error('❌ Failed to get user applications:', error.message);
    }
    
    // Test updating application status
    console.log('\n9. Update Application Status Test:');
    try {
      if (applicationId) {
        await updateApplicationStatus(adminToken, applicationId, 'under_review');
        console.log('✅ Successfully updated application status to under_review');
        
        await updateApplicationStatus(adminToken, applicationId, 'shortlisted');
        console.log('✅ Successfully updated application status to shortlisted');
      } else {
        console.log('⚠️ Skipping application status update test - no application ID available');
      }
    } catch (error) {
      console.error('❌ Failed to update application status:', error.message);
    }
    
    console.log('\n=== ALL TESTS COMPLETED ===');
  } catch (error) {
    console.error('Test suite failed:', error.message);
  }
}

runTests();
