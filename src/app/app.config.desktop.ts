/*
 * Software Name : SuperCodingBall
 * Version: 1.0.0
 * SPDX-FileCopyrightText: Copyright (c) 2025 Orange
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * This software is distributed under the BSD 3-Clause "New" or "Revised" License,
 * the text of which is available at https://spdx.org/licenses/BSD-3-Clause.html
 * or see the "LICENSE.txt" file for more details.
 */

import {
  ApplicationConfig,
  provideZoneChangeDetection,
  provideAppInitializer,
  inject
} from '@angular/core';
import {provideRouter, withHashLocation} from '@angular/router';

import {routes} from './app.routes';
import {provideServiceWorker} from '@angular/service-worker';
import {provideTranslateService, provideTranslateLoader} from '@ngx-translate/core';
import {provideHttpClient} from '@angular/common/http';
import {CustomTranslateLoader} from './services/custom-translate-loader';
import {CodeService} from './services/code.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({eventCoalescing: true}),
    provideRouter(routes, withHashLocation()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: false
    }),
    provideHttpClient(),
    provideAppInitializer(() => inject(CodeService).init()),
    provideTranslateService({
      fallbackLang: 'en',
      loader: provideTranslateLoader(CustomTranslateLoader),
    })
  ]
};
