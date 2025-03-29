import { ErrorHandler, inject, Injectable, Injector } from '@angular/core';
import { isObject } from '../../util/is-object';
import { getErrorTxt } from '../../util/get-error-text';
import { IS_ELECTRON } from '../../app.constants';
import {
  createErrorAlert,
  isHandledError,
  logAdvancedStacktrace,
} from './global-error-handler.util';
import { saveBeforeLastErrorActionLog } from '../../util/action-logger';
import { error } from 'electron-log/renderer';
import { PfapiService } from '../../pfapi/pfapi.service';
import { CompleteBackup } from '../../pfapi/api';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private injector = inject<Injector>(Injector);

  // TODO Cleanup this mess
  async handleError(err: any): Promise<void> {
    const errStr = typeof err === 'string' ? err : err.toString();
    // eslint-disable-next-line
    const simpleStack = err && err.stack;
    console.error('GLOBAL_ERROR_HANDLER', err);

    // if not our custom error handler we have a critical error on our hands
    if (!isHandledError(err)) {
      const errorStr = this._getErrorStr(err) || errStr;
      saveBeforeLastErrorActionLog();
      createErrorAlert(errorStr, simpleStack, err, await this._getUserData());
    }

    if (IS_ELECTRON) {
      error('Frontend Error:', err, simpleStack);
    }

    const additionalLog = IS_ELECTRON
      ? (stack: unknown) => error('Frontend Error Stack:', stack)
      : () => null;

    logAdvancedStacktrace(err, additionalLog).then();

    if (!isHandledError(err)) {
      // NOTE: rethrow the error otherwise it gets swallowed
      throw new Error(err);
    }
  }

  private _getErrorStr(err: unknown): string {
    if (isObject(err)) {
      const str = getErrorTxt(err);
      return typeof str === 'string'
        ? str
        : 'Unable to parse error string. Please see console error';
    } else {
      return (err as any).toString();
    }
  }

  private async _getUserData(): Promise<CompleteBackup<any> | undefined> {
    try {
      return this.injector.get(PfapiService).getCompleteBackup();
    } catch (e) {
      console.log('Cannot load data');
      console.error(e);
      return undefined;
    }
  }
}
