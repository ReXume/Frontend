import ExperienceSlider from "../UI_old/ExperienceSlider";

interface CareerSelectorProps {
  value: number;
  onChange: (newValue: number) => void;
}

function CareerSelector(props: CareerSelectorProps) {
  const { value, onChange } = props;
  return (
    <div>
      <h4 className="text-md font-medium text-gray-700 mb-2 flex items-center">
        <span className="text-blue-500 mr-1">#</span> 경력
      </h4>

      <ExperienceSlider value={value} onChange={onChange} />
    </div>
  );
}

export default CareerSelector;
