import { Request, Response } from "express";
import { Meeting } from "../../db/mysqlModels/Meeting";
import { Course } from "../../db/mysqlModels/Course";

// Instructor: Create meeting
export const createMeeting = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const { title, description, link, startTime, endTime, approvedEmails } =
      req.body;

    if (
      !title ||
      !link ||
      !startTime ||
      !endTime ||
      !Array.isArray(approvedEmails)
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ message: "Invalid start/end time" });
    }

    const course = await Course.findOne({ where: { id: courseId } });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const meeting = Meeting.create({
      title,
      description,
      link,
      startTime: start,
      endTime: end,
      approvedEmails,
      courseId,
    });
    await meeting.save();
    return res.status(201).json({ message: "Meeting created", data: meeting });
  } catch (e) {
    console.error("createMeeting error", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Instructor: list meetings for a course
export const getMeetingsForCourse = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findOne({ where: { id: courseId } });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const meetings = await Meeting.find({ where: { courseId } });
    return res
      .status(200)
      .json({ message: "Meetings fetched", data: meetings });
  } catch (e) {
    console.error("getMeetingsForCourse error", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// NEW: Get single meeting (instructor)
export const getMeetingById = async (req: Request, res: Response) => {
  try {
    const { courseId, meetingId } = req.params;
    const meeting = await Meeting.findOne({
      where: { id: meetingId, courseId },
    });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    return res.status(200).json({ message: "Meeting fetched", data: meeting });
  } catch (e) {
    console.error("getMeetingById error", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// NEW: Update meeting (partial update)
export const updateMeeting = async (req: Request, res: Response) => {
  try {
    const { courseId, meetingId } = req.params;
    const meeting = await Meeting.findOne({
      where: { id: meetingId, courseId },
    });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    const { title, description, link, startTime, endTime, approvedEmails } =
      req.body;

    if (approvedEmails !== undefined && !Array.isArray(approvedEmails)) {
      return res
        .status(400)
        .json({ message: "approvedEmails must be an array" });
    }

    if (title !== undefined) meeting.title = title;
    if (description !== undefined) meeting.description = description;
    if (link !== undefined) meeting.link = link;
    if (startTime !== undefined) {
      const s = new Date(startTime);
      if (isNaN(s.getTime()))
        return res.status(400).json({ message: "Invalid startTime" });
      meeting.startTime = s;
    }
    if (endTime !== undefined) {
      const eTime = new Date(endTime);
      if (isNaN(eTime.getTime()))
        return res.status(400).json({ message: "Invalid endTime" });
      meeting.endTime = eTime;
    }
    if (meeting.endTime <= meeting.startTime) {
      return res
        .status(400)
        .json({ message: "endTime must be after startTime" });
    }
    if (approvedEmails !== undefined) meeting.approvedEmails = approvedEmails;

    await meeting.save();
    return res.status(200).json({ message: "Meeting updated", data: meeting });
  } catch (e) {
    console.error("updateMeeting error", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// NEW: Delete meeting
export const deleteMeeting = async (req: Request, res: Response) => {
  try {
    const { courseId, meetingId } = req.params;
    const meeting = await Meeting.findOne({
      where: { id: meetingId, courseId },
    });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    await meeting.remove();
    return res.status(200).json({ message: "Meeting deleted" });
  } catch (e) {
    console.error("deleteMeeting error", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Student: meetings they are approved for in a course
export const getStudentMeetings = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const userEmail = (req as any).user?.email;
    if (!userEmail) return res.status(401).json({ message: "Unauthorized" });

    const meetings = await Meeting.find({ where: { courseId } });
    const allowed = meetings.filter((m) =>
      m.approvedEmails.includes(userEmail),
    );
    return res.status(200).json({ message: "Meetings fetched", data: allowed });
  } catch (e) {
    console.error("getStudentMeetings error", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};
