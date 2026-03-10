import { useEffect } from "react";
import { usePriceStore } from "@/store/priceStore";
import { PriceEventSchema } from "@/types/market";

const RETRY_DELAY_MS = 3000;

export function usePriceStream() {
  const setPrice = usePriceStore((s) => s.setPrice);
  const setConnectionStatus = usePriceStore((s) => s.setConnectionStatus);

  useEffect(() => {
    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let cancelled = false;

    function connect() {
      setConnectionStatus("reconnecting");
      es = new EventSource("/api/stream/prices");

      es.onopen = () => setConnectionStatus("connected");

      es.onmessage = (event) => {
        const result = PriceEventSchema.safeParse(JSON.parse(event.data));
        if (result.success) setPrice(result.data);
      };

      es.onerror = () => {
        setConnectionStatus("reconnecting");
        es.close();
        if (!cancelled) retryTimeout = setTimeout(connect, RETRY_DELAY_MS);
      };
    }

    connect();

    return () => {
      cancelled = true;
      es?.close();
      clearTimeout(retryTimeout);
      setConnectionStatus("disconnected");
    };
  }, [setPrice, setConnectionStatus]);
}
