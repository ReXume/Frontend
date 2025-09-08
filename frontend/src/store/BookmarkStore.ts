import { create } from "zustand";
import { BookmarkListType } from "../dataType";

interface BookmarkStore {
  bookmarks: BookmarkListType[];
  setBookmarks: (bookmarks: BookmarkListType[]) => void;
  isBookmarked: (resumeId: number) => boolean;
}

export const useBookmarkStore = create<BookmarkStore>((set, get) => ({
  bookmarks: [],
  setBookmarks: (bookmarks) => set({ bookmarks }),
  isBookmarked: (resumeId) =>
    get().bookmarks.some((b) => b.resume_id === resumeId),
}));
