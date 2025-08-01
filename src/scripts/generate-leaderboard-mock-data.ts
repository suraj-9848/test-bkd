import { AppDataSource } from "../db/connect";
import { User, UserRole } from "../db/mysqlModels/User";
import { Test, TestStatus } from "../db/mysqlModels/Test";
import { TestSubmission } from "../db/mysqlModels/TestSubmission";
import { Org } from "../db/mysqlModels/Org";
import { Course } from "../db/mysqlModels/Course";
import { Module } from "../db/mysqlModels/Module";
import { Batch } from "../db/mysqlModels/Batch";

async function main() {
  await AppDataSource.initialize();

  const orgRepo = AppDataSource.getRepository(Org);
  const userRepo = AppDataSource.getRepository(User);
  const courseRepo = AppDataSource.getRepository(Course);
  const moduleRepo = AppDataSource.getRepository(Module);
  const batchRepo = AppDataSource.getRepository(Batch);
  const testRepo = AppDataSource.getRepository(Test);
  const submissionRepo = AppDataSource.getRepository(TestSubmission);

  // 1. Create Org
  let org = await orgRepo.findOneBy({ name: "Leaderboard Org" });
  if (!org) {
    org = orgRepo.create({ name: "Leaderboard Org" });
    await orgRepo.save(org);
  }

  // 2. Create Multiple Sample Courses
  const sampleCourses = [
    {
      title: "React Fundamentals",
      logo: "",
      is_public: true,
      instructor_name: "John Doe",
      start_date: new Date(Date.now() - 86400000),
      end_date: new Date(Date.now() + 86400000 * 30),
    },
    {
      title: "Node.js Backend Development",
      logo: "",
      is_public: true,
      instructor_name: "Jane Smith",
      start_date: new Date(Date.now() - 86400000),
      end_date: new Date(Date.now() + 86400000 * 45),
    },
    {
      title: "Full Stack Web Development",
      logo: "",
      is_public: true,
      instructor_name: "Bob Wilson",
      start_date: new Date(Date.now() - 86400000),
      end_date: new Date(Date.now() + 86400000 * 60),
    },
    {
      title: "Database Design & Management",
      logo: "",
      is_public: true,
      instructor_name: "Alice Johnson",
      start_date: new Date(Date.now() - 86400000),
      end_date: new Date(Date.now() + 86400000 * 40),
    },
  ];

  const createdCourses = [];
  for (const courseData of sampleCourses) {
    let course = await courseRepo.findOneBy({ title: courseData.title });
    if (!course) {
      course = courseRepo.create(courseData);
      await courseRepo.save(course);
      console.log(`✅ Created course: ${course.title} (ID: ${course.id})`);
    } else {
      console.log(`ℹ️ Course already exists: ${course.title}`);
    }
    createdCourses.push(course);
  }

  // Use the first course for the test
  const course = createdCourses[0];

  // 2.5. Create a sample batch and link courses to it
  let batch = await batchRepo.findOneBy({ name: "Sample Batch 2024" });
  if (!batch) {
    batch = batchRepo.create({
      name: "Sample Batch 2024",
      org_id: org.id,
      courses: createdCourses, // Link all courses to this batch
    });
    await batchRepo.save(batch);
    console.log(`✅ Created batch: ${batch.name} (ID: ${batch.id})`);
  } else {
    console.log(`ℹ️ Batch already exists: ${batch.name}`);
  }

  // 2.6. Create sample modules for each course
  const moduleData = [
    { title: "Introduction", order: 1 },
    { title: "Core Concepts", order: 2 },
    { title: "Advanced Topics", order: 3 },
    { title: "Practical Applications", order: 4 },
  ];

  for (const courseItem of createdCourses) {
    for (const modData of moduleData) {
      const moduleTitle = `${courseItem.title} - ${modData.title}`;
      let module = await moduleRepo.findOneBy({ title: moduleTitle });

      if (!module) {
        module = moduleRepo.create({
          title: moduleTitle,
          order: modData.order,
          course: courseItem,
          isLocked: false, // Make modules unlocked so they're accessible
        });
        await moduleRepo.save(module);
        console.log(`  ✅ Created module: ${module.title} (ID: ${module.id})`);
      } else {
        console.log(`  ℹ️ Module already exists: ${module.title}`);
      }
    }
  }

  // 3. Create Users
  const users = [
    { username: "alice", email: "alice@example.com" },
    { username: "bob", email: "bob@example.com" },
    { username: "charlie", email: "charlie@example.com" },
  ];
  const userEntities = [];
  for (const u of users) {
    let user = await userRepo.findOneBy({ email: u.email });
    if (!user) {
      user = userRepo.create({
        username: u.username,
        email: u.email,
        password: "Password@123",
        userRole: UserRole.STUDENT,
        batch_id: [],
        org_id: org.id,
      });
      await userRepo.save(user);
    }
    userEntities.push(user);
  }

  // 4. Create Test
  let test = await testRepo.findOneBy({ title: "Sample Test" });
  if (!test) {
    test = testRepo.create({
      title: "Sample Test",
      description: "Leaderboard test",
      course: course,
      maxMarks: 100,
      passingMarks: 40,
      durationInMinutes: 60,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      status: TestStatus.PUBLISHED,
      shuffleQuestions: false,
      showResults: true,
      showCorrectAnswers: false,
      maxAttempts: 1,
    });
    await testRepo.save(test);
  }

  // 5. Create TestSubmissions
  const scores = [95, 80, 60];
  for (let i = 0; i < userEntities.length; i++) {
    let submission = await submissionRepo.findOne({
      where: { user: { id: userEntities[i].id }, test: { id: test.id } },
      relations: ["user", "test"],
    });
    if (!submission) {
      submission = submissionRepo.create({
        user: userEntities[i],
        test,
        totalScore: scores[i],
        mcqScore: scores[i],
        submittedAt: new Date(),
      });
      await submissionRepo.save(submission);
    }
  }

  console.log(
    "✅ Sample courses, modules, batch, and leaderboard data created successfully!",
  );
  console.log(`📚 Created ${createdCourses.length} courses`);
  console.log(`📖 Created ${createdCourses.length * 4} modules (4 per course)`);
  console.log(`🎓 Created 1 batch linked to all courses`);
  console.log(`👥 Created ${userEntities.length} users`);
  console.log("🎯 Created test and submissions for leaderboard");
  console.log("\n🎉 Your MCQ management should now work in the admin panel!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
