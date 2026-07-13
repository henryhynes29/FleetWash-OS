import "./globals.css";
export const metadata = {
  title: "FleetWash OS",
  description: "Fleet washing operations platform",
  manifest: "/manifest.json",
};
export const viewport = { themeColor: "#0E1626" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ("serviceWorker" in navigator) {
            window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
          }
        ` }} />
      </body>
    </html>
  );
}
