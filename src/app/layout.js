import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata = {
  title: 'ระบบจองห้องประชุม | คณะวิทยาศาสตร์และนวัตกรรมดิจิทัล',
  description: 'ระบบจองห้องประชุมออนไลน์ คณะวิทยาศาสตร์และนวัตกรรมดิจิทัล สำหรับอาจารย์ บุคลากร และนิสิต',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
