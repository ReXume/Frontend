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
export const postBookmark = async (resumeId: number) => {
  try {
    const data = await fetchJson(`/bookmarks/${resumeId}`, { method: "POST" });
    return (data as any).result;
  } catch (error) {
    console.error("북마크 추가 오류:", error);
    const customError = new Error("북마크 추가 오류");
    // Sentry.captureException(customError);
    throw error;
  }
};

// 북마크 조회
export const getBookmarkById = async (userId: number) => {
  try {
    const data = await fetchJson(`/bookmarks/users/${userId}`);
    return data as any;
  } catch (error) {
    console.error("북마크 조회 오류:", error);
    const customError = new Error("북마크 조회 오류");
    // Sentry.captureException(customError);
    throw error;
  }
};

// 북마크 삭제
export const deleteBookmarkById = async (bookmarkId: number) => {
  try {
    const data = await fetchJson(`/bookmarks/${bookmarkId}`, { method: "DELETE" });
    console.log("북마크 삭제 성공:", data);
    return data as any;
  } catch (error) {
    console.error("북마크 삭제 오류:", error);
    const customError = new Error("북마크 삭제 오류");
    // Sentry.captureException(customError);
    throw error;
  }
};
