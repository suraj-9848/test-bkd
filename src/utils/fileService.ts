import fs from "fs";
import path from "path";

/**
 * Service for handling file operations for the hiring portal
 */
class FileService {
  /**
   * Ensures a directory exists, creating it if necessary
   * @param directory The directory path to ensure exists
   */
  public ensureDirectoryExists(directory: string): void {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  /**
   * Saves a file from a buffer
   * @param fileBuffer The file buffer
   * @param fileName The file name
   * @param directory The directory to save the file to
   * @returns The file path
   */
  public saveFile(
    fileBuffer: Buffer,
    fileName: string,
    directory: string,
  ): string {
    this.ensureDirectoryExists(directory);
    const filePath = path.join(directory, fileName);
    fs.writeFileSync(filePath, fileBuffer);
    return filePath;
  }

  /**
   * Deletes a file if it exists
   * @param filePath The file path to delete
   * @returns True if the file was deleted, false if it did not exist
   */
  public deleteFile(filePath: string): boolean {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  /**
   * Generates a unique file name
   * @param originalName The original file name
   * @param prefix An optional prefix for the file name
   * @returns A unique file name
   */
  public generateUniqueFileName(
    originalName: string,
    prefix: string = "",
  ): string {
    const timestamp = Date.now();
    const extension = path.extname(originalName);
    const sanitizedPrefix = prefix.replace(/\s+/g, "_");
    return `${timestamp}_${sanitizedPrefix}${extension}`;
  }

  /**
   * Gets the JD file directory path
   * @returns The JD file directory path
   */
  public getJDFileDirectory(): string {
    return path.join(process.cwd(), "uploads", "jd_files");
  }

  /**
   * Gets the resume directory path
   * @returns The resume directory path
   */
  public getResumeDirectory(): string {
    return path.join(process.cwd(), "uploads", "resumes");
  }
}

export const fileService = new FileService();
