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

async function fetchForm<T>(input: string, body: FormData): Promise<T> {
  const res = await fetch(`${BASE_URL}${input}`, {
    method: "POST",
    credentials: "include",
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export const postResume = async (
  resume_file: File,
  resume: {
    position: string;
    career: number;
    company_names: string[];
    tech_stack_names: string[];
  }
) => {
  try {
    const formData = new FormData();
    formData.append("resume_file", resume_file);

    // JSON 문자열 그대로 추가
    formData.append("resume", JSON.stringify(resume));
    console.log("resume", resume);

    // FormData 내부 확인
    for (const [key, value] of formData.entries()) {
      console.log(key, value);
    }

    console.log("전송할 데이터:", resume);
    console.log("폼데이터 확인:", [...formData.entries()]);

    // API 요청 보내기
    return await fetchForm(`/resumes`, formData);
  } catch (error) {
    console.error("이력서 업로드 오류:", error);
    const customError = new Error("이력서 업로드 오류");
    // Sentry.captureException(customError);
    throw error;
  }
};
// 이력서 검색
export const searchResume = async (searchName: string) => {
  try {
    const data = await fetchJson(`/resumes/search?user_name=${searchName}`);
    console.log("api: ", data);
    return data;
  } catch (error) {
    console.log("이력서 검색 오류", error);
    const customError = new Error("이력서 검색 오류");
    // Sentry.captureException(customError);
    throw error;
  }
};

// 여러 이력서 조회
export const getResumeList = async (page: number, size: number) => {
  try {
    const formData = new FormData();
    formData.append("page", page.toString());
    formData.append("size", size.toString());
    const data = await fetchJson(`/resumes?page=${page}&size=${size}`);
    return (data as any).result;
  } catch (error) {
    console.log("이력서 목록 조회 오류", error);
    const customError = new Error("이력서 목록 조회 오류");
    // Sentry.captureException(customError);
    throw error;
  }
};

interface FilterDTO {
  positions: string[];
  min_career: number;
  max_career: number;
  tech_stack_names: string[];
  company_names: string[]; // 추가
}

interface Pageable {
  page: number;
  size: number;
  sort?: string[];
}

interface FilterParams {
  dto: FilterDTO;
  pageable: Pageable;
}

export const postFilter = async (filterParams: FilterParams) => {
  try {
    // 쿼리 파라미터 구성
    const queryParams = new URLSearchParams({
      page: String(filterParams.pageable.page),
      size: String(filterParams.pageable.size),
      ...(filterParams.pageable.sort && {
        sort: filterParams.pageable.sort.join(","),
      }),
    }).toString();

    // API 요청
    const data = await fetchJson(`/resumes/search?${queryParams}`, {
      method: "POST",
      body: JSON.stringify({
        positions: filterParams.dto.positions,
        min_career: filterParams.dto.min_career,
        max_career: filterParams.dto.max_career,
        tech_stack_names: filterParams.dto.tech_stack_names,
        company_names: filterParams.dto.company_names,
      }),
    });

    return data;
  } catch (error) {
    if (error instanceof Error) {
      console.error("필터링 api 오류:", error.message);
      const customError = new Error("필터링 API 오류");
      // Sentry.captureException(customError);
    }
    throw error;
  }
};

// 개별 이력서 조회
export const viewResume = async (resumeId: number) => {
  try {
    const data = await fetchJson(`/resumes/${resumeId}`);
    return (data as any).result;
  } catch (error) {
    console.log("이력서 조회 오류", error);
    const customError = new Error("개별 이력서 조회 오류");
    // Sentry.captureException(customError);
    throw error;
  }
};

export const deleteResume = async (resumeId: number) => {
  try {
    const data = await fetchJson(`/resumes/${resumeId}`, { method: "DELETE" });
    return data as any;
  } catch (error) {
    console.log("이력서 삭제 오류", error);
    const customError = new Error("이력서 삭제 오류");
    // Sentry.captureException(customError);
    throw error;
  }
};
