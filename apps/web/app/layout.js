import "./globals.css";

export const metadata = {
  title: "MyTeleBot",
  description: "Telegram bot control panel prototype"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
