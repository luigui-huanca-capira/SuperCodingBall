import {describe, expect, it} from 'vitest';
import {
  CHARACTER_POSITIONS,
  DEFAULT_CHARACTER_ID,
  DEFAULT_CHARACTER_POSITION,
  getCharacterPosition,
  getPlayableCharacter,
  PLAYABLE_CHARACTERS
} from './playable-character';

describe('playable characters', () => {
  it('registers the classic character, Nova and Leo with unique identifiers', () => {
    expect(PLAYABLE_CHARACTERS.map(character => character.id)).toEqual(['girl1', 'nova', 'leo']);
    expect(new Set(PLAYABLE_CHARACTERS.map(character => character.id)).size).toBe(3);
  });

  it('returns Nova and Leo with their corresponding visual assets', () => {
    expect(getPlayableCharacter('nova')).toMatchObject({name: 'Nova', spriteAsset: 'nova-v6'});
    expect(getPlayableCharacter('leo')).toMatchObject({name: 'Leo', spriteAsset: 'leo'});
  });

  it('falls back to the classic character for an unknown identifier', () => {
    expect(getPlayableCharacter('unknown').id).toBe(DEFAULT_CHARACTER_ID);
  });

  it('defines the four field positions and a safe default', () => {
    expect(CHARACTER_POSITIONS).toHaveLength(4);
    expect(getCharacterPosition('unknown').id).toBe(DEFAULT_CHARACTER_POSITION);
    expect(getCharacterPosition('defender-left').playerIndex).toBe(3);
  });
});
