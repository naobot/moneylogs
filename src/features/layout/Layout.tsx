import { ReactNode } from "react";
import MainNav from "./components/MainNav";
import Footer from "./components/Footer";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="Container">
      <MainNav />
      <div className="Content">{children}</div>
      <Footer />
    </div>
  );
};

export default Layout;
