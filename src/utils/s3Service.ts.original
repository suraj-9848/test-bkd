import AWS from 'aws-sdk';
import { config } from '../config';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for handling file operations with AWS S3
 */
class S3Service {
  private s3: AWS.S3;
  
  constructor() {
    // Configure AWS SDK
    AWS.config.update({
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      region: config.AWS_REGION || 'us-east-1'
    });
    
    this.s3 = new AWS.S3();
  }
  
  /**
   * Generates a unique file name for S3
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
   * Uploads a file to S3 bucket
   * @param fileBuffer The file buffer
   * @param fileName The name to use for the file in S3
   * @param contentType The MIME type of the file
   * @param folder Optional folder path within the bucket
   * @returns The S3 URL of the uploaded file
   */
  public async uploadFile(
    fileBuffer: Buffer, 
    fileName: string, 
    contentType: string,
    folder: string = ''
  ): Promise<string> {
    const bucketName = config.AWS_S3_BUCKET_NAME;
    
    if (!bucketName) {
      throw new Error('AWS S3 bucket name not configured');
    }
    
    const s3Key = folder ? `${folder}/${fileName}` : fileName;
    
    const params: AWS.S3.PutObjectRequest = {
      Bucket: bucketName,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'public-read' // Make sure the file is publicly accessible
    };
    
    try {
      const result = await this.s3.upload(params).promise();
      return result.Location; // Return the public URL
    } catch (error) {
      console.error('Error uploading to S3:', error);
      throw error;
    }
  }
  
  /**
   * Deletes a file from S3 bucket
   * @param s3Url The full S3 URL of the file to delete
   * @returns Promise resolving to success status
   */
  public async deleteFile(s3Url: string): Promise<boolean> {
    const bucketName = config.AWS_S3_BUCKET_NAME;
    
    if (!bucketName) {
      throw new Error('AWS S3 bucket name not configured');
    }
    
    // Extract the key from the URL
    // URL format: https://bucket-name.s3.region.amazonaws.com/key
    let key = s3Url.split(`${bucketName}.s3.`)[1];
    if (key) {
      key = key.split('/').slice(1).join('/');
    } else {
      // Alternative way to extract key if the URL format is different
      key = new URL(s3Url).pathname.substring(1);
    }
    
    const params: AWS.S3.DeleteObjectRequest = {
      Bucket: bucketName,
      Key: key
    };
    
    try {
      await this.s3.deleteObject(params).promise();
      return true;
    } catch (error) {
      console.error('Error deleting from S3:', error);
      return false;
    }
  /**
   * Tests connection to S3 bucket
   * @returns Promise resolving to true if connection is successful
   * @throws Error if connection fails
   */
  public async testConnection(): Promise<boolean> {
    const bucketName = config.AWS_S3_BUCKET_NAME;
    
    if (!bucketName) {
      throw new Error('AWS S3 bucket name not configured');
    }
    
    try {
      // List objects with max-keys=1 to minimize data transfer
      const params: AWS.S3.ListObjectsV2Request = {
        Bucket: bucketName,
        MaxKeys: 1
      };
      
      await this.s3.listObjectsV2(params).promise();
      return true;
    } catch (error) {
      console.error('Error connecting to S3:', error);
      throw error;
    }
  }
}

export const s3Service = new S3Service();
