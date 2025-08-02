import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JWTPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export const authDebugMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authReq = req as any;

  if (authReq.user) {
    console.log("Authenticated user:", authReq.user.email);
  } else {
    console.log("No authenticated user found");
  }

  next();
};

export const validateJWTMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Authorization header is required",
        debug: {
          headers: Object.keys(req.headers),
          hasAuth: !!authHeader,
        },
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message:
          "Invalid authorization header format. Expected 'Bearer <token>'",
        debug: {
          receivedFormat: authHeader.substring(0, 20) + "...",
          expectedFormat: "Bearer <token>",
        },
      });
    }

    const token = authHeader.substring(7);

    if (!token || token.length < 10) {
      return res.status(401).json({
        message: "Invalid or missing JWT token",
        debug: {
          tokenLength: token?.length || 0,
          hasToken: !!token,
        },
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        message: "Server configuration error",
      });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

      // Attach the decoded user information to the request
      (req as any).user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };
      next();
    } catch (jwtError) {
      return res.status(401).json({
        message: "Invalid JWT token",
        error:
          jwtError instanceof Error
            ? jwtError.message
            : "Token verification failed",
      });
    }
  } catch (error) {
    return res.status(401).json({
      message: "JWT validation failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const validateDayContentMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.method === "POST" || req.method === "PUT") {
    if (!req.body.content || typeof req.body.content !== "string") {
      return res.status(400).json({
        message: "Content is required and must be a string",
        received: {
          content: req.body.content,
          type: typeof req.body.content,
        },
      });
    }

    const textContent = req.body.content.replace(/<[^>]*>/g, "").trim();
    if (textContent.length === 0) {
      return res.status(400).json({
        message: "Content cannot be empty",
        debug: {
          originalContent: req.body.content.substring(0, 100) + "...",
          textContent: textContent,
          textLength: textContent.length,
        },
      });
    }
  }

  next();
};
