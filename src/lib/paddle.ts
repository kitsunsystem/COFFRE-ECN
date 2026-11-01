// Paddle.js, loaded only when someone pays: the checkout opens over the page and card details never touch our servers.
import { PADDLE_CLIENT_TOKEN, PADDLE_SANDBOX } from "./env";

type Paddle = {
  Environment: { set(env: string): void };
  Initialize(o: { token: string; eventCallback?: (e: { name?: string }) => void }): void;
  Checkout: { open(o: { transactionId: string }): void };
};
let loading: Promise<Paddle> | undefined;

export function paddle(onCompleted: () => void) {
  if (!PADDLE_CLIENT_TOKEN) return Promise.reject(new Error("Paiement indisponible pour le moment."));
  loading ??= new Promise<Paddle>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.onload = () => {
      const P = (window as unknown as { Paddle: Paddle }).Paddle;
      if (PADDLE_SANDBOX) P.Environment.set("sandbox");
      // Initialize runs once per page: the first payment sets the callback.
      P.Initialize({ token: PADDLE_CLIENT_TOKEN, eventCallback: (e) => e.name === "checkout.completed" && onCompleted() });
      resolve(P);
    };
    s.onerror = () => {
      loading = undefined;
      s.remove();
      reject(new Error("Le paiement ne s'est pas chargé. Vérifiez votre connexion et réessayez."));
    };
    document.head.appendChild(s);
  });
  return loading;
}
