import { useState, useEffect } from "react";
import axios from "axios";
import ResumeItem from "../../components/MyInfoPage/ResumeItem.tsx";
import { ResumeType } from "../../dataType.ts";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

function MyInfoPage() {
  const [userResumes, setUserResumes] = useState<ResumeType[]>([]);

  const renderResume = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/resumes/user`, {
        withCredentials: true,
      });

      if (response.data?.code === "COMMON_200") {
        setUserResumes(response.data.result);
      } else {
        console.log("데이터를 불러오지 못했습니다.");
      }
    } catch (error) {
      console.error("실패:", error);
    }
  };

  useEffect(() => {
    renderResume();
  }, []);

  return (
    <div className="flex gap-8">
      <div className="flex-1">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">나의 이력서 목록</h3>
            <p className="text-sm text-gray-500">{userResumes.length}개</p>
          </div>
          <div className="space-y-4">
            {userResumes.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                등록된 이력서가 없습니다.
              </div>
            ) : (
              userResumes.map((resume) => (
                <ResumeItem
                  key={resume.resume_id}
                  resume={resume}
                  onUpdate={renderResume}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MyInfoPage;
