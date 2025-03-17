import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';
import { SyncProvider } from './sync-provider.model';
import { GlobalConfigService } from '../../features/config/global-config.service';
import { filter, map, shareReplay, switchMap, take, tap } from 'rxjs/operators';
import { SyncConfig } from '../../features/config/global-config.model';
import { SyncResult } from './sync.model';
import { TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { DataImportService } from './data-import.service';
import { SnackService } from '../../core/snack/snack.service';
import { GlobalProgressBarService } from '../../core-ui/global-progress-bar/global-progress-bar.service';
import { PFDropbox } from '../../pfapi/sync-provider-services/pf-dropbox';
import { DROPBOX_APP_KEY } from './dropbox/dropbox.const';
import { PF } from '../../pfapi/pf';
import { PFModelCfg } from '../../pfapi/pf.model';
import { TaskState } from '../../features/tasks/task.model';
import { ProjectState } from '../../features/project/project.model';
import { PersistenceLocalService } from '../../core/persistence/persistence-local.service';
import {
  PFNoRemoteDataError,
  PFNoRemoteMetaFile,
  PFNoRevError,
} from 'src/app/pfapi/errors/pf-errors';
import { initialTaskState } from '../../features/tasks/store/task.reducer';
import { initialProjectState } from '../../features/project/store/project.reducer';

type ModelCfgs = {
  task: PFModelCfg<TaskState>;
  project: PFModelCfg<ProjectState>;
};
const MODEL_CFGS: ModelCfgs = {
  task: {
    modelVersion: 1,
  },
  project: {
    modelVersion: 1,
  },
} as const;

@Injectable({
  providedIn: 'root',
})
export class SyncProviderService {
  private _globalConfigService = inject(GlobalConfigService);
  private _dataImportService = inject(DataImportService);
  private _translateService = inject(TranslateService);
  private _snackService = inject(SnackService);
  private _matDialog = inject(MatDialog);
  private _persistenceLocalService = inject(PersistenceLocalService);
  private _globalProgressBarService = inject(GlobalProgressBarService);

  // TODO
  pf = new PF(MODEL_CFGS, {});

  // TODO
  isCurrentProviderInSync$ = of(false);

  syncCfg$: Observable<SyncConfig> = this._globalConfigService.cfg$.pipe(
    map((cfg) => cfg?.sync),
  );

  currentProvider$ = this.syncCfg$.pipe(
    map((cfg) => {
      // console.log('Activated SyncProvider:', syncProvider);
      switch (cfg.syncProvider) {
        case SyncProvider.Dropbox:
          return new PFDropbox({
            appKey: DROPBOX_APP_KEY,
            // basePath: `/${DROPBOX_APP_FOLDER}`,
            basePath: `/`,
          });
        // case SyncProvider.WebDAV:
        //   return this._webDavSyncService;
        // case SyncProvider.LocalFile:
        //   if (IS_ANDROID_WEB_VIEW) {
        //     return this._localFileSyncAndroidService;
        //   } else {
        //     return this._localFileSyncElectronService;
        //   }
        default:
          return null;
      }
    }),
    filter((p) => !!p),
    shareReplay(1),
  );
  syncInterval$: Observable<number> = this.syncCfg$.pipe(map((cfg) => cfg.syncInterval));
  isEnabled$: Observable<boolean> = this.syncCfg$.pipe(map((cfg) => cfg.isEnabled));
  isEnabledAndReady$: Observable<boolean> = combineLatest([
    this.currentProvider$.pipe(
      switchMap((currentProvider) =>
        currentProvider ? currentProvider.isReady() : of(false),
      ),
    ),
    this.isEnabled$,
  ]).pipe(
    tap((v) => console.log('a', v)),
    map(([isReady, isEnabled]) => isReady && isEnabled),
  );

  isSyncing$ = new BehaviorSubject<boolean>(false);

  _afterCurrentSyncDoneIfAny$: Observable<unknown> = this.isSyncing$.pipe(
    filter((isSyncing) => !isSyncing),
  );

  afterCurrentSyncDoneOrSyncDisabled$: Observable<unknown> = this.isEnabled$.pipe(
    switchMap((isEnabled) =>
      isEnabled ? this._afterCurrentSyncDoneIfAny$ : of(undefined),
    ),
  );

  constructor() {
    this._persistenceLocalService.load().then((d) => {
      console.log(d);

      this.currentProvider$.subscribe((provider) => {
        this.pf.importCompleteData({
          task: initialTaskState,
          project: initialProjectState,
        });
        this.pf.setActiveProvider(provider);
        // TODO real implementation
        this.pf.setCredentialsForActiveProvider({
          accessToken: d[SyncProvider.Dropbox].accessToken,
          refreshToken: d[SyncProvider.Dropbox].refreshToken,
        });
      });
    });
  }

  // TODO move someplace else

  async sync(): Promise<SyncResult> {
    const currentProvider = await this.currentProvider$.pipe(take(1)).toPromise();
    if (!currentProvider) {
      throw new Error('No Sync Provider for sync()');
    }

    try {
      await this.pf.sync();
    } catch (error: any) {
      console.error(error);
      if (error instanceof Error) {
        if (error instanceof PFNoRemoteDataError) {
          console.error('No data error');
        } else if (error instanceof PFNoRevError) {
          console.error('No data error');
        } else if (error instanceof PFNoRemoteMetaFile) {
          console.error('No data error');
        }
        // TODO ....
      }
      return 'ERROR';
    }
    return 'SUCCESS';

    // TODO handle some place else
    // if (
    //   currentProvider === this._localFileSyncAndroidService &&
    //   !androidInterface.isGrantedFilePermission()
    // ) {
    //   if (androidInterface.isGrantFilePermissionInProgress) {
    //     console.log('Abort sync since currently choosing folder to give access');
    //     return 'USER_ABORT';
    //   }
    //
    //   const res = await this._openPermissionDialog$().toPromise();
    //   if (res === 'DISABLED_SYNC') {
    //     this._log(currentProvider, 'Dialog => Disable Sync');
    //     return 'USER_ABORT';
    //   }
    // }

    // this._globalProgressBarService.countUp('SYNC');
    // this.isSyncing$.next(true);
    // try {
    //   const r = await this._sync(currentProvider);
    //   this.isSyncing$.next(false);
    //   this._globalProgressBarService.countDown();
    //   return r;
    // } catch (e) {
    //   this._globalProgressBarService.countDown();
    //   console.log('__error during sync__');
    //   console.error(e);
    //   const errStr = getSyncErrorStr(e);
    //
    //   if (errStr.includes(KNOWN_SYNC_ERROR_PREFIX)) {
    //     this._snackService.open({
    //       msg: errStr.replace(KNOWN_SYNC_ERROR_PREFIX, ''),
    //       type: 'ERROR',
    //     });
    //   } else {
    //     this._snackService.open({
    //       msg: T.F.SYNC.S.UNKNOWN_ERROR,
    //       type: 'ERROR',
    //       translateParams: {
    //         err: getSyncErrorStr(e),
    //       },
    //     });
    //   }
    //   this.isSyncing$.next(false);
    //   return 'ERROR';
    // }
  }

  // private async _sync(cp: PFSyncProviderServiceInterface<unknown>): Promise<SyncResult> {
  //   let isReady: boolean = false;
  //   try {
  //     isReady = await cp.isReady();
  //   } catch (e) {
  //     console.error(e);
  //     isReady = false;
  //   }
  //   if (!isReady) {
  //     console.log('syncProviderCfg', cp);
  //     this._snackService.open({
  //       msg: T.F.SYNC.S.INCOMPLETE_CFG,
  //       type: 'ERROR',
  //     });
  //     return 'ERROR';
  //   }
  //   return 'SUCCESS';
  // }

  private _c(str: string): boolean {
    return confirm(this._translateService.instant(str));
  }
}
