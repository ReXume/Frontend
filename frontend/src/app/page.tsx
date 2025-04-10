"use client";
import Category from "@/components/common/Category";
import BannerCard from "@/components/main/BannerCard";
import CareerModal from "@/components/modal/CareerModal";
import PositionModal from "@/components/modal/PositionModal";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState } from "react";

export default function Home() {
  // const router = useRouter();
  // const { setResumeId } = useResumeStore();

  // const moveToResume = async (resumeId: number) => {
  //   try {
  //     // const response = await viewResume(resumeId);
  //     // setResumeId(response.resume_id);
  //     router.push(`/feedback/${response.resume_id}`);
  //     return response;
  //   } catch (error) {
  //     console.error("이력서 조회 오류:", error);
  //     throw error;
  //   }
  // };

  // 정렬 옵션 상태: "최신순"(최신 데이터) / "조회순"(인기 데이터)
  const [sortOption, setSortOption] = useState("최신순");
  const [isPositionOpen, setIsPositionOpen] = useState(false);
  const [isCareerOpen, setIsCareerOpen] = useState(false);
  const [positionTitle, setPositionTitle] = useState("포지션");
  const [careerTitle, setCareerTitle] = useState("경력");
  // const { positions, min_career, max_career, setCareerRange, setPositions } =
  //   useFilterStore();
  // const [filteredData, setFilteredData] = useState<PostCardsType[] | null>(
  //   null
  // );

  // 공통 데이터 fetch 함수
  // const fetchPostCards = async (page: number, size = 8) => {
  //   try {
  //     const resumeList = await getResumeList(page, size);
  //     return resumeList;
  //   } catch (error) {
  //     console.error("포스트카드 조회 오류:", error);
  //     throw error;
  //   }
  // };

  // [최신 데이터] useInfiniteQuery: 무한 스크롤로 최신 이력서 목록을 가져옴
  // const latestQuery = useInfiniteQuery({
  //   queryKey: ["latestResumes"],
  //   queryFn: async ({ pageParam = 0 }) => {
  //     return fetchPostCards(pageParam);
  //   },
  //   getNextPageParam: (lastPage, allPages) => {
  //     if (lastPage.length > 0) {
  //       return allPages.length;
  //     } else {
  //       return undefined;
  //     }
  //   },
  //   initialPageParam: 0,
  // });

  // [인기 데이터] useQuery: 조회순으로 인기 이력서를 가져오며, staleTime 10분으로 캐싱함
  // const popularQuery = useQuery({
  //   queryKey: ["popularResumes"],
  //   queryFn: async () => {
  //     const data = await getResumeList(0, 100);
  //     return data.sort(
  //       (a: PostCardsType, b: PostCardsType) => b.view_count - a.view_count
  //     );
  //   },
  //   staleTime: 10 * 60 * 1000, // 10분
  // });

  const handleApplyPosition = (selectedPosition: string | null) => {
    // setPositions(selectedPosition ? [selectedPosition] : []);
    setPositionTitle(selectedPosition || "포지션");
    setIsPositionOpen(false);
  };

  const handleApplyCareer = (min: number, max: number) => {
    // setCareerRange(min, max);
    setCareerTitle(`${min}년 ~ ${max}년`);
    setIsCareerOpen(false);
  };

  // 필터 및 정렬: 선택된 정렬 옵션에 따라 최신/인기 데이터 중 필터링 적용
  // const applyFilters = useCallback(() => {
  //   let rawData: PostCardsType[] = [];
  //   if (sortOption === "최신순") {
  //     if (latestQuery.data?.pages) {
  //       rawData = latestQuery.data.pages.flatMap((page) => page);
  //     }
  //   } else if (sortOption === "조회순") {
  //     if (popularQuery.data) {
  //       rawData = [...popularQuery.data];
  //     }
  //   }
  //   const filtered = rawData.filter((post: PostCardsType) => {
  //     const positionMatch =
  //       positionTitle === "포지션" ? true : positions.includes(post.position);
  //     const careerMatch =
  //       careerTitle === "경력"
  //         ? true
  //         : post.career >= min_career && post.career <= max_career;
  //     return positionMatch && careerMatch;
  //   });
  //   setFilteredData(filtered);
  // }, [
  //   latestQuery.data?.pages,
  //   popularQuery.data,
  //   positions,
  //   min_career,
  //   max_career,
  //   positionTitle,
  //   careerTitle,
  //   sortOption,
  // ]);

  // useEffect(() => {
  //   applyFilters();
  // }, [
  //   latestQuery.data?.pages,
  //   popularQuery.data,
  //   positions,
  //   min_career,
  //   max_career,
  //   sortOption,
  //   applyFilters,
  // ]);

  // // 무한 스크롤: 최신 데이터일 때만 Intersection Observer로 다음 페이지 요청
  // const loadMoreRef = useRef<HTMLDivElement | null>(null);
  // useEffect(() => {
  //   if (sortOption !== "최신순") return;
  //   if (!latestQuery.hasNextPage || latestQuery.isFetchingNextPage) return;
  //   const observer = new IntersectionObserver(
  //     (entries) => {
  //       if (entries[0].isIntersecting) {
  //         latestQuery.fetchNextPage();
  //       }
  //     },
  //     { root: null, rootMargin: "0px", threshold: 0.1 }
  //   );
  //   const loadMoreCurrent = loadMoreRef.current;
  //   if (loadMoreCurrent) observer.observe(loadMoreCurrent);
  //   return () => {
  //     if (loadMoreCurrent) observer.unobserve(loadMoreCurrent);
  //   };
  // }, [
  //   latestQuery,
  //   latestQuery.hasNextPage,
  //   latestQuery.fetchNextPage,
  //   latestQuery.isFetchingNextPage,
  //   sortOption,
  // ]);

  return (
    <div className="bg-amber-900">
      <main className="container mx-auto px-4 py-8">
        <BannerCard />
        <div className="mt-12">
          <div className="flex flex-wrap gap-3">
            <h2 className="text-xl font-bold text-gray-800 w-full mb-2">
              이력서 목록
            </h2>
            {/* 정렬 옵션: 인기(조회순) / 최신(최신순) */}
            <Category
              title={sortOption}
              options={["조회순", "최신순"]}
              onSelect={(selectedOption: string) =>
                setSortOption(selectedOption || "조회순")
              }
            />
            <Category
              title={positionTitle}
              onClick={() => setIsPositionOpen(true)}
            />
            <Category
              title={careerTitle}
              onClick={() => setIsCareerOpen(true)}
            />
            {isPositionOpen && (
              <PositionModal
                isOpen={isPositionOpen}
                onClose={() => setIsPositionOpen(false)}
                onApply={handleApplyPosition}
              />
            )}
            {isCareerOpen && (
              <CareerModal
                isOpen={isCareerOpen}
                onClose={() => setIsCareerOpen(false)}
                onApply={handleApplyCareer}
              />
            )}
          </div>

          {/* {filteredData && filteredData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
              {filteredData.map((post: PostCardsType) => (
                <PostCard
                  key={post.resume_id}
                  name={post.user_name}
                  role={post.position}
                  experience={post.career}
                  skills={post.tech_stack_names}
                  onClick={() => moveToResume(Number(post.resume_id))}
                />
              ))}
            </div>
          ) : (
            <div className="flex justify-center items-center text-center my-8 text-lg">
              카테고리에 해당하는 이력서가 없습니다
            </div>
          )} */}
        </div>
        {/* {sortOption === "최신순" && <div ref={loadMoreRef} className="h-1" />} */}
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        hello
      </footer>
    </div>
  );
}
