import {beforeEach, describe, expect, it} from 'vitest';
import {DEFAULT_CHARACTER_ID, DEFAULT_CHARACTER_POSITION} from '../models/playable-character';
import {LocalStorageService} from './local-storage.service';

describe('LocalStorageService maintenance settings', () => {
  let service: LocalStorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new LocalStorageService();
  });

  it('enables sound by default and persists the mute preference', () => {
    expect(service.getGameSoundEnabledStatus()).toBe(true);
    service.setGameSoundEnabledStatus(false);
    expect(service.getGameSoundEnabledStatus()).toBe(false);
  });

  it('uses the classic character and default position when no selection exists', () => {
    expect(service.getSelectedCharacterId()).toBe(DEFAULT_CHARACTER_ID);
    expect(service.getSelectedCharacterPosition()).toBe(DEFAULT_CHARACTER_POSITION);
  });

  it('persists the selected character and position', () => {
    service.setSelectedCharacterId('nova');
    service.setSelectedCharacterPosition('defender-left');
    expect(service.getSelectedCharacterId()).toBe('nova');
    expect(service.getSelectedCharacterPosition()).toBe('defender-left');
  });

  it('moves a special character instead of duplicating it', () => {
    service.setCharacterAtPosition('attacker-left', 'nova');
    service.setCharacterAtPosition('defender-right', 'nova');
    expect(service.getCharacterAtPosition('attacker-left')).toBeUndefined();
    expect(service.getCharacterAtPosition('defender-right')).toBe('nova');
  });

  it('removes a custom assignment when the classic character is selected', () => {
    service.setCharacterAtPosition('attacker-right', 'leo');
    service.setCharacterAtPosition('attacker-right', DEFAULT_CHARACTER_ID);
    expect(service.getCharacterAtPosition('attacker-right')).toBeUndefined();
  });

  it('cleans duplicate assignments loaded from previous versions', () => {
    localStorage.setItem('character-assignments', JSON.stringify({
      'attacker-left': 'nova',
      'defender-left': 'nova'
    }));
    expect(service.getCharacterAssignments()).toEqual({'attacker-left': 'nova'});
  });

  it('recovers from invalid assignment data', () => {
    localStorage.setItem('character-assignments', '{invalid');
    expect(service.getCharacterAssignments()).toEqual({});
    expect(localStorage.getItem('character-assignments')).toBeNull();
  });
});
