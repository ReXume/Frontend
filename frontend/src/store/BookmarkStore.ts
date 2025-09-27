import { BookmarkType } from "@/types/BookmarkType";
import { create } from "zustand";

interface BookmarkStore {
  bookmarks: BookmarkType[];
  setBookmarks: (bookmarks: BookmarkType[]) => void;
  isBookmarked: (resumeId: number) => boolean;
}

export const useBookmarkStore = create<BookmarkStore>((set, get) => ({
  bookmarks: [],
  setBookmarks: (bookmarks) => set({ bookmarks }),
  isBookmarked: (resumeId) => get().bookmarks.some((b) => b.resume_id === resumeId),
}));
