const { AppDataSource } = require('../src/db/connect');
const { User } = require('../src/db/mysqlModels/User');

const UserRole = {
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor', 
  STUDENT: 'student',
  RECRUITER: 'recruiter'
};

async function createAdminUser() {
  try {
    console.log('🔄 Initializing database connection...');
    await AppDataSource.initialize();
    console.log(' Database connected successfully');

    const userRepository = AppDataSource.getRepository(User);

    // Replace this with your actual Google email
    const adminEmail = process.argv[2] || 'your-email@gmail.com';
    const adminName = process.argv[3] || 'Admin User';

    console.log(`🔍 Checking if user already exists: ${adminEmail}`);
    
    // Check if user already exists
    let existingUser = await userRepository.findOne({
      where: { email: adminEmail }
    });

    if (existingUser) {
      console.log('👤 User already exists, updating role to ADMIN...');
      existingUser.userRole = UserRole.ADMIN;
      await userRepository.save(existingUser);
      console.log(' User role updated to ADMIN successfully');
    } else {
      console.log('➕ Creating new admin user...');
      const newUser = userRepository.create({
        username: adminName,
        email: adminEmail,
        userRole: UserRole.ADMIN,
        batch_id: []
      });

      await userRepository.save(newUser);
      console.log(' New admin user created successfully');
    }

    console.log('🎉 Admin user setup complete!');
    console.log(`📧 Email: ${adminEmail}`);
    console.log(`👑 Role: ${UserRole.ADMIN}`);
    console.log('');
    console.log('🔐 You can now login with this Google account as an admin');

  } catch (error) {
    console.error(' Error creating admin user:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('🔚 Database connection closed');
    }
  }
}

// Run the script
if (require.main === module) {
  console.log('🚀 Starting admin user creation script...');
  console.log('Usage: node create-admin-user.js <email> <name>');
  console.log('Example: node create-admin-user.js admin@example.com "Admin User"');
  console.log('');
  
  createAdminUser().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = { createAdminUser }; 