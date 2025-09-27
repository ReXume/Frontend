export type FeedbackPoint = {
  id: number;
  content: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  pageNumber: number | 1;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};
