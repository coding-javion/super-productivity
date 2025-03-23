import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { GlobalConfigService } from '../../features/config/global-config.service';
import {
  GLOBAL_CONFIG_FORM_CONFIG,
  GLOBAL_IMEX_FORM_CONFIG,
  GLOBAL_PRODUCTIVITY_FORM_CONFIG,
} from '../../features/config/global-config-form-config.const';
import {
  ConfigFormConfig,
  ConfigFormSection,
  GlobalConfigSectionKey,
  GlobalConfigState,
  GlobalSectionConfig,
} from '../../features/config/global-config.model';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { ProjectCfgFormKey } from '../../features/project/project.model';
import { T } from '../../t.const';
import { versions } from '../../../environments/versions';
import { IS_ELECTRON } from '../../app.constants';
import { IS_ANDROID_WEB_VIEW } from '../../util/is-android-web-view';
import { getAutomaticBackUpFormCfg } from '../../features/config/form-cfgs/automatic-backups-form.const';
import {
  MatButtonToggle,
  MatButtonToggleChange,
  MatButtonToggleGroup,
} from '@angular/material/button-toggle';
import { getAppVersionStr } from '../../util/get-app-version-str';
import { MatIcon } from '@angular/material/icon';
import { ConfigSectionComponent } from '../../features/config/config-section/config-section.component';
import { ConfigSoundFormComponent } from '../../features/config/config-sound-form/config-sound-form.component';
import { TranslatePipe } from '@ngx-translate/core';
import { AsyncPipe } from '@angular/common';
import { SYNC_FORM } from '../../features/config/form-cfgs/sync-form.const';
import { PfapiService } from '../../pfapi/pfapi.service';
import { map, tap } from 'rxjs/operators';

@Component({
  selector: 'config-page',
  templateUrl: './config-page.component.html',
  styleUrls: ['./config-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonToggleGroup,
    MatButtonToggle,
    MatIcon,
    ConfigSectionComponent,
    ConfigSoundFormComponent,
    TranslatePipe,
    AsyncPipe,
  ],
})
export class ConfigPageComponent implements OnInit, OnDestroy {
  private readonly _cd = inject(ChangeDetectorRef);
  private readonly _pfapiService = inject(PfapiService);
  readonly configService = inject(GlobalConfigService);

  T: typeof T = T;
  globalConfigFormCfg: ConfigFormConfig;
  globalImexFormCfg: ConfigFormConfig;
  globalProductivityConfigFormCfg: ConfigFormConfig;
  globalSyncConfigFormCfg = SYNC_FORM;

  globalCfg?: GlobalConfigState;

  appVersion: string = getAppVersionStr();
  versions?: any = versions;

  // TODO needs to contain all sync providers....
  // TODO maybe handling this in an effect would be better????
  syncFormCfg$: Observable<any> = combineLatest([
    this._pfapiService.currentProviderCfg$,
    this.configService.sync$,
  ])
    .pipe(
      map(([currentProviderCfg, syncCfg]) => {
        if (!currentProviderCfg) {
          return syncCfg;
        }
        return {
          ...syncCfg,
          [currentProviderCfg.providerId]: currentProviderCfg.credentials,
        };
      }),
    )
    .pipe(tap((v) => console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXA', v)));

  private _subs: Subscription = new Subscription();

  constructor() {
    // somehow they are only unproblematic if assigned here
    this.globalConfigFormCfg = GLOBAL_CONFIG_FORM_CONFIG.slice();
    this.globalImexFormCfg = GLOBAL_IMEX_FORM_CONFIG.slice();
    this.globalProductivityConfigFormCfg = GLOBAL_PRODUCTIVITY_FORM_CONFIG.slice();

    // NOTE: needs special handling cause of the async stuff
    if (IS_ANDROID_WEB_VIEW) {
      this.globalImexFormCfg = [...this.globalImexFormCfg, getAutomaticBackUpFormCfg()];
    } else if (IS_ELECTRON) {
      window.ea.getBackupPath().then((backupPath) => {
        this.globalImexFormCfg = [
          ...this.globalImexFormCfg,
          getAutomaticBackUpFormCfg(backupPath),
        ];
        this._cd.detectChanges();
      });
    }
  }

  ngOnInit(): void {
    this._subs.add(
      this.configService.cfg$.subscribe((cfg) => {
        this.globalCfg = cfg;
        this._cd.detectChanges();
      }),
    );
  }

  ngOnDestroy(): void {
    this._subs.unsubscribe();
  }

  trackBySectionKey(
    i: number,
    section: ConfigFormSection<{ [key: string]: any }>,
  ): string {
    return section.key;
  }

  saveGlobalCfg($event: {
    sectionKey: GlobalConfigSectionKey | ProjectCfgFormKey;
    config: any;
  }): void {
    const config = $event.config;
    const sectionKey = $event.sectionKey as GlobalConfigSectionKey;

    if (!sectionKey || !config) {
      throw new Error('Not enough data');
    } else {
      this.configService.updateSection(sectionKey, config);
    }
  }

  // TODO
  saveSyncFormCfg($event: { config: any }): void {}

  updateDarkMode(ev: MatButtonToggleChange): void {
    console.log(ev.value);
    if (ev.value) {
      this.configService.updateSection('misc', { darkMode: ev.value });
    }
  }

  getGlobalCfgSection(
    sectionKey: GlobalConfigSectionKey | ProjectCfgFormKey,
  ): GlobalSectionConfig {
    return (this.globalCfg as any)[sectionKey];
  }
}
