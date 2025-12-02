// src/components/BtcChart.tsx
import { useEffect, useRef } from 'react';
import {
  SciChartSurface,
  NumericAxis,
  FastCandlestickRenderableSeries,
  OhlcDataSeries,
  SciChartJsNavyTheme,
  EAxisAlignment,
} from 'scichart';

export function BtcChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<SciChartSurface | null>(null);

  useEffect(() => {
    (async () => {
      if (!chartRef.current) { return; }

      // Загружаем WASM из CDN (для v4 — синхронно)
      SciChartSurface.useWasmFromCDN();

      // Создаём поверхность (Community License работает автоматически)
      const { sciChartSurface, wasmContext } = await SciChartSurface.create(chartRef.current, {
        theme: new SciChartJsNavyTheme(),
        title: 'BTC/USDT — 1h',
        titleStyle: { fontSize: 18, color: '#FFFFFF' },
      });

      surfaceRef.current = sciChartSurface;

      // Оси (исправлено growBy)
      const xAxis = new NumericAxis(wasmContext, {
        axisAlignment: EAxisAlignment.Bottom,
      });
      const yAxis = new NumericAxis(wasmContext, {
        axisAlignment: EAxisAlignment.Right,
        growBy: { min: 0.1, max: 0.1 },  // Объект, а не число!
        labelPostfix: ' $',
      });

      sciChartSurface.xAxes.add(xAxis);
      sciChartSurface.yAxes.add(yAxis);

      // Свечи
      const candleSeries = new FastCandlestickRenderableSeries(wasmContext, {
        dataSeries: new OhlcDataSeries(wasmContext),
        strokeUp: '#00ff88',
        fillUp: '#00ff8844',
        strokeDown: '#ff4444',
        fillDown: '#ff444444',
        strokeThickness: 1,
      });
      sciChartSurface.renderableSeries.add(candleSeries);

      // Данные с Binance (последние 200 1h свечей)
      try {
        const res = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=200');
        const klines = await res.json();

        const dataSeries = candleSeries.dataSeries as OhlcDataSeries;
        klines.forEach((k: [number, string, string, string, string, ...any[]], i: number) => {
          dataSeries.append(i, +k[1], +k[2], +k[3], +k[4]);  // x=индекс, OHLC=цены
        });

        sciChartSurface.zoomExtents();  // Автозум
        console.log('SciChart v4 + BTC/USDT загружен! (Community License OK) 🎉');
      } catch (e) {
        console.error('Ошибка Binance:', e);
      }
    })();

    return () => {
      surfaceRef.current?.delete();
    };
  }, []);

  return (
    <div
      ref={chartRef}
      style={{
        width: '100%',
        height: '600px',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    />
  );
}