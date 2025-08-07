import { Repository } from "typeorm";
import { AppDataSource } from "../../db/connect";
import {
  CPEditRequest,
  CPEditRequestStatus,
} from "../../db/mysqlModels/CPEditRequest";
import { User } from "../../db/mysqlModels/User";
import { CPTracker } from "../../db/mysqlModels/CPTracker";

interface EditRequestData {
  leetcode_username?: string;
  codeforces_username?: string;
  codechef_username?: string;
  atcoder_username?: string;
  active_platforms: string[];
  reason: string;
}

interface GetEditRequestsOptions {
  status?: string;
  limit?: number;
  offset?: number;
}

export class CPEditRequestService {
  private static editRequestRepository: Repository<CPEditRequest>;
  private static userRepository: Repository<User>;
  private static cpTrackerRepository: Repository<CPTracker>;

  static async initialize() {
    this.editRequestRepository = AppDataSource.getRepository(CPEditRequest);
    this.userRepository = AppDataSource.getRepository(User);
    this.cpTrackerRepository = AppDataSource.getRepository(CPTracker);
  }

  static async createEditRequest(
    userId: string,
    editData: EditRequestData,
  ): Promise<CPEditRequest> {
    if (!this.editRequestRepository) {
      await this.initialize();
    }

    // Check if user has pending request
    const existingRequest = await this.editRequestRepository.findOne({
      where: {
        user: { id: userId },
        status: CPEditRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new Error("User already has a pending edit request");
    }

    // Get user and current tracker
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get current CP tracker to store current values
    const currentTracker = await this.cpTrackerRepository.findOne({
      where: { user: { id: userId } },
    });

    // Create edit request
    const editRequest = this.editRequestRepository.create({
      user,
      current_leetcode_username: currentTracker?.leetcode_username,
      current_codeforces_username: currentTracker?.codeforces_username,
      current_codechef_username: currentTracker?.codechef_username,
      current_atcoder_username: currentTracker?.atcoder_username,
      requested_leetcode_username: editData.leetcode_username,
      requested_codeforces_username: editData.codeforces_username,
      requested_codechef_username: editData.codechef_username,
      requested_atcoder_username: editData.atcoder_username,
      requested_active_platforms: editData.active_platforms,
      reason: editData.reason,
      status: CPEditRequestStatus.PENDING,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return await this.editRequestRepository.save(editRequest);
  }

  static async getEditRequests(
    options: GetEditRequestsOptions = {},
  ): Promise<CPEditRequest[]> {
    if (!this.editRequestRepository) {
      await this.initialize();
    }

    const query = this.editRequestRepository
      .createQueryBuilder("request")
      .leftJoinAndSelect("request.user", "user")
      .orderBy("request.created_at", "DESC");

    if (options.status) {
      const statusEnum =
        options.status.toLowerCase() === "pending"
          ? CPEditRequestStatus.PENDING
          : options.status.toLowerCase() === "approved"
            ? CPEditRequestStatus.APPROVED
            : options.status.toLowerCase() === "rejected"
              ? CPEditRequestStatus.REJECTED
              : null;

      if (statusEnum) {
        query.where("request.status = :status", { status: statusEnum });
      }
    }

    if (options.limit) {
      query.take(options.limit);
    }

    if (options.offset) {
      query.skip(options.offset);
    }

    return await query.getMany();
  }

  static async getEditRequestById(
    requestId: string,
  ): Promise<CPEditRequest | null> {
    if (!this.editRequestRepository) {
      await this.initialize();
    }

    return await this.editRequestRepository.findOne({
      where: { id: requestId },
      relations: ["user"],
    });
  }

  static async approveEditRequest(
    requestId: string,
    adminId: string,
  ): Promise<CPEditRequest> {
    if (!this.editRequestRepository) {
      await this.initialize();
    }

    const editRequest = await this.getEditRequestById(requestId);
    if (!editRequest) {
      throw new Error("Edit request not found");
    }

    if (editRequest.status !== CPEditRequestStatus.PENDING) {
      throw new Error("Edit request is not pending");
    }

    // Update or create CP tracker
    let cpTracker = await this.cpTrackerRepository.findOne({
      where: { user: { id: editRequest.user.id } },
    });

    if (cpTracker) {
      // Update existing tracker
      if (editRequest.requested_leetcode_username !== undefined) {
        cpTracker.leetcode_username = editRequest.requested_leetcode_username;
      }
      if (editRequest.requested_codeforces_username !== undefined) {
        cpTracker.codeforces_username =
          editRequest.requested_codeforces_username;
      }
      if (editRequest.requested_codechef_username !== undefined) {
        cpTracker.codechef_username = editRequest.requested_codechef_username;
      }
      if (editRequest.requested_atcoder_username !== undefined) {
        cpTracker.atcoder_username = editRequest.requested_atcoder_username;
      }
      if (editRequest.requested_active_platforms) {
        cpTracker.active_platforms = editRequest.requested_active_platforms;
      }
      cpTracker.updated_at = new Date();
    } else {
      // Create new tracker
      cpTracker = this.cpTrackerRepository.create({
        user: editRequest.user,
        leetcode_username: editRequest.requested_leetcode_username,
        codeforces_username: editRequest.requested_codeforces_username,
        codechef_username: editRequest.requested_codechef_username,
        atcoder_username: editRequest.requested_atcoder_username,
        active_platforms: editRequest.requested_active_platforms || [],
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    await this.cpTrackerRepository.save(cpTracker);

    // Update request status
    editRequest.status = CPEditRequestStatus.APPROVED;
    editRequest.reviewed_by = adminId;
    editRequest.reviewed_at = new Date();
    editRequest.updated_at = new Date();

    return await this.editRequestRepository.save(editRequest);
  }

  static async rejectEditRequest(
    requestId: string,
    adminId: string,
    rejectionReason: string,
  ): Promise<CPEditRequest> {
    if (!this.editRequestRepository) {
      await this.initialize();
    }

    const editRequest = await this.getEditRequestById(requestId);
    if (!editRequest) {
      throw new Error("Edit request not found");
    }

    if (editRequest.status !== CPEditRequestStatus.PENDING) {
      throw new Error("Edit request is not pending");
    }

    // Update request status
    editRequest.status = CPEditRequestStatus.REJECTED;
    editRequest.reviewed_by = adminId;
    editRequest.reviewed_at = new Date();
    editRequest.admin_notes = rejectionReason;
    editRequest.updated_at = new Date();

    return await this.editRequestRepository.save(editRequest);
  }

  static async getUserEditRequests(userId: string): Promise<CPEditRequest[]> {
    if (!this.editRequestRepository) {
      await this.initialize();
    }

    return await this.editRequestRepository.find({
      where: { user: { id: userId } },
      order: { created_at: "DESC" },
    });
  }

  static async hasEditedOnce(userId: string): Promise<boolean> {
    if (!this.editRequestRepository) {
      await this.initialize();
    }

    // Check if user has any approved edit requests
    const approvedRequest = await this.editRequestRepository.findOne({
      where: {
        user: { id: userId },
        status: CPEditRequestStatus.APPROVED,
      },
    });

    return !!approvedRequest;
  }
}
