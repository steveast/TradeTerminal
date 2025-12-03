import * as React from "react";
import { createCandlestickChart, sciChartOverview } from "../components/createCandlestickChart";
import { SciChartReact, SciChartNestedOverview, TResolvedReturnType } from "scichart-react";
import { binanceSocketClient, TRealtimePriceBar } from "../components/binanceSocketClient";
import { Observable } from "rxjs";
import { simpleBinanceRestClient, TPriceBar } from "../components/binanceRestClient";

// SCICHART EXAMPLE
// const drawExample = async (rootElement: string | HTMLDivElement) => {
//     const { sciChartSurface, sciChartOverview, controls } = await createCandlestickChart(rootElement);
export const drawExample = () => async (rootElement: string | HTMLDivElement) => {
  const { sciChartSurface, controls } = await createCandlestickChart(rootElement);

  const endDate = new Date(Date.now());
  const startDate = new Date();
  startDate.setMinutes(endDate.getMinutes() - 300);

  const priceBars: TPriceBar[] = await simpleBinanceRestClient.getCandles("BTCUSDT", "1m", startDate, endDate, 500, 'com');
  // Set the candles data on the chart
  controls.setData("BTC/USDT", "Bitcoin / US Dollar - 4 h", priceBars);

  const startViewportRange = new Date();
  startViewportRange.setMinutes(endDate.getMinutes() - 100);
  endDate.setMinutes(endDate.getMinutes() + 10);
  controls.setXRange(startViewportRange, endDate);

  const obs: Observable<TRealtimePriceBar> = binanceSocketClient.getRealtimeCandleStream("BTCUSDT", "1m");
  const subscription = obs.subscribe((pb) => {
    const priceBar = {
      date: pb.openTime,
      open: pb.open,
      high: pb.high,
      low: pb.low,
      close: pb.close,
      volume: pb.volume,
    };
    controls.onNewTrade(priceBar, pb.lastTradeSize, pb.lastTradeBuyOrSell);
  });

  return { sciChartSurface, subscription, controls };
};

export default function BasePage() {
  const chartControlsRef = React.useRef<{
    setData: (symbolName: string, watermarkText: string, priceBars: TPriceBar[]) => void;
    onNewTrade: (priceBar: TPriceBar, tradeSize: number, lastTradeBuyOrSell: boolean) => void;
    setXRange: (startDate: Date, endDate: Date) => void;
    enableCandlestick: () => void;
    enableOhlc: () => void;
  }>(undefined);

  const initFunc = drawExample();

  return (
    <div style={{ height: '100vh', display: "flex", flexDirection: "column" }}>
      <SciChartReact
        key="key"
        initChart={initFunc}
        onInit={(initResult: TResolvedReturnType<typeof initFunc>) => {
          const { subscription, controls } = initResult;
          chartControlsRef.current = controls;

          return () => {
            subscription.unsubscribe();
          };
        }}
        style={{ display: "flex", flexDirection: "column", width: "100%", flex: "auto" }}
        innerContainerProps={{ style: { flexBasis: "80%", flexGrow: 1, flexShrink: 1 } }}
      >
        <SciChartNestedOverview
          style={{ flexBasis: "20%", flexGrow: 1, flexShrink: 1 }}
          options={sciChartOverview}
        />
      </SciChartReact>
    </div>
  );
}
