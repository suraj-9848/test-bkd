const logger = require("../../utils/logger").getLoggerByName("Auth Controller")
import { Request, Response } from "express"
import { OAuth2Client } from "google-auth-library"
import { config } from "../../config"
import { UserRole } from "../../db/mysqlModels/UserSoes"
import { randomUUID } from "crypto"
import { createTokenAndSend } from "../../lib/authLib/authUtils"
import { UserSoes } from "../../db/mysqlModels/UserSoes"
const client = new OAuth2Client(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET)

export const logOut = async (req: Request, res: Response) => {
    try {
        for (let i of Object.keys(req.cookies)) {
            res.clearCookie(i)
        }
        res.status(200).json({
            status: "success",
            message: "User logged out successfully",
        })
    }
    catch (error) {
        logger.error(error)
        return res.status(500).send({ error })
    }
}


export const SignIn = async (req: Request, res: Response) => {
    try {
        const { tokenId } = req.body
        console.log(tokenId)
        const response = await client.verifyIdToken({
            idToken: tokenId,
            audience: config.GOOGLE_CLIENT_ID,
        })
        const { email, name, picture, } = response.getPayload()

        const user = await UserSoes.findOne({ where: { userEmail: email } })
        if (!user) {
            let newUsername = email.split("@")[0].toLowerCase();

            let ifUsernameExists = await UserSoes.findOne({
                where: {
                    userName: newUsername
                }
            })

            if (ifUsernameExists) {
                newUsername = newUsername + "-" + randomUUID().slice(4, 10)
            }

            const newUser = await UserSoes.create({
                userName: newUsername,
                userEmail: email,
                userFullName: name,
                avatar: picture,
                lastLoginDate: new Date(),
                userCreatedOn: new Date(),
            }).save()

            createTokenAndSend(newUser, 201, res, true)
        }
        else {
            user.lastLoginDate = new Date()
            await user.save()
            createTokenAndSend(user, 200, res, true)
        }
    }
    catch (error) {
        logger.error(error)
        return res.status(500).send({ error })
    }
}
