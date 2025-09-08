import React, { useState } from "react";
import { Upload, FileUp, Trash2 } from "lucide-react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import * as pdfjsLib from "pdfjs-dist";

// PDF.js worker 설정 (CDN 경로 사용)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js";
interface PdfUploadProps {
  // 파일이 선택되거나 삭제될 때 호출되는 콜백
  onFileSelect: (file: File | null) => void;
}

function PdfUpload(props: PdfUploadProps) {
  const { onFileSelect } = props;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFileName(file.name);

      const fileUrl = URL.createObjectURL(file);
      setPdfUrl(fileUrl);
      onFileSelect(file);
    }
  }
  console.log("이력서 PDF URL", pdfUrl);

  function handleFileDelete() {
    setSelectedFile(null);
    setFileName("");
    setPdfUrl(null);
    setNumPages(null);
    setPageNumber(1);
    onFileSelect(null);
  }

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
          <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center mr-2 text-sm">
            1
          </span>
          첨부파일 업로드
        </h3>
        {selectedFile ? (
          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <FileUp size={20} className="text-blue-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{fileName}</p>
                  <p className="text-sm text-gray-500">
                    {Math.round(selectedFile.size / 1024)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={handleFileDelete}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <label className="block w-full">
              <div className="flex items-center justify-center bg-slate-50 rounded-lg p-4 cursor-pointer hover:bg-slate-100 transition-colors">
                <Upload size={20} className="text-gray-400 mr-2" />
                <span className="text-gray-600">PDF 파일 선택하기</span>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf"
                onChange={handleFileChange}
              />
            </label>
          </div>
        )}
      </div>

      {/* PDF 미리보기 */}
      {pdfUrl && (
        <div className="border rounded-xl overflow-hidden bg-white">
          <div className="bg-gray-50 p-4 border-b">
            <h4 className="font-medium text-gray-700">PDF 미리보기</h4>
            <p className="text-sm text-gray-500">
              페이지 {pageNumber} / {numPages}
            </p>
          </div>
          <div className="p-4 flex justify-center bg-white">
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              // className="max-w-full"
            >
              <Page
                pageNumber={pageNumber}
                width={400}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          </div>
          {numPages && numPages > 1 && (
            <div className="flex justify-between items-center p-4 bg-gray-50 border-t">
              <button
                onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
                disabled={pageNumber <= 1}
                className="px-3 py-1 text-sm bg-white border rounded-md disabled:opacity-50"
              >
                이전
              </button>
              <button
                onClick={() =>
                  setPageNumber((prev) => Math.min(numPages, prev + 1))
                }
                disabled={pageNumber >= numPages}
                className="px-3 py-1 text-sm bg-white border rounded-md disabled:opacity-50"
              >
                다음
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PdfUpload;
