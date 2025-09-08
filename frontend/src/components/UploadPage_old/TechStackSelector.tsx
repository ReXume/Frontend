import React, { useState } from "react";

interface TechStackSelectorProps {
  selectedStacks: string[];
  availableStacks: string[];
  onToggle: (stack: string) => void;
  onAdd: (newStack: string) => void;
}

// 직접입력 태그 컴포넌트
function DirectInputTag(props: {
  existingTags: string[];
  onAdd: (newTag: string) => void;
}) {
  const { existingTags, onAdd } = props;
  const [inputValue, setInputValue] = useState("");

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
  }

  function handleKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (
      e.key === "Enter" &&
      inputValue.trim() !== "" &&
      !existingTags.includes(inputValue.trim())
    ) {
      onAdd(inputValue.trim());
      setInputValue("");
    }
  }

  return (
    <input
      type="text"
      value={inputValue}
      onChange={handleInputChange}
      onKeyPress={handleKeyPress}
      className="w-24 h-8 bg-gray-100 rounded text-center outline-none"
      placeholder="직접입력"
    />
  );
}

function TechStackSelector(props: TechStackSelectorProps) {
  const { selectedStacks, availableStacks, onToggle, onAdd } = props;

  return (
    <div>
      <h4 className="text-md font-medium text-gray-700 mb-2 flex items-center">
        <span className="text-blue-500 mr-1">#</span> 스택
      </h4>
      <div className="flex flex-wrap gap-2">
        {availableStacks.map(function (stack) {
          return (
            <button
              key={stack}
              className={
                "px-3 py-1.5 rounded-full text-sm font-medium " +
                (selectedStacks.includes(stack)
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200")
              }
              onClick={function () {
                onToggle(stack);
              }}
            >
              {stack}
            </button>
          );
        })}
        <DirectInputTag existingTags={availableStacks} onAdd={onAdd} />
      </div>
    </div>
  );
}

export default TechStackSelector;
