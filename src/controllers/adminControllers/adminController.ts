import { Request, Response } from "express"
import { IsNull, Like, Not } from "typeorm"
import { getFillteredRecordsWithPagination } from "../../lib/dbLib/sqlUtils"
import { StudentSoes } from "../../db/mysqlModels/StudentSoes"
import { ExamSubjectQuestionSoes } from "../../db/mysqlModels/ExamSubjectQuestionSoes"
const logger = require("../../utils/logger").getLoggerByName("Admin Controller")

export const getTestData = async (req: Request, res: Response) => {
    try {
        const data = await StudentSoes.find({take : 20});
        res.status(200).json(data);
    }
    catch (error) {
        logger.error(error)
        return res.status(500).send({ error })
    }
}
import { UTApi } from "uploadthing/server";
import * as fs from 'fs';
import { QuestionOptionSoes } from "../../db/mysqlModels/QuestionOptionSoes"

export const handleServerUpload = async (req: Request, res: Response) => {
    try {
        const base_path = 'E:/Development/sampath-academy/public_html'
        const records= await QuestionOptionSoes
            .find({ where: { newOptionTitleimg: IsNull(), questionOptionTitleImg: Not("") } })
        let i = 1;
        let s = "";
        console.log(records)
        for (const record of records) {
            if (record.questionOptionTitleImg.startsWith("../")) {
                
                s = record.questionOptionTitleImg.replace("../", base_path + "/")
                const utapi = new UTApi();
                console.log(s)
                const image = fs.readFileSync(s)
                const blob = new Blob([image])
                const { data } = await utapi.uploadFiles(blob, record.questionOptionTitleImg);
                console.log(data);
                const { url } = data;
                record.newOptionTitleimg = url;
                logger.info(url, i, records.length)
                i++;
                await record.save()
                // return res.status(200).send(image)
            }
        }

        return res.send('Ok')
    }
    catch (error) {
        logger.error(error)
        return res.status(500).send({ error })
    }
}
export const handleFileUpload = async (req: Request, res: Response) => {
    try {
        const base_path = '/Users/shashankh/Documents/git/objectivesolu/public_html'
        const records = await ExamSubjectQuestionSoes
            .find({ where: { newStudentImage: IsNull(), studentImage: Not("") } })
        let i = 1;
        for (const record of records) {
            let s = "";
            console.log(record)
            if (record.studentImage.startsWith("../")) {
                s = record.studentImage.replace("../", base_path + "/")
                const utapi = new UTApi();
                console.log(s)
                const image = fs.readFileSync(s)
                const blob = new Blob([image])
                const { data } = await utapi.uploadFiles(blob, record.studentImage);
                console.log(data);
                const { url } = data;
                record.newStudentImage = url;
                logger.info(url, i, records.length)
                i++;
                await record.save()
            }
        }
        return res.status(200).send("ok")
    }
    catch (error) {
        logger.error(error)
        return res.status(500).send({ error })
    }
}



export const getUsers = async (req: Request, res: Response) => {
    try {
        let limit: number = parseInt(req.query.limit as string) || 10
        let page: number = parseInt(req.query.page as string) || 1

        let query = [{ firstName: Like(`%${req.query.query || ""}%`) }, { email: Like(`%${req.query.query || ""}%`) }, { userName: Like(`%${req.query.query || ""}%`) }, { collegeRegistrationNumber: Like(`%${req.query.query || ""}%`) }, { role: Like(`%${req.query.query || ""}%`) }, { lastName: Like(`%${req.query.query || ""}%`) }]

        let select = {
            userName: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            avatar: true,
            collegeRegistrationNumber: true,
            lastLoginDate: true,
            provider: true,
            created_at: true,
            id: true,
            isActive: true,
        }

        logger.info("Fetching All Users..")

        let filter = {
            page,
            limit,
        }

        let sorting = {

        }

        let result = await getFillteredRecordsWithPagination(StudentSoes, filter, query, sorting, select, {})

        res.status(200).send(result);
    } catch (error) {
        res.status(500).send({ error })
        logger.error(error)
    }
}