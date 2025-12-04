import * as React from 'react';
import { Terminal } from '@app/components/terminal';
import { Observable } from 'rxjs';
import { SciChartReact, TResolvedReturnType } from 'scichart-react';
import { simpleBinanceRestClient, TPriceBar } from '../components/binance/binanceRestClient';
import { binanceSocketClient, TRealtimePriceBar } from '../components/binance/binanceSocketClient';
import { createCandlestickChart } from '../components/chat/createCandlestickChart';

export const collectData = () => async (rootElement: string | HTMLDivElement) => {
  const { sciChartSurface, controls } = await createCandlestickChart(rootElement);
  const timeframe = '4h';
  const limit = 1000;
  const endDate = new Date(Date.now());
  const startDate = new Date();
  startDate.setHours(endDate.getHours() - limit);

  const priceBars: TPriceBar[] = await simpleBinanceRestClient.getCandles(
    'BTCUSDT',
    timeframe,
    startDate,
    endDate,
    limit,
    'com'
  );
  // Set the candles data on the chart
  controls.setData('BTC/USDT', priceBars);

  const startViewportRange = new Date();
  startViewportRange.setHours(endDate.getHours() - 200);
  endDate.setHours(endDate.getHours() + 20);
  controls.setXRange(startViewportRange, endDate);

  const obs: Observable<TRealtimePriceBar> = binanceSocketClient.getRealtimeCandleStream(
    'BTCUSDT',
    timeframe
  );
  const subscription = obs.subscribe((pb) => {
    const priceBar = {
      date: pb.openTime,
      open: pb.open,
      high: pb.high,
      low: pb.low,
      close: pb.close,
      volume: pb.volume,
    };
    controls.onNewTrade(priceBar);
  });

  return { sciChartSurface, subscription, controls };
};

export default function BasePage() {
  const initFunc = collectData();

  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      <SciChartReact
        key="key"
        initChart={initFunc}
        onInit={(initResult: TResolvedReturnType<typeof initFunc>) => {
          const { subscription } = initResult;

          return () => {
            subscription.unsubscribe();
          };
        }}
        style={{ display: 'flex', flexDirection: 'column', width: '75vw', flex: 'auto' }}
        innerContainerProps={{ style: { flexBasis: '80%', flexGrow: 1, flexShrink: 1 } }}
      />
      <Terminal />
    </div>
  );
}
