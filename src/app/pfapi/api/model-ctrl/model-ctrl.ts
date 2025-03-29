import { ModelCfg, ModelBase } from '../pfapi.model';
import { Database } from '../db/database';
import { MetaModelCtrl } from './meta-model-ctrl';
import { pfLog } from '../util/log';

// type ExtractModelCfgType<T extends ModelCfg<unknown>> =
//   T extends ModelCfg<infer U> ? U : never;

export class ModelCtrl<MT extends ModelBase> {
  public readonly modelId: string;
  public readonly modelCfg: ModelCfg<MT>;

  private _inMemoryData: MT | null = null;
  private _db: Database;
  private _metaModel: MetaModelCtrl;

  constructor(
    modelId: string,
    modelCfg: ModelCfg<MT>,
    db: Database,
    metaModel: MetaModelCtrl,
  ) {
    this.modelCfg = modelCfg;
    this._metaModel = metaModel;
    this._db = db;
    this.modelId = modelId;
  }

  // TODO improve on isSyncModelChange
  save(data: MT, p?: { isSyncModelChange: boolean }): Promise<unknown> {
    this._inMemoryData = data;
    pfLog(2, `${ModelCtrl.name}.${this.save.name}()`, this.modelId, data);

    if (!p?.isSyncModelChange) {
      return this._db.save(this.modelId, data);
    }

    return Promise.all([
      this._metaModel.onModelSave(this.modelId, this.modelCfg),
      this._db.save(this.modelId, data),
    ]);
  }

  async partialUpdate(data: Partial<MT>): Promise<unknown> {
    if (typeof data !== 'object' || data === null) {
      throw new Error(`${ModelCtrl.name}:${this.modelId}: data is not an object`);
    }
    const newData = {
      // TODO fix
      // @ts-ignore
      ...(await this.load()),
      ...data,
    };
    return this.save(newData);
  }

  // TODO implement isSkipMigration
  async load(isSkipMigration?: boolean): Promise<MT> {
    pfLog(3, `${ModelCtrl.name}.${this.load.name}()`, this._inMemoryData);
    return (
      this._inMemoryData ||
      ((await this._db.load(this.modelId)) as Promise<MT>) ||
      (this.modelCfg.defaultData as MT)
    );
  }

  execAction(...p: any[]): any {
    throw new Error('not implemented');
  }
  execActions(...p: any[]): any {
    throw new Error('not implemented');
  }
  getById(id: string): any {
    throw new Error('not implemented');
  }
}
