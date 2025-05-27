import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mock S3 Service for local testing without AWS credentials
 * This saves files locally instead of uploading to S3
 */
class MockS3Service {
  private localStoragePath: string;
  
  constructor() {
    // Local path for storing "uploaded" files
    this.localStoragePath = path.join(process.cwd(), 'uploads');
    this.ensureDirectoryExists(this.localStoragePath);
  }
  
  /**
   * Make sure the upload directory exists
   */
  private ensureDirectoryExists(directoryPath: string): void {
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }
  }
  
  /**
   * Generates a unique file name
   * @param originalName The original file name
   * @param prefix An optional prefix for the file name
   * @returns A unique file name
   */
  public generateUniqueFileName(originalName: string, prefix: string = ''): string {
    const timestamp = Date.now();
    const extension = path.extname(originalName);
    const sanitizedPrefix = prefix.replace(/\s+/g, '_');
    return `${sanitizedPrefix ? sanitizedPrefix + '_' : ''}${timestamp}_${uuidv4().substring(0, 8)}${extension}`;
  }
  
  /**
   * Simulates uploading a file to S3 by saving it locally
   * @param fileBuffer The file buffer
   * @param fileName The name to use for the file
   * @param contentType The MIME type of the file
   * @param folder Optional folder path 
   * @returns The local URL of the "uploaded" file
   */
  public async uploadFile(
    fileBuffer: Buffer, 
    fileName: string, 
    contentType: string,
    folder: string = ''
  ): Promise<string> {
    // Create folder if it doesn't exist
    const folderPath = path.join(this.localStoragePath, folder);
    this.ensureDirectoryExists(folderPath);
    
    // Save file to local storage
    const filePath = path.join(folderPath, fileName);
    fs.writeFileSync(filePath, fileBuffer);
    
    // Return a local "URL" that points to the file
    return `file://${filePath}`;
  }
  
  /**
   * Simulates checking if a file exists in S3
   * @param fileName The name of the file to check
   * @param folder Optional folder path
   * @returns Whether the file exists
   */
  public async fileExists(fileName: string, folder: string = ''): Promise<boolean> {
    const filePath = path.join(this.localStoragePath, folder, fileName);
    return fs.existsSync(filePath);
  }
  
  /**
   * Simulates deleting a file from S3
   * @param fileName The name of the file to delete
   * @param folder Optional folder path
   * @returns Whether the deletion was successful
   */
  public async deleteFile(fileName: string, folder: string = ''): Promise<boolean> {
    const filePath = path.join(this.localStoragePath, folder, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
  
  /**
   * Simulates getting a presigned URL for a file
   * @param fileName The name of the file
   * @param folder Optional folder path
   * @returns A mock presigned URL (just the local path)
   */
  public getSignedUrl(fileName: string, folder: string = ''): string {
    return `file://${path.join(this.localStoragePath, folder, fileName)}`;
  }
  
  /**
   * Simulates getting a file from S3
   * @param fileName The name of the file to get
   * @param folder Optional folder path
   * @returns The file buffer or null if not found
   */
  public async getFile(fileName: string, folder: string = ''): Promise<Buffer | null> {
    const filePath = path.join(this.localStoragePath, folder, fileName);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
    return null;
  }
  
  /**
   * Checks the health of the service
   * @returns A health status object
   */
  public async checkHealth(): Promise<{ status: string; message: string }> {
    try {
      // Check if we can write to the local storage
      const testFile = path.join(this.localStoragePath, 'health-check.txt');
      fs.writeFileSync(testFile, 'Health check');
      fs.unlinkSync(testFile);
      return { status: 'healthy', message: 'Mock S3 service is working correctly' };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: `Mock S3 service failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
}

export default new MockS3Service();
