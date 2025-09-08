import { MouseEventHandler } from "react";
import { Clock } from "lucide-react";

function PostCard({
  name,
  role,
  experience,
  skills,
  onClick,
}: {
  name: string;
  role: string;
  experience: number | string;
  skills: string[];
  onClick?: MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden hover:cursor-pointer"
      onClick={onClick}
    >
      <div className="p-5">
        <div className="flex items-center mb-3">
          <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center mr-3">
            <span className="text-sm font-medium text-blue-600">
              {name.substring(1, 3)}
            </span>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{name}</h3>
            <div className="flex items-center text-sm text-gray-500">
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 mt-1 rounded text-xs font-medium">
                {role}
              </span>
            </div>
          </div>
        </div>

        {/* 경력 */}
        <div className="flex items-center text-sm text-gray-600 my-2">
          <Clock size={14} className="mr-1" />
          <span>{experience === 0 ? "신입" : `${experience}년`}</span>
        </div>

        {/* 기술 스택 */}
        <div className="flex flex-wrap gap-1 mt-4 mb-4">
          {skills && skills.length > 0 ? (
            skills.slice(0, 3).map((skill, index) => (
              <div
                key={index}
                className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded"
              >
                {skill}
              </div>
            ))
          ) : (
            <div className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
              <p>NoSkill</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PostCard;
