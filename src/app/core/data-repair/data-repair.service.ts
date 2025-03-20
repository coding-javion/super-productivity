import { Injectable, inject } from '@angular/core';
import { AppDataCompleteLegacy, AppDataCompleteNew } from '../../imex/sync/sync.model';
import { T } from '../../t.const';
import { TranslateService } from '@ngx-translate/core';
import { dataRepair } from './data-repair.util';
import { isDataRepairPossible } from './is-data-repair-possible.util';
import { getLastValidityError } from '../../imex/sync/is-valid-app-data.util';
import { IS_ELECTRON } from '../../app.constants';

@Injectable({
  providedIn: 'root',
})
export class DataRepairService {
  private _translateService = inject(TranslateService);

  repairData(
    dataIn: AppDataCompleteLegacy | AppDataCompleteNew,
  ): AppDataCompleteLegacy | AppDataCompleteNew {
    return dataRepair(dataIn);
  }

  isRepairPossibleAndConfirmed(
    dataIn: AppDataCompleteLegacy | AppDataCompleteNew,
  ): boolean {
    if (!isDataRepairPossible(dataIn)) {
      console.log({ dataIn });
      alert('Data damaged, repair not possible.');
      return false;
    }

    const isConfirmed = confirm(
      this._translateService.instant(T.CONFIRM.AUTO_FIX, {
        validityError: getLastValidityError() || 'Unknown validity error',
      }),
    );

    if (IS_ELECTRON && !isConfirmed) {
      window.ea.shutdownNow();
    }

    return isConfirmed;
  }
}
