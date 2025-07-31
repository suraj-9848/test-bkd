// Script to generate sample data for testing the hiring portal
const { Org } = require("../build/db/mysqlModels/Org");
const { User, UserRole } = require("../build/db/mysqlModels/User");
const { Job, JobStatus } = require("../build/db/mysqlModels/Job");
const { AppDataSource } = require("../build/db/connect");
const bcrypt = require("bcryptjs");

async function generateSampleData() {
  console.log("Initializing database connection...");
  try {
    await AppDataSource.initialize();
    console.log("Database connection established.");
  } catch (error) {
    console.error("Failed to connect to database:", error);
    return;
  }

  try {
    console.log("Generating sample data for hiring portal...");

    // Create organization
    console.log("Creating organization...");
    const organization = Org.create({
      name: "Test Company",
      description: "A test company for the hiring portal",
      address: "123 Test Street, Test City",
    });
    await organization.save();
    console.log(`Organization created with ID: ${organization.id}`);

    // Create admin user
    console.log("Creating admin user...");
    const adminPassword = await bcrypt.hash("Password@123", 10);
    const admin = User.create({
      username: "admin",
      email: "admin@gmail.com",
      password: adminPassword,
      userRole: UserRole.ADMIN,
      org_id: organization.id,
      batch_id: [],
    });
    await admin.save();
    console.log(`Admin user created with ID: ${admin.id}`);

    // Create student user
    console.log("Creating student user...");
    const studentPassword = await bcrypt.hash("Password@123", 10);
    const student = User.create({
      username: "student",
      email: "test@gmail.com",
      password: studentPassword,
      userRole: UserRole.STUDENT,
      org_id: organization.id,
      batch_id: [],
    });
    await student.save();
    console.log(`Student user created with ID: ${student.id}`);

    // Create sample jobs
    console.log("Creating sample jobs...");
    const jobTitles = [
      "Software Engineer",
      "Data Scientist",
      "Product Manager",
      "UX Designer",
      "DevOps Engineer",
    ];

    for (const title of jobTitles) {
      const job = Job.create({
        title,
        companyName: "Test Company",
        description: `This is a sample job posting for ${title} position.`,
        skills: ["JavaScript", "TypeScript", "React", "Node.js"],
        eligibleBranches: ["Computer Science", "Information Technology"],
        status: JobStatus.OPEN,
        org_id: organization.id,
        location: "San Francisco, CA", // Added location field
      });
      await job.save();
      console.log(`Job created: ${title} with ID: ${job.id}`);
    }

    console.log("Sample data generation completed successfully!");
    console.log("\nLogin credentials:");
    console.log("Admin: email=admin@gmail.com, password=Password@123");
    console.log("Student: email=test@gmail.com, password=Password@123");
  } catch (error) {
    console.error("Error generating sample data:", error);
  } finally {
    // Close the database connection
    await AppDataSource.destroy();
    console.log("Database connection closed.");
  }
}

// Execute the function if this script is run directly
if (require.main === module) {
  generateSampleData();
}

module.exports = { generateSampleData };
