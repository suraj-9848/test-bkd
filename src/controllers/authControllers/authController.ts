import { Request, Response } from 'express'

export const SignIn = (req: Request, res: Response) => {
  const { username, password } = req.body

  // Placeholder auth logic
  if (username === 'admin' && password === 'admin123') {
    res.status(200).json({ token: 'fake-jwt-token', user: { username } })
  } else {
    res.status(401).json({ error: 'Invalid credentials' })
  }
}

export const logOut = (req: Request, res: Response) => {
  // Just send a success message, assuming frontend deletes token/session
  res.status(200).json({ message: 'Logged out successfully' })
}
