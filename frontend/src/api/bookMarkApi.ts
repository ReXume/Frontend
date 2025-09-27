import { 
  BookmarkListResponseType, 
  BookmarkAddResponseType, 
  BookmarkDeleteResponseType 
} from "@/types/BookmarkResponseType";

const BASE_URL = "/api";

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${input}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

// 북마크 추가
export const postBookmark = async (resumeId: number): Promise<BookmarkAddResponseType> => {
  try {
    const data = await fetchJson<BookmarkAddResponseType>(`/bookmarks/${resumeId}`, { method: "POST" });
    return data;
  } catch (error) {
    console.error("북마크 추가 오류:", error);
    throw error;
  }
};

// 북마크 조회
export const getBookmarkById = async (userId: number): Promise<BookmarkListResponseType> => {
  try {
    const data = await fetchJson<BookmarkListResponseType>(`/bookmarks/users/${userId}`);
    return data;
  } catch (error) {
    console.error("북마크 조회 오류:", error);
    throw error;
  }
};

// 북마크 삭제
export const deleteBookmarkById = async (bookmarkId: number): Promise<BookmarkDeleteResponseType> => {
  try {
    const data = await fetchJson<BookmarkDeleteResponseType>(`/bookmarks/${bookmarkId}`, { method: "DELETE" });
    console.log("북마크 삭제 성공:", data);
    return data;
  } catch (error) {
    console.error("북마크 삭제 오류:", error);
    throw error;
  }
};
