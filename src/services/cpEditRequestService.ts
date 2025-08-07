import { AppDataSource } from "../db/connect";
import {
  CPEditRequest,
  CPEditRequestStatus,
} from "../db/mysqlModels/CPEditRequest";
import { CPTracker } from "../db/mysqlModels/CPTracker";
import { User } from "../db/mysqlModels/User";
import { getLogger } from "../utils/logger";

const logger = getLogger();

export class CPEditRequestService {
  private static cpEditRequestRepo = AppDataSource.getRepository(CPEditRequest);
  private static cpTrackerRepo = AppDataSource.getRepository(CPTracker);
  private static userRepo = AppDataSource.getRepository(User);

  // Create new edit request
  static async createEditRequest(
    userId: string,
    requestData: {
      leetcode_username?: string;
      codeforces_username?: string;
      codechef_username?: string;
      atcoder_username?: string;
      active_platforms: string[];
      reason: string;
    },
  ) {
    try {
      // Check if user has pending request
      const existingRequest = await this.cpEditRequestRepo.findOne({
        where: {
          user_id: userId,
          status: CPEditRequestStatus.PENDING,
        },
      });

      if (existingRequest) {
        throw new Error(
          "You already have a pending edit request. Please wait for admin approval.",
        );
      }

      // Get current CP tracker data
      const currentTracker = await this.cpTrackerRepo.findOne({
        where: { user_id: userId },
      });

      if (!currentTracker) {
        throw new Error("CP Tracker profile not found");
      }

      // Create edit request
      const editRequest = new CPEditRequest();
      editRequest.user_id = userId;

      // Current values
      editRequest.current_leetcode_username = currentTracker.leetcode_username;
      editRequest.current_codeforces_username =
        currentTracker.codeforces_username;
      editRequest.current_codechef_username = currentTracker.codechef_username;
      editRequest.current_atcoder_username = currentTracker.atcoder_username;

      // Requested changes
      editRequest.requested_leetcode_username = requestData.leetcode_username;
      editRequest.requested_codeforces_username =
        requestData.codeforces_username;
      editRequest.requested_codechef_username = requestData.codechef_username;
      editRequest.requested_atcoder_username = requestData.atcoder_username;
      editRequest.requested_active_platforms = requestData.active_platforms;

      editRequest.reason = requestData.reason;

      await this.cpEditRequestRepo.save(editRequest);

      logger.info(`CP edit request created for user ${userId}`);
      return editRequest;
    } catch (error) {
      logger.error(
        `Error creating CP edit request for user ${userId}:`,
        error.message,
      );
      throw error;
    }
  }

  // Get edit requests with pagination
  static async getEditRequests(
    page: number = 1,
    limit: number = 10,
    status?: CPEditRequestStatus,
  ) {
    try {
      const queryBuilder = this.cpEditRequestRepo
        .createQueryBuilder("request")
        .leftJoinAndSelect("request.user", "user")
        .leftJoinAndSelect("request.reviewer", "reviewer")
        .orderBy("request.created_at", "DESC")
        .skip((page - 1) * limit)
        .take(limit);

      if (status) {
        queryBuilder.where("request.status = :status", { status });
      }

      const [requests, total] = await queryBuilder.getManyAndCount();

      return {
        requests,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error("Error fetching CP edit requests:", error.message);
      throw error;
    }
  }

  // Approve edit request
  static async approveEditRequest(
    requestId: string,
    adminId: string,
    adminNotes?: string,
  ) {
    try {
      const request = await this.cpEditRequestRepo.findOne({
        where: { id: requestId },
        relations: ["user"],
      });

      if (!request) {
        throw new Error("Edit request not found");
      }

      if (request.status !== CPEditRequestStatus.PENDING) {
        throw new Error("Request has already been processed");
      }

      // Update CP tracker with new values
      const tracker = await this.cpTrackerRepo.findOne({
        where: { user_id: request.user_id },
      });

      if (!tracker) {
        throw new Error("CP Tracker not found");
      }

      tracker.leetcode_username = request.requested_leetcode_username;
      tracker.codeforces_username = request.requested_codeforces_username;
      tracker.codechef_username = request.requested_codechef_username;
      tracker.atcoder_username = request.requested_atcoder_username;
      tracker.active_platforms = request.requested_active_platforms;

      await this.cpTrackerRepo.save(tracker);

      // Update request status
      request.status = CPEditRequestStatus.APPROVED;
      request.reviewed_by = adminId;
      request.admin_notes = adminNotes;
      request.reviewed_at = new Date();

      await this.cpEditRequestRepo.save(request);

      logger.info(`CP edit request ${requestId} approved by admin ${adminId}`);
      return request;
    } catch (error) {
      logger.error(
        `Error approving CP edit request ${requestId}:`,
        error.message,
      );
      throw error;
    }
  }

  // Reject edit request
  static async rejectEditRequest(
    requestId: string,
    adminId: string,
    adminNotes: string,
  ) {
    try {
      const request = await this.cpEditRequestRepo.findOne({
        where: { id: requestId },
      });

      if (!request) {
        throw new Error("Edit request not found");
      }

      if (request.status !== CPEditRequestStatus.PENDING) {
        throw new Error("Request has already been processed");
      }

      request.status = CPEditRequestStatus.REJECTED;
      request.reviewed_by = adminId;
      request.admin_notes = adminNotes;
      request.reviewed_at = new Date();

      await this.cpEditRequestRepo.save(request);

      logger.info(`CP edit request ${requestId} rejected by admin ${adminId}`);
      return request;
    } catch (error) {
      logger.error(
        `Error rejecting CP edit request ${requestId}:`,
        error.message,
      );
      throw error;
    }
  }

  // Get user's edit requests
  static async getUserEditRequests(userId: string) {
    try {
      const requests = await this.cpEditRequestRepo.find({
        where: { user_id: userId },
        relations: ["reviewer"],
        order: { created_at: "DESC" },
      });

      return requests;
    } catch (error) {
      logger.error(
        `Error fetching edit requests for user ${userId}:`,
        error.message,
      );
      throw error;
    }
  }

  // Check if user can edit their profile
  static async canUserEdit(userId: string): Promise<boolean> {
    try {
      const tracker = await this.cpTrackerRepo.findOne({
        where: { user_id: userId },
      });

      return tracker ? true : true;
    } catch (error) {
      logger.error(
        `Error checking edit permission for user ${userId}:`,
        error.message,
      );
      return false;
    }
  }

  // Get pending edit request for a user
  static async getPendingRequestByUserId(userId: string) {
    try {
      const request = await this.cpEditRequestRepo.findOne({
        where: {
          user_id: userId,
          status: CPEditRequestStatus.PENDING,
        },
        relations: ["user"],
        order: { created_at: "DESC" },
      });

      return request;
    } catch (error) {
      logger.error(
        `Error fetching pending request for user ${userId}:`,
        error.message,
      );
      throw error;
    }
  }
}
