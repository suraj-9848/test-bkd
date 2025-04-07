
import express from 'express'

export const authRouter = express.Router()
//import { SignIn, logOut } from '../../controllers/authControllers/authController'
import { userProtect } from '../../lib/authLib/authUtils'

// authRouter.post("/signin", SignIn)
// authRouter.get("/logout", userProtect, logOut)