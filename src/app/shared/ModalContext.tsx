'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type ModalType = 'player' | 'club' | null;

interface ModalContextType {
  isOpen: boolean;
  modalType: ModalType;
  data: any;
  openModal: (type: ModalType, data?: any) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [data, setData] = useState<any>(null);

  const openModal = (type: ModalType, data?: any) => {
    setModalType(type);
    setData(data);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setModalType(null);
    setData(null);
  };

  return (
    <ModalContext.Provider value={{ isOpen, modalType, data, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}



