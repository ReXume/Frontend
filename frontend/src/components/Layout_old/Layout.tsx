import React from "react";
import Navbar from "../common/Navbar.tsx";

interface LayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

function Layout({ children, sidebar }: LayoutProps): React.ReactElement {
  return (
    <div className="pt-5 bg-white">
      <Navbar />
      <div className="flex flex-row w-full">
        {/* Left Column: Main Content */}
        <div className="w-full md:w-2/3">{children}</div>

        {/* Right Column: Sidebar */}
        <div className="w-1/3 flex flex-col p-4 overflow-hidden">{sidebar}</div>
      </div>
    </div>
  );
}

export default Layout;
