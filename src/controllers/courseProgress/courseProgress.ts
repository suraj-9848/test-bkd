import {Request, Response} from 'express';
import {AppDataSource} from "../../db/connect";
import {StudentCourseProgress} from "../../db/mysqlModels/StudentCourseProgress";
//module export method to be changed to ES6
const { getLoggerByName } = require("../../utils/logger");

const progressRepo=AppDataSource.getRepository(StudentCourseProgress);
const logger=getLoggerByName("courseProgress");
export const updateSessionId=async(req:Request, res:Response)=>{
    const {id,session_id}=req.body;
    logger.debug(req.body);
    try{
        const progress=await progressRepo.findOneBy({id});
        if(!progress){
            return res.status(404).json({message:"Record not found"});
        }
        progress.session_id=session_id;
        await progressRepo.save(progress);
        res.json({message:"Session ID updated successfully", progress});
    }catch(err){
        res.status(500).json({message:"Error updating session_id",error:err});
    }
};

export const updateCurrentPage=async(req:Request,res:Response)=>{
    const {id,current_page}=req.body;
    try{
        const progress=await progressRepo.findOneBy({id});
        if(!progress){
            return res.status(404).json({message:"Record not found"});
        }
        progress.current_page=current_page;
        await progressRepo.save(progress);
        res.json({message:"Current page updated successfully", progress});
    }catch(err){
        res.status(500).json({message:"Error updating current_page",error:err});
    }
};

export const updateStatus=async(req:Request,res:Response)=>{
    const {id,status}=req.body;
    try{
        const progress=await progressRepo.findOneBy({id});
        if(!progress){
            return res.status(404).json({message:"Record not found"});
        }
        progress.status=status;
        await progressRepo.save(progress);
        res.json({message:"Status updated successfully", progress});
    }catch(err){
        res.status(500).json({message:"Error updating status",error:err});
    }
};