'use client'

import { useState } from "react";
import { Check } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { useRouter } from "next/navigation";
import { postResume } from "@/api/resumeApi";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import PdfUpload from "@/components/UploadPage_old/PdfUpload";
import PositionSelector from "@/components/UploadPage_old/PositionSelector";
import CareerSelector from "@/components/UploadPage_old/CareerSelector";
import TechStackSelector from "@/components/UploadPage_old/TechStackSelector";
import CompanySelector from "@/components/UploadPage_old/CompanySelector";

function ResumeUpload() {
  const [resume_file, setResumeFile] = useState<File | null>(null);
  const [position, setPosition] = useState("");

  const [techStack, setTechStack] = useState<string[]>([]);
  const [career, setCareer] = useState<number>(0);
  const [applyingCompany, setApplyingCompany] = useState<string[]>([]);

  const [stackTags, setStackTags] = useState<string[]>([
    "JAVA",
    "JavaScript",
    "TypeScript",
    "React",
    "Next.js",
    "Spring Boot",
    "Flask",
    "Go",
    "AWS",
    "MySQL",
    "PostgreSQL",
  ]);

  const router = useRouter();

  // 스택 선택 토글 (직접입력은 DirectInputTag로 처리)
  const toggleStack = (stack: string) => {
    if (techStack.includes(stack)) {
      setTechStack(techStack.filter((s) => s !== stack));
    } else {
      setTechStack([...techStack, stack]);
    }
  };

  // 회사 선택 토글
  const toggleCompany = (company: string) => {
    if (applyingCompany.includes(company)) {
      setApplyingCompany(applyingCompany.filter((c) => c !== company));
    } else {
      setApplyingCompany([...applyingCompany, company]);
    }
  };

  const positions = [
    "FRONTEND",
    "BACKEND",
    "FULLSTACK",
    "DEVOPS",
    "DESIGNER",
    "AI",
    "ANDROID",
    "IOS",
    "DATA",
  ];

  const stacks = stackTags;

  const companies = [
    "IT대기업",
    "스타트업",
    "서비스",
    "SI",
    "금융권",
    "제조업",
    "판매직",
    "유니콘",
  ];

  const handleAddStack = (newTag: string) => {
    setStackTags([...stackTags, newTag]);
  };

  // 이력서 업로드
  const handleUpload = async () => {
    if (!position) {
      alert("포지션을 선택해주세요.");
      return;
    }
    if (!resume_file) {
      alert("이력서 파일을 선택해주세요.");
      return;
    }

    const resume = {
      position: position,
      career: career,
      company_names: applyingCompany,
      tech_stack_names: techStack,
    };

    try {
      const response = await postResume(resume_file, resume);
      console.log("업로드성공:", response);
      alert("등록이 완료되었습니다");
      router.push("/");
    } catch (error) {
      console.error("업로드 에러:", error);
      alert("업로드 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  const handleFileSelect = (pdfUrl: File | null) => {
    setResumeFile(pdfUrl);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-8">이력서 등록</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/*  파일 업로드 및 PDF 미리보기 */}
            <PdfUpload onFileSelect={handleFileSelect} />

            {/* 이력서 정보 입력 */}
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center mr-2 text-sm">
                    2
                  </span>
                  이력서 정보 입력
                </h3>

                {/* 포지션 선택 */}
                <div className="mb-6">
                  <PositionSelector
                    positions={positions}
                    selectedPosition={position}
                    onSelect={setPosition}
                  />
                </div>

                {/* 스택 선택 – 버튼 리스트와 직접입력 */}
                <div className="mb-6">
                  <TechStackSelector
                    selectedStacks={techStack}
                    availableStacks={stacks}
                    onToggle={toggleStack}
                    onAdd={handleAddStack}
                  />
                </div>

                {/* 경력 선택 – Radix Slider */}
                <div className="mb-6">
                  <CareerSelector value={career} onChange={setCareer} />
                </div>

                {/* 회사 선택 */}
                <div className="mb-6">
                  <CompanySelector
                    companies={companies}
                    selectedCompanies={applyingCompany}
                    onToggle={toggleCompany}
                  />
                </div>

                {/* 제출 버튼 */}
                <div className="mt-8 flex justify-end">
                  <button
                    className="bg-blue-500 text-white px-6 py-3 rounded-lg font-medium flex items-center hover:bg-blue-600 transition-colors"
                    onClick={handleUpload}
                  >
                    <Check size={18} className="mr-2" />
                    이력서 등록하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResumeUpload;
