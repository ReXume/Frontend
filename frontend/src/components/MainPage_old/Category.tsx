import { useState, useEffect, useRef } from "react";
import ArrowDown from "../../assets/ArrowDown.svg";

type CategoryProps = {
  title: string;
  onClick?: () => void; // 모달 열기 위한 함수
  options?: string[]; // 드롭다운 옵션
  onSelect?: (option: string) => void; // 옵션 선택 시 호출되는 함수
};

function Category({ title, onClick, options, onSelect }: CategoryProps) {
  const [isOpen, setIsOpen] = useState(false); // 드롭다운 상태
  const [selectedOption, setSelectedOption] = useState<string | null>(null); // 선택된 옵션
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => setIsOpen((prev) => !prev);

  // 외부 클릭 시 드롭다운 창 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 옵션 선택 핸들러
  const handleOptionClick = (option: string) => {
    setSelectedOption(option);
    setIsOpen(false); // 선택 후 드롭다운 닫기
    if (onSelect) {
      onSelect(option); // 부모 컴포넌트에 선택된 값 전달
    }
  };

  return (
    <div className="relative flex flex-col" ref={dropdownRef}>
      {/* 카테고리 버튼 */}
      <button
        onClick={() => {
          if (options) {
            toggleDropdown(); // options가 있을 때 드롭다운 열기
          } else if (onClick) {
            onClick(); // options가 없으면 모달 열기
          }
        }}
        className="px-4 py-2 bg-white rounded-full text-sm font-medium text-gray-700 shadow-sm flex items-center hover:shadow-md transition-shadow"
        aria-expanded={isOpen} // 접근성 속성 추가
        aria-haspopup={options ? "listbox" : undefined}
      >
        <span className="text-[#535353] text-base font-normal px-1">
          {selectedOption || title} {/* 선택된 옵션이 있으면 표시 */}
        </span>
        <img
          src={ArrowDown}
          alt="ArrowDown"
          className={`transition-transform duration-200 w-4 h-4 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* 드롭다운 옵션 리스트 */}
      {isOpen && options && (
        <ul
          className="absolute top-12 left-0 w-28 bg-white rounded-lg border-[1.5px] mt-1 z-10"
          role="listbox"
        >
          {options.map((option, index) => (
            <li
              key={index}
              className="px-4 py-2 hover:bg-[#f0f4ff] cursor-pointer"
              onClick={() => handleOptionClick(option)}
              role="option"
              aria-selected={selectedOption === option}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Category;
