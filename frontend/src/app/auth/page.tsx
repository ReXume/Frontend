'use client'

// AuthCallback.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";

const AuthCallback = () => {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function verifyAuth() {
      try {
        await checkAuth();
        // 인증 성공 시 원하는 페이지로 이동 (예: 대시보드)
        router.push("/"); //기존에 저장했던 위치
      } catch (err) {
        console.error("인증 실패", err);
        setError("인증에 실패했습니다. 다시 로그인 해주세요.");
      } finally {
        setLoading(false);
      }
    }

    verifyAuth();
  }, [checkAuth, router]);

  if (loading) {
    return <div>인증 확인 중...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return null;
};

export default AuthCallback;
