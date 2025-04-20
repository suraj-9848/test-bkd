import { Request, Response, NextFunction } from 'express';


export const dummyUserMiddleware = (req: Request, res: Response, next: NextFunction) => {
  req.user = {
    id: "12345",
    name: "Dummy Admin",
    role: "admin",
    email: "admin@example.com"
  };
  next();
};

export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }

  next();
};
