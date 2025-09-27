'use client'

import { useRouter } from "next/navigation";
import man1 from "../../assets/man1.webp";
import man2 from "../../assets/man2.webp";

function BannerCard() {
  const router = useRouter();

  const moveUploadPage = () => {
    router.push(`/upload`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-blue-500 rounded-2xl p-8 text-white flex flex-col md:flex-row items-center">
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-2">내가 지원할 기업은?</h2>
          <p className="text-sm text-blue-100 mb-6">
            채용 공고를 한 번에 볼 수 있습니다.
          </p>
          <button className="bg-white text-blue-600 px-6 py-3 rounded-full font-medium hover:bg-blue-50 transition-colors">
            지금 확인하기
          </button>
        </div>
        <div className="mt-6 md:mt-0">
          <img
            src={man1.src as string}
            alt="셔츠입은 사람"
            className="flex hidden lg:block w-40 h-40 object-cover rounded-full"
          />
        </div>
      </div>

      <div className="bg-indigo-500 rounded-2xl p-8 text-white flex flex-col md:flex-row items-center">
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-2">
            이력서 피드백이 필요할 때?
          </h2>
          <p className="text-sm text-indigo-100 mb-6">
            이력서를 등록하고 피드백을 받을 수 있습니다.
          </p>
          <button
            className="bg-white text-indigo-600 px-6 py-3 rounded-full font-medium hover:bg-indigo-50 transition-colors"
            onClick={moveUploadPage}
          >
            등록하러 가기
          </button>
        </div>
        <div className="flex hidden lg:block mt-6 md:mt-0">
          <img
            src={man2.src as string}
            alt="컴퓨터하는 사람"
            className="w-40 h-40 object-cover rounded-full"
          />
        </div>
      </div>
    </div>
  );
}

export default BannerCard;
