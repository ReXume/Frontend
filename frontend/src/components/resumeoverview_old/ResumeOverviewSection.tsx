import React from "react";
import { Star, Download } from "lucide-react";

interface ResumeOverviewProps {
  userName: string;
  position: string;
  career: number;
  techStackNames: string[];
  fileUrl: string;
  isLoading: boolean;
}

const ResumeOverviewSection: React.FC<ResumeOverviewProps> = ({
  userName,
  position,
  career,
  techStackNames,
  fileUrl,
  isLoading,
}) => {
  if (isLoading) {
    return <div>Loading...</div>;
  }

  const rawFileName = fileUrl.split("/").pop() || "resume.pdf";
  const fileName =
    rawFileName.length > 5 ? rawFileName.slice(0, 14) + "..." : rawFileName;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {userName}&apos;s Resume
          </h2>
        </div>
        <button className="flex items-center text-yellow-500 hover:text-yellow-600">
          <Star size={18} className="mr-1" />
          {/* TODO: 북마크 기능 추가 */}
          <span className="text-sm">북마크</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-slate-50 p-3 rounded-lg">
          <p className="text-sm text-gray-500 mb-1">Position</p>
          <p className="font-medium">{position}</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg">
          <p className="text-sm text-gray-500 mb-1">Career</p>
          <p className="font-medium">
            {career === 0 ? "신입" : `${career} years`}
          </p>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg relative">
          <p className="text-sm text-gray-500 mb-1">Tech Stack</p>
          <div className="group">
            <p className="font-medium truncate w-32">
              {techStackNames.join(", ")}
            </p>
            <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-white border border-gray-300 p-2 rounded shadow-lg z-10">
              {techStackNames.join(", ")}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 액션 섹션 */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center">
          <p className="text-sm text-gray-500 mr-2">파일명: {fileName}</p>
        </div>
        <div className="flex space-x-2">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg flex items-center hover:bg-blue-600"
          >
            <Download size={16} className="mr-1" />
            다운로드
          </a>
        </div>
      </div>
    </div>
  );
};

export default ResumeOverviewSection;
