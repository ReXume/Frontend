"use client";

import React from "react";

interface LayoutProps {
  children?: React.ReactNode;
  sidebar: React.ReactNode;
}

export default function ResumeLayout({
  children,
  sidebar,
}: LayoutProps): React.ReactElement {
  return (
    <div className="pt-5 bg-white">
      <div className="flex flex-row w-full">
        {/* Left Column: Main Content */}
        <div className="w-full md:w-2/3">{children}</div>

        {/* Right Column: Sidebar */}
        <div className="w-1/3 flex flex-col p-4 overflow-hidden">{sidebar}</div>
      </div>
    </div>
  );
}
