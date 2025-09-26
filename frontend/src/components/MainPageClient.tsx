"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  useInfiniteQuery,
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import Category from "@/components/common/Category";
import BannerCard from "@/components/main/BannerCard";
import CareerModal from "@/components/modal/CareerModal";
import PositionModal from "@/components/modal/PositionModal";
import useResumeStore from "@/store/ResumeStore";
import { useRouter } from "next/navigation";
import { getResumeList, viewResume } from "@/api/resumeApi";
import PostCard from "@/components/common/PostCard";
import useFilterStore from "@/store/useFilterStore";
import Navbar from "./common_old/Navbar";

export type MainPageClientProps = {
  initialResumes: any[];
};

export default function MainPageClient({
}: MainPageClientProps) {

}
