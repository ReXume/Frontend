'use client'

import { FileText, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { ResumeType } from "@/types/ResumeType";
import { deleteResume } from "../../api/resumeApi";

type ResumeItemProps = {
  resume: ResumeType;
  onUpdate: () => void;
};

function ResumeItem({ resume, onUpdate }: ResumeItemProps) {
  const router = useRouter();

  const handleResumeClick = () => {
    router.push(`/feedback/${resume.resume_id}`);
  };

  const handleDeleteResume = async () => {
    const result = await Swal.fire({
      title: "이력서를 제거하시겠습니까?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "네, 제거합니다.",
      cancelButtonText: "취소",
    });

    if (result.isConfirmed) {
      try {
        await deleteResume(resume.resume_id);
        Swal.fire(
          "삭제 완료",
          "이력서가 성공적으로 제거되었습니다.",
          "success"
        );
        onUpdate();
      } catch (error) {
        console.error("이력서 삭제 오류:", error);
        Swal.fire("오류", "이력서를 제거하는 데 실패했습니다.", "error");
      }
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
      <div className="flex items-center" onClick={handleResumeClick}>
        <div className="flex items-center space-x-4">
          <FileText className="w-5 h-5 text-gray-500 mx-2" />
          <div>
            <h4 className="font-medium">{resume.resume_name}</h4>
            <p className="text-sm text-gray-500">{resume.user_name}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4 ml-10">
        {/* 이것도 data 추가되면 수정해야 함 */}
        <p className="text-sm text-gray-500">2025-01-11</p>
      </div>
      <div
        className="flex items-center justify-center w-20 h-10 hover:scale-125 cursor-pointer"
        onClick={handleDeleteResume}
      >
        <Trash className="w-5 h-5 text-gray-500" />
      </div>
    </div>
  );
}

export default ResumeItem;
