import Icon from "@/components/Icon";

const AuthErrorMessage = ({ message }: { message: string }) => {
  if (!message) return null;

  return (
    <div className="AuthError" role="alert">
      <Icon type="warning" />
      {message}
    </div>
  );
};

export default AuthErrorMessage;
