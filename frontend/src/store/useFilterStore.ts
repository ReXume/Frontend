import { create } from "zustand";

interface FilterState {
  positions: string[];
  min_career: number;
  max_career: number;
  tech_stack_names: string[]; // 상태에서 관리 필요 여부 확인
  setCareerRange: (min: number, max: number) => void;
  setPositions: (positions: string[]) => void;
  setTechStackNames: (techStack: string[]) => void;
}

const useFilterStore = create<FilterState>((set) => ({
  positions: [], // 초기값은 빈 배열
  min_career: 0, // 최소 경력 초기값
  max_career: 10, // 최대 경력 초기값
  tech_stack_names: [], // 기술 스택

  // 경력 범위 업데이트
  setCareerRange: (min, max) => {
    console.log("경력 범위 업데이트:", { min, max });
    set({
      min_career: Math.max(0, min), // 최소값 0 이상
      max_career: Math.min(10, max), // 최대값 10 이하
    });
  },

  // 포지션 업데이트 (중복 제거 및 대문자 변환)
  setPositions: (positions) => {
    const uniquePositions = [
      ...new Set(positions.map((pos) => pos.toUpperCase())),
    ];
    console.log("포지션 업데이트:", uniquePositions);
    set({ positions: uniquePositions });
  },

  // 기술 스택 업데이트
  setTechStackNames: (techStack) => {
    console.log("기술 스택 업데이트:", techStack);
    set({ tech_stack_names: techStack });
  },
}));

export default useFilterStore;
