import { AxiosError } from "axios";

// class HttpError extends Error {
//   status: number | null;
//   url: string | null;
//   details: any;

//   constructor(err: any) {
//     super(err.message || "Unknown API error");
//     this.name = "HttpError";
//     this.status = err.status || err.response?.status || null;
//     this.url = err.config?.url || err.request?.responseURL || null;
//     this.details = err.response?.data || null;
//   }
// }

// export function simplifyAxiosError(err: any): HttpError {
//   if (!err) {
//     return new HttpError({ message: "Unknown error" });
//   }
//   return new HttpError(err);
// }

// export function isAxiosError(err: any): err is AxiosError {
//   return err && err.isAxiosError === true;
// }
