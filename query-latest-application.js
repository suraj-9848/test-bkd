const mysql = require('mysql2/promise');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  limit: 1,
  status: null,
  email: null
};

// Process command line arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && i + 1 < args.length) {
    options.limit = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--status' && i + 1 < args.length) {
    options.status = args[i + 1];
    i++;
  } else if (args[i] === '--email' && i + 1 < args.length) {
    options.email = args[i + 1];
    i++;
  } else if (args[i] === '--help') {
    console.log(`
Job Application Query Tool

Usage:
  node query-latest-application.js [options]

Options:
  --limit <number>    Number of applications to return (default: 1)
  --status <status>   Filter by application status (applied, under_review, shortlisted, rejected, hired)
  --email <email>     Filter by applicant email
  --help              Show this help message

Examples:
  node query-latest-application.js
  node query-latest-application.js --limit 5
  node query-latest-application.js --status applied
  node query-latest-application.js --email example@gmail.com
    `);
    process.exit(0);
  }
}

async function queryJobApplications(options) {
  // Using the MYSQL_DEV_DATABASE_URL environment variable
  let connection;
  try {
    if (process.env.MYSQL_DEV_DATABASE_URL) {
      // Use the connection URL if available
      connection = await mysql.createConnection(process.env.MYSQL_DEV_DATABASE_URL);
      console.log('Connected to database using connection URL');
    } else {
      // Fallback to individual parameters
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USERNAME || 'trialbliz',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'lms_db'
      });
      console.log('Connected to database using individual parameters');
    }
    
    // Build the WHERE clause based on options
    const whereConditions = [];
    const queryParams = [];
    
    if (options.status) {
      whereConditions.push('ja.status = ?');
      queryParams.push(options.status);
    }
    
    if (options.email) {
      whereConditions.push('ja.applicantEmail = ?');
      queryParams.push(options.email);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    console.log(`Querying for job applications${options.limit > 1 ? ` (limit: ${options.limit})` : ''}...`);
    if (options.status) console.log(`Status filter: ${options.status}`);
    if (options.email) console.log(`Email filter: ${options.email}`);
    
    // Build and execute the query
    const query = `
      SELECT 
        ja.id, 
        ja.job_id, 
        ja.applicantName, 
        ja.applicantEmail, 
        ja.college, 
        ja.graduationYear, 
        ja.branch, 
        ja.skills, 
        ja.status, 
        ja.resumePath,
        DATE_FORMAT(ja.appliedAt, '%Y-%m-%d %H:%i:%s') as appliedAt,
        DATE_FORMAT(ja.updatedAt, '%Y-%m-%d %H:%i:%s') as updatedAt,
        j.title as jobTitle, 
        j.companyName,
        j.location
      FROM job_application ja 
      LEFT JOIN job j ON ja.job_id = j.id 
      ${whereClause}
      ORDER BY ja.appliedAt DESC 
      LIMIT ${options.limit}
    `;
    
    // Execute the query without adding the limit as a parameter
    const [rows] = await connection.execute(query, queryParams);
    
    if (rows.length === 0) {
      console.log('No job applications found matching the criteria.');
      return;
    }
    
    console.log(`Found ${rows.length} job application(s):`);
    
    // Display each application
    rows.forEach((app, index) => {
      if (rows.length > 1) {
        console.log(`\n--- Application ${index + 1} ---`);
      }
      
      console.log(JSON.stringify(app, null, 2));
      
      // Additional information display for better readability
      console.log('\nApplication Summary:');
      console.log(`ID: ${app.id}`);
      console.log(`Applicant: ${app.applicantName || 'Not specified'} (${app.applicantEmail || 'No email'})`);
      console.log(`Job: ${app.jobTitle} at ${app.companyName} - ${app.location || 'No location'}`);
      console.log(`Status: ${app.status}`);
      console.log(`Applied at: ${app.appliedAt}`);
      console.log(`Updated at: ${app.updatedAt}`);
      console.log(`Skills: ${Array.isArray(app.skills) ? app.skills.join(', ') : app.skills}`);
      console.log(`Resume path: ${app.resumePath || 'No resume'}`);
    });
    
  } catch (err) {
    console.error('Error querying database:', err);
    if (err.message.includes('ECONNREFUSED')) {
      console.error('Could not connect to the database. Make sure your MySQL server is running.');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed.');
    }
  }
}

queryJobApplications(options);
