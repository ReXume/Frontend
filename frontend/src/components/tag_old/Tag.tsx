type TagProps = {
  text: string;
};

function Tag({ text }: TagProps) {
  return (
    <div className="bg-[#f3f3f3] rounded w-[113.54px] h-[30.42px] flex justify-center items-center">
      <span className="text-[15.01px] text-[#040404] font-['ABeeZee']">
        {text}
      </span>
    </div>
  );
}

export default Tag;
