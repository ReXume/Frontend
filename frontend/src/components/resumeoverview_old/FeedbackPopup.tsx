import { FeedbackPoint } from "@/types/FeedbackPointType";

type FeedbackPopupProps = {
  point: FeedbackPoint;
  onClose: () => void;
  newComment: string;
  setNewComment: (comment: string) => void;
  onSubmit: () => void;
};

function FeedbackPopup({
  onClose,
  newComment,
  setNewComment,
  onSubmit,
}: FeedbackPopupProps) {
  return (
    <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-20">
      <div className="bg-white border rounded shadow-lg p-4 w-80">
        <h3 className="text-lg font-semibold mb-2">Feedback Point</h3>
        <textarea
          className="w-full border rounded p-2 mb-2"
          placeholder="Add or edit your comment"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <div className="flex justify-end space-x-2">
          <button className="px-4 py-2 bg-gray-300 rounded" onClick={onClose}>
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded"
            onClick={onSubmit}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeedbackPopup;
