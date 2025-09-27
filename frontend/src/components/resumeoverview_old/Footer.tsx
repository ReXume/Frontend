'use client'

// import { useRouter } from "next/navigation";
import chevronLeft from "../../assets/chevron-left.webp";
import chevronRight from "../../assets/chevron-right.webp";

function Footer(): React.ReactElement {
  // const router = useRouter();

  // const handlePreviousResume = () => {
  //   if (previousResumeId) {
  //     router.push(`/feedback/${previousResumeId}`);
  //   }
  // };

  // const handleNextResume = () => {
  //   if (laterResumeId) {
  //     router.push(`/feedback/${laterResumeId}`);
  //   }
  // };

  return (
    <footer className="w-full h-[49px] bg-white border-t border-[#e0e0e0] flex justify-between items-center px-4">
      {/* Previous Resume */}
      <div
        // onClick={previousResumeId !== null ? handlePreviousResume : undefined}
        className={`flex items-center space-x-2 mt-3 -mb-5 opacity-50 cursor-not-allowed`}
      >
        <img src={chevronLeft.src as string} alt="Previous Resume" className="w-6 h-6" />
        <div className="text-[#6e6e6e] text-[15px] font-medium font-pretendard">
          이전 이력서
        </div>
      </div>

      {/* Next Resume */}
      <div
        // onClick={laterResumeId !== null ? handleNextResume : undefined}
        className={`flex items-center space-x-2 mt-3 -mb-5 opacity-50 cursor-not-allowed`}
      >
        <div className="text-[#6e6e6e] text-[15px] font-medium font-pretendard">
          다음 이력서
        </div>
        <img src={chevronRight.src as string} alt="Next Resume" className="w-6 h-6" />
      </div>
    </footer>
  );
}

export default Footer;
