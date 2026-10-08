import React from 'react';
import { Navbar } from '../components/shared/Navbar';
import { Footer } from '../components/shared/Footer';

interface UserLayoutProps {
  children: React.ReactNode;
  session: any;
  onLogout: () => void;
  unreadNotifications?: number;
}

export const UserLayout: React.FC<UserLayoutProps> = ({
  children,
  session,
  onLogout,
  unreadNotifications = 0
}) => {
  return (
    <>
      <Navbar
        isAuthenticated={true}
        userRole={session?.role}
        userName={session?.email}
        unreadNotifications={unreadNotifications}
        onLogout={onLogout}
      />
      <main className="page">
        <div className="container">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
};
