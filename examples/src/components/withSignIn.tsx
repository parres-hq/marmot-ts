import { ComponentType } from "react";
import { useObservable } from "../hooks/use-observable";
import accountManager from "../lib/accounts";

export function withSignIn<P extends object>(
  Component: ComponentType<P>,
): ComponentType<P> {
  return function WithSignInWrapper(props: P) {
    const activeAccount = useObservable(accountManager.active$);

    const handleSignIn = () => {
      (
        document.getElementById("signin_modal") as HTMLDialogElement
      )?.showModal();
    };

    if (!activeAccount) {
      return (
        <div className="flex items-center justify-center min-h-[400px] flex-col gap-4">
          <div className="text-center text-lg">
            This example requires an account:
          </div>
          <button
            className="btn btn-primary w-sm btn-lg"
            onClick={handleSignIn}
          >
            Sign In
          </button>
        </div>
      );
    }

    return <Component {...props} />;
  };
}
