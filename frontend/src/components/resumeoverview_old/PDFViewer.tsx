import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import PDF from "./PDF";
import { FeedbackPoint } from "@/types/FeedbackPointType";
import { AddFeedbackPoint } from "@/types/AddFeedbackPointType";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/api/pdfjs/worker";

interface PDFViewerProps {
  pdfSrc: string;
  pageNumber: number;
  addFeedbackPoint: (point: Omit<AddFeedbackPoint, "id">) => void;
  editFeedbackPoint: (point: FeedbackPoint) => void;
  feedbackPoints: FeedbackPoint[];
  hoveredCommentId: number | null;
  setHoveredCommentId: (id: number | null) => void;
  setClickedCommentId: (id: number | null) => void;
}

const PDFViewer = ({
  pdfSrc,
  // pageNumber,
  addFeedbackPoint,
  // editFeedbackPoint,
  feedbackPoints,
  hoveredCommentId,
  setHoveredCommentId,
  setClickedCommentId,
}: PDFViewerProps) => {
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    const loadPdf = async () => {
      if (!pdfSrc || typeof pdfSrc !== "string" || pdfSrc.trim().length === 0) {
        console.warn("PDFViewer: pdfSrc is empty. Skipping load.");
        return;
      }
      try {
        const loadingTask = pdfjsLib.getDocument({ url: pdfSrc });
        const loadedPdf = await loadingTask.promise;
        setPdf(loadedPdf as pdfjsLib.PDFDocumentProxy);
        setNumPages(loadedPdf.numPages);
      } catch (err) {
        console.error("Failed to load PDF:", err);
      }
    };
    loadPdf();
  }, [pdfSrc]);

  if (!pdf) return <div>PDF 로딩 중...</div>;

  return (
    <div
      style={{
        width: 1200,
        margin: "auto",
        overflowY: "auto",
        maxHeight: "90vh",
      }}
    >
      {Array.from({ length: numPages }).map((_, idx) => (
        <PDF
          key={`page-${idx + 1}`}
          pdf={pdf}
          pageNumber={idx + 1}
          feedback={[]}
          addFeedbackPoint={addFeedbackPoint}
          feedbackPoints={feedbackPoints}
          hoveredCommentId={hoveredCommentId}
          setHoveredCommentId={setHoveredCommentId}
          setClickedCommentId={setClickedCommentId}
        />
      ))}
    </div>
  );
};

export default PDFViewer;
