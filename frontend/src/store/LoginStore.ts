import { create } from "zustand";

interface ResumeStore {
  loginStatus: number;
  setLoginStatus: (id: number) => void;
}

interface UserInfo {
  username: string;
  email: string;
  role: string;
}

interface UserInfoStore {
  userData: UserInfo | null; // userData를 객체로 정의 (초기값은 null)
  setUserData: (info: UserInfo) => void;
}

export const useLoginStatus = create<ResumeStore>((set) => ({
  loginStatus: 0,
  setLoginStatus: (id) => set({ loginStatus: id }),
}));

export const useUserInfo = create<UserInfoStore>((set) => ({
  userData: null,
  setUserData: (info) => set({ userData: info }),
}));
