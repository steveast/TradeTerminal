// npm i lodash
import lodashGet from 'lodash/get';
import lodashSet from 'lodash/set';
import lodashUnset from 'lodash/unset';
import { toJS } from 'mobx';

export class LS {
  private static ROOT_KEY = 'TradeTerminal';

  // если нужно — можно поменять namespace
  static setRootKey(key: string) {
    this.ROOT_KEY = key;
  }

  private static load(): Record<string, any> {
    try {
      const raw = localStorage.getItem(this.ROOT_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private static save(obj: Record<string, any>) {
    localStorage.setItem(this.ROOT_KEY, JSON.stringify(obj));
  }

  static get<T = any>(path: string, fallback?: T): T {
    const obj = this.load();
    const value = lodashGet(obj, path);
    return value !== undefined ? value : (fallback as T);
  }

  static set(path: string, value: any) {
    const obj = this.load();
    lodashSet(toJS(obj), path, value);
    this.save(obj);
  }

  static delete(path: string) {
    const obj = this.load();
    lodashUnset(obj, path);
    this.save(obj);
  }

  static clear() {
    localStorage.removeItem(this.ROOT_KEY);
  }
}
