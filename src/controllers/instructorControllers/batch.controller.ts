import { Request, Response } from "express";
import { Batch } from "../../db/mysqlModels/Batch";
import {
  createRecord,
  getSingleRecord,
  deleteRecords,
  updateRecords,
  getAllRecords,
  getAllRecordsWithFilter,
} from "../../lib/dbLib/sqlUtils";
import { Course } from "../../db/mysqlModels/Course";
import { User } from "../../db/mysqlModels/User";
import { UserCourse } from "../../db/mysqlModels/UserCourse";
import { AppDataSource } from "../../db/connect";
import { TestSubmission } from "../../db/mysqlModels/TestSubmission";

export const createBatch = async (req: Request, res: Response) => {
  try {
    const { name, description, org_id } = req.body;
    const batch = new Batch();
    batch.name = name;
    batch.description = description;
    batch.org_id = org_id;

    const saved = await createRecord<Batch>(
      Batch.getRepository(),
      batch,
      "all_batches",
      10 * 60
    );
    return res.status(201).json({ message: "Batch created", batch: saved });
  } catch (err) {
    console.error("Error creating batch:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const fetchAllBatches = async (req: Request, res: Response) => {
  try {
    console.log("=== FETCH ALL BATCHES DEBUG ===");
    const batches = await getAllRecords(Batch, {
      relations: ["courses"],
    });
    console.log("Found batches count:", batches?.length);
    console.log("Batches:", JSON.stringify(batches, null, 2));
    return res.status(200).json({ message: "Fetched batches", batches });
  } catch (err) {
    console.error("Error fetching batches:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const fetchBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const batch = await getSingleRecord<Batch, any>(
      Batch,
      { where: { id } },
      `batch_${id}`,
      true,
      10 * 60
    );
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }
    return res.status(200).json({ message: "Batch fetched", batch });
  } catch (err) {
    console.error("Error fetching batch:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const result = await updateRecords(Batch, { id }, updateData, false);
    return res.status(200).json({ message: "Batch updated", result });
  } catch (err) {
    console.error("Error updating batch:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteRecords(Batch, { id });
    if (result.affected === 0) {
      return res.status(404).json({ message: "Batch not found" });
    }
    return res.status(200).json({ message: "Batch deleted" });
  } catch (err) {
    console.error("Error deleting batch:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Assign a single student to a batch (with org_id enforcement)
export const assignBatchToStudent = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { userId } = req.body;
    if (!userId)
      return res.status(400).json({ message: "User ID is required" });
    const batch = await getSingleRecord<Batch, any>(Batch, {
      where: { id: batchId },
    });
    if (!batch) return res.status(404).json({ message: "Batch not found" });
    let user = await getSingleRecord<User, any>(User, {
      where: { id: userId },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.org_id) {
      await updateRecords(
        User,
        { id: userId },
        { org_id: batch.org_id },
        false
      );
      user.org_id = batch.org_id;
    } else if (user.org_id !== batch.org_id) {
      return res
        .status(400)
        .json({ message: "User belongs to a different organization" });
    }
    if (!user.batch_id.includes(batchId)) {
      user.batch_id = [...user.batch_id, batchId];
      await updateRecords(
        User,
        { id: userId },
        { batch_id: user.batch_id },
        false
      );
    }
    const courses = await getAllRecordsWithFilter<Course, any>(Course, {
      where: { batch: { id: batchId } },
    });
    const assigned: Course[] = [];
    for (const course of courses) {
      const exists = await getSingleRecord<UserCourse, any>(UserCourse, {
        where: { user: { id: userId }, course: { id: course.id } },
      });
      if (!exists)
        await createRecord(
          UserCourse.getRepository(),
          Object.assign(new UserCourse(), { user, course })
        );
      assigned.push(course);
    }
    return res.status(200).json({
      message: "Student assigned to batch successfully",
      courses: assigned,
    });
  } catch (err) {
    console.error("Error assigning batch to student:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Fixed assignMultipleStudentsToBatch function with correct relationship handling
export const assignMultipleStudentsToBatch = async (
  req: Request,
  res: Response
) => {
  try {
    console.log("=== ASSIGN MULTIPLE STUDENTS DEBUG ===");
    const { batchId } = req.params;
    const { userIds } = req.body;

    console.log("Request params:", { batchId });
    console.log("Request body:", { userIds });

    if (!batchId) {
      console.error("Missing batchId in params");
      return res.status(400).json({ message: "Batch ID is required" });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      console.error("Invalid userIds:", userIds);
      return res
        .status(400)
        .json({ message: "userIds array is required and cannot be empty" });
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const uid of userIds) {
      if (!uid || typeof uid !== "string" || !uuidRegex.test(uid)) {
        console.error("Invalid user ID format:", uid);
        return res
          .status(400)
          .json({ message: `Invalid user ID format: ${uid}` });
      }
    }

    console.log("Fetching batch...");
    const batch = await getSingleRecord<Batch, any>(Batch, {
      where: { id: batchId },
    });

    if (!batch) {
      console.error("Batch not found:", batchId);
      return res.status(404).json({ message: "Batch not found" });
    }

    console.log("Found batch:", {
      id: batch.id,
      name: batch.name,
      org_id: batch.org_id,
    });

    console.log("Fetching courses for batch...");

    const courseRepository = AppDataSource.getRepository(Course);
    const courses = await courseRepository
      .createQueryBuilder("course")
      .innerJoin("course.batches", "batch")
      .where("batch.id = :batchId", { batchId })
      .getMany();

    console.log("Found courses:", courses.length);
    courses.forEach((course) => {
      console.log(`Course: ${course.id} - ${course.title}`);
    });

    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < userIds.length; i++) {
      const uid = userIds[i];
      console.log(`Processing user ${i + 1}/${userIds.length}: ${uid}`);

      try {
        let user = await getSingleRecord<User, any>(User, {
          where: { id: uid },
        });

        if (!user) {
          console.error(`User not found: ${uid}`);
          results.push({ userId: uid, status: "User not found" });
          errorCount++;
          continue;
        }

        console.log(`Found user: ${user.username} (${user.email})`);
        console.log(
          `User org_id: ${user.org_id}, Batch org_id: ${batch.org_id}`
        );

        if (!user.org_id) {
          console.log(`Setting org_id for user ${uid} to ${batch.org_id}`);
          await updateRecords(
            User,
            { id: uid },
            { org_id: batch.org_id },
            false
          );
          user.org_id = batch.org_id;
        } else if (user.org_id !== batch.org_id) {
          console.error(
            `Org mismatch: User ${uid} org_id=${user.org_id}, Batch org_id=${batch.org_id}`
          );
          results.push({ userId: uid, status: "Organization mismatch" });
          errorCount++;
          continue;
        }

        const currentBatchIds = user.batch_id || [];
        console.log(`Current batch_ids for user ${uid}:`, currentBatchIds);

        if (!currentBatchIds.includes(batchId)) {
          const newBatchIds = [...currentBatchIds, batchId];
          console.log(`Updating batch_ids for user ${uid} to:`, newBatchIds);

          await updateRecords(
            User,
            { id: uid },
            { batch_id: newBatchIds },
            false
          );
        } else {
          console.log(`User ${uid} already assigned to batch ${batchId}`);
        }

        let coursesAssigned = 0;
        for (const course of courses) {
          try {
            const exists = await getSingleRecord<UserCourse, any>(UserCourse, {
              where: { user: { id: uid }, course: { id: course.id } },
            });

            if (!exists) {
              console.log(`Assigning course ${course.id} to user ${uid}`);

              const userEntity = await getSingleRecord<User, any>(User, {
                where: { id: uid },
              });

              const courseEntity = await getSingleRecord<Course, any>(Course, {
                where: { id: course.id },
              });

              if (userEntity && courseEntity) {
                const userCourse = new UserCourse();
                userCourse.user = userEntity;
                userCourse.course = courseEntity;
                userCourse.completed = false;

                await createRecord(UserCourse.getRepository(), userCourse);
                coursesAssigned++;
              } else {
                console.error(
                  `Failed to load entities for course assignment: user=${!!userEntity}, course=${!!courseEntity}`
                );
              }
            } else {
              console.log(
                `User ${uid} already assigned to course ${course.id}`
              );
            }
          } catch (courseError) {
            console.error(
              `Error assigning course ${course.id} to user ${uid}:`,
              courseError
            );
          }
        }

        results.push({
          userId: uid,
          status: "Assigned",
          coursesAssigned,
          totalCourses: courses.length,
        });

        successCount++;
        console.log(`Successfully processed user ${uid}`);
      } catch (userError) {
        console.error(`Error processing user ${uid}:`, userError);
        results.push({
          userId: uid,
          status: "Processing error",
          error:
            userError instanceof Error ? userError.message : String(userError),
        });
        errorCount++;
      }
    }

    console.log("=== ASSIGNMENT SUMMARY ===");
    console.log(`Total users processed: ${userIds.length}`);
    console.log(`Successful assignments: ${successCount}`);
    console.log(`Failed assignments: ${errorCount}`);
    console.log("Results:", results);

    return res.status(200).json({
      message: `Batch assignment completed: ${successCount} successful, ${errorCount} failed`,
      summary: {
        total: userIds.length,
        successful: successCount,
        failed: errorCount,
        batchName: batch.name,
        coursesInBatch: courses.length,
      },
      results,
    });
  } catch (err) {
    console.error("=== CRITICAL ERROR IN ASSIGN MULTIPLE STUDENTS ===");
    console.error("Error details:", err);
    console.error(
      "Stack trace:",
      err instanceof Error ? err.stack : "No stack trace"
    );

    let errorMessage = "Internal server error";
    if (err instanceof Error) {
      if (err.message.includes("connection")) {
        errorMessage = "Database connection error";
      } else if (err.message.includes("timeout")) {
        errorMessage = "Database timeout error";
      } else if (err.message.includes("constraint")) {
        errorMessage = "Database constraint violation";
      } else if (
        err.message.includes("Property") &&
        err.message.includes("was not found")
      ) {
        errorMessage =
          "Database relationship error - please check entity relationships";
      } else {
        errorMessage = `Server error: ${err.message}`;
      }
    }

    return res.status(500).json({
      message: errorMessage,
      details:
        process.env.NODE_ENV === "development"
          ? err instanceof Error
            ? err.message
            : String(err)
          : undefined,
    });
  }
};

// Get all students in a batch with their details
export const fetchBatchStudents = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    console.log(`📋 Fetching students for batch: ${batchId}`);

    // Verify batch exists
    const batch = await getSingleRecord(Batch, { where: { id: batchId } });
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Get all students enrolled in courses within this batch
    const userCourses = await getAllRecordsWithFilter(UserCourse, {
      where: {
        course: {
          batches: { id: batchId },
        },
      },
      relations: ["user", "course"],
    });

    // Extract unique students with their details
    const studentMap = new Map();
    userCourses.forEach((uc) => {
      if (uc.user && !studentMap.has(uc.user.id)) {
        studentMap.set(uc.user.id, {
          id: uc.user.id,
          username: uc.user.username,
          email: uc.user.email,
          name: uc.user.name || uc.user.username,
          user: uc.user,
        });
      }
    });

    const students = Array.from(studentMap.values());

    console.log(`✅ Found ${students.length} students in batch ${batchId}`);

    return res.status(200).json({
      message: "Batch students fetched successfully",
      students,
      count: students.length,
    });
  } catch (err) {
    console.error("Error fetching batch students:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get test scores for a specific student in a course
export const getStudentCourseScores = async (req: Request, res: Response) => {
  try {
    const { batchId, courseId, studentId } = req.params;

    console.log(
      `📊 Fetching scores for student: ${studentId}, course: ${courseId}, batch: ${batchId}`
    );

    // Get all test submissions for this student in this course
    const submissions = await getAllRecordsWithFilter(TestSubmission, {
      where: {
        user: { id: studentId },
        test: { course: { id: courseId } },
      },
      relations: ["test", "test.course"],
      order: { submittedAt: "DESC" },
    });

    // Calculate scores
    const scores = submissions.map((submission) => ({
      testId: submission.test.id,
      testTitle: submission.test.title,
      score: submission.totalScore || 0,
      maxScore: submission.test.maxMarks || 100,
      percentage:
        submission.totalScore && submission.test.maxMarks
          ? Math.round(
              (submission.totalScore / submission.test.maxMarks) * 100 * 10
            ) / 10
          : 0,
      submittedAt: submission.submittedAt,
      status: submission.status,
    }));

    // Calculate average
    const average =
      scores.length > 0
        ? Math.round(
            (scores.reduce((sum, s) => sum + s.percentage, 0) / scores.length) *
              10
          ) / 10
        : 0;

    console.log(
      `✅ Found ${scores.length} test scores for student ${studentId}`
    );

    return res.status(200).json({
      message: "Student scores fetched successfully",
      scores,
      average,
      totalTests: scores.length,
    });
  } catch (err) {
    console.error("Error fetching student scores:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
