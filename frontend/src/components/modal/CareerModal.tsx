"use client";
import { useEffect, useRef } from "react";
// import Slider from "./Slider";
// import useFilterStore from "../../store/useFilterStore";

interface CareerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (minCareer: number, maxCareer: number) => void; // onApply 콜백 추가
}

const CareerModal = ({ isOpen, onClose }: CareerModalProps) => {
  // const { min_career, max_career, setCareerRange } = useFilterStore(); // 상태에서 min_career, max_career 가져오기
  // const [localMinCareer, setLocalMinCareer] = useState(min_career);
  // const [localMaxCareer, setLocalMaxCareer] = useState(max_career);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // const handleSliderChange = (newMin: number, newMax: number) => {
  //   // setLocalMinCareer(newMin);
  //   // setLocalMaxCareer(newMax);
  // };

  const applyFilter = () => {
    // setCareerRange(localMinCareer, localMaxCareer);
    // if (onApply) onApply(localMinCareer, localMaxCareer); // onApply 호출
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="absolute mt-24 w-125 p-6 bg-white rounded-lg border shadow-xl"
      ref={dropdownRef}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-black text-2xl"
      >
        &times;
      </button>
      <div className="text-black text-2xl font-semibold mb-6">경력</div>
      <div className="p-3 my-3 ml-3">
        {/* <Slider
          minCareer={localMinCareer}
          maxCareer={localMaxCareer}
          onChange={handleSliderChange}
        /> */}
      </div>
      <div className="flex justify-between">
        <button
          className="w-24 h-10 border border-gray-300 rounded-lg flex items-center justify-center text-black text-base font-medium"
        >
          초기화
        </button>
        <button
          onClick={applyFilter}
          className="w-24 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white text-base font-medium"
        >
          적용
        </button>
      </div>
    </div>
  );
};

export default CareerModal;
