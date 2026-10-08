import React from 'react';
import { Navbar } from '../components/shared/Navbar';
import { Footer } from '../components/shared/Footer';

interface PublicLayoutProps {
  children: React.ReactNode;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  return (
    <>
      <Navbar
        isAuthenticated={false}
        onLogout={() => {}}
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
