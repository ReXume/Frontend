import Slider from "@mui/material/Slider";

interface ExperienceSliderProps {
  value: number;
  onChange: (newValue: number) => void;
}

function ExperienceSlider(props: ExperienceSliderProps) {
  const { value, onChange } = props;

  return (
    <div className="px-2">
      <Slider
        value={value}
        onChange={(_event, newValue) => onChange(newValue as number)}
        step={1}
        min={0}
        max={10}
        valueLabelDisplay="auto"
        sx={{
          "& .MuiSlider-thumb": { color: "#007bff" },
          "& .MuiSlider-track": { color: "#007bff" },
          "& .MuiSlider-rail": { color: "#dddddd" },
        }}
      />
      <div className="flex justify-between text-sm text-gray-500">
        <span>0년</span>
        <span>10년+</span>
      </div>
      <div className="text-center mt-1 font-medium text-blue-600">
        {value === 10 ? "10년+" : `${value}년`}
      </div>
    </div>
  );
}

export default ExperienceSlider;
