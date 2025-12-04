import { LS } from '@app/utils/storage';
import { observable, makeObservable, action, runInAction, reaction } from 'mobx';

interface ITerminalModel {
  activeTab: 'stopOne' | 'squeeze';
}

export class TerminalModel implements ITerminalModel {
  @observable activeTab: 'stopOne' | 'squeeze' = LS.get('activeTab', 'stopOne');

  constructor() {
    makeObservable(this);
    reaction(
      () => this.activeTab,
      (activeTab) => {
        LS.set('activeTab', activeTab);
      }
    );
  }

  /**
   * Присваивает значения в модель (batch обновления)
   */
  @action.bound
  public commit(patch: Partial<ITerminalModel> = {}): this {
    runInAction(() => {
      Object.assign(this, patch);
    });
    return this;
  }
}
