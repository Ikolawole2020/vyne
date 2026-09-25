import "./globals.css";
export const metadata = { title: "Vyne — Trade Crypto", description: "Vyne crypto exchange" };

const themeInit = `(function(){try{var t=localStorage.getItem("vyne_theme")||"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
