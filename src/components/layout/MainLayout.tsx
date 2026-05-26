import { ReactNode, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { Sidebar } from '../common/Sidebar';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { sidebarOpen, theme } = useUIStore();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main
        className={`transition-all duration-200 ease-in-out ${
          sidebarOpen ? 'lg:ml-64' : ''
        }`}
      >
        <div className="min-h-screen">{children}</div>
      </main>
    </div>
  );
}
