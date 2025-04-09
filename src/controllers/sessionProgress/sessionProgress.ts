import {Request,Response} from "express";
import {AppDataSource} from "../../db/connect";
import {StudentSessionProgress} from "../../db/mysqlModels/StudentSessionProgress";

const sessionRepo=AppDataSource.getRepository(StudentSessionProgress);

export const updateSessionId=async(req:Request,res:Response)=>{
    const {id,session_id}=req.body;
    try{
        const progress=await sessionRepo.findOneBy({id});
        if(!progress){
            return res.status(404).json({message:"Record not found"});
        }
        progress.session_id=session_id;
        await sessionRepo.save(progress);
        res.json({message:"Session ID updated successfully",progress});
    }catch(err){
        res.status(500).json({message:"Error updating session_id",error:err});
    }
};

export const updateQuestionId=async(req:Request,res:Response)=>{
    const {id,question_id}=req.body;
    try{
        const progress=await sessionRepo.findOneBy({id});
        if(!progress){
            return res.status(404).json({message:"Record not found"});
        }
        progress.question_id=question_id;
        await sessionRepo.save(progress);
        res.json({message:"Question ID updated successfully",progress});
    }catch(err){
        res.status(500).json({message:"Error updating question_id",error:err});
    }
};

export const updateStatus=async (req:Request,res:Response)=>{
    const {id,status}=req.body;
    try{
        const progress=await sessionRepo.findOneBy({id});
        if(!progress){
            return res.status(404).json({message:"Record not found"});
        }
        progress.status=status;
        await sessionRepo.save(progress);
        res.json({message:"Status updated successfully",progress});
    }catch(err){
        res.status(500).json({message:"Error updating status",error:err});
    }
};