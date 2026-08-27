import Providers from "./providers";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const metadata = {
  title: "Duty Officer Checklist System",
  description: "Daily inspection checklist, reports & task management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0 }}>
        <Providers>{children}</Providers>

        <ToastContainer position="top-right" autoClose={3000} />
      </body>
    </html>
  );
}