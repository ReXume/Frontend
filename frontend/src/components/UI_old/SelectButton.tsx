import { useEffect, useRef, useState } from "react";

interface SelectButtonProps {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  width?: string;
  placeholder?: string;
}

function SelectButton({
  options,
  selected,
  onSelect,
  width = "100%",
  placeholder = "선택하세요",
}: SelectButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={dropdownRef} className="relative" style={{ width }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-w-[150px] max-w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 text-gray-700 bg-white flex justify-between items-center"
      >
        <span className={selected ? "text-black" : "text-gray-400"}>
          {selected || placeholder}
        </span>
        <span className="ml-auto">&#9662;</span> {/* ▼ 아이콘 */}
      </button>

      {isOpen && (
        <ul className="absolute w-full mt-1 border border-gray-200 rounded-md shadow-lg bg-white z-10">
          {options.map((option) => (
            <li
              key={option}
              onClick={() => {
                onSelect(option);
                setIsOpen(false);
              }}
              className={`px-4 py-2 cursor-pointer ${
                selected === option
                  ? "bg-gray-100 font-semibold"
                  : "hover:bg-gray-100"
              }`}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SelectButton;
