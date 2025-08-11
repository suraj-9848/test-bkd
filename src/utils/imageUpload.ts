import AWS from "aws-sdk";
import { config } from "../config";
import { v4 as uuidv4 } from "uuid";

const s3 = new AWS.S3({
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  region: config.AWS_REGION,
  endpoint: config.AWS_S3_ENDPOINT,
  s3ForcePathStyle: true,
  signatureVersion: "v4",
});

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

/**
 * Securely uploads an image buffer to DigitalOcean Spaces and returns the public URL.
 * Adds error handling, file name uniqueness, and basic MIME type validation.
 * @param {Buffer} buffer - The image buffer.
 * @param {string} originalFileName - The original file name (for extension).
 * @param {string} mimeType - The MIME type of the image (e.g., 'image/png').
 * @returns {Promise<string>} - The public URL of the uploaded image.
 */
export async function uploadImageAndGetUrl(
  buffer: Buffer,
  originalFileName: string,
  mimeType: string,
): Promise<string> {
  // Validate MIME type
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error("Invalid image MIME type");
  }

  // Generate unique file name
  const ext = originalFileName.split(".").pop() || "png";
  const uniqueFileName = `${uuidv4()}.${ext}`;

  const params = {
    Bucket: config.AWS_S3_BUCKET_NAME,
    Key: uniqueFileName,
    Body: buffer,
    ContentType: mimeType,
  };

  try {
    await s3.upload(params).promise();
    // Construct the public URL
    const url = `${config.AWS_S3_ENDPOINT.replace(/\/$/, "")}/${config.AWS_S3_BUCKET_NAME}/${uniqueFileName}`;
    return url;
  } catch (error) {
    // Log error if you have a logger, or rethrow
    throw new Error(
      "Image upload failed: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}
