import { useAuthState } from "react-firebase-hooks/auth";
import { Link } from "react-router-dom";
import { auth } from "@/config/firebase-config";
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
          transparency in personal finances created and maintained by Naomi Cui.
        </p>
      </div>

      <div style={{ textAlign: "center" }}>
        {!isLoggedIn ? (
          <Link to="/login" state={{ view: "register" }}>
            [Register]
          </Link>
        ) : (
          <Button onClick={() => {}} text="[Get started]" />
        )}
      </div>
    </div>
  );
};
