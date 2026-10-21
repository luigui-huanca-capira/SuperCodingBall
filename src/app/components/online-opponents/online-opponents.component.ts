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

import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {AllGames, ConnectionStatus, Opponent} from '../../models/online-models';
import {OnlineService} from '../../services/online.service';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {Subscription} from 'rxjs';
import {CodeService} from '../../services/code.service';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Router, RouterLink} from '@angular/router';
import {LocalStorageService} from '../../services/local-storage.service';
import {DancingMonstersComponent} from '../dancing-monsters/dancing-monsters.component';
import {AnonPicturePipe} from '../../services/anon-picture.pipe';
import {FormsModule} from '@angular/forms';

export enum GamePoint {
  LOST = 0,
  DRAW,
  WON
}

@Component({
  selector: 'app-online-opponents',
  imports: [FormsModule, RouterLink, TranslatePipe, DancingMonstersComponent, AnonPicturePipe],
  templateUrl: './online-opponents.component.html',
  styleUrl: './online-opponents.component.scss'
})

export class OnlineOpponentsComponent implements OnInit, OnDestroy {
  @ViewChild('replayGameContent') private replayGameContent: any;
  @ViewChild('deleteAccountContent') private deleteAccountContent: any;
  @ViewChild('connectionErrorContent') private connectionErrorContent: any;
  GamePoint = GamePoint;
  public ConnectionStatus = ConnectionStatus;
  private connectionStatusSubscription?: Subscription;
  private syncTodayGamesSubscription?: Subscription;
  opponents: Opponent[] = [];
  lastResult?: number;
  personalRanking = 0;
  loading = false;
  connectionErrorKey = 'ONLINE.CONNECTION_ERROR';
  modalParams = {
    won: '<img src="assets/icons/trophy-solid-warning.png" class="icon24"/>',
    draw: '<img src="assets/icons/trophy-solid-secondary.png" class="icon24"/>',
    lost: '<img src="assets/icons/trophy-solid-danger.png" class="icon24"/>',
  };

  private _syncLeaderBoard = false;

  get syncLeaderBoard(): boolean {
    return this._syncLeaderBoard;
  }

  set syncLeaderBoard(sync: boolean) {
    this._syncLeaderBoard = sync;
    if (sync && (this.syncTodayGamesSubscription?.closed ?? true)) {
      this.syncTodayGamesSubscription = this.onlineService.syncTodayGames()
        .subscribe(allGames => this.computeLeaderBoard(allGames))
    } else if (!sync && this.syncTodayGamesSubscription && !this.syncTodayGamesSubscription.closed) {
      this.syncTodayGamesSubscription.unsubscribe()
    }
  }

  protected searchTerm = '';

  get filteredOpponents(): Opponent[] {
    return this.opponents.filter(opp => !this.searchTerm ||
      this.normalized(opp.userDisplay?.displayName ?? '').includes(this.normalized(this.searchTerm)));
  }

  get totalScore(): number {
    return this.filteredOpponents.reduce((sum, curr) => sum + curr.points, 0);
  }

  private normalized(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  constructor(
    private router: Router,
    public modalService: NgbModal,
    public translate: TranslateService,
    private codeService: CodeService,
    public onlineService: OnlineService,
    private localStorageService: LocalStorageService
  ) {
  }

  ngOnInit(): void {
    if (this.onlineService.connectionStatus === ConnectionStatus.Connected) {
      void this.loadData();
    }
    this.connectionStatusSubscription = this.onlineService.connectionStatusChanged.subscribe(
      status => {
        this.loading = false;
        if (status === ConnectionStatus.Connected) {
          void this.loadData();
        }
      }
    );
  }

  ngOnDestroy(): void {
    this.connectionStatusSubscription?.unsubscribe();
    this.syncTodayGamesSubscription?.unsubscribe();
    this.modalService.dismissAll();
  }

  async loadData(): Promise<void> {
    this.loading = true;
    try {
      await this.onlineService.syncUser(this.codeService.loadOwnBlocksFromLocalStorage());
      await this.onlineService.setUserDisplayInDailyGames();
      const allGames = await this.onlineService.loadGamesAndRemoveOldOnes();
      this.computeLeaderBoard(allGames)
    } catch (error) {
      this.showConnectionError(error);
    } finally {
      this.loading = false;
    }
  }

  async connectAnonymously(): Promise<void> {
    await this.connect(() => this.onlineService.connectAnonymously());
  }

  async connectWithFacebook(): Promise<void> {
    await this.connect(() => this.onlineService.connectWithFacebook());
  }

  async connectWithGoogle(): Promise<void> {
    await this.connect(() => this.onlineService.connectWithGoogle());
  }

  private async connect(connectAction: () => Promise<void>): Promise<void> {
    this.loading = true;
    try {
      await connectAction();
    } catch (error) {
      this.showConnectionError(error);
    }
  }

  private showConnectionError(error: unknown): void {
    console.log('Online connection failed.', error);
    this.connectionErrorKey = this.getConnectionErrorKey(error);
    this.loading = false;
    setTimeout(() => this.modalService.open(this.connectionErrorContent, {size: 'sm'}));
  }

  private getConnectionErrorKey(error: unknown): string {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? (error as {code?: unknown}).code
      : undefined;
    if (code === 'auth/admin-restricted-operation') {
      return 'ONLINE.ANONYMOUS_AUTH_DISABLED';
    }
    if (typeof code === 'string' && code.startsWith('auth/')) {
      return 'ONLINE.AUTH_ERROR';
    }
    return 'ONLINE.DATA_ERROR';
  }

  computeLeaderBoard(allGames: AllGames) {
    this.computeOpponentsScore(allGames);
    const today = OnlineService.getUtcTimestamp(Date.now());
    // We hide opponents:
    this.opponents = this.opponents
      // without userDisplay (who have been challenged but who didn't connect in the 15 days)
      .filter(opponent => !!opponent.userDisplay)
      // with 0 points from the past days
      .filter(opponent => opponent.points || opponent.lastSeen === today);
    this.computeRankings();
    void this.onlineService.updateLeaderboard(this.opponents.find(opp => opp.userId === this.onlineService.userId));
  }

  private computeOpponentsScore(allGames: AllGames): void {
    this.opponents = [];
    const today = OnlineService.getUtcTimestamp(Date.now());
    const myGames = allGames[today.toString()]
      ?.[this.onlineService.userId]
      ?.dailyGames
      ?? {};

    for (const [dayTimestamp, games] of Object.entries(allGames)) {
      for (const userId of Object.keys(games)) {
        const userDailyRecap = games[userId];
        let searchedUser = this.opponents.find(user => user.userId === userId);
        if (!searchedUser) {
          searchedUser = new Opponent(userId, userDailyRecap.userDisplay, 0, 0, +dayTimestamp);
          this.opponents.push(searchedUser);
        } else if (+dayTimestamp > searchedUser.lastSeen) {
          searchedUser.lastSeen = +dayTimestamp;
          searchedUser.userDisplay = userDailyRecap.userDisplay;
        }
        if (!userDailyRecap.dailyGames) {
          continue;
        }
        for (const opponentId of Object.keys(userDailyRecap.dailyGames)) {
          const gameResult = userDailyRecap.dailyGames[opponentId];
          const searchedOpponent = this.opponents.find(opp => opp.userId === opponentId);
          if (!searchedOpponent) {
            this.opponents.push(new Opponent(opponentId, null, 2 - gameResult, 0, 0));
          } else {
            searchedOpponent.points += 2 - gameResult;
          }
          searchedUser.points += gameResult;
        }
      }
    }
    this.opponents = this.opponents.map(opponent => {
      opponent.lastResult = myGames[opponent.userId];
      return opponent;
    });
  }

  private computeRankings(): void {
    this.opponents.sort((a, b) => {
      if (a.points !== b.points) {
        return b.points - a.points;
      } else if (a.lastSeen !== b.lastSeen) {
        return b.lastSeen - a.lastSeen;
      } else {
        return b.userId.localeCompare(a.userId);
      }
    });

    let formerPoints = -1;
    let currentRanking = 0;
    let exAequoNumber = 1;
    for (const opponent of this.opponents) {
      if (formerPoints !== opponent.points) {
        currentRanking += exAequoNumber;
        exAequoNumber = 1;
        formerPoints = opponent.points;
      } else {
        exAequoNumber++;
      }
      opponent.ranking = currentRanking;
    }

    this.personalRanking = this.opponents.find(opp => opp.userId === this.onlineService.userId)?.ranking ?? 0;
  }

  play(opponentId: string): void {
    if (opponentId === this.onlineService.userId) {
      return;
    }
    this.lastResult = this.opponents.find(opponent => opponent.userId === opponentId)?.lastResult;
    if (this.lastResult !== undefined) {
      this.modalService.open(this.replayGameContent)
        .result.then(async (replayValidated: boolean) => {
        if (replayValidated) {
          // For some reason, adding these 500ms prevents a glitch for Blockly's vertical scrollbar
          // There should be some race condition between the disappearing Bootstrap modal and Blockly
          await new Promise(resolve => setTimeout(resolve, 500));
          this.router.navigate([`/code/online/${opponentId}`]);
        }
      }, () => { });
    } else {
      this.router.navigate([`/code/online/${opponentId}`]);
    }
  }

  async updateUserDisplayName(nickname: string): Promise<void> {
    await this.onlineService.updateUserDisplayName(nickname)
    this.onlineService.resetUser();
    await this.loadData();
  }

  async downloadBlocks(): Promise<void> {
    const blocks = await this.codeService.loadOwnBlocksFromServer();
    this.localStorageService.saveBlocks(blocks);
    this.modalService.dismissAll();
  }

  removeAccount(): void {
    this.modalService.open(this.deleteAccountContent, {size: 'sm'})
      .result.then(async (deleteValidated: boolean) => {
        if (deleteValidated) {
          this.loading = true;
          try {
            await this.onlineService.removeAccount();
          } finally {
            this.loading = false;
          }
        }
      }, () => { });
  }
}
