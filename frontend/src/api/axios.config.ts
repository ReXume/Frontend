import axios from "axios";
import { AXIOS_BASE_URL, NETWORK } from "@/constants/api";
import { handleAPIError } from "@/api/interceptor";
import camelcaseKeys from "camelcase-keys";
import decamelizeKeys from "decamelize-keys";
import useAuthStore from "@/store/authStore";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || AXIOS_BASE_URL;

export const jsonAxios = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export const formAxios = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "multipart/form-data",
  },
});

export const jsonFormAxios = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export const axiosInstance = axios.create({
  baseURL: AXIOS_BASE_URL,
  timeout: NETWORK.TIMEOUT,
  withCredentials: true,
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
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

axiosInstance.interceptors.response.use((response) => response, handleAPIError);

axiosInstance.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("authToken");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.request.use((config) => {
  if (config.data) {
    config.data = decamelizeKeys(config.data);
  }
  return config;
});

axiosInstance.interceptors.response.use((response) => {
  if (response.data) {
    response.data = camelcaseKeys(response.data, { deep: true });
  }
  return response;
});
