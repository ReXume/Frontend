"use client";

import useAuthStore from "@/store/authStore";
import { Send } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

interface Position {
  x: number; // 백분율
  y: number; // 백분율
}

interface CommentFormProps {
  onAdd?: (comment: string) => void; // 사이드바용
  onSubmit?: (comment: string) => void; // 메인 영역용
  onCancel?: () => void; // 메인 영역용
  position?: Position; // 메인 영역용
  initialComment?: string; // 메인 영역용 (수정 시)
  onAiFeedback?: () => void; // AI 피드백 버튼 클릭 시 부모로 넘길 콜백(필요하다면)
  disabled?: boolean;
  resumeId?: number;
  username?: string; // 사용자 이름 (아바타에 사용)
}

function CommentForm({
  onAdd,
  onSubmit,
  onCancel,
  position,
  initialComment = "",
  disabled = false,
  resumeId,
}: CommentFormProps) {
  const [comment, setComment] = useState<string>(initialComment);
  const { userData } = useAuthStore();
  // textarea에 대한 참조 생성
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setComment(e.target.value);
  };

  const handleSubmit = (
    e: FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    if (comment.trim() === "") return;

    if (onAdd) {
      onAdd(comment);
    }

    if (onSubmit) {
      onSubmit(comment);
    }

    setComment("");
  };

  // const handleAiFeedback = async () => {
  //   try {
  //     const response = await postAiFeedback(resumeId!);
  //     const aiFeedbackContent =
  //       response?.someProperty ?? "AI 피드백이 없습니다.";

  //     // "AI피드백: ~" 형식으로 추가
  //     if (onAdd) {
  //       onAdd(`AI피드백: ${aiFeedbackContent}`);
  //     }
  //   } catch (error) {
  //     console.error(error);
  //   }
  // };

  // 컴포넌트가 마운트될 때 textarea에 포커스 설정
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // 폼이 메인 영역에 위치할 경우 스타일 적용
  const formStyles: React.CSSProperties = position
    ? {
        left: `${position.x}%`,
        position: "absolute",
        top: `${position.y}%`,
        transform: "translate(0%, -100%)",
        width: "400px",
        zIndex: 10,
        marginLeft: "10px",
        marginTop: "-10px",
      }
    : {
        position: "relative",
        zIndex: 10,
      };

  return (
    <div
      className="bg-white border rounded shadow-lg p-2 z-10 transition-transform duration-300 ease-in-out"
      style={formStyles}
      onClick={(e) => e.stopPropagation()} // 이벤트 전파 중단
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex items-start">
          {
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3 flex-shrink-0">
              <span className="text-sm font-medium text-blue-600">
                {userData?.username.slice(0, 2)}
              </span>
            </div>
          }
          <div className="flex-grow">
            <textarea
              ref={textareaRef} // textarea에 ref 할당
              placeholder={
                onAdd ? "댓글을 입력하세요..." : "피드백을 입력하세요..."
              }
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              value={comment}
              onChange={handleChange}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="flex justify-end mt-2 space-x-2">
          {/* 메인 영역용 취소 버튼 */}
          {onCancel && (
            <button
              type="button"
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              onClick={onCancel}
              disabled={disabled}
            >
              취소
            </button>
          )}
          <button
            type="submit"
            className={`px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center hover:bg-blue-600 ${
              disabled ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={disabled}
          >
            <Send size={16} className="mr-2" />
            {onSubmit ? (initialComment ? "수정" : "추가") : "댓글 추가"}
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center hover:bg-blue-600"
            // onClick={handleAiFeedback}
            disabled={disabled}
          >
            AI 피드백
          </button>
        </div>
      </form>
    </div>
  );
}

export default CommentForm;
