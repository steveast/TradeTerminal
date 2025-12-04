import * as React from 'react';
import { Terminal } from '@app/components/terminal';
import { Observable } from 'rxjs';
import { SciChartReact, TResolvedReturnType } from 'scichart-react';
import { simpleBinanceRestClient, TPriceBar } from '../components/binance/binanceRestClient';
import { binanceSocketClient, TRealtimePriceBar } from '../components/binance/binanceSocketClient';
import { createCandlestickChart } from '../components/chat/createCandlestickChart';

export const collectData = () => async (rootElement: string | HTMLDivElement) => {
  const { sciChartSurface, controls } = await createCandlestickChart(rootElement);

  const endDate = new Date(Date.now());
  const startDate = new Date();
  startDate.setMinutes(endDate.getMinutes() - 500);

  const priceBars: TPriceBar[] = await simpleBinanceRestClient.getCandles(
    'BTCUSDT',
    '1m',
    startDate,
    endDate,
    500,
    'com'
  );
  // Set the candles data on the chart
  controls.setData('BTC/USDT', priceBars);

  const startViewportRange = new Date();
  startViewportRange.setMinutes(endDate.getMinutes() - 100);
  endDate.setMinutes(endDate.getMinutes() + 10);
  controls.setXRange(startViewportRange, endDate);

  const obs: Observable<TRealtimePriceBar> = binanceSocketClient.getRealtimeCandleStream(
    'BTCUSDT',
    '1m'
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
        options={{
          licenseKey: '', // пусто, чтобы не пытался получать лицензию с localhost
        }}
      />
      <Terminal />
    </div>
  );
}
