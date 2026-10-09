import './globals.css';
import SiteHeader from './SiteHeader';

export const metadata = {
  title: 'IEEE EMBS VIT Student Chapter Pune | Biomedical Engineering Quiz',
  description: 'Official assessment and quiz portal organized by IEEE EMBS VIT Student Chapter Pune at Vishwakarma Institute of Technology, Pune.',
  icons: {
    icon: '/logo.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
