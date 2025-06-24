import { AppDataSource } from "../db/connect";
import { User, UserRole } from "../db/mysqlModels/User";
import { Test, TestStatus } from "../db/mysqlModels/Test";
import { TestSubmission } from "../db/mysqlModels/TestSubmission";
import { Org } from "../db/mysqlModels/Org";
import { Course } from "../db/mysqlModels/Course";

async function main() {
  await AppDataSource.initialize();

  const orgRepo = AppDataSource.getRepository(Org);
  const userRepo = AppDataSource.getRepository(User);
  const courseRepo = AppDataSource.getRepository(Course);
  const testRepo = AppDataSource.getRepository(Test);
  const submissionRepo = AppDataSource.getRepository(TestSubmission);

  // 1. Create Org
  let org = await orgRepo.findOneBy({ name: "Leaderboard Org" });
  if (!org) {
    org = orgRepo.create({ name: "Leaderboard Org" });
    await orgRepo.save(org);
  }

  // 2. Create Course
  let course = await courseRepo.findOneBy({ title: "Leaderboard Course" });
  if (!course) {
    course = courseRepo.create({
      title: "Leaderboard Course",
      logo: "",
      start_date: new Date(Date.now() - 86400000),
      end_date: new Date(Date.now() + 86400000 * 30),
      // Remove org_id, just create course without org if not required
    });
    await courseRepo.save(course);
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

  console.log("Mock leaderboard data created!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
