
import express from 'express'
import { getUsers, getTestData } from '../../controllers/adminControllers/adminController'

export const adminRouter = express.Router()


adminRouter.get("/users/all", getUsers)
adminRouter.get("/ping", (req, res) => res.send("pong from admin"))
adminRouter.get('/test', getTestData)
// adminRouter.get('/file', handleFileUpload)