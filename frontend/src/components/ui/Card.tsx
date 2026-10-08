import React from 'react';

interface CardProps {
  title?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  hover?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  headerRight,
  children,
  footer,
  hover = false,
  className = ''
}) => {
  return (
    <div className={`card ${hover ? 'card-hover' : ''} ${className}`}>
      {title && (
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
          {headerRight}
        </div>
      )}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
};
