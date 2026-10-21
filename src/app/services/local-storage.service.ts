/*
 * Software Name : SuperCodingBall
 * Version: 1.0.0
 * SPDX-FileCopyrightText: Copyright (c) 2021 Orange
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * This software is distributed under the BSD 3-Clause "New" or "Revised" License,
 * the text of which is available at https://spdx.org/licenses/BSD-3-Clause.html
 * or see the "LICENSE.txt" file for more details.
 */

import {Injectable, isDevMode} from '@angular/core';
import {
  CharacterPosition,
  DEFAULT_CHARACTER_ID,
  DEFAULT_CHARACTER_POSITION
} from '../models/playable-character';

type CharacterAssignments = Partial<Record<CharacterPosition, string>>;
const characterPositions: CharacterPosition[] = [
  'attacker-left',
  'attacker-right',
  'defender-left',
  'defender-right'
];

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {
  getTrackingDisabledStatus(): boolean {
    return localStorage.getItem('tracking-disabled') === 'true';
  }

  setTrackingDisabledStatus(disabled: boolean): void {
    localStorage.setItem('tracking-disabled', String(disabled));
  }

  getLocalStrategies(): {id: string, won: boolean}[] {
    return [
      'do-nothing',
      '1player-only',
      'all-defenders',
      'defenders-pass-to-attackers',
      'only-passes',
      '3attackers',
      'column',
      'sprinters'
    ].map(opponentId => ({
      id: opponentId,
      won: this.getOfflineWonStatus(opponentId)
    }));
  }

  isStrongEnough(): boolean {
    return this.getLocalStrategies().filter(it => it.won).length >= 3;
  }

  loadBlocks(): string {
    return localStorage.getItem('savedBlocks') || '{}';
  }

  saveBlocks(savedBlocks: string): void {
    if (isDevMode()) {
      console.log(JSON.stringify(JSON.parse(savedBlocks), null, " "));
    }
    localStorage.setItem('savedBlocks', savedBlocks);
  }

  getOfflineWonStatus(opponentId: string): boolean {
    return !!localStorage.getItem(opponentId);
  }

  setOfflineWonStatus(opponentId: string): void {
    localStorage.setItem(opponentId, 'won');
  }

  clearLocalStorage(): void {
    localStorage.clear();
  }

  getAcceleratedGameStatus(): boolean {
    return localStorage.getItem('accelerated') !== 'false';
  }

  setAcceleratedGameStatus(accelerated: boolean): void {
    localStorage.setItem('accelerated', String(accelerated));
  }

  getGameSoundEnabledStatus(): boolean {
    return localStorage.getItem('game-sound-enabled') !== 'false';
  }

  setGameSoundEnabledStatus(enabled: boolean): void {
    localStorage.setItem('game-sound-enabled', String(enabled));
  }

  getSelectedCharacterId(): string {
    return localStorage.getItem('selected-character') ?? DEFAULT_CHARACTER_ID;
  }

  setSelectedCharacterId(characterId: string): void {
    localStorage.setItem('selected-character', characterId);
  }

  getSelectedCharacterPosition(): CharacterPosition {
    return (localStorage.getItem('selected-character-position') as CharacterPosition) ?? DEFAULT_CHARACTER_POSITION;
  }

  setSelectedCharacterPosition(position: CharacterPosition): void {
    localStorage.setItem('selected-character-position', position);
  }

  getCharacterAssignments(): CharacterAssignments {
    const savedAssignments = localStorage.getItem('character-assignments');
    if (savedAssignments) {
      try {
        const assignments = JSON.parse(savedAssignments) as CharacterAssignments;
        const assignedCharacters = new Set<string>();
        let duplicatesRemoved = false;
        for (const position of characterPositions) {
          const characterId = assignments[position];
          if (!characterId) {
            continue;
          }
          if (assignedCharacters.has(characterId)) {
            delete assignments[position];
            duplicatesRemoved = true;
          } else {
            assignedCharacters.add(characterId);
          }
        }
        if (duplicatesRemoved) {
          localStorage.setItem('character-assignments', JSON.stringify(assignments));
        }
        return assignments;
      } catch {
        localStorage.removeItem('character-assignments');
      }
    }

    const legacyCharacter = localStorage.getItem('selected-character');
    if (legacyCharacter && legacyCharacter !== DEFAULT_CHARACTER_ID) {
      return {[this.getSelectedCharacterPosition()]: legacyCharacter};
    }
    return {};
  }

  setCharacterAtPosition(position: CharacterPosition, characterId: string): void {
    const assignments = this.getCharacterAssignments();
    if (characterId === DEFAULT_CHARACTER_ID) {
      delete assignments[position];
    } else {
      for (const assignedPosition of characterPositions) {
        if (assignments[assignedPosition] === characterId) {
          delete assignments[assignedPosition];
        }
      }
      assignments[position] = characterId;
    }
    localStorage.setItem('character-assignments', JSON.stringify(assignments));
  }

  getCharacterAtPosition(position: CharacterPosition): string | undefined {
    return this.getCharacterAssignments()[position];
  }
}
