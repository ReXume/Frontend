// export const AXIOS_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
export const AXIOS_BASE_URL = 'http://localhost:8080/' as string;



// export const NETWORK = {
//   TIMEOUT: parseInt(import.meta.env.VITE_NETWORK_TIMEOUT as string, 10) || 5000,
// };
export const NETWORK = {
  TIMEOUT: parseInt('http://localhost:8080/' as string, 10) || 5000,
};

export const HTTP_STATUS_CODE = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  // 필요에 따라 추가적인 상태 코드 정의
} as const;
