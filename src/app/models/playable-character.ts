export interface PlayableCharacter {
  id: string;
  name: string;
  spriteAsset: string;
  portraitAsset: string;
  aiGenerated: boolean;
}

export type CharacterPosition = 'attacker-left' | 'attacker-right' | 'defender-left' | 'defender-right';

export interface CharacterPositionOption {
  id: CharacterPosition;
  name: string;
  playerIndex: number;
}

export const DEFAULT_CHARACTER_ID = 'girl1';
export const DEFAULT_CHARACTER_POSITION: CharacterPosition = 'attacker-right';

export const CHARACTER_POSITIONS: readonly CharacterPositionOption[] = [
  {id: 'attacker-left', name: 'Delantero izquierdo', playerIndex: 1},
  {id: 'attacker-right', name: 'Delantero derecho', playerIndex: 0},
  {id: 'defender-left', name: 'Defensa izquierdo', playerIndex: 3},
  {id: 'defender-right', name: 'Defensa derecho', playerIndex: 2}
];

export const PLAYABLE_CHARACTERS: readonly PlayableCharacter[] = [
  {
    id: DEFAULT_CHARACTER_ID,
    name: 'Clásica',
    spriteAsset: 'girl1',
    portraitAsset: 'assets/icons/user-solid.png',
    aiGenerated: false
  },
  {
    id: 'nova',
    name: 'Nova',
    spriteAsset: 'nova-v6',
    portraitAsset: 'assets/characters/nova-portrait.png',
    aiGenerated: true
  },
  {
    id: 'leo',
    name: 'Leo',
    spriteAsset: 'leo',
    portraitAsset: 'assets/characters/leo-portrait.png',
    aiGenerated: true
  }
];

export function getPlayableCharacter(id: string): PlayableCharacter {
  return PLAYABLE_CHARACTERS.find(character => character.id === id) ?? PLAYABLE_CHARACTERS[0];
}

export function getCharacterPosition(id: string): CharacterPositionOption {
  return CHARACTER_POSITIONS.find(position => position.id === id) ?? CHARACTER_POSITIONS[1];
}
