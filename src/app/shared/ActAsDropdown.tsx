'use client';

import { useState, useRef, useEffect } from 'react';
import { useActAs } from './ActAsContext';

type UserOption = {
  id: string;
  name: string;
  role: 'app-admin' | 'tournament-admin' | 'event-manager' | 'captain' | 'player';
  email?: string;
};

type ActAsDropdownProps = {
  currentUser: {
    id: string;
    name: string;
    role: 'app-admin' | 'tournament-admin' | 'event-manager' | 'captain' | 'player';
  };
  availableUsers?: UserOption[];
};

export function ActAsDropdown({ currentUser, availableUsers = [] }: ActAsDropdownProps) {
  const { actingAs, setActingAs, isActingAs } = useActAs();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredUsers = availableUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectUser = (user: UserOption) => {
    setActingAs({
      id: user.id,
      name: user.name,
      role: user.role,
    });
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleStopActing = () => {
    setActingAs(null);
    setIsOpen(false);
  };

  const displayUser = actingAs || currentUser;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-surface-2 hover:bg-surface-3 rounded-md border border-subtle transition-colors"
      >
        <span className="text-muted">Act As:</span>
        <span className="font-medium text-primary">
          {displayUser.name}
          {displayUser.role && (
            <span className="text-muted ml-1">
              , {displayUser.role.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          )}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-surface-1 border border-subtle rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-subtle">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-2 border border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            {/* Current user option */}
            <button
              onClick={() => handleSelectUser(currentUser)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-surface-2 flex items-center justify-between ${
                !isActingAs ? 'bg-primary/10 text-primary' : ''
              }`}
            >
              <div>
                <div className="font-medium">
                  {currentUser.name}
                  <span className="text-muted ml-1">
                    , {currentUser.role.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
                <div className="text-xs text-muted">You</div>
              </div>
              {!isActingAs && <span className="text-xs text-primary">✓</span>}
            </button>

            {/* Available users */}
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-surface-2 flex items-center justify-between ${
                  actingAs?.id === user.id ? 'bg-primary/10 text-primary' : ''
                }`}
              >
                <div>
                  <div className="font-medium">
                    {user.name}
                    <span className="text-muted ml-1">
                      , {user.role.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                </div>
                {actingAs?.id === user.id && <span className="text-xs text-primary">✓</span>}
              </button>
            ))}

            {filteredUsers.length === 0 && searchTerm && (
              <div className="px-3 py-2 text-sm text-muted text-center">
                No users found
              </div>
            )}
          </div>

          {isActingAs && (
            <div className="p-3 border-t border-subtle">
              <button
                onClick={handleStopActing}
                className="w-full px-3 py-2 text-sm bg-warning/20 text-warning hover:bg-warning/30 rounded-md transition-colors"
              >
                Stop Acting As
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

