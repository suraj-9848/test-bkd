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
import { User, UserRole } from "../../db/mysqlModels/User";
import { UserCourse } from "../../db/mysqlModels/UserCourse";
import { AppDataSource } from "../../db/connect";
import { TestSubmission } from "../../db/mysqlModels/TestSubmission";

// Get students assigned to a specific batch
export const getBatchStudents = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    // Check if batch exists
    const batch = await getSingleRecord<Batch, any>(Batch, {
      where: { id: batchId },
    });
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Get all users assigned to this batch
    const students = await getAllRecordsWithFilter<User, any>(User, {
      where: {
        batch_id: {
          like: `%${batchId}%`, // Using LIKE to search in JSON array
        },
      },
    });

    // Filter and format the response
    const formattedStudents = students.map((student) => ({
      id: student.id,
      name: student.name,
      email: student.email,
      username: student.username,
      batch_id: student.batch_id,
      org_id: student.org_id,
    }));

    return res.status(200).json({
      message: "Batch students fetched successfully",
      batchId,
      batchName: batch.name,
      students: formattedStudents,
      totalStudents: formattedStudents.length,
    });
  } catch (err) {
    console.error("Error fetching batch students:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Check if a specific student is assigned to a specific batch
export const checkStudentBatchAssignment = async (
  req: Request,
  res: Response,
) => {
  try {
    const { batchId, studentId } = req.params;

    // Get user record
    const user = await getSingleRecord<User, any>(User, {
      where: { id: studentId },
    });

    if (!user) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check if user is assigned to the batch
    const isAssigned = user.batch_id && user.batch_id.includes(batchId);

    return res.status(200).json({
      studentId,
      batchId,
      isAssigned: !!isAssigned,
      batchIds: user.batch_id || [],
    });
  } catch (err) {
    console.error("Error checking student batch assignment:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Transfer student from one batch to another
export const transferStudentBetweenBatches = async (
  req: Request,
  res: Response,
) => {
  try {
    const { studentId, fromBatchId, toBatchId } = req.body;

    if (!studentId || !fromBatchId || !toBatchId) {
      return res.status(400).json({
        message: "studentId, fromBatchId, and toBatchId are required",
      });
    }

    // Get user and batches
    const [user, fromBatch, toBatch] = await Promise.all([
      getSingleRecord<User, any>(User, { where: { id: studentId } }),
      getSingleRecord<Batch, any>(Batch, { where: { id: fromBatchId } }),
      getSingleRecord<Batch, any>(Batch, { where: { id: toBatchId } }),
    ]);

    if (!user) return res.status(404).json({ message: "Student not found" });
    if (!fromBatch)
      return res.status(404).json({ message: "Source batch not found" });
    if (!toBatch)
      return res.status(404).json({ message: "Target batch not found" });

    // Check organization consistency
    if (user.org_id !== fromBatch.org_id || user.org_id !== toBatch.org_id) {
      return res.status(400).json({
        message: "Organization mismatch between student and batches",
      });
    }

    // Check if student is in source batch
    if (!user.batch_id || !user.batch_id.includes(fromBatchId)) {
      return res.status(400).json({
        message: "Student is not assigned to the source batch",
      });
    }

    // Update batch assignment
    const updatedBatchIds = user.batch_id.filter(
      (id: string) => id !== fromBatchId,
    );
    if (!updatedBatchIds.includes(toBatchId)) {
      updatedBatchIds.push(toBatchId);
    }

    await updateRecords(
      User,
      { id: studentId },
      { batch_id: updatedBatchIds },
      false,
    );

    // Handle course assignments
    const [fromBatchCourses, toBatchCourses] = await Promise.all([
      getAllRecordsWithFilter<Course, any>(Course, {
        where: { batch: { id: fromBatchId } },
      }),
      getAllRecordsWithFilter<Course, any>(Course, {
        where: { batch: { id: toBatchId } },
      }),
    ]);

    // Remove from old batch courses
    for (const course of fromBatchCourses) {
      await deleteRecords(UserCourse, {
        user: { id: studentId },
        course: { id: course.id },
      });
    }

    // Add to new batch courses
    for (const course of toBatchCourses) {
      const existingEnrollment = await getSingleRecord<UserCourse, any>(
        UserCourse,
        {
          where: { user: { id: studentId }, course: { id: course.id } },
        },
      );

      if (!existingEnrollment) {
        await createRecord(
          UserCourse.getRepository(),
          Object.assign(new UserCourse(), { user, course }),
        );
      }
    }

    return res.status(200).json({
      message: "Student transferred successfully",
      studentId,
      fromBatch: fromBatch.name,
      toBatch: toBatch.name,
      removedFromCourses: fromBatchCourses.length,
      addedToCourses: toBatchCourses.length,
    });
  } catch (err) {
    console.error("Error transferring student:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

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
      10 * 60,
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
      10 * 60,
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
    const user = await getSingleRecord<User, any>(User, {
      where: { id: userId },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.org_id) {
      await updateRecords(
        User,
        { id: userId },
        { org_id: batch.org_id },
        false,
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
        false,
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
          Object.assign(new UserCourse(), { user, course }),
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
  res: Response,
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
        const user = await getSingleRecord<User, any>(User, {
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
          `User org_id: ${user.org_id}, Batch org_id: ${batch.org_id}`,
        );

        if (!user.org_id) {
          console.log(`Setting org_id for user ${uid} to ${batch.org_id}`);
          await updateRecords(
            User,
            { id: uid },
            { org_id: batch.org_id },
            false,
          );
          user.org_id = batch.org_id;
        } else if (user.org_id !== batch.org_id) {
          console.error(
            `Org mismatch: User ${uid} org_id=${user.org_id}, Batch org_id=${batch.org_id}`,
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
            false,
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
                  `Failed to load entities for course assignment: user=${!!userEntity}, course=${!!courseEntity}`,
                );
              }
            } else {
              console.log(
                `User ${uid} already assigned to course ${course.id}`,
              );
            }
          } catch (courseError) {
            console.error(
              `Error assigning course ${course.id} to user ${uid}:`,
              courseError,
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
      err instanceof Error ? err.stack : "No stack trace",
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

export const assignMultipleStudentsToBatchEnhanced = async (
  req: Request,
  res: Response,
) => {
  try {
    console.log("=== ENHANCED ASSIGN MULTIPLE STUDENTS ===");
    const { batchId } = req.params;
    const { userIds } = req.body;

    console.log("Request params:", { batchId });
    console.log("Request body:", { userIds });

    if (!batchId) {
      return res.status(400).json({ message: "Batch ID is required" });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        message: "userIds array is required and cannot be empty",
      });
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const uid of userIds) {
      if (!uid || typeof uid !== "string" || !uuidRegex.test(uid)) {
        return res.status(400).json({
          message: `Invalid user ID format: ${uid}`,
        });
      }
    }

    // Check if batch exists
    const batch = await getSingleRecord<Batch, any>(Batch, {
      where: { id: batchId },
    });

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    console.log("Found batch:", { id: batch.id, name: batch.name });

    const results: any[] = [];
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const userId of userIds) {
      try {
        console.log(`Processing user: ${userId}`);

        const user = await getSingleRecord<User, any>(User, {
          where: { id: userId },
        });

        if (!user) {
          console.error(`User not found: ${userId}`);
          results.push({
            userId,
            status: "error",
            message: "User not found",
          });
          errorCount++;
          continue;
        }

        console.log(`Found user: ${user.username} (${user.email})`);

        // Check organization match
        if (!user.org_id) {
          await updateRecords(
            User,
            { id: userId },
            { org_id: batch.org_id },
            false,
          );
          user.org_id = batch.org_id;
        } else if (user.org_id !== batch.org_id) {
          console.error(`Organization mismatch for user ${userId}`);
          results.push({
            userId,
            status: "error",
            message: "User belongs to a different organization",
          });
          errorCount++;
          continue;
        }

        // **CRITICAL FIX: Check if already assigned to prevent duplicates**
        const currentBatchIds = user.batch_id || [];
        if (currentBatchIds.includes(batchId)) {
          console.log(`User ${userId} already assigned to batch ${batchId}`);
          results.push({
            userId,
            status: "skipped",
            message: "Already assigned to this batch",
            userName: user.username,
          });
          skippedCount++;
          continue;
        }

        // Add batch to user's batch_id array (no duplicates)
        const updatedBatchIds = [...currentBatchIds, batchId];
        await updateRecords(
          User,
          { id: userId },
          { batch_id: updatedBatchIds },
          false,
        );

        console.log(`Updated user ${userId} batch_id: ${updatedBatchIds}`);

        // Assign to courses in this batch
        const courses = await getAllRecordsWithFilter<Course, any>(Course, {
          where: { batch: { id: batchId } },
        });

        let assignedCourses = 0;
        for (const course of courses) {
          const existingEnrollment = await getSingleRecord<UserCourse, any>(
            UserCourse,
            {
              where: { user: { id: userId }, course: { id: course.id } },
            },
          );

          if (!existingEnrollment) {
            await createRecord(
              UserCourse.getRepository(),
              Object.assign(new UserCourse(), { user, course }),
            );
            assignedCourses++;
          }
        }

        results.push({
          userId,
          userName: user.username,
          status: "success",
          message: `Assigned to batch and ${assignedCourses} courses`,
          assignedCourses,
        });
        successCount++;

        console.log(`Successfully assigned user ${userId} to batch ${batchId}`);
      } catch (userError) {
        console.error(`Error processing user ${userId}:`, userError);
        results.push({
          userId,
          status: "error",
          message: `Assignment failed: ${userError instanceof Error ? userError.message : "Unknown error"}`,
        });
        errorCount++;
      }
    }

    console.log("=== ASSIGNMENT SUMMARY ===");
    console.log(`Total processed: ${userIds.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Skipped (already assigned): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);

    const response = {
      message: `Assignment completed: ${successCount} successful, ${skippedCount} already assigned, ${errorCount} errors`,
      batchId,
      batchName: batch.name,
      summary: {
        total: userIds.length,
        successful: successCount,
        skipped: skippedCount,
        failed: errorCount,
      },
      results,
    };

    // Return success even if some assignments were skipped
    return res.status(200).json(response);
  } catch (err) {
    console.error("Error in enhanced assign multiple students:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err instanceof Error ? err.message : "Unknown error",
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

    console.log(` Found ${students.length} students in batch ${batchId}`);

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
      `📊 Fetching scores for student: ${studentId}, course: ${courseId}, batch: ${batchId}`,
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
              (submission.totalScore / submission.test.maxMarks) * 100 * 10,
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
              10,
          ) / 10
        : 0;

    console.log(` Found ${scores.length} test scores for student ${studentId}`);

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

export const getStudentsWithBatches = async (req: Request, res: Response) => {
  try {
    console.log("=== GET STUDENTS WITH BATCHES ===");

    // Get the instructor's organization from the request
    // You may need to adjust this based on how you get the org_id in your system
    const instructorId = (req as any).user?.id;

    if (!instructorId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get instructor's organization
    const instructor = await getSingleRecord<User, any>(User, {
      where: { id: instructorId },
    });

    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    const orgId = instructor.org_id;

    if (!orgId) {
      return res
        .status(400)
        .json({ message: "Instructor organization not found" });
    }

    console.log(`Fetching students for organization: ${orgId}`);

    // Get all students in the same organization
    const students = await getAllRecordsWithFilter<User, any>(User, {
      where: {
        org_id: orgId,
        userRole: UserRole.STUDENT,
      },
    });

    console.log(`Found ${students.length} students`);

    // Format the response with proper batch information
    const formattedStudents = students.map((student) => ({
      id: student.id,
      name: student.username,
      email: student.email,
      username: student.username,
      batch_id: student.batch_id || [],
      org_id: student.org_id,
      profile_picture: student.profile_picture,
    }));

    console.log("Formatted students sample:", formattedStudents.slice(0, 2));

    return res.status(200).json({
      message: "Students fetched successfully",
      users: formattedStudents,
      students: formattedStudents,
      totalStudents: formattedStudents.length,
      organizationId: orgId,
    });
  } catch (err) {
    console.error("Error fetching students with batches:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

// ===== REMOVE MULTIPLE STUDENTS FROM BATCH =====
export const removeMultipleStudentsFromBatch = async (
  req: Request,
  res: Response,
) => {
  try {
    console.log("=== REMOVE MULTIPLE STUDENTS FROM BATCH ===");
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
      return res.status(400).json({
        message: "userIds array is required and cannot be empty",
      });
    }

    // Check if batch exists
    const batch = await getSingleRecord<Batch, any>(Batch, {
      where: { id: batchId },
    });
    if (!batch) {
      console.error("Batch not found:", batchId);
      return res.status(404).json({ message: "Batch not found" });
    }

    console.log("Batch found:", batch.name);

    const results = [];
    const errors = [];

    // Process each user removal
    for (const userId of userIds) {
      try {
        console.log(`Processing removal for user: ${userId}`);

        // Get user record
        const user = await getSingleRecord<User, any>(User, {
          where: { id: userId },
        });

        if (!user) {
          console.error(`User not found: ${userId}`);
          errors.push(`User not found: ${userId}`);
          continue;
        }

        console.log(`User found: ${user.username || user.email}`);

        // Check organization match
        if (user.org_id !== batch.org_id) {
          console.error(`Organization mismatch for user ${userId}`);
          errors.push(
            `User ${user.username || user.email} belongs to a different organization`,
          );
          continue;
        }

        // Check if user is actually assigned to this batch
        const currentBatchIds = user.batch_id || [];
        if (!currentBatchIds.includes(batchId)) {
          console.warn(`User ${userId} is not assigned to batch ${batchId}`);
          errors.push(
            `User ${user.username || user.email} is not assigned to this batch`,
          );
          continue;
        }

        // Remove batch from user's batch_id array
        const updatedBatchIds = currentBatchIds.filter(
          (id: string) => id !== batchId,
        );
        await updateRecords(
          User,
          { id: userId },
          { batch_id: updatedBatchIds },
          false,
        );

        console.log(
          `Updated user ${userId} batch_id from [${currentBatchIds}] to [${updatedBatchIds}]`,
        );

        // Remove user from all courses in this batch
        // FIX: Use proper many-to-many relationship query
        const courseRepository = AppDataSource.getRepository(Course);
        const batchCourses = await courseRepository
          .createQueryBuilder("course")
          .innerJoin("course.batches", "batch")
          .where("batch.id = :batchId", { batchId })
          .getMany();

        let removedFromCourses = 0;
        for (const course of batchCourses) {
          try {
            const result = await deleteRecords(UserCourse, {
              user: { id: userId },
              course: { id: course.id },
            });
            if (result.affected && result.affected > 0) {
              removedFromCourses++;
              console.log(`Removed user ${userId} from course ${course.id}`);
            }
          } catch (courseError) {
            console.warn(
              `Failed to remove user ${userId} from course ${course.id}:`,
              courseError,
            );
          }
        }

        results.push({
          userId,
          userName: user.username || user.email,
          success: true,
          message: `Removed from batch and ${removedFromCourses} courses`,
          removedFromCourses,
        });

        console.log(
          `Successfully removed user ${userId} from batch ${batchId}`,
        );
      } catch (userError) {
        console.error(`Error processing user ${userId}:`, userError);
        errors.push(`Failed to remove user ${userId}: ${userError}`);
      }
    }

    console.log("=== REMOVAL SUMMARY ===");
    console.log(`Successful removals: ${results.length}`);
    console.log(`Errors: ${errors.length}`);

    // Prepare response
    const response: any = {
      message: `Batch removal processed: ${results.length} successful, ${errors.length} errors`,
      batchId,
      batchName: batch.name,
      results,
      totalProcessed: userIds.length,
      successCount: results.length,
      errorCount: errors.length,
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error("Error in removeMultipleStudentsFromBatch:", err);
    return res.status(500).json({
      message: "Internal server error during batch removal",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

// ===== REMOVE SINGLE STUDENT FROM BATCH =====
export const removeBatchFromStudent = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Check if batch exists
    const batch = await getSingleRecord<Batch, any>(Batch, {
      where: { id: batchId },
    });
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Get user record
    const user = await getSingleRecord<User, any>(User, {
      where: { id: userId },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check organization match
    if (user.org_id !== batch.org_id) {
      return res.status(400).json({
        message: "User belongs to a different organization",
      });
    }

    // Check if user is actually assigned to this batch
    const currentBatchIds = user.batch_id || [];
    if (!currentBatchIds.includes(batchId)) {
      return res.status(400).json({
        message: "User is not assigned to this batch",
      });
    }

    // Remove batch from user's batch_id array
    const updatedBatchIds = currentBatchIds.filter(
      (id: string) => id !== batchId,
    );
    await updateRecords(
      User,
      { id: userId },
      { batch_id: updatedBatchIds },
      false,
    );

    // Remove user from all courses in this batch
    // FIX: Use proper many-to-many relationship query
    const courseRepository = AppDataSource.getRepository(Course);
    const courses = await courseRepository
      .createQueryBuilder("course")
      .innerJoin("course.batches", "batch")
      .where("batch.id = :batchId", { batchId })
      .getMany();

    const removedCourses: Course[] = [];
    for (const course of courses) {
      try {
        const result = await deleteRecords(UserCourse, {
          user: { id: userId },
          course: { id: course.id },
        });

        if (result.affected && result.affected > 0) {
          removedCourses.push(course);
        }
      } catch (courseError) {
        console.warn(
          `Failed to remove user from course ${course.id}:`,
          courseError,
        );
      }
    }

    return res.status(200).json({
      message: "Student removed from batch successfully",
      userId,
      batchId,
      removedFromCourses: removedCourses.length,
      updatedBatchIds,
    });
  } catch (err) {
    console.error("Error removing batch from student:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ===== GET USER'S BATCH INFORMATION =====
export const getUserBatches = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await getSingleRecord<User, any>(User, {
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get batch details for the user's batch_id array
    const batchIds = user.batch_id || [];
    const batches = [];

    for (const batchId of batchIds) {
      try {
        const batch = await getSingleRecord<Batch, any>(Batch, {
          where: { id: batchId },
        });
        if (batch) {
          batches.push({
            id: batch.id,
            name: batch.name,
            description: batch.description,
            org_id: batch.org_id,
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch batch ${batchId}:`, err);
      }
    }

    return res.status(200).json({
      userId,
      batch_id: batchIds,
      batches,
      totalBatches: batches.length,
    });
  } catch (err) {
    console.error("Error fetching user batches:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Bulk assignment function for multiple batches
export const bulkAssignStudentsToBatches = async (
  req: Request,
  res: Response,
) => {
  try {
    const { assignments } = req.body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({
        message: "assignments array is required and cannot be empty",
      });
    }

    const results = [];
    const errors = [];

    for (const assignment of assignments) {
      const { batchId, studentIds } = assignment;

      if (!batchId || !Array.isArray(studentIds) || studentIds.length === 0) {
        errors.push({
          batchId,
          studentIds,
          success: false,
          error: "Invalid batchId or studentIds array",
        });
        continue;
      }

      try {
        // Create a proper request object
        const mockReq = {
          params: { batchId },
          body: { userIds: studentIds },
        } as any;

        // Create a mock response that captures the result
        let assignmentResult = null;
        const mockRes = {
          status: (code: number) => ({
            json: (data: any) => {
              assignmentResult = { statusCode: code, data };
              return { statusCode: code, data };
            },
          }),
        } as any;

        await assignMultipleStudentsToBatchEnhanced(mockReq, mockRes);

        results.push({
          batchId,
          studentIds,
          success: true,
          result: assignmentResult,
        });
      } catch (error) {
        errors.push({
          batchId,
          studentIds,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return res.status(200).json({
      message: `Bulk assignment completed: ${results.length} successful, ${errors.length} failed`,
      results,
      errors: errors.length > 0 ? errors : undefined,
      totalAssignments: assignments.length,
      successCount: results.length,
      errorCount: errors.length,
    });
  } catch (err) {
    console.error("Error in bulk assignment:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
