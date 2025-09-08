export class HTTPError extends Error {
  statusCode: number;
  code?: number;
  data?: unknown;

  constructor(
    statusCode: number,
    message?: string,
    code?: number,
    data?: unknown
  ) {
    super(message);
    this.name = "HTTPError";
    this.statusCode = statusCode;
    this.code = code;
    this.data = data;

    Object.setPrototypeOf(this, HTTPError.prototype);
  }
}
