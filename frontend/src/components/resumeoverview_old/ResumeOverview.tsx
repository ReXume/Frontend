import ResumeOverviewSection from "./ResumeOverviewSection";

interface ResumeOverviewProps {
  userName: string;
  position: string;
  career: number;
  techStackNames: string[];
  fileUrl: string;
  isLoading: boolean;
}

function ResumeOverview({
  userName,
  position,
  career,
  techStackNames,
  fileUrl,
  isLoading,
}: ResumeOverviewProps): React.ReactElement {
  return (
    <div className="w-[534px] h-auto  bg-white p-4 z-1">
      {/* Personal Info Section */}
      <ResumeOverviewSection
        userName={userName}
        position={position}
        career={career}
        techStackNames={techStackNames}
        fileUrl={fileUrl}
        isLoading={isLoading}
      />
    </div>
  );
}

export default ResumeOverview;
