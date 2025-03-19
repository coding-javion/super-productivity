import {
  AllSyncModels,
  BaseCfg,
  ConflictData,
  ExtractModelCfgType,
  ModelBase,
  ModelCfgs,
  ModelCfgToModelCtrl,
} from './pfapi.model';
import { SyncService } from './sync/sync.service';
import { Database } from './db/database';
import { IndexedDbAdapter } from './db/indexed-db-adapter';
import { MetaModelCtrl } from './model-ctrl/meta-model-ctrl';
import { ModelCtrl } from './model-ctrl/model-ctrl';
import { MiniObservable } from './util/mini-observable';
import { SyncProviderServiceInterface } from './sync/sync-provider.interface';
import { pfLog } from './util/log';
import { SyncProviderId, SyncStatus } from './pfapi.const';
import { EncryptAndCompressHandlerService } from './sync/encrypt-and-compress-handler.service';
import { SyncProviderCredentialsStore } from './sync/sync-provider-credentials-store';
import { NoSyncProviderSet } from './errors/errors';

// type EventMap = {
// 'sync:start': undefined;
// 'sync:complete': { success: boolean; timestamp: number };
// 'sync:error': Error;
// 'model:changed': { modelId: string; timestamp: number };
// 'credentials:update': { credentials: unknown };
// };

// export class <PCfg extends Cfg, Ms extends ModelCfg<any>[]> {
export class Pfapi<const MD extends ModelCfgs> {
  private static _wasInstanceCreated = false;

  private readonly _syncProvider$: MiniObservable<SyncProviderServiceInterface<unknown> | null> =
    new MiniObservable<SyncProviderServiceInterface<unknown> | null>(null);

  private readonly _syncService: SyncService<MD>;

  // private readonly _eventHandlers = new Map<
  //   keyof EventMap,
  //   Record<symbol, (data: unknown) => void>
  // >();

  public readonly db: Database;
  public readonly metaModel: MetaModelCtrl;
  public readonly m: ModelCfgToModelCtrl<MD>;
  public readonly syncProviders: SyncProviderServiceInterface<unknown>[];

  constructor(
    modelCfgs: MD,
    syncProviders: SyncProviderServiceInterface<unknown>[],
    cfg?: BaseCfg,
  ) {
    if (Pfapi._wasInstanceCreated) {
      throw new Error(': This should only ever be instantiated once');
    }
    Pfapi._wasInstanceCreated = true;

    this.db = new Database({
      onError: cfg?.onDbError || (() => undefined),
      adapter:
        cfg?.dbAdapter ||
        new IndexedDbAdapter({
          // TODO to variable
          dbName: 'pf',
          dbMainName: 'main',
          version: 1,
        }),
    });

    this.metaModel = new MetaModelCtrl(this.db);
    this.m = this._createModels(modelCfgs);
    pfLog(2, `m`, this.m);

    this.syncProviders = syncProviders;
    this.syncProviders.forEach((sp) => {
      sp.credentialsStore = new SyncProviderCredentialsStore<unknown>(this.db, sp.id);
    });

    this._syncService = new SyncService<MD>(
      this.m,
      this._syncProvider$,
      this.metaModel,
      new EncryptAndCompressHandlerService(),
    );
  }

  // TODO type
  async sync(): Promise<{ status: SyncStatus; conflictData?: ConflictData }> {
    pfLog(3, `${this.sync.name}()`);
    const result = await this._syncService.sync();
    pfLog(2, `${this.sync.name}() result:`, result);
    return result;
  }

  setActiveSyncProvider(activeProviderId: SyncProviderId): void {
    const provider = this.syncProviders.find((sp) => sp.id === activeProviderId);
    pfLog(2, `${this.setActiveSyncProvider.name}()`, activeProviderId, provider);
    this._syncProvider$.next(provider || null);
  }

  getActiveSyncProvider(): SyncProviderServiceInterface<unknown> | null {
    return this._syncProvider$.value;
  }

  // TODO typing
  setCredentialsForActiveProvider(credentials: unknown): Promise<void> {
    pfLog(
      3,
      `${this.setCredentialsForActiveProvider.name}()`,
      credentials,
      this._syncProvider$.value,
    );
    if (!this._syncProvider$.value) {
      throw new NoSyncProviderSet();
    }
    return this._syncProvider$.value.setCredentials(credentials);
  }

  async getAllSyncModelData(): Promise<AllSyncModels<MD>> {
    pfLog(3, `${this.getAllSyncModelData.name}()`);
    const modelIds = Object.keys(this.m);
    const promises = modelIds.map((modelId) => {
      const modelCtrl = this.m[modelId];
      return modelCtrl.load();
    });

    const allDataArr = await Promise.all(promises);
    const allData = allDataArr.reduce((acc, cur, idx) => {
      acc[modelIds[idx]] = cur;
      return acc;
    }, {});
    return allData as AllSyncModels<MD>;
  }

  // TODO type
  async importAllSycModelData(data: AllSyncModels<MD>): Promise<unknown> {
    pfLog(2, `${this.importAllSycModelData.name}()`, data);
    const modelIds = Object.keys(data);
    const promises = modelIds.map((modelId) => {
      const modelData = data[modelId];
      const modelCtrl = this.m[modelId];
      return modelCtrl.save(modelData);
    });
    return Promise.all(promises);
  }

  // public on<K extends keyof EventMap>(
  //   eventName: K,
  //   callback: (data: EventMap[K]) => void,
  // ): () => void {
  //   // Implement event handling
  //   const eventId = Symbol();
  //   this._eventHandlers.set(eventName, {
  //     ...(this._eventHandlers.get(eventName) || {}),
  //     [eventId]: callback,
  //   });
  //
  //   // Return unsubscribe function
  //   return () => {
  //     const handlers = this._eventHandlers.get(eventName);
  //     if (handlers) {
  //       delete handlers[eventId];
  //     }
  //   };
  // }

  pause(): void {}

  private _createModels(modelCfgs: MD): ModelCfgToModelCtrl<MD> {
    const result = {} as Record<string, ModelCtrl<ModelBase>>;
    // TODO validate modelCfgs
    for (const [id, item] of Object.entries(modelCfgs)) {
      result[id] = new ModelCtrl<ExtractModelCfgType<typeof item>>(
        id,
        item,
        this.db,
        this.metaModel,
      );
    }
    // TODO fix type :(
    console.log('CHECK if expected', result);

    return result as unknown as ModelCfgToModelCtrl<MD>;
  }

  // getAllModelData(): unknown {}

  // /**
  //  * Updates configuration and propagates changes
  //  * @param cfg Updated configuration
  //  */
  // // TODO think about this
  // public updateCfg(cfg: Partial<BaseCfg>): void {
  //   const currentCfg = this._cfg$.value;
  //   const newCfg = { ...currentCfg, ...cfg };
  //   this._cfg$.next(newCfg);
  // }
}
