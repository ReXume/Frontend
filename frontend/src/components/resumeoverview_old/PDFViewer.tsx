import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import PDF from "./PDF";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

const PDFViewer = ({
  pdfSrc,
  feedbackData,
  addFeedbackPoint,
  editFeedbackPoint,
  feedbackPoints,
  hoveredCommentId,
  setHoveredCommentId,
  setClickedCommentId,
}: any) => {
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    const loadPdf = async () => {
      const loadingTask = pdfjsLib.getDocument(pdfSrc);
      const loadedPdf = await loadingTask.promise;
      // setPdf(loadedPdf);
      setNumPages(loadedPdf.numPages);
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
          key={`page-${idx + 1}`} // ← key 로 pageNumber 포함
          pdf={pdf}
          pageNumber={idx + 1}
          feedback={feedbackData && feedbackData[idx + 1]}
          addFeedbackPoint={addFeedbackPoint}
          editFeedbackPoint={editFeedbackPoint}
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
