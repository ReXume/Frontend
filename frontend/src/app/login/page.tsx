'use client'

import React from "react";
import Image from "next/image";
import { GoogleLogin, GithubLogin } from "@/api/auth";
import GoogleImg from "../assets/GoogleLogin.webp";
import GithubImg from "../assets/GithubLogin.webp";
import loginText from "../assets/loginText.webp";

const LoginPage: React.FC = () => {
  return (
    <div className="flex justify-center min-h-screen">
      <div className="flex items-center flex-col pt-40">
        <h2 className="text-6xl font-normal mb-10">ReXume</h2>
        <Image 
          src={loginText} 
          alt="loginText" 
          className="mb-20 w-[24rem]" 
        />
        <Image
          src={GoogleImg}
          alt="GoogleImg"
          onClick={GoogleLogin}
          className="hover:scale-105 hover:cursor-pointer my-2 w-[22rem]"
        />
        <Image
          src={GithubImg}
          alt="GithubImg"
          onClick={GithubLogin}
          className="hover:scale-105 hover:cursor-pointer w-[22rem]"
        />
      </div>
    </div>
  );
};

export default LoginPage;
