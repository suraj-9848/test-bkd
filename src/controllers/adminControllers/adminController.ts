import { Request, Response } from 'express'

export const getUsers = (req: Request, res: Response) => {
  // Dummy user list
  const users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ]

  res.status(200).json({ success: true, users })
}

export const getTestData = (req: Request, res: Response) => {
  res.status(200).json({ message: 'Test data from adminController' })
}
