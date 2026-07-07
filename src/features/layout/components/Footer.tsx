import { EXTERNAL_LINKS } from "@/config/links";

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
      <a href={EXTERNAL_LINKS.tipJar} target="_blank" rel="noopener noreferrer">
        support me?
      </a>
    </footer>
  );
};

export default Footer;
