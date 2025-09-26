import { User } from "lucide-react";

function UserInfo() {
  const userData: { username?: string; role?: string } | null = null;

  return (
    <div>
      <div className="flex gap-8">
        <div className="w-72 bg-white rounded-lg shadow-sm p-6 h-fit">
          <div className="flex flex-col items-center">
            {/* 유저 아이콘 */}
            <div className="w-24 h-24 bg-gray-200 rounded-full mb-4 flex items-center justify-center">
              <User className="w-12 h-12 text-gray-400" />
            </div>
            {/* 유저 정보 */}
            <h2 className="text-xl font-bold mb-1">
              {userData?.username || "Loading..."}
            </h2>
            <p className="text-gray-500 mb-4">
              {userData?.role || "Loading role..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserInfo;
