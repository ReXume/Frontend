'use client'

import { useRouter } from "next/navigation";
import { Bookmark, Trash } from "lucide-react";
import Swal from "sweetalert2";
import { deleteBookmarkById } from "../../api/bookMarkApi.js";
import { formatDate } from "../../utils/DateFormatter";
import { BookmarkType } from "@/types/BookmarkType.js";

type BookmarkItemProps = {
  bookmark: BookmarkType;
  onUpdate: () => void; // 북마크 변경 시 호출되는 콜백
};

function BookmarkItem({ bookmark, onUpdate }: BookmarkItemProps) {
  const router = useRouter();

  const handleBookmarkClick = () => {
    router.push(`/feedback/${bookmark.resume_id}`);
  };

  const handleDeleteBookmark = async () => {
    const result = await Swal.fire({
      title: "북마크를 제거하시겠습니까?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "네, 제거합니다.",
      cancelButtonText: "취소",
    });

    if (result.isConfirmed) {
      try {
        await deleteBookmarkById(bookmark.bookmark_id);
        Swal.fire(
          "삭제 완료",
          "북마크가 성공적으로 제거되었습니다.",
          "success"
        );
        onUpdate();
      } catch (error) {
        console.error("북마크 삭제 오류:", error);
        Swal.fire("오류", "북마크를 제거하는 데 실패했습니다.", "error");
      }
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
      <div className="flex items-center" onClick={handleBookmarkClick}>
        <div className="flex items-center space-x-4">
          <Bookmark className="w-5 h-5 text-gray-500 mx-2" />
          <div>
            <h4 className="font-medium">{bookmark.resume_title}</h4>
            <p className="text-sm text-gray-500">{bookmark.resume_author}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4 ml-10">
        <span className="text-sm text-gray-500">
          {formatDate(bookmark.created_at)}
        </span>
      </div>
      <div
        className="flex items-center justify-center w-20 h-10 hover:scale-125 cursor-pointer"
        onClick={handleDeleteBookmark}
      >
        <Trash className="w-5 h-5 text-gray-500" />
      </div>
    </div>
  );
}

export default BookmarkItem;
