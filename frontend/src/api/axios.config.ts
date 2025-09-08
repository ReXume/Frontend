import axios from "axios";
import { AXIOS_BASE_URL, NETWORK } from "@/constants/api";
import { handleAPIError } from "@/api/interceptor";
import camelcaseKeys from "camelcase-keys";
import decamelizeKeys from "decamelize-keys";
import useAuthStore from "@/store/authStore";

// const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const BASE_URL = `http://localhost:8080/`


export const jsonAxios = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // 필요에 따라 설정
  headers: {
    "Content-Type": "application/json",
  },
});

export const formAxios = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // 필요에 따라 설정
  headers: {
    "Content-Type": "multipart/form-data",
  },
});

export const jsonFormAxios = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // 필요에 따라 설정
  headers: {
    "Content-Type": "application/json",
  },
});

export const axiosInstance = axios.create({
  baseURL: AXIOS_BASE_URL,
  timeout: NETWORK.TIMEOUT,
  withCredentials: true, // CORS 설정에 따라 true 또는 false
  // useAuth는 Axios의 기본 설정에 포함되지 않으므로 제거
});

//재발급 로직
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // 토큰 갱신 요청
        await axiosInstance.post(BASE_URL + "/reissue");
        return axiosInstance(originalRequest);
      } catch (error) {
        const customError = new Error("재발급 오류");
        console.error("재발급 오류:", customError);
        const logout = useAuthStore.getState().logout;
        logout();
        return Promise.reject(error);
      }
    }
  }
);

// 응답 인터셉터: 에러 핸들링
axiosInstance.interceptors.response.use((response) => response, handleAPIError);

// 요청 인터셉터: 인증 토큰 자동 첨부 (옵션)
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 요청 인터셉터 설정
axiosInstance.interceptors.request.use((config) => {
  if (config.data) {
    config.data = decamelizeKeys(config.data);
  }
  return config;
});

// 응답 인터셉터 설정
axiosInstance.interceptors.response.use((response) => {
  if (response.data) {
    response.data = camelcaseKeys(response.data, { deep: true });
  }
  return response;
});
