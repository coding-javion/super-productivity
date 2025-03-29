import { ModelCtrl } from './api/model-ctrl/model-ctrl';
import { EntityState } from '@ngrx/entity';
import { AdditionalLogErrorBase } from '../core/errors/errors';
import { Action } from '@ngrx/store';
import { ActionReducer } from '@ngrx/store/src/models';
import { MiniObservable } from './api/util/mini-observable';
import { Observable } from 'rxjs';
import { PfapiEventPayloadMap, PfapiEvents } from './api/pfapi.model';
import { PFEventEmitter } from './api/util/events';

export class ModelNotFoundError extends AdditionalLogErrorBase {
  override name = ModelNotFoundError.name;
}

export const modelGetById = async <M, T extends EntityState<M>>(
  id: string,
  pfapiModel: ModelCtrl<T>,
): Promise<M> => {
  const data = await pfapiModel.load();
  const entry = data.entities[id];
  if (!entry) {
    throw new ModelNotFoundError(`Model with id ${id} not found`, { data, id });
  }
  return entry;
};

export const modelExecAction = async <M, T extends EntityState<M>>(
  pfapiModel: ModelCtrl<T>,
  action: Action,
  reducerFn: ActionReducer<T, { type: string; payload?: any }>,
  isUpdateRevAndLastUpdate: boolean = false,
): Promise<T> => {
  const data = await pfapiModel.load();
  const newState = reducerFn(data, action);
  await pfapiModel.save(newState, { isUpdateRevAndLastUpdate: isUpdateRevAndLastUpdate });
  return newState;
};

export const modelExecActions = async <M, T extends EntityState<M>>(
  pfapiModel: ModelCtrl<T>,
  actions: Action[],
  reducerFn: ActionReducer<T, { type: string; payload?: any }>,
  isUpdateRevAndLastUpdate: boolean = false,
): Promise<T> => {
  const data = await pfapiModel.load();
  const newState = actions.reduce((acc, act) => reducerFn(acc, act), data);
  await pfapiModel.save(newState, { isUpdateRevAndLastUpdate: isUpdateRevAndLastUpdate });
  return newState;
};

export const miniObservableToObservable = <T>(
  miniObs: MiniObservable<T>,
): Observable<T> => {
  return new Observable((observer) => {
    const unsub = miniObs.subscribe((v) => observer.next(v));
    return () => unsub();
  });
};

/**
 * Creates an Observable that emits events of a specific type from a PFEventEmitter
 * with proper payload typing.
 *
 * @param target The PFEventEmitter instance
 * @param eventName The specific event to listen for
 * @returns An Observable that emits the properly typed event payloads
 */
export const fromPfapiEvent = <K extends PfapiEvents>(
  target: PFEventEmitter,
  eventName: K,
): Observable<PfapiEventPayloadMap[K]> =>
  new Observable<PfapiEventPayloadMap[K]>((subscriber) => {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const handler = (data: PfapiEventPayloadMap[K]) => {
      subscriber.next(data);
    };

    // Add event listener
    target.addEventListener(eventName, handler);

    // Return teardown logic
    return () => {
      target.removeEventListener(eventName, handler);
    };
  });
