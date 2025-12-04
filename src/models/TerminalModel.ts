import { observable, makeObservable, action, runInAction, reaction } from 'mobx';
import store from 'store2';

interface ITerminalModel {
  activeTab: 'stopOne' | 'squeeze';
}

export class TerminalModel implements ITerminalModel {
  @observable activeTab: 'stopOne' | 'squeeze' = store.get('terminal', 'stopOne');

  constructor() {
    makeObservable(this);
    reaction(
      () => this.activeTab,
      (activeTab) => {
        store.set('terminal', { activeTab });
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
