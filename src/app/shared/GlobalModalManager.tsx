'use client';

import React from 'react';
import { useModal } from './ModalContext';
import PlayerModal from './PlayerModal';
import ClubModal from './ClubModal';
import { Club, Player } from '@/types';

interface GlobalModalManagerProps {
  clubs: Club[];
  players: Player[];
  onSavePlayer: (player: Partial<Player>) => Promise<void>;
  onSaveClub: (club: Partial<Club>) => Promise<void>;
}

export default function GlobalModalManager({ 
  clubs, 
  players,
  onSavePlayer, 
  onSaveClub 
}: GlobalModalManagerProps) {
  const { isOpen, modalType, data, closeModal } = useModal();

  return (
    <>
      {modalType === 'player' && (
        <PlayerModal
          isOpen={isOpen}
          onClose={closeModal}
          onSave={onSavePlayer}
          player={data}
          clubs={clubs}
        />
      )}
      
      {modalType === 'club' && (
        <ClubModal
          isOpen={isOpen}
          onClose={closeModal}
          onSave={onSaveClub}
          club={data}
          players={players}
        />
      )}
    </>
  );
}
