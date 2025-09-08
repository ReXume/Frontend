import React, { useState, ChangeEvent, FormEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { CommentType } from "../../mockApi.ts";

interface CommentProps extends CommentType {
  onDelete: (id: number) => void;
  onEdit: (id: number, newText: string) => void;
}

function CommentCard({
  id,
  text,
  timestamp,
  modified = false,
  onDelete,
  onEdit,
}: CommentProps) {
  const timeAgo = formatDistanceToNow(timestamp, {
    addSuffix: true,
    locale: ko,
  });
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedText, setEditedText] = useState<string>(text);

  const handleDelete = () => {
    onDelete(id);
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  const handleEditChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEditedText(e.target.value);
  };

  const handleEditSubmit = (
    e: FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    if (editedText.trim() === "") return;
    onEdit(id, editedText);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedText(text);
    setIsEditing(false);
  };

  return (
    <div className=" h-auto relative mt-4 p-4 bg-white border-b border-primary-lightBlue">
      {/* Comment Text or Edit Form */}
      {isEditing ? (
        <form onSubmit={handleEditSubmit} className="mb-2 z-10">
          <input
            type="text"
            value={editedText}
            onChange={handleEditChange}
            className="w-full px-2 py-1 border border-gray-300 rounded mb-2 text-[#333333] text-sm font-normal font-Pretendard focus:outline-none"
          />
          <div className="flex space-x-2">
            <button
              type="submit"
              className="px-3 py-1 bg-blue-500 text-white rounded text-xs"
            >
              저장
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-3 py-1 bg-gray-300 text-black rounded text-xs"
            >
              취소
            </button>
          </div>
        </form>
      ) : (
        <div className="text-[#333333] text-sm font-normal mb-2 z-10 whitespace-pre-wrap">
          {text}
        </div>
      )}

      {/* Timestamp */}
      <div className="text-[#6d6d6d] text-[8px] font-normal mb-2 z-10">
        {timeAgo} {modified && "(수정됨)"}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2 z-10">
        <button
          data-testid="EditButton"
          onClick={handleEditToggle}
          className="text-blue-500 text-xs"
        >
          {isEditing ? "취소" : "수정"}
        </button>
        <button onClick={handleDelete} className="text-red-500 text-xs">
          삭제
        </button>
      </div>
    </div>
  );
}

export default CommentCard;
