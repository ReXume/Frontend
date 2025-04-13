export type FeedbackPoint = {
  id: number;
  content: string;
  xCoordinate: number;
  yCoordinate: number;
  pageNumber: number | 1;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};
