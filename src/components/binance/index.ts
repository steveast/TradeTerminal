// binanceFuturesClient.final.v19-fixed.ts
// Актуально для @binance/derivatives-trading-usds-futures@^19.0.1 (декабрь 2025)

import {
  DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL,
  DERIVATIVES_TRADING_USDS_FUTURES_REST_API_TESTNET_URL,
  DERIVATIVES_TRADING_USDS_FUTURES_WS_API_PROD_URL,
  DERIVATIVES_TRADING_USDS_FUTURES_WS_API_TESTNET_URL,
  DERIVATIVES_TRADING_USDS_FUTURES_WS_STREAMS_PROD_URL,
  DERIVATIVES_TRADING_USDS_FUTURES_WS_STREAMS_TESTNET_URL,
  DerivativesTradingUsdsFutures,
} from '@binance/derivatives-trading-usds-futures';
import { BehaviorSubject, EMPTY, from, Subject, timer } from 'rxjs';
import { catchError, delayWhen, retryWhen, switchMap, take, takeUntil, tap } from 'rxjs/operators';

const MAX_RETRIES = 10;
const BASE_DELAY = 1000;

export type Candle = {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
};

export type Position = {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unrealizedPnL: string;
  leverage: string;
  positionSide: 'BOTH' | 'LONG' | 'SHORT';
};

export class BinanceFuturesClient {
  private isTestnet: boolean;
  private client: DerivativesTradingUsdsFutures;
  private wsStreamsConnection?: any; // WebsocketStreamsConnection
  private wsApiConnection?: any; // WebsocketAPIBase
  private listenKey?: string;
  private userDataStream?: any; // WebsocketStream for user data
  private klineStream?: any; // WebsocketStream for klines

  private candleSubject = new BehaviorSubject<Candle | null>(null);
  private positionSubject = new BehaviorSubject<Position[]>([]);
  private statusSubject = new BehaviorSubject<'disconnected' | 'connecting' | 'connected'>(
    'disconnected'
  );
  private destroy$ = new Subject<void>();

  public candles$ = this.candleSubject.asObservable();
  public positions$ = this.positionSubject.asObservable();
  public status$ = this.statusSubject.asObservable();

  constructor(
    private apiKey: string,
    private apiSecret: string,
    options: { testnet?: boolean } = {}
  ) {
    this.isTestnet = options.testnet ?? false;
    const basePath = this.isTestnet
      ? DERIVATIVES_TRADING_USDS_FUTURES_REST_API_TESTNET_URL
      : DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL;

    // Для WS: wsURL вместо baseUrl (по примерам на npm)
    const wsStreamsWsUrl = this.isTestnet
      ? DERIVATIVES_TRADING_USDS_FUTURES_WS_STREAMS_TESTNET_URL
      : DERIVATIVES_TRADING_USDS_FUTURES_WS_STREAMS_PROD_URL;
    const wsApiWsUrl = this.isTestnet
      ? DERIVATIVES_TRADING_USDS_FUTURES_WS_API_TESTNET_URL
      : DERIVATIVES_TRADING_USDS_FUTURES_WS_API_PROD_URL;

    this.client = new DerivativesTradingUsdsFutures({
      configurationRestAPI: { apiKey, apiSecret, basePath },
      configurationWebsocketStreams: { wsURL: wsStreamsWsUrl },
      configurationWebsocketAPI: { wsURL: wsApiWsUrl },
    });
  }

  async connect(symbol: string = 'BTCUSDT', interval: string = '1m') {
    if (this.statusSubject.value === 'connecting') {
      return;
    }
    this.statusSubject.next('connecting');

    timer(0, 5000)
      .pipe(
        switchMap(() => this.createConnection(symbol, interval)),
        retryWhen((errors) =>
          errors.pipe(
            tap((err) => console.warn('Reconnecting...', err.message || err)),
            delayWhen((_, i) => timer(Math.min(BASE_DELAY * 2 ** i, 60_000))),
            take(MAX_RETRIES)
          )
        ),
        catchError((err) => {
          console.error('Connection failed permanently', err);
          this.statusSubject.next('disconnected');
          return EMPTY;
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.statusSubject.next('connected');
        console.log('Binance Futures connected');
      });
  }

  private async createConnection(symbol: string, interval: string) {
    this.listenKey = await this.getListenKeyWithRetry();

    // Подключаем WS Streams (без extra params — wsURL из config)
    this.wsStreamsConnection = await this.client.websocketStreams.connect({
      stream: [`${symbol.toLowerCase()}@kline_${interval}`, `userData@${this.listenKey}`], // Мульти-стрим
      mode: 'single',
    });

    // Создаём стримы (подписка через создание после connect)
    this.userDataStream = this.wsStreamsConnection.userData(this.listenKey);
    this.klineStream = this.wsStreamsConnection.kline(symbol, interval);

    // Обработчики сообщений (string data, parse JSON)
    this.userDataStream.on('message', (data: string) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.e === 'ACCOUNT_UPDATE' || parsed.e === 'ORDER_TRADE_UPDATE') {
          this.updatePositions();
        }
      } catch (e) {
        console.warn('User data parse error:', e);
      }
    });

    this.klineStream.on('message', (data: string) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.k?.x) {
          // Закрытая свеча
          this.candleSubject.next({
            openTime: parsed.k.t,
            open: parsed.k.o,
            high: parsed.k.h,
            low: parsed.k.l,
            close: parsed.k.c,
            volume: parsed.k.v,
            closeTime: parsed.k.T,
            quoteVolume: parsed.k.q,
          });
        }
      } catch (e) {
        console.warn('Kline parse error:', e);
      }
    });

    // WS API для ордеров (без extra params — wsURL из config)
    this.wsApiConnection = await this.client.websocketAPI.connect();

    // Авто-продление listenKey (каждые 25 мин, без параметров)
    timer(0, 25 * 60 * 1000)
      .pipe(
        switchMap(() => from(this.client.restAPI.keepaliveUserDataStream())),
        catchError(() => EMPTY),
        takeUntil(this.destroy$)
      )
      .subscribe();

    await this.updatePositions();
  }

  private async getListenKeyWithRetry(): Promise<string> {
    const res = await this.client.restAPI.startUserDataStream();
    return res.listenKey; // Тип: string
  }

  // Hedge Mode (dualSidePosition as string "true"/"false")
  async enableHedgeMode() {
    await this.client.restAPI.changePositionMode({ dualSidePosition: 'true' });
    console.log('Hedge Mode enabled');
  }

  async disableHedgeMode() {
    await this.client.restAPI.changePositionMode({ dualSidePosition: 'false' });
    console.log('Hedge Mode disabled');
  }

  // Leverage
  async setLeverage(symbol: string, leverage: number) {
    if (leverage < 1 || leverage > 125) {
      throw new Error('Invalid leverage');
    }
    await this.client.restAPI.changeLeverage({ symbol, leverage });
    console.log(`${symbol}: leverage ${leverage}x`);
  }

  // Ордера в USD
  private async getCurrentPrice(symbol: string): Promise<number> {
    const ticker = await this.client.restAPI.tickerPrice({ symbol });
    return parseFloat(ticker.price);
  }

  private async getLotSize(symbol: string) {
    const info = await this.client.restAPI.exchangeInformation();
    const s = info.symbols.find((s: any) => s.symbol === symbol); // symbols по docs
    const lot = s.filters.find((f: any) => f.filterType === 'LOT_SIZE');
    const price = s.filters.find((f: any) => f.filterType === 'PRICE_FILTER');

    return {
      minQty: parseFloat(lot.minQty),
      stepSize: parseFloat(lot.stepSize),
      precision: lot.stepSize.toString().split('.')[1]?.length || 0,
      tickPrecision: price.tickSize.toString().split('.')[1]?.length || 2,
    };
  }

  private roundToStep(value: number, step: number): number {
    return Math.floor(value / step) * step;
  }

  async marketOrderByUsd(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    usdAmount: number;
    positionSide?: 'BOTH' | 'LONG' | 'SHORT';
  }) {
    const { symbol, side, usdAmount, positionSide = 'BOTH' } = params;
    if (usdAmount <= 0) {
      throw new Error('usdAmount must be > 0');
    }
    const price = await this.getCurrentPrice(symbol);
    let qty = usdAmount / price;
    const lot = await this.getLotSize(symbol);
    qty = this.roundToStep(qty, lot.stepSize);

    if (qty < lot.minQty) {
      throw new Error(`Order too small: ${qty} < ${lot.minQty}`);
    }

    console.log(
      `Market ${side} ${symbol}: $${usdAmount} → ${qty.toFixed(lot.precision)} @ ~$${price.toFixed(2)}`
    );

    return this.newOrder({
      symbol,
      side,
      type: 'MARKET',
      quantity: qty.toFixed(lot.precision),
      positionSide,
    });
  }

  async limitOrderByUsd(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    usdAmount: number;
    price: number;
    positionSide?: 'BOTH' | 'LONG' | 'SHORT';
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
  }) {
    const { symbol, side, usdAmount, price, positionSide = 'BOTH', timeInForce = 'GTC' } = params;
    let qty = usdAmount / price;
    const lot = await this.getLotSize(symbol);
    qty = this.roundToStep(qty, lot.stepSize);

    if (qty < lot.minQty) {
      throw new Error(`Order too small: ${qty} < ${lot.minQty}`);
    }

    return this.newOrder({
      symbol,
      side,
      type: 'LIMIT',
      quantity: qty.toFixed(lot.precision),
      price: price.toFixed(lot.tickPrecision),
      timeInForce,
      positionSide,
    });
  }

  // Базовые
  async getKlines(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
    const data = await this.client.restAPI.klines({ symbol, interval, limit });
    return data.map((k: any) => ({
      openTime: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: k[5],
      closeTime: k[6],
      quoteVolume: k[7],
    }));
  }

  async getPositions(): Promise<Position[]> {
    const acc = await this.client.restAPI.account();
    return acc.positions
      .filter((p: any) => Number(p.positionAmt) !== 0)
      .map((p: any) => ({
        symbol: p.symbol,
        positionAmt: p.positionAmt,
        entryPrice: p.entryPrice,
        markPrice: p.markPrice || '0',
        unrealizedPnL: p.unrealizedProfit || '0',
        leverage: p.leverage || '1',
        positionSide: p.positionSide as 'BOTH' | 'LONG' | 'SHORT',
      }));
  }

  private async updatePositions() {
    try {
      const pos = await this.getPositions();
      this.positionSubject.next(pos);
    } catch (e) {
      console.warn('Failed to update positions:', e);
    }
  }

  async newOrder(params: any) {
    if (!this.wsApiConnection) {
      throw new Error('Not connected to WS API');
    }
    return this.wsApiConnection.newOrder(params); // Через WebsocketAPIBase
  }

  async closePosition(symbol: string, positionSide: 'LONG' | 'SHORT' | 'BOTH' = 'BOTH') {
    const positions = await this.getPositions();
    const pos = positions.find((p) => p.symbol === symbol && p.positionSide === positionSide);
    if (!pos || Number(pos.positionAmt) === 0) {
      return;
    }

    const side = Number(pos.positionAmt) > 0 ? 'SELL' : 'BUY';
    const qty = String(Math.abs(Number(pos.positionAmt)));

    return this.newOrder({
      symbol,
      side,
      type: 'MARKET',
      positionSide,
      quantity: qty,
    });
  }

  destroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.userDataStream) {
      this.userDataStream.close();
    }
    if (this.klineStream) {
      this.klineStream.close();
    }
    if (this.wsStreamsConnection) {
      this.wsStreamsConnection.close();
    }
    if (this.wsApiConnection) {
      this.wsApiConnection.close();
    }
    this.statusSubject.next('disconnected');
  }
}
