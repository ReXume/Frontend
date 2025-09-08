import { formAxios, jsonAxios, jsonFormAxios } from "./axios.config";

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
    const response = await formAxios.post(`/resumes`, formData);

    return response.data;
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
    const response = await jsonAxios.get(
      `/resumes/search?user_name=${searchName}`
    );
    console.log("api: ", response);
    return response.data;
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

    const response = await jsonFormAxios.get(
      `/resumes?page=${page}&size=${size}`
    );
    return response.data.result;
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
    const response = await jsonAxios.post(`/resumes/search?${queryParams}`, {
      positions: filterParams.dto.positions,
      min_career: filterParams.dto.min_career,
      max_career: filterParams.dto.max_career,
      tech_stack_names: filterParams.dto.tech_stack_names,
      company_names: filterParams.dto.company_names, // 추가
    });

    return response.data;
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
    const response = await jsonAxios.get(`/resumes/${resumeId}`);
    return response.data.result;
  } catch (error) {
    console.log("이력서 조회 오류", error);
    const customError = new Error("개별 이력서 조회 오류");
    // Sentry.captureException(customError);
    throw error;
  }
};

export const deleteResume = async (resumeId: number) => {
  try {
    const response = await jsonAxios.delete(`/resumes/${resumeId}`);
    return response.data;
  } catch (error) {
    console.log("이력서 삭제 오류", error);
    const customError = new Error("이력서 삭제 오류");
    // Sentry.captureException(customError);
    throw error;
  }
};
