import { useState, useEffect } from "react";
import { Search, User } from "lucide-react";
import { useRouter } from "next/navigation";
import useSearchStore from "../../store/SearchStore";
import authStore from "../../store/authStore";

function Navbar() {
  const router = useRouter();
  const [searchText, setSearchText] = useState<string>("");
  const { setSearchName } = useSearchStore();
  const { checkAuth, userData, isAuthenticated } = authStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const moveMainPage = () => {
    router.push("/");
  };

  const moveLoginPage = () => {
    router.push("/login");
  };

  const moveMyPage = () => {
    router.push("/myInfo");
  };

  const searchName = () => {
    if (!searchText.trim()) {
      alert("검색어를 입력해주세요!");
      return;
    }

    try {
      setSearchName(searchText);
      router.push(`/search?user_name=${searchText}`);
    } catch (error) {
      alert("검색 실패 ");
      console.log(error);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      searchName();
    }
  };

  return (
    <header className="sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        {/* 로고 */}
        <h1
          className="text-3xl font-bold text-gray-800 hover:cursor-pointer"
          onClick={moveMainPage}
        >
          Re
          <span className="text-blue-600">X</span>ume
        </h1>

        {/* 검색 바 */}
        <div className="relative ml-auto w-80">
          <input
            type="text"
            placeholder="검색어를 입력하세요."
            className="w-full px-4 py-2 pr-10 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button
            className="absolute right-5 top-1/2 -translate-y-1/2"
            onClick={searchName}
          >
            <Search className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 로그인 / 프로필 */}
        <div className="ml-6 flex items-center">
          {isAuthenticated ? (
            <div
              className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-full cursor-pointer"
              onClick={moveMyPage}
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-6 h-6 text-gray-600" />
              </div>
              <span
                className="hidden sm:block text-sm font-medium"
                onClick={moveMyPage}
              >
                {userData?.username}
              </span>
            </div>
          ) : (
            <button
              className="px-4 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              onClick={moveLoginPage}
            >
              로그인
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
