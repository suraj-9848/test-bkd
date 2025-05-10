import { Request, Response } from "express";
import { Test, TestStatus } from "../../db/mysqlModels/Test";
import { Question, QuestionType } from "../../db/mysqlModels/Question";
import { QuizOptions } from "../../db/mysqlModels/QuizOptions";
import { TestAttempt, AttemptStatus } from "../../db/mysqlModels/TestAttempt";
import { TestAnswer } from "../../db/mysqlModels/TestAnswer";
import { User } from "../../db/mysqlModels/User";
import {
    createRecord,
    getSingleRecord,
    getAllRecordsWithFilter,
    updateRecords,
} from "../../lib/dbLib/sqlUtils";
import { redisClient } from "../../db/connect";

const logger = require("../../utils/logger").getLoggerByName("Test Attempt");

// Get available tests for a student
export const getAvailableTests = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const now = new Date();

        // Try to get from cache first
        const cacheKey = `user:${userId}:available_tests`;
        const cachedTests = await redisClient.get(cacheKey);

        if (cachedTests) {
            return res.status(200).json(JSON.parse(cachedTests));
        }

        // Get student's batch IDs
        const user = await getSingleRecord<User, any>(User, {
            where: { id: userId },
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const batchIds = user.batch_id || [];
        if (batchIds.length === 0) {
            return res.status(200).json({
                message: "No batches found for the student",
                availableTests: [],
            });
        }

        // Find tests for courses in student's batches that are published and active
        const tests = await getAllRecordsWithFilter<Test, any>(Test, {
            where: {
                status: TestStatus.PUBLISHED,
                startDate: { $lte: now },
                endDate: { $gte: now },
                course: {
                    batch: {
                        id: { $in: batchIds },
                    },
                },
            },
            relations: ["course", "course.batch"],
        });

        // Check existing attempts
        const testIds = tests.map((test) => test.id);
        const attempts = await getAllRecordsWithFilter<TestAttempt, any>(
            TestAttempt,
            {
                where: {
                    student: { id: userId },
                    test: { id: { $in: testIds } },
                },
            }
        );

        // Filter tests that student can attempt
        const availableTests = tests
            .filter((test) => {
                // Check if student has already submitted or evaluated the test
                const hasCompleted = attempts.some(
                    (attempt) =>
                        attempt.test.id === test.id &&
                        (attempt.status === AttemptStatus.SUBMITTED ||
                            attempt.status === AttemptStatus.EVALUATED)
                );

                return !hasCompleted;
            })
            .map((test) => ({
                id: test.id,
                title: test.title,
                courseName: test.course.title,
                batchName: test.course.batch.name,
                description: test.description,
                durationInMinutes: test.durationInMinutes,
                startDate: test.startDate,
                endDate: test.endDate,
                maxMarks: test.maxMarks,
                hasOngoingAttempt: attempts.some(
                    (attempt) =>
                        attempt.test.id === test.id &&
                        (attempt.status === AttemptStatus.STARTED ||
                            attempt.status === AttemptStatus.IN_PROGRESS)
                ),
            }));

        // Cache the result
        await redisClient.set(
            cacheKey,
            JSON.stringify({
                message: "Available tests retrieved successfully",
                availableTests,
            }),
            { EX: 300 } // Cache for 5 minutes
        );

        return res.status(200).json({
            message: "Available tests retrieved successfully",
            availableTests,
        });
    } catch (error) {
        logger.error("Error fetching available tests:", error);
        return res
            .status(500)
            .json({ error: "Failed to fetch available tests" });
    }
};

// Start a test attempt
export const startTestAttempt = async (req: Request, res: Response) => {
    try {
        const { testId } = req.params;
        const userId = req.user.id;

        // Check if test exists and is published
        let test;

        // Try to get from Redis cache first
        const cachedTest = await redisClient.get(`test:${testId}:config`);
        if (cachedTest) {
            test = JSON.parse(cachedTest);
        } else {
            test = await getSingleRecord<Test, any>(
                Test,
                {
                    where: {
                        id: testId,
                        status: {
                            $in: [TestStatus.PUBLISHED, TestStatus.ACTIVE],
                        },
                    },
                },
                `test_${testId}_basic`,
                true
            );

            if (!test) {
                return res
                    .status(404)
                    .json({ error: "Test not found or not published" });
            }

            // Cache test data
            await redisClient.set(
                `test:${testId}:config`,
                JSON.stringify({
                    id: test.id,
                    title: test.title,
                    description: test.description,
                    maxMarks: test.maxMarks,
                    passingMarks: test.passingMarks,
                    durationInMinutes: test.durationInMinutes,
                    startDate: test.startDate,
                    endDate: test.endDate,
                    status: test.status,
                    shuffleQuestions: test.shuffleQuestions,
                    showResults: test.showResults,
                    showCorrectAnswers: test.showCorrectAnswers,
                }),
                { EX: 86400 }
            ); // Cache for 24 hours
        }

        // Check if test is within the scheduled time
        const now = new Date();
        const startDate = new Date(test.startDate);
        const endDate = new Date(test.endDate);

        if (now < startDate) {
            return res.status(400).json({ error: "Test has not started yet" });
        }

        if (now > endDate) {
            return res.status(400).json({ error: "Test has ended" });
        }

        // Check if student has already completed the test
        const existingAttempts = await getAllRecordsWithFilter<
            TestAttempt,
            any
        >(TestAttempt, {
            where: {
                student: { id: userId },
                test: { id: testId },
            },
        });

        const submittedAttempt = existingAttempts.find(
            (a) =>
                a.status === AttemptStatus.SUBMITTED ||
                a.status === AttemptStatus.EVALUATED
        );

        if (submittedAttempt) {
            return res
                .status(400)
                .json({ error: "You have already completed this test" });
        }

        // Check if there's an ongoing attempt
        const ongoingAttempt = existingAttempts.find(
            (a) =>
                a.status === AttemptStatus.STARTED ||
                a.status === AttemptStatus.IN_PROGRESS
        );

        if (ongoingAttempt) {
            // Calculate remaining time
            const startTime = new Date(ongoingAttempt.startedAt);
            const endTime = new Date(
                startTime.getTime() + test.durationInMinutes * 60000
            );
            const remainingTime =
                Math.max(0, endTime.getTime() - now.getTime()) / 1000; // in seconds

            // If time is up, auto-submit
            if (remainingTime <= 0) {
                await submitTest(req, res);
                return;
            }

            // Continue with existing attempt
            return res.status(200).json({
                message: "Continuing existing test attempt",
                attemptId: ongoingAttempt.id,
                remainingTimeSeconds: remainingTime,
            });
        }

        // Create a new attempt
        const attempt = new TestAttempt();
        attempt.test = { id: testId } as any;
        attempt.student = { id: userId } as any;
        attempt.status = AttemptStatus.STARTED;

        const savedAttempt = await createRecord(TestAttempt, attempt);

        // Update test status in DB if it's the first attempt
        if (test.status === TestStatus.PUBLISHED) {
            await updateRecords(
                Test,
                { id: testId },
                { status: TestStatus.ACTIVE, lastUpdated: new Date() },
                false
            );

            // Update cache
            test.status = TestStatus.ACTIVE;
            await redisClient.set(
                `test:${testId}:config`,
                JSON.stringify(test),
                {
                    EX: 86400,
                }
            );
        }

        // Set active test counter in Redis
        const activeCounterKey = `test:${testId}:active_students`;
        const currentActiveCount = await redisClient.get(activeCounterKey);
        await redisClient.set(
            activeCounterKey,
            parseInt(currentActiveCount || "0") + 1
        );

        // Cache the attempt
        await redisClient.set(
            `test:${testId}:attempt:${userId}`,
            JSON.stringify({
                attemptId: (savedAttempt as TestAttempt).id,
                startedAt: (savedAttempt as TestAttempt).startedAt,
                status: (savedAttempt as TestAttempt).status,
            }),
            { EX: test.durationInMinutes * 60 } // Cache for the duration of the test
        );

        return res.status(201).json({
            message: "Test attempt started",
            attemptId: (savedAttempt as TestAttempt).id,
            startedAt: (savedAttempt as TestAttempt).startedAt,
            durationMinutes: test.durationInMinutes,
        });
    } catch (error) {
        logger.error("Error starting test attempt:", error);
        return res.status(500).json({ error: "Failed to start test attempt" });
    }
};

// Get test questions for an attempt
export const getTestQuestions = async (req: Request, res: Response) => {
    try {
        const { attemptId } = req.params;
        const userId = req.user.id;

        // Verify this is a valid attempt for this user
        let attempt;

        // Try to get from cache first
        const attemptCacheKey = `attempt:${attemptId}:user:${userId}`;
        const cachedAttempt = await redisClient.get(attemptCacheKey);

        if (cachedAttempt) {
            attempt = JSON.parse(cachedAttempt);
        } else {
            attempt = await getSingleRecord<TestAttempt, any>(TestAttempt, {
                where: {
                    id: attemptId,
                    student: { id: userId },
                    status: {
                        $in: [AttemptStatus.STARTED, AttemptStatus.IN_PROGRESS],
                    },
                },
                relations: ["test"],
            });

            if (!attempt) {
                return res
                    .status(404)
                    .json({ error: "Active test attempt not found" });
            }

            // Cache the attempt
            await redisClient.set(
                attemptCacheKey,
                JSON.stringify({
                    id: attempt.id,
                    testId: attempt.test.id,
                    startedAt: attempt.startedAt,
                    status: attempt.status,
                }),
                { EX: attempt.test.durationInMinutes * 60 }
            );
        }

        const testId = attempt.testId || attempt.test.id;

        // Update attempt status to IN_PROGRESS
        if (attempt.status === AttemptStatus.STARTED) {
            await updateRecords(
                TestAttempt,
                { id: attemptId },
                { status: AttemptStatus.IN_PROGRESS },
                false
            );

            // Update cache
            attempt.status = AttemptStatus.IN_PROGRESS;
            await redisClient.set(attemptCacheKey, JSON.stringify(attempt), {
                EX: 3600,
            });
        }

        // Get questions from cache if available
        let questions;
        const questionsCacheKey = `test:${testId}:questions`;
        const cachedQuestions = await redisClient.get(questionsCacheKey);

        if (cachedQuestions) {
            questions = JSON.parse(cachedQuestions);
        } else {
            // Get questions from database
            const questionsFromDB = await getAllRecordsWithFilter<
                Question,
                any
            >(Question, {
                where: { test: { id: testId } },
                relations: ["options"],
            });

            if (!questionsFromDB || questionsFromDB.length === 0) {
                return res
                    .status(404)
                    .json({ error: "No questions found for this test" });
            }

            // Format questions for cache (without correct answers)
            questions = questionsFromDB.map((q) => ({
                id: q.id,
                question_text: q.question_text,
                type: q.type,
                marks: q.marks,
                expectedWordCount: q.expectedWordCount,
                options:
                    q.type === QuestionType.MCQ
                        ? q.options.map((opt) => ({
                              id: opt.id,
                              text: opt.text,
                              // Don't include correct answer!
                          }))
                        : [],
            }));

            // Cache questions
            await redisClient.set(
                questionsCacheKey,
                JSON.stringify(questions),
                {
                    EX: 86400,
                }
            );
        }

        // Get test configuration (for shuffling)
        let testConfig;
        const testConfigCacheKey = `test:${testId}:config`;
        const cachedConfig = await redisClient.get(testConfigCacheKey);

        if (cachedConfig) {
            testConfig = JSON.parse(cachedConfig);

            // Shuffle questions if configured
            if (testConfig.shuffleQuestions) {
                questions = [...questions].sort(() => Math.random() - 0.5);
            }
        }

        // Get student's previous answers for this attempt
        let answers = [];
        const answersCacheKey = `test:${testId}:attempt:${attemptId}:answers`;
        const cachedAnswers = await redisClient.get(answersCacheKey);

        if (cachedAnswers) {
            answers = JSON.parse(cachedAnswers);
        } else {
            // Get answers from database
            const answersFromDB = await getAllRecordsWithFilter<
                TestAnswer,
                any
            >(TestAnswer, {
                where: { attempt: { id: attemptId } },
                relations: ["question"],
            });

            if (answersFromDB && answersFromDB.length > 0) {
                answers = answersFromDB.map((a) => ({
                    questionId: a.question.id,
                    selectedOptions: a.selectedOptions || [],
                    textAnswer: a.textAnswer || "",
                }));

                // Cache answers
                await redisClient.set(
                    answersCacheKey,
                    JSON.stringify(answers),
                    {
                        EX: 3600,
                    }
                );
            }
        }

        // Calculate remaining time
        const now = new Date();
        const startTime = new Date(attempt.startedAt);
        let testDuration;

        if (testConfig) {
            testDuration = testConfig.durationInMinutes * 60000; // convert to milliseconds
        } else {
            const test = await getSingleRecord<Test, any>(Test, {
                where: { id: testId },
            });
            testDuration = test.durationInMinutes * 60000;
        }

        const endTime = new Date(startTime.getTime() + testDuration);
        const remainingTime =
            Math.max(0, endTime.getTime() - now.getTime()) / 1000; // in seconds

        return res.status(200).json({
            message: "Test questions retrieved successfully",
            attemptId,
            questions,
            answers,
            remainingTimeSeconds: remainingTime,
        });
    } catch (error) {
        logger.error("Error fetching test questions:", error);
        return res
            .status(500)
            .json({ error: "Failed to fetch test questions" });
    }
};

// Save an answer during test
export const saveAnswer = async (req: Request, res: Response) => {
    try {
        const { attemptId } = req.params;
        const { questionId, selectedOptions, textAnswer } = req.body;
        const userId = req.user.id;

        if (!questionId) {
            return res.status(400).json({ error: "Question ID is required" });
        }

        // Verify this is the student's attempt
        const attempt = await getSingleRecord<TestAttempt, any>(TestAttempt, {
            where: {
                id: attemptId,
                student: { id: userId },
                status: AttemptStatus.IN_PROGRESS,
            },
            relations: ["test"],
        });

        if (!attempt) {
            return res
                .status(404)
                .json({ error: "Active test attempt not found" });
        }

        // Check if test time has expired
        const now = new Date();
        const startTime = new Date(attempt.startedAt);
        const endTime = new Date(
            startTime.getTime() + attempt.test.durationInMinutes * 60000
        );

        if (now > endTime) {
            // Auto-submit the test
            await autoSubmitTest(attemptId, userId);
            return res.status(400).json({
                error: "Test time has expired and has been auto-submitted",
            });
        }

        // Verify question belongs to this test
        const question = await getSingleRecord<Question, any>(Question, {
            where: { id: questionId, test: { id: attempt.test.id } },
        });

        if (!question) {
            return res
                .status(404)
                .json({ error: "Question not found in this test" });
        }

        // Check if answer already exists in DB
        const existingAnswer = await getSingleRecord<TestAnswer, any>(
            TestAnswer,
            {
                where: {
                    attempt: { id: attemptId },
                    question: { id: questionId },
                },
            }
        );

        // Create or update answer in DB
        if (existingAnswer) {
            existingAnswer.selectedOptions =
                question.type === QuestionType.MCQ ? selectedOptions || [] : [];
            existingAnswer.textAnswer =
                question.type === QuestionType.DESCRIPTIVE
                    ? textAnswer || ""
                    : "";
            await existingAnswer.save();
        } else {
            const newAnswer = new TestAnswer();
            newAnswer.attempt = { id: attemptId } as any;
            newAnswer.question = { id: questionId } as any;
            newAnswer.selectedOptions =
                question.type === QuestionType.MCQ ? selectedOptions || [] : [];
            newAnswer.textAnswer =
                question.type === QuestionType.DESCRIPTIVE
                    ? textAnswer || ""
                    : "";
            await createRecord(TestAnswer, newAnswer);
        }

        // Update answer in Redis cache
        const answersKey = `test:${attempt.test.id}:attempt:${attemptId}:answers`;
        const cachedAnswers = await redisClient.get(answersKey);
        let answers = [];

        if (cachedAnswers) {
            answers = JSON.parse(cachedAnswers);
            const answerIndex = answers.findIndex(
                (a) => a.questionId === questionId
            );

            if (answerIndex >= 0) {
                answers[answerIndex] = {
                    questionId,
                    selectedOptions:
                        question.type === QuestionType.MCQ
                            ? selectedOptions || []
                            : [],
                    textAnswer:
                        question.type === QuestionType.DESCRIPTIVE
                            ? textAnswer || ""
                            : "",
                };
            } else {
                answers.push({
                    questionId,
                    selectedOptions:
                        question.type === QuestionType.MCQ
                            ? selectedOptions || []
                            : [],
                    textAnswer:
                        question.type === QuestionType.DESCRIPTIVE
                            ? textAnswer || ""
                            : "",
                });
            }
        } else {
            answers = [
                {
                    questionId,
                    selectedOptions:
                        question.type === QuestionType.MCQ
                            ? selectedOptions || []
                            : [],
                    textAnswer:
                        question.type === QuestionType.DESCRIPTIVE
                            ? textAnswer || ""
                            : "",
                },
            ];
        }

        // Update cache
        await redisClient.set(answersKey, JSON.stringify(answers), {
            EX: 3600,
        });

        return res.status(200).json({
            message: "Answer saved successfully",
        });
    } catch (error) {
        logger.error("Error saving answer:", error);
        return res.status(500).json({ error: "Failed to save answer" });
    }
};

// Submit a test
export const submitTest = async (req: Request, res: Response) => {
    try {
        const { attemptId } = req.params;
        const userId = req.user.id;

        const result = await processTestSubmission(attemptId, userId);

        return res.status(200).json({
            message: "Test submitted successfully",
            ...result,
        });
    } catch (error) {
        logger.error("Error submitting test:", error);
        return res.status(500).json({ error: "Failed to submit test" });
    }
};

// Auto-submit a test when time expires
const autoSubmitTest = async (attemptId: string, userId: string) => {
    try {
        const result = await processTestSubmission(attemptId, userId);
        return result;
    } catch (error) {
        logger.error("Error auto-submitting test:", error);
        throw error;
    }
};

// Common function to process test submission
const processTestSubmission = async (attemptId: string, userId: string) => {
    // Verify this is the student's attempt
    const attempt = await getSingleRecord<TestAttempt, any>(TestAttempt, {
        where: {
            id: attemptId,
            student: { id: userId },
            status: { $in: [AttemptStatus.STARTED, AttemptStatus.IN_PROGRESS] },
        },
        relations: [
            "test",
            "answers",
            "answers.question",
            "answers.question.options",
        ],
    });

    if (!attempt) {
        throw new Error("Active test attempt not found");
    }

    const testId = attempt.test.id;

    // Auto-grade MCQ questions
    let totalScore = 0;
    let hasDescriptiveQuestions = false;

    for (const answer of attempt.answers || []) {
        if (answer.question.type === QuestionType.MCQ) {
            // Get correct options for this question
            const correctOptionIds = answer.question.options
                .filter((opt) => opt.correct)
                .map((opt) => opt.id);

            // Check if selected options match correct options exactly
            const selectedOptions = answer.selectedOptions || [];
            const isCorrect =
                selectedOptions.length === correctOptionIds.length &&
                selectedOptions.every((opt) => correctOptionIds.includes(opt));

            if (isCorrect) {
                answer.score = answer.question.marks;
                totalScore += answer.score;
            } else {
                answer.score = 0;
            }

            answer.isEvaluated = true;
        } else if (answer.question.type === QuestionType.DESCRIPTIVE) {
            hasDescriptiveQuestions = true;
            answer.score = null;
            answer.isEvaluated = false;
        }

        await answer.save();
    }

    // Update attempt status
    attempt.status = AttemptStatus.SUBMITTED;
    attempt.submittedAt = new Date();

    // If there are only MCQ questions, mark as evaluated
    if (!hasDescriptiveQuestions) {
        attempt.status = AttemptStatus.EVALUATED;
        attempt.score = totalScore;

        // Update leaderboard in Redis
        await updateLeaderboard(testId);
    }

    await attempt.save();

    // Decrement active student counter
    const activeCountKey = `test:${testId}:active_students`;
    const currentActive = parseInt(
        (await redisClient.get(activeCountKey)) || "0"
    );

    if (currentActive > 0) {
        await redisClient.set(activeCountKey, currentActive - 1);

        // If this was the last student, update test status if end time has passed
        if (currentActive - 1 === 0) {
            const now = new Date();
            const testEndTime = new Date(attempt.test.endDate);

            if (now >= testEndTime) {
                await updateRecords(
                    Test,
                    { id: testId },
                    { status: TestStatus.COMPLETED, lastUpdated: new Date() },
                    false
                );
            }
        }
    }

    // Clear cache entries
    await redisClient.del(`test:${testId}:attempt:${userId}`);
    await redisClient.del(`test:${testId}:attempt:${attemptId}:answers`);
    await redisClient.del(`attempt:${attemptId}:user:${userId}`);

    // Update user's available tests cache
    await redisClient.del(`user:${userId}:available_tests`);

    return {
        attemptId: attempt.id,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        score: attempt.score,
        needsManualGrading: hasDescriptiveQuestions,
        autoGradedScore: totalScore,
    };
};

// Get test results after completion
export const getTestResults = async (req: Request, res: Response) => {
    try {
        const { attemptId } = req.params;
        const userId = req.user.id;

        // Verify this is the student's attempt and it's completed
        const attempt = await getSingleRecord<TestAttempt, any>(TestAttempt, {
            where: {
                id: attemptId,
                student: { id: userId },
                status: {
                    $in: [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED],
                },
            },
            relations: ["test", "answers", "answers.question"],
        });

        if (!attempt) {
            return res
                .status(404)
                .json({ error: "Test attempt not found or not completed" });
        }

        // Check if test allows viewing results
        if (
            attempt.status !== AttemptStatus.EVALUATED &&
            !attempt.test.showResults
        ) {
            return res
                .status(403)
                .json({ error: "Test results are not available yet" });
        }

        // Format the results
        const results = {
            testId: attempt.test.id,
            testTitle: attempt.test.title,
            attemptId: attempt.id,
            submittedAt: attempt.submittedAt,
            status: attempt.status,
            score: attempt.score,
            maxMarks: attempt.test.maxMarks,
            passingMarks: attempt.test.passingMarks,
            passed:
                attempt.status === AttemptStatus.EVALUATED
                    ? attempt.score >= attempt.test.passingMarks
                    : null,
            answers: attempt.answers.map((answer) => ({
                questionId: answer.question.id,
                questionText: answer.question.question_text,
                type: answer.question.type,
                maxMarks: answer.question.marks,
                selectedOptions: answer.selectedOptions,
                textAnswer: answer.textAnswer,
                score: answer.score,
                feedback: answer.feedback,
                isEvaluated: answer.isEvaluated,
            })),
        };

        // Include correct answers if test is configured to show them
        if (
            attempt.test.showCorrectAnswers &&
            attempt.status === AttemptStatus.EVALUATED
        ) {
            for (const answer of results.answers) {
                if (answer.type === QuestionType.MCQ) {
                    const question = await getSingleRecord<Question, any>(
                        Question,
                        {
                            where: { id: answer.questionId },
                            relations: ["options"],
                        }
                    );

                    answer["correctOptions"] = question.options
                        .filter((opt) => opt.correct)
                        .map((opt) => opt.id);
                }
            }
        }

        // If test shows leaderboard and is evaluated, include position
        if (
            attempt.status === AttemptStatus.EVALUATED &&
            attempt.test.showResults
        ) {
            // Try to get leaderboard from cache
            const leaderboardKey = `test:${attempt.test.id}:leaderboard`;
            const cachedLeaderboard = await redisClient.get(leaderboardKey);

            if (cachedLeaderboard) {
                const leaderboard = JSON.parse(cachedLeaderboard);
                const position = leaderboard.findIndex(
                    (entry) => entry.attemptId === attemptId
                );

                if (position !== -1) {
                    results["position"] = position + 1;
                    results["totalParticipants"] = leaderboard.length;
                }
            }
        }

        return res.status(200).json({
            message: "Test results retrieved successfully",
            results,
        });
    } catch (error) {
        logger.error("Error fetching test results:", error);
        return res.status(500).json({ error: "Failed to fetch test results" });
    }
};

// Get test attempt history
export const getTestAttemptHistory = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;

        // Get all completed attempts for the student
        const attempts = await getAllRecordsWithFilter<TestAttempt, any>(
            TestAttempt,
            {
                where: {
                    student: { id: userId },
                    status: {
                        $in: [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED],
                    },
                },
                relations: ["test", "test.course"],
                order: { submittedAt: "DESC" },
            }
        );

        const history = attempts.map((attempt) => ({
            attemptId: attempt.id,
            testId: attempt.test.id,
            testTitle: attempt.test.title,
            courseName: attempt.test.course.title,
            status: attempt.status,
            score: attempt.score,
            maxScore: attempt.test.maxMarks,
            submittedAt: attempt.submittedAt,
            isEvaluated: attempt.status === AttemptStatus.EVALUATED,
            passed:
                attempt.status === AttemptStatus.EVALUATED
                    ? attempt.score >= attempt.test.passingMarks
                    : null,
        }));

        return res.status(200).json({
            message: "Test attempt history retrieved successfully",
            history,
        });
    } catch (error) {
        logger.error("Error fetching test history:", error);
        return res.status(500).json({ error: "Failed to fetch test history" });
    }
};

// Get leaderboard for a test
export const getTestLeaderboard = async (req: Request, res: Response) => {
    try {
        const { testId } = req.params;

        // Try to get from cache
        const leaderboardKey = `test:${testId}:leaderboard`;
        const cachedLeaderboard = await redisClient.get(leaderboardKey);

        if (cachedLeaderboard) {
            return res.status(200).json({
                message: "Leaderboard retrieved successfully",
                leaderboard: JSON.parse(cachedLeaderboard),
            });
        }

        // If not in cache, generate the leaderboard
        const leaderboard = await generateLeaderboard(testId);

        return res.status(200).json({
            message: "Leaderboard retrieved successfully",
            leaderboard,
        });
    } catch (error) {
        logger.error("Error fetching leaderboard:", error);
        return res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
};

// Helper function to update leaderboard in Redis
const updateLeaderboard = async (testId: string) => {
    await generateLeaderboard(testId);
};

// Helper function to generate the leaderboard
const generateLeaderboard = async (testId: string) => {
    try {
        const attempts = await getAllRecordsWithFilter<TestAttempt, any>(
            TestAttempt,
            {
                where: {
                    test: { id: testId },
                    status: AttemptStatus.EVALUATED,
                },
                relations: ["student"],
            }
        );

        if (attempts.length === 0) {
            return [];
        }

        const leaderboard = attempts
            .map((attempt) => ({
                attemptId: attempt.id,
                studentId: attempt.student.id,
                studentName: attempt.student.username,
                score: attempt.score || 0,
                submittedAt: attempt.submittedAt,
            }))
            .sort((a, b) => {
                // Sort by score first (descending)
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                // Then by submission time (ascending) for tiebreaker
                return (
                    new Date(a.submittedAt).getTime() -
                    new Date(b.submittedAt).getTime()
                );
            });

        // Cache the leaderboard
        await redisClient.set(
            `test:${testId}:leaderboard`,
            JSON.stringify(leaderboard),
            { EX: 600 }
        );

        return leaderboard;
    } catch (error) {
        logger.error("Error generating leaderboard:", error);
        throw error;
    }
};
