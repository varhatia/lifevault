import "../styles/globals.css";
import React from "react";
import InactivityMonitor from "./components/InactivityMonitor";
import LayoutWrapper from "./components/LayoutWrapper";

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#020617] text-slate-50 antialiased">
        <InactivityMonitor />
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
