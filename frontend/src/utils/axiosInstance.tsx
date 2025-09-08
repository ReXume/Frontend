import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Axios 인스턴스 생성
export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
  withCredentials: true, // 쿠키를 자동으로 포함
});

// 응답 인터셉터
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const originalRequest = error.config; // 원래 요청 저장
      if (!originalRequest._retry) {
        originalRequest._retry = true; // 재시도 플래그 설정
        try {
          // 토큰 재발급 요청
          await axios.post(
            `${BASE_URL}/reissue`,
            {},
            { withCredentials: true }
          );
          console.log("호출 성공");
          // 재발급 성공 시 원래 요청 재시도
          return axiosInstance(originalRequest);
        } catch (err) {
          console.error("토큰 재발급 실패: ", err);
          // 추가적으로 상태 관리 로직 호출 (예: 로그아웃 처리)
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
