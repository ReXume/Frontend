import { create } from "zustand";

interface SearchStore {
  searchName: string;
  setSearchName: (name: string) => void;
}

const useSearchStore = create<SearchStore>((set) => ({
  searchName: "",
  setSearchName: (name) => set({ searchName: name }),
}));

export default useSearchStore;
