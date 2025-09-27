import { ResumeData } from "./ResumeDataType";

export type ResumeResponseType = {
  result: ResumeData[];
  status: string;
  message: string;
  timestamp: string;
  error: string;
};