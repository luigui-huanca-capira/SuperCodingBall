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

import {Injectable, OnDestroy, EventEmitter} from '@angular/core';
import {
  Auth,
  FacebookAuthProvider,
  GoogleAuthProvider,
  User as FirebaseUser,
  Unsubscribe,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithRedirect,
  signOut,
  updateProfile
} from 'firebase/auth';
import {DataSnapshot, Database, get, getDatabase, onValue, ref, remove, set, update} from 'firebase/database';
import {Observable} from 'rxjs';
import {
  AllGames,
  ConnectionStatus,
  LeaderboardEntry,
  OneDayGames,
  Opponent,
  User,
  UserDisplay,
  UserStrategy
} from '../models/online-models';
import {FirebaseAppService} from './firebase-app.service';

@Injectable({
  providedIn: 'root'
})
export class OnlineService implements OnDestroy {
  private auth: Auth;
  private database: Database;
  private unsubscribeAuth?: Unsubscribe;
  connectionStatusChanged = new EventEmitter<ConnectionStatus>();
  private _connectionStatus = ConnectionStatus.Unknown;

  get connectionStatus(): ConnectionStatus {
    return this._connectionStatus;
  }

  set connectionStatus(status: ConnectionStatus) {
    if (this._connectionStatus !== status) {
      this.connectionStatusChanged.emit(status);
    }
    this._connectionStatus = status;
  }

  userId = '';
  firebaseDisplayName = '';
  userDisplay = new UserDisplay();
  userSynced = false;
  userDisplaySetInDailyGames: {[dayTimestamp: string]: boolean} = {};
  allGames?: AllGames = undefined

  constructor(firebaseAppService: FirebaseAppService) {
    this.auth = getAuth(firebaseAppService.app);
    this.database = getDatabase(firebaseAppService.app);
    this.unsubscribeAuth = onAuthStateChanged(
      this.auth,
      (user: FirebaseUser | null) => {
        if (user) {
          this.parseAuthInfo(user);
        } else {
          this.deleteCredentials();
          this.connectionStatus = ConnectionStatus.Disconnected;
        }
      },
      (error) => {
        console.log('Firebase authentication failed.', error);
        this.deleteCredentials();
        this.connectionStatus = ConnectionStatus.Disconnected;
      }
    );
  }

  static getUtcTimestamp(timestamp: number): number {
    const localDateLocalMidnight = new Date(timestamp);
    localDateLocalMidnight.setHours(0, 0, 0, 0);
    const localDateUtcMidnight = new Date();
    localDateUtcMidnight.setUTCFullYear(localDateLocalMidnight.getFullYear());
    localDateUtcMidnight.setUTCMonth(localDateLocalMidnight.getMonth());
    localDateUtcMidnight.setUTCDate(localDateLocalMidnight.getDate());
    localDateUtcMidnight.setUTCHours(0, 0, 0, 0);
    return localDateUtcMidnight.getTime();
  }

  private deleteCredentials(): void {
    this.userDisplay = new UserDisplay();
    this.userId = '';
    this.firebaseDisplayName = '';
  }

  private parseAuthInfo(user: FirebaseUser): void {
    this.firebaseDisplayName = user.displayName || 'Team-' + user.uid.substring(0, 4);
    this.userDisplay.fullDisplayName = this.firebaseDisplayName;
    this.userDisplay.pictureUrl = user.photoURL;
    this.userId = user.uid;
    this.connectionStatus = ConnectionStatus.Connected;
  }

  private snapshotToValue<T>(snapshot: DataSnapshot, defaultValue: T): T {
    const value = snapshot.val();
    return value === null ? defaultValue : value as T;
  }

  ngOnDestroy(): void {
    this.unsubscribeAuth?.();
  }

  public connectAnonymously(): Promise<void> {
    return signInAnonymously(this.auth).then(() => undefined);
  }

  public connectWithFacebook(): Promise<void> {
    const provider = new FacebookAuthProvider();
    provider.addScope('public_profile');
    return signInWithRedirect(this.auth, provider);
  }

  public connectWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    return signInWithRedirect(this.auth, provider);
  }

  public async disconnect(): Promise<void> {
    this.resetUser();
    await signOut(this.auth);
  }

  public resetUser(): void {
    this.userSynced = false;
    this.userDisplaySetInDailyGames = {};
  }

  public async removeAccount(): Promise<void> {
    const currentUser = this.auth.currentUser;
    const userId = this.userId;
    if (!currentUser || !userId) {
      return;
    }

    await Promise.all([
      remove(ref(this.database, `users/${userId}`)),
      remove(ref(this.database, `strategies/${userId}`)),
      remove(ref(this.database, `leaderboard/${userId}`)),
      this.removeUserGames(userId)
    ]);
    await deleteUser(currentUser);
    this.resetUser();
    this.deleteCredentials();
    this.connectionStatus = ConnectionStatus.Disconnected;
  }

  private async removeUserGames(userId: string): Promise<void> {
    const gamesSnapshot = await get(ref(this.database, 'games'));
    if (!gamesSnapshot.exists()) {
      return;
    }

    const updates: {[path: string]: null} = {};
    gamesSnapshot.forEach(daySnapshot => {
      const dayTimestamp = daySnapshot.key;
      if (dayTimestamp && daySnapshot.child(userId).exists()) {
        updates[`games/${dayTimestamp}/${userId}`] = null;
      }
    });

    if (Object.keys(updates).length) {
      await update(ref(this.database), updates);
    }
  }

  async syncUser(blocks: string): Promise<void> {
    if (!this.userSynced && this.userId) {
      const userSnapshot = await get(ref(this.database, `users/${this.userId}`));
      const currentUser = this.snapshotToValue<User | null>(userSnapshot, null);
      if (!!currentUser?.displayName) {
        this.userDisplay.fullDisplayName = currentUser.displayName;
      } else {
        this.userDisplay.fullDisplayName = this.firebaseDisplayName;
      }
      if (currentUser?.pictureUrl !== undefined) {
        this.userDisplay.pictureUrl = currentUser.pictureUrl;
      }

      await this.updateUserRecord();

      const strategySnapshot = await get(ref(this.database, `strategies/${this.userId}`));
      const currentStrategy = this.snapshotToValue<UserStrategy | null>(strategySnapshot, null);
      if (!currentStrategy?.blocks) {
        await this.updateUserBlocks(blocks);
      }

      this.userSynced = true;
    }
  }

  private async updateUserRecord(): Promise<void> {
    if (!this.userId) {
      return;
    }

    const user: User = {
      displayName: this.userDisplay.displayName,
      pictureUrl: this.userDisplay.pictureUrl,
      updatedAt: Date.now()
    };
    await update(ref(this.database, `users/${this.userId}`), user);
  }

  async updateUserDisplayName(displayName: string): Promise<void> {
    this.userDisplay.fullDisplayName = displayName;
    if (this.auth.currentUser) {
      await updateProfile(this.auth.currentUser, {displayName: this.userDisplay.displayName});
    }
    await this.updateUserRecord();
  }

  async updateUserBlocks(blocks: string): Promise<void> {
    if (!this.userId) {
      return;
    }

    await update(ref(this.database, `strategies/${this.userId}`), {
      blocks,
      updatedAt: Date.now()
    });
  }

  async setUserDisplayInDailyGames(): Promise<void> {
    if (!this.userId) {
      return;
    }

    const today = OnlineService.getUtcTimestamp(Date.now());
    if (!this.userDisplaySetInDailyGames[today]) {
      await set(ref(this.database, `games/${today}/${this.userId}/userDisplay`), this.userDisplay);
      this.userDisplaySetInDailyGames[today] = true
    }
  }

  async loadGamesAndRemoveOldOnes(): Promise<AllGames> {
    const allGames = await this.loadAllGamesOrRefreshTodayGames();
    const allTimeStamps = Object.keys(allGames);
    for (const timestamp of allTimeStamps) {
      if (+timestamp < Date.now() - 15 * 1000 * 60 * 60 * 24) {
        delete allGames[timestamp];
      }
    }
    this.allGames = allGames;
    return allGames;
  }

  // Only refresh games from the current date, which depends on the timezone of the player
  // Thus, games being played by players whose date is yesterday or tomorrow will not be updated
  // but it is an acceptable drawback compared to the network traffic improvement
  private async loadAllGamesOrRefreshTodayGames(): Promise<AllGames> {
    const allGames = this.allGames;
    if (!allGames) {
      const gamesSnapshot = await get(ref(this.database, 'games'));
      return this.snapshotToValue<AllGames>(gamesSnapshot, {});
    } else {
      const today = OnlineService.getUtcTimestamp(Date.now());
      const todayGamesSnapshot = await get(ref(this.database, `games/${today}`));
      allGames[today] = this.snapshotToValue<OneDayGames>(todayGamesSnapshot, {});
      return allGames
    }
  }

  syncTodayGames(): Observable<AllGames> {
    const today = OnlineService.getUtcTimestamp(Date.now());
    const todayGamesRef = ref(this.database, `games/${today}`);
    return new Observable<AllGames>((subscriber) => {
      const unsubscribe = onValue(
        todayGamesRef,
        (snapshot) => {
          const allGames = this.allGames ?? {};
          allGames[today] = this.snapshotToValue<OneDayGames>(snapshot, {});
          this.allGames = allGames;
          subscriber.next(allGames);
        },
        (error) => subscriber.error(error)
      );

      return () => unsubscribe();
    })
  }

  async loadUserBlocks(userId: string): Promise<string> {
    const strategySnapshot = await get(ref(this.database, `strategies/${userId}/blocks`));
    return this.snapshotToValue<string>(strategySnapshot, '{}');
  }

  async setGameResult(opponentId: string, points: number): Promise<void> {
    if (!this.userId) {
      return;
    }

    const today = OnlineService.getUtcTimestamp(Date.now());
    await set(ref(this.database, `games/${today}/${this.userId}/dailyGames/${opponentId}`), points);
  }

  async updateLeaderboard(opponent: Opponent | undefined): Promise<void> {
    if (!this.userId || !opponent) {
      return;
    }

    const leaderboardEntry: LeaderboardEntry = {
      displayName: this.userDisplay.displayName,
      points: opponent.points,
      ranking: opponent.ranking,
      lastSeen: opponent.lastSeen,
      updatedAt: Date.now()
    };
    await set(ref(this.database, `leaderboard/${this.userId}`), leaderboardEntry);
  }
}
