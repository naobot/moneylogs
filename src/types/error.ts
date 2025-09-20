export interface ErrorInfo {
  message: string;
  stack?: string;
  source?: string;
  timestamp: Date;
  userAgent: string;
  url: string;
  userId?: string;
}