import SelectButton from "../UI_old/SelectButton";

interface PositionSelectorProps {
  positions: string[];
  selectedPosition: string;
  onSelect: (position: string) => void;
}

function PositionSelector({
  positions,
  selectedPosition,
  onSelect,
}: PositionSelectorProps) {
  return (
    <div>
      <h4 className="text-md font-medium text-gray-700 mb-2 flex items-center">
        <span className="text-blue-500 mr-1">#</span> 포지션
      </h4>

      <SelectButton
        options={positions}
        selected={selectedPosition}
        onSelect={onSelect}
        placeholder="포지션을 선택하세요"
        width="100%"
      />
    </div>
  );
}

export default PositionSelector;
