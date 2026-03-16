'use client';

import { useState, useEffect } from 'react';

const PARTICIPANT_ID_KEY = 'zaseki_participant_id';
const DISPLAY_NAME_KEY = 'zaseki_display_name';

export function useParticipantSession() {
  const [participantId, setParticipantId] = useState('');
  const [displayName, setDisplayNameState] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let id = localStorage.getItem(PARTICIPANT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(PARTICIPANT_ID_KEY, id);
    }
    setParticipantId(id);

    const name = localStorage.getItem(DISPLAY_NAME_KEY) || '';
    setDisplayNameState(name);
    setIsReady(true);
  }, []);

  const setDisplayName = (name: string) => {
    localStorage.setItem(DISPLAY_NAME_KEY, name);
    setDisplayNameState(name);
  };

  return { participantId, displayName, setDisplayName, isReady };
}
