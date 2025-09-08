import { create } from "zustand";

// 상태의 타입 정의
interface CategoryState {
  positionCategory: string[];
  careerCategory: string[];
  setPositionCategory: (position: string[]) => void;
  setCareerCategory: (career: string[]) => void;
  deleteCareer: () => void;
  deletePosition: () => void;
}

// Zustand store 생성
const useCategoryStore = create<CategoryState>((set) => ({
  positionCategory: [], // 초기값을 빈 배열로 설정
  careerCategory: [], // 초기값을 빈 배열로 설정
  setPositionCategory: (position: string[]) =>
    set({ positionCategory: position }),
  setCareerCategory: (career: string[]) => set({ careerCategory: career }),
  deleteCareer: () => set({ careerCategory: [] }),
  deletePosition: () => set({ positionCategory: [] }),
}));

export default useCategoryStore;
