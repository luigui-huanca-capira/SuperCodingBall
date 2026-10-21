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
import {FirebaseApp, getApp, getApps, initializeApp} from 'firebase/app';
import {getAnalytics} from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyBJYl1nuRbzgwjewoCaqYPc_5Sr17ussoc',
  authDomain: 'supercodingball.firebaseapp.com',
  databaseURL: 'https://supercodingball-default-rtdb.firebaseio.com',
  projectId: 'supercodingball',
  storageBucket: 'supercodingball.appspot.com',
  messagingSenderId: '488172291868',
  appId: '1:488172291868:web:48fcb92d01c23ef3695cd9',
  measurementId: 'G-N0RFS9M9XJ'
};

@Injectable({
  providedIn: 'root'
})
export class FirebaseAppService {
  readonly app: FirebaseApp;

  constructor() {
    this.app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }

  enableAnalytics(trackingDisabled: boolean): void {
    if (!isDevMode() && !trackingDisabled) {
      getAnalytics(this.app);
    }
  }
}
