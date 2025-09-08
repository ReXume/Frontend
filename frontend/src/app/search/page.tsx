'use client'

import { useEffect, useState } from "react";
import useSearchStore from "@/store/SearchStore";
import useCategoryStore from "@/store/CategoryStore";
import { PostCardsType } from "@/types/PostCardsType";
import { searchResume } from "@/api/resumeApi";
import Navbar from "@/components/layout/Navbar";
import down from "@/assets/chevron-down.svg";
import PostCard from "@/components/common/PostCard";
import PositionModal from "@/components/Search_old/PositionModal";
import CareerModal from "@/components/Search_old/CareerModal";

function SearchPage() {
  const [isPositionOpen, setIsPositionOpen] = useState<boolean>(false);
  const [isCareerOpen, setIsCareerOpen] = useState<boolean>(false);

  // zustand에서 검색 결과 상태 가져오기
  const { searchName } = useSearchStore();

  // zustand에서 positionCategory, careerCategory 가져오기
  const positionCategory = useCategoryStore((state) => state.positionCategory);
  const careerCategory = useCategoryStore((state) => state.careerCategory);

  // 포지션 모달
  const openPositionModal = () => setIsPositionOpen(true);
  const closePositionModal = () => setIsPositionOpen(false);

  // 경력 모달
  const openCareerModal = () => setIsCareerOpen(true);
  const closeCareerModal = () => setIsCareerOpen(false);

  //검색 결과
  const [responseData, setResponseData] = useState<PostCardsType[] | null>(
    null
  );

  //와이러노

  useEffect(() => {
    const SearchResults = async () => {
      if (searchName.length > 0) {
        try {
          const response = await searchResume(searchName);
          setResponseData(response);
        } catch (error) {
          console.error("검색 요청 실패:", error);
        }
      }
    };
    SearchResults();
  }, [searchName]);

  console.log("Data: ", responseData);

  return (
    <div className="bg-white">
      <Navbar />
      <div className="flex flex-col justify-start p-5">
        <div className="w-full max-w-screen-lg mx-auto">
          {/* 검색 결과 제목 */}
          <div className="flex flex-row justify-start items-center p-10">
            <span className="text-black text-4xl font-extrabold">
              {searchName && searchName.length > 0 ? (
                `‘${searchName}’`
              ) : (
                <span className="ml-5">‘ ’</span>
              )}
            </span>
            <span className="text-black text-3xl font-normal ml-8 mt-2">
              검색 결과
            </span>
          </div>

          {/* 포지션과 경력 선택 버튼 */}
          <div className="flex flex-row items-center px-24 -ml-10 -mt-3 relative">
            <p className="font-medium text-black text-xl">포지션</p>
            <div className="relative">
              <img
                className="w-6 h-6 border border-[1.5px] rounded-lg p-1 ml-2 cursor-pointer"
                src={down}
                alt="down"
                onClick={openPositionModal}
              />
              {/* 포지션 모달 */}
              {isPositionOpen && (
                <div className="absolute top-10 -left-14 z-50">
                  <PositionModal
                    isOpen={isPositionOpen}
                    onClose={closePositionModal}
                  />
                </div>
              )}
            </div>

            <p className="font-medium text-black text-xl ml-8">경력</p>
            <div className="relative">
              <img
                className="w-6 h-6 border border-[1.5px] rounded-lg p-1 ml-2 cursor-pointer"
                src={down}
                alt="down"
                onClick={openCareerModal}
              />
              {/* 경력 모달 */}
              {isCareerOpen && (
                <div className="absolute top-10 -left-10 z-50">
                  <CareerModal
                    isOpen={isCareerOpen}
                    onClose={closeCareerModal}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 선택한 포지션 및 경력 카테고리 표시 */}
          <div className="flex space-x-2 mt-7 mb-2 ml-4 sm:ml-10">
            {Array.isArray(positionCategory) &&
              positionCategory.length > 0 &&
              positionCategory.map((category, index) => (
                <div
                  key={index}
                  className="flex items-center justify-center px-3 sm:px-4 py-1 bg-[#618EFF] rounded-xl text-center text-white text-xs sm:text-sm font-medium"
                >
                  {category}
                </div>
              ))}
          </div>

          <div className="flex space-x-2 mt-3 mb-2 ml-4 sm:ml-10">
            {Array.isArray(careerCategory) &&
              careerCategory.length > 0 &&
              careerCategory.map((category, index) => (
                <div
                  key={index}
                  className="flex items-center justify-center px-3 sm:px-4 py-1 bg-[#34D399] rounded-xl text-center text-white text-xs sm:text-sm font-medium"
                >
                  {category}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* 검색 결과 출력 */}
      <div className="flex justify-center bg-[#eff4ff] px-5 sm:px-10">
        <div className="grid grid-cols-1 min-[700px]:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 transform gap-6 p-5 max-w-screen-lg xl:w-full">
          {responseData && responseData.length > 0 ? (
            responseData.map((post: PostCardsType) => {
              return (
                <PostCard
                  key={post.resume_id}
                  name={post.user_name}
                  role={post.position}
                  experience={post.career}
                  skills={post.tech_stack_names}
                />
              );
            })
          ) : (
            <div className="flex justify-center w-full my-10">
              <p>검색 결과가 존재하지 않습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchPage;
