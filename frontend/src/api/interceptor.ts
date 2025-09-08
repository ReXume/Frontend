// src/api/interceptors.ts
import { AxiosError } from "axios";
import { HTTPError } from "./HTTPError.ts";
import { HTTP_STATUS_CODE } from "../constants/api.ts";

export interface ErrorResponseData {
  statusCode?: number;
  errorMessage?: string;
  code?: number;
  errors?: Record<string, string[]>;
}

export const handleAPIError = (error: AxiosError<ErrorResponseData>) => {
  if (!error.response) {
    // 네트워크 오류 등 응답이 없는 경우
    throw new HTTPError(0, "네트워크 오류가 발생했습니다.");
  }

  const { data, status } = error.response;

  if (status >= HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR) {
    throw new HTTPError(status, data.errorMessage, data.code, data);
  }

  // 클라이언트 오류 (400~499)
  throw new HTTPError(status, data.errorMessage, data.code, data);
};
