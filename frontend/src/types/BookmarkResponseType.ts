import { BookmarkType } from "./BookmarkType";

// 북마크 조회 응답 타입
export type BookmarkListResponseType = {
  result: BookmarkType[];
};

// 북마크 추가 응답 타입 (단순한 객체)
export type BookmarkAddResponseType = {
  bookmark_id: number;
  resume_id: number;
};

// 북마크 삭제 응답 타입
export type BookmarkDeleteResponseType = {
  success: boolean;
};