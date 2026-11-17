import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import MainNav from "./components/MainNav";
import Footer from "./components/Footer";
import { textDensity } from "@/utils/textDensity";

const Layout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  return (
    <div className="Container">
      <MainNav />
      <div className="Content" data-text={textDensity(pathname)}>
        {children}
      </div>
      <Footer />
    </div>
  );
};

export default Layout;
