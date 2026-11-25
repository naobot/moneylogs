import { Link } from "react-router-dom";
import { EXTERNAL_LINKS } from "@/config/links";
import { isNative } from "@/platform";

const Footer = () => {
  return (
    <footer className="Footer">
      a
      <a href={EXTERNAL_LINKS.website} target="_blank" rel="noopener noreferrer">
        nnao.world
      </a>
      project
      <span className="Footer__sep" aria-hidden="true">
        ·
      </span>
      {/* No tip link in the store apps: Play and the App Store restrict payment links
          outside their own billing. */}
      {!isNative() && (
        <>
          <a href={EXTERNAL_LINKS.tipJar} target="_blank" rel="noopener noreferrer">
            support me?
          </a>
          <span className="Footer__sep" aria-hidden="true">
            ·
          </span>
        </>
      )}
      <Link to="/privacy">privacy</Link>
    </footer>
  );
};

export default Footer;
