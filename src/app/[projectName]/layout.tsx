import type { Metadata } from "next";

import "../globals.css"
import I18nProvider from "@/lib/i18n";
import '../../../public/fonts/style.css';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


export async function generateMetadata({ params }: { params: { projectName: string } }): Promise<Metadata> {
  try {
    const response = await fetch(`https://pos-jouboun.tsdsolution.net/api/DriverController/setting`, {
      next: { revalidate: 3600 },
    });
    const data: any = await response.json();
    return {
      title: data.site_name || "Tonle Coffee",
      icons: `https://pos-jouboun.tsdsolution.net/assets/uploads/logos/${data.logo}`
    };
  } catch (error) {
    console.error("Error fetching metadata:", error);
    // Return default metadata or handle the error as per your requirement
    return {
      title: "Default Title",
      icons: "/default-icon.png"
    };
  }
}

export default function RootLayout({
  params,
  children,
}: Readonly<{
  params: { projectName: string }
  children: React.ReactNode;
}>) {
  return (
    <html lang="kh" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://pos-jouboun.tsdsolution.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://pos-jouboun.tsdsolution.net" />
      </head>
      <body className="m-auto max-w-[575px]">
        <div className=" h-screen bg-white overflow-auto max-w-[575px] w-full ">
          <I18nProvider>

            <ToastContainer position="top-center" />
            {children}
          </I18nProvider>
        </div>
      </body>
    </html>
  );
}
