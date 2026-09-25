"use client";
import { useEffect, useRef } from "react";

const TV_MAP = {
  BTCUSDT: "BINANCE:BTCUSDT",
  ETHUSDT: "BINANCE:ETHUSDT",
  SOLUSDT: "BINANCE:SOLUSDT",
  BNBUSDT: "BINANCE:BNBUSDT",
  XRPUSDT: "BINANCE:XRPUSDT",
  DOGEUSDT: "BINANCE:DOGEUSDT",
  ADAUSDT: "BINANCE:ADAUSDT",
  AVAXUSDT: "BINANCE:AVAXUSDT",
  DOTUSDT: "BINANCE:DOTUSDT",
};

export default function TVChart({ symbol = "BTCUSDT", height = 420 }) {
  const idRef = useRef(`tv_${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    const tvSymbol = TV_MAP[symbol] || `BINANCE:${symbol}`;
    function mount() {
      const el = document.getElementById(idRef.current);
      if (!el || !window.TradingView) return;
      el.innerHTML = "";
      new window.TradingView.widget({
        autosize: true,
        symbol: tvSymbol,
        interval: "15",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#0b0e11",
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        allow_symbol_change: false,
        container_id: idRef.current,
        studies: ["Volume@tv-basicstudies"],
      });
    }
    if (window.TradingView) { mount(); return; }
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    s.onload = mount;
    document.body.appendChild(s);
  }, [symbol]);
  return (
    <div style={{ height, width: "100%", background: "#0b0e11" }}>
      <div id={idRef.current} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
