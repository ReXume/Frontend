import { create } from "zustand";

interface ResumeStore {
  resumeId: number;
  setResumeId: (id: number) => void;
  ResumeUrl: string;
  setResumeUrl: (id: string) => void;
}

const useResumeStore = create<ResumeStore>((set) => ({
  resumeId: 0,
  setResumeId: (id) => set({ resumeId: id }),
  ResumeUrl: "",
  setResumeUrl: (url) => set({ ResumeUrl: url }),
}));

export default useResumeStore;
