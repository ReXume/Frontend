import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

interface ExperienceSliderProps {
  minCareer: number;
  maxCareer: number;
  onChange: (newMin: number, newMax: number) => void;
}

export default function ExperienceSlider({
  minCareer,
  maxCareer,
  onChange,
}: ExperienceSliderProps) {
  const [value, setValue] = React.useState<number[]>([minCareer, maxCareer]);

  React.useEffect(() => {
    setValue([minCareer, maxCareer]);
  }, [minCareer, maxCareer]);

  const handleValueChange = (newValue: number[]) => {
    setValue(newValue);
    onChange(newValue[0], newValue[1]); // 부모 컴포넌트에 새로운 경력 범위 전달
  };

  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="flex justify-between">
        <span>신입</span>
        <span>10년</span>
      </div>
      <SliderPrimitive.Root
        className="relative flex w-full touch-none select-none items-center"
        value={value}
        onValueChange={handleValueChange}
        max={10}
        step={1}
      >
        <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-gray-200">
          <SliderPrimitive.Range className="absolute h-full bg-blue-500" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-6 w-6 rounded-full border border-blue-500 bg-white ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
        <SliderPrimitive.Thumb className="block h-6 w-6 rounded-full border border-blue-500 bg-white ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
      </SliderPrimitive.Root>
      <div className="text-center">
        {value[0] === 0 ? "신입" : `${value[0]}년`} -{" "}
        {value[1] === 10 ? "10년 이상" : `${value[1]}년`}
      </div>
    </div>
  );
}
