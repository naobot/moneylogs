import { useAuthState } from "react-firebase-hooks/auth";
import { Link } from "react-router-dom";
import { auth } from "@/config/firebase-config";
import { EXTERNAL_LINKS } from "@/config/links";
import Button from "@/components/Button";

export const About = () => {
  const [user] = useAuthState(auth);
  const isLoggedIn = !!user;

  return (
    <div className="AboutPage">
      <h2>about</h2>

      <div>
        <p>
          <strong>moneylogs</strong> is a private social media platform where microblogging meets
          transparency in personal finances created and maintained by{" "}
          <a href={EXTERNAL_LINKS.website} target="_blank" rel="noopener noreferrer">
            Naomi Cui
          </a>
          .
        </p>
      </div>

      <div style={{ textAlign: "center" }}>
        {!isLoggedIn ? (
          <Link to="/login" state={{ view: "register" }}>
            [Register]
          </Link>
        ) : (
          <Button to="/create" text="[Get started]" />
        )}
      </div>

      <div>
        <p>
          moneylogs is free. If you'd like to support it, consider{" "}
          <a href={EXTERNAL_LINKS.tipJar} target="_blank" rel="noopener noreferrer">
            leaving a tip
          </a>
          .
        </p>
      </div>
    </div>
  );
};
